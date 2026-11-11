import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PolarisApp from '@/components/polaris/PolarisApp';
import { PolarisDataProvider } from '@/lib/polaris-api';

const session = { session_id: 's1', ue_pseudonym: 'ue-test', technology: '5G SA', state: 'ACTIVE', procedure:'Registration', decode_completeness:100, interfaces:['N2'], message_count:1, ue_ip:'198.51.100.10' };
const event = { event_id:'e1', capture_id:'c1', interface:'N2', protocol:'NGAP', message_name:'Registration Accept', source_participant:'AMF', destination_participant:'UE', direction:'CORE_TO_RAN', decoding_status:'DECODED', semantic_status:'SUCCESS', procedure_group:'Registration', packet_references:[{packet_number:45}], decoded_ie_tree:{result:'accepted'}, errors:[] };
const payloads: Record<string,unknown> = {
  '/auth/me':{role:'operator'}, '/health':{status:'healthy',coordination_open:false}, '/version':{backend_api:'2.11.6',web_frontend:'2.11.6',platform_core:'2.11.6',session_engine:'0.5.7',correlation_engine:'0.6.6',event_schema:'1.6.1',callflow_schema:'1.3.2',decoders:{ngap:'0.6.0'}},
  '/metrics':{capture_state:'active',pending_segments:7,segments_ingested:18,ingestion_failures:0,open_segments:2,zero_event_segments:1,dumpcap_active:6,dumpcap_expected:12}, '/storage/safety':{free_percent:25},
  '/sessions':[session], '/sessions/filter':[session], '/sessions/s1':session, '/sessions/s1/events':[event], '/sessions/s1/callflow':{events:[event]}, '/sessions/s1/procedures':[], '/sessions/s1/correlations':{edges:[{edge_id:'edge-1',source_event_id:'e1',target_event_id:'e1',source_interface:'N2',target_interface:'N2',matching_identifiers:['ctx=test'],rule_id:'context-rule',rule_version:'1',matched_rules:['context-rule'],evidence_description:'same context',evidence_type:'EXACT_CONTEXT',confidence:'EXACT',scope:'session',limitations:[],packet_references:[]}]},
  '/events/e1':event, '/events/e1/provenance':{capture_id:'c1',event_id:'e1',packet_number:45}, '/packets':[{id:'p1'}],
  '/probes':[{id:'p1',name:'lab-probe',role:'Capture',status:'healthy',version:'probe-test'}], '/probes/p1':{id:'p1',version:'probe-test'}, '/probes/p1/interfaces':[{name:'N2'}],
  '/interfaces':[{name:'N2'}], '/captures':[], '/modules':[], '/datasets':[{id:'d1',name:'Dataset test'}], '/sessions/available_causes':['#27'], '/correlation/rules':[]
};
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(()=>{
  localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe(){} disconnect(){} });
  fetcher = vi.fn(async (url: string) => { const path=url.replace('/api/v1','').split('?')[0] ?? ''; return new Response(JSON.stringify({data:payloads[path] ?? [],meta:{total:1}}),{headers:{'Content-Type':'application/json'}}); });
  vi.stubGlobal('fetch',fetcher);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function open(hash: string) {
  window.history.replaceState({},'', '/#'+hash);
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  return render(<QueryClientProvider client={client}><PolarisDataProvider><PolarisApp/></PolarisDataProvider></QueryClientProvider>);
}
describe('main screens with simulated REST responses',()=>{
  it('Home shows server metrics without Traffic or fabricated recent activity', async()=>{
    open('home'); await screen.findByText('18'); expect(screen.queryByText('Traffic')).not.toBeInTheDocument(); expect(screen.getByText("Aucune activité pour l'instant")).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'operator'})).not.toBeInTheDocument();
  });
  it('Analyzer executes filter, displays session and reads callflow and provenance', async()=>{
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'}));
    fireEvent.click(screen.getByRole('button',{name:'Exécuter la requête'}));
    await screen.findAllByText('ue-test');
    await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url).endsWith('/sessions/s1/callflow'))).toBe(true));
    await screen.findAllByText('cc1 · 45');
    await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url).endsWith('/events/e1/provenance'))).toBe(true));
    expect(document.body.textContent).not.toContain('private');
    expect(document.body.textContent).not.toContain('198.51.100.10');
    expect(fetcher.mock.calls.some(([url,options])=>String(url)==='/api/v1/sessions/filter' && options.method==='POST')).toBe(true);
  });
  it('Analyzer can display every session with an unfiltered request', async()=>{
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Afficher toutes les sessions'}));
    await screen.findAllByText('ue-test');
    const request=fetcher.mock.calls.find(([url,options])=>String(url)==='/api/v1/sessions/filter' && options.method==='POST');
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({});
    expect(screen.getAllByText('Toutes les sessions').length).toBeGreaterThan(0);
    expect(screen.getByRole('checkbox',{name:'Démo'})).not.toBeChecked();
  });
  it('keeps a session without session_id non-clickable and never requests a fallback id', async()=>{
    const previousSessions=payloads['/sessions']; const previousFilter=payloads['/sessions/filter'];
    payloads['/sessions']=[{...session,session_id:undefined}]; payloads['/sessions/filter']=[{...session,session_id:undefined}];
    try {
      open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'})); fireEvent.click(screen.getByRole('button',{name:'Exécuter la requête'}));
      const absent=await screen.findByText('identifiant absent'); fireEvent.click(absent);
      expect(fetcher.mock.calls.some(([url])=>/\/sessions\/(row-|undefined|null)/.test(String(url)))).toBe(false);
    } finally { payloads['/sessions']=previousSessions; payloads['/sessions/filter']=previousFilter; }
  });
  it('shows the failed detail endpoint and HTTP status', async()=>{
    fetcher.mockImplementation(async (url: string) => {
      const path=url.replace('/api/v1','').split('?')[0] ?? '';
      if (path==='/sessions/s1') return new Response(JSON.stringify({error:{code:'NOT_FOUND'}}),{status:404,headers:{'Content-Type':'application/json'}});
      return new Response(JSON.stringify({data:payloads[path] ?? [],meta:{total:1}}),{headers:{'Content-Type':'application/json'}});
    });
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'})); fireEvent.click(screen.getByRole('button',{name:'Exécuter la requête'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Détail indisponible · /sessions/s1 · HTTP 404');
  });
  it('renders repeated procedure group names without duplicate React keys', async()=>{
    const previous=payloads['/sessions/s1/callflow'];
    payloads['/sessions/s1/callflow']={events:[
      {...event,event_id:'pfcp-a',procedure_group:'PFCP Session'},
      {...event,event_id:'registration',procedure_group:'UE Registration and Context'},
      {...event,event_id:'pfcp-b',procedure_group:'PFCP Session'},
    ]};
    const consoleError=vi.spyOn(console,'error').mockImplementation(()=>{});
    try {
      open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'})); fireEvent.click(screen.getByRole('button',{name:'Exécuter la requête'}));
      await screen.findAllByText(/Registration Accept/); fireEvent.click(await screen.findByRole('button',{name:/^Filter/}));
      expect(screen.getByRole('dialog',{name:'Filtres du Ladder'})).toBeTruthy();
      expect(await screen.findAllByRole('checkbox',{name:'PFCP Session'})).toHaveLength(1);
      expect(screen.getByRole('complementary',{name:'Analyse sessions'})).toBeTruthy();
      expect(consoleError.mock.calls.flat().join(' ')).not.toContain('same key');
    } finally { payloads['/sessions/s1/callflow']=previous; consoleError.mockRestore(); }
  });
  it('Nodes uses probes and server version; capture targets remain disabled', async()=>{
    open('nodes'); await screen.findByText('lab-probe'); expect(screen.getByText('probe-test')).toBeInTheDocument();
    await screen.findByRole('textbox',{name:'Cible de capture'}); expect(screen.getByRole('textbox',{name:'Cible de capture'})).toBeDisabled();
  });
  it('KPI displays health ratio from metrics, not a generated series', async()=>{
    open('kpi'); await screen.findByText('50.0 %'); fireEvent.click(screen.getByRole('button',{name:'KPI Builder'}));
    expect(screen.getByText('Non disponible : backend à venir')).toBeInTheDocument();
  });
  it('Live stays unavailable without Demo and disables identity search', async()=>{
    open('live'); expect(screen.getByRole('button',{name:'Rechercher'})).toBeDisabled();
    expect(screen.getByText('Non disponible : backend à venir — Live (WebSocket)')).toBeInTheDocument();
  });
  it('Settings reads every lab component and UI package version', async()=>{
    open('settings'); fireEvent.click(screen.getByRole('button',{name:/À propos/})); await screen.findAllByText('2.11.6'); expect(screen.getByText('0.10.0')).toBeInTheDocument(); expect(screen.getByText('0.6.6')).toBeInTheDocument(); expect(screen.getByText('ngap')).toBeInTheDocument(); expect(screen.getByText('POLARIS 2.11.6 · API 2.11.6 · UI 0.10.0')).toBeInTheDocument();
  });
  it('Dashboard library is marked local and has no simulated saved queries outside Demo',()=>{
    open('templates'); expect(screen.getByText('local à ce navigateur')).toBeInTheDocument(); expect(screen.getByText('Aucune requête.')).toBeInTheDocument();
  });
  it('offline remains empty, no automatic demo fallback', async()=>{
    fetcher.mockRejectedValue(new TypeError('offline')); open('home'); await screen.findAllByText('POLARIS non connecté');
    expect(screen.queryByText('18')).not.toBeInTheDocument(); expect(screen.queryByText('Données de démo')).not.toBeInTheDocument();
  });
  it('Demo switch shows isolated data and does not grant a role', async()=>{
    fetcher.mockRejectedValue(new TypeError('offline')); open('home'); fireEvent.click(screen.getByRole('checkbox',{name:'Démo'}));
    await screen.findByText('436'); expect(screen.queryByRole('button',{name:'operator'})).not.toBeInTheDocument();
  });
  it('removes every demo tab when Demo is turned off', async()=>{
    open('sessions'); const toggle=screen.getByRole('checkbox',{name:'Démo'}); fireEvent.click(toggle);
    expect(await screen.findAllByText('Échecs · run 482')).not.toHaveLength(0);
    fireEvent.click(toggle); await waitFor(()=>expect(screen.queryAllByText('Échecs · run 482')).toHaveLength(0));
  });
});
