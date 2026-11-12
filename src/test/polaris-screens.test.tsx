import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PolarisApp from '@/components/polaris/PolarisApp';
import { PolarisDataProvider } from '@/lib/polaris-api';

const session = { session_id: 's1', anchor_capture_id:'c1', first_packet_number:45, ue_pseudonym: 'ue-test', technology: '5G SA', state: 'ACTIVE', procedure:'Registration', decode_completeness:100, interfaces:['N2'], message_count:1, ue_ip:'198.51.100.10' };
const event = { event_id:'e1', capture_id:'c1', interface:'N2', protocol:'NGAP', message_name:'Registration Accept', source_participant:'AMF', destination_participant:'UE', direction:'CORE_TO_RAN', decoding_status:'DECODED', semantic_status:'SUCCESS', procedure_group:'Registration', packet_references:[{packet_number:45}], decoded_ie_tree:{result:'accepted'}, errors:[] };
const clearSubscriber=['001','01','012','345','6789'].join('');
const clearTemporary=['0x','C0','FF','EE','01'].join('');
const identities={imsi:clearSubscriber,tmsi:[{value:clearTemporary}],s_tmsi:[{value:['01',clearTemporary.slice(2)].join('')}],m_tmsi:[{value:clearTemporary.slice(2)}],imei:{value:['35','2099','00','176','148'].join('')},msisdn:['33','6','00','00','00','01'].join('')};
const payloads: Record<string,unknown> = {
  '/auth/me':{role:'operator',permissions:['probes.create','probes.update','probes.delete','probes.software_update']}, '/health':{status:'healthy',coordination_open:false}, '/version':{product:'POLARIS',version:'3.0.0',api_commit:'api-source',ui_commit:'ui-source'},
  '/metrics':{capture_state:'active',pending_segments:7,segments_ingested:18,ingestion_failures:0,open_segments:2,zero_event_segments:1,dumpcap_active:6,dumpcap_expected:12}, '/storage/safety':{filesystem:{usage_percent:75,available_bytes:268435456}},
  '/sessions':[session], '/sessions/filter':[session], '/sessions/s1':session, '/sessions/s1/events':[event], '/sessions/s1/callflow':{events:[event]}, '/sessions/s1/procedures':[], '/sessions/s1/correlations':{edges:[{edge_id:'edge-1',source_event_id:'e1',target_event_id:'e1',source_interface:'N2',target_interface:'N2',matching_identifiers:['ctx=test'],rule_id:'context-rule',rule_version:'1',matched_rules:['context-rule'],evidence_description:'same context',evidence_type:'EXACT_CONTEXT',confidence:'EXACT',scope:'session',limitations:[],packet_references:[]}]},
  '/events/e1':{...event,decoded_ie_tree:{...event.decoded_ie_tree,imsi:clearSubscriber}}, '/events/e1/provenance':{capture_id:'c1',event_id:'e1',packet_number:45}, '/packets':[{id:'p1'}], '/packets/c1/45/dissect':{dissection:['subscriber',clearSubscriber].join('=')}, '/sessions/s1/identities':identities,
  '/probes':[{id:'p1',probe_id:'p1',name:'lab-probe',host:'localhost',mgmt_ip:'127.0.0.1',site:'lab-a',probe_type:'virtual',role:'Capture',status:'healthy',version:'probe-test'}], '/probes/p1':{id:'p1',probe_id:'p1',name:'lab-probe',host:'localhost',mgmt_ip:'127.0.0.1',site:'lab-a',probe_type:'virtual',version:'probe-test'}, '/probes/p1/interfaces':[{interface:'ens3',role:'N2',bpf_filter:'sctp port 38412'}],
  '/interfaces':[{name:'N2',interface:'N2',device:'br-test',protocol:'NGAP',status:'CAPTURING'}], '/interfaces/runtime':[{interface:'N2',pid:9001,active:true,bpf_filter:'sctp port 38412',device:'br-test'}], '/captures':[], '/modules':[], '/datasets':[{id:'d1',name:'Dataset test'}], '/sessions/available_causes':['#27'], '/correlation/rules':[]
};
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(()=>{
  localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe(){} disconnect(){} });
  fetcher = vi.fn(async (url: string) => { const path=url.replace('/api/v1','').split('?')[0] ?? ''; const operatorEnvelope=/\/identities$|^\/identities$|^\/events\/|^\/packets\/.*\/dissect$/.test(path); return new Response(JSON.stringify({data:payloads[path] ?? [],meta:{total:1,...(operatorEnvelope?{identity_access:'operator'}:{})}}),{headers:{'Content-Type':'application/json'}}); });
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
  it('loads clear identities only for the visible operator page', async()=>{
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Afficher toutes les sessions'}));
    expect((await screen.findAllByText(clearSubscriber)).length).toBeGreaterThan(0);
    const calls=fetcher.mock.calls.filter(([url])=>String(url).endsWith('/sessions/s1/identities'));
    expect(calls).toHaveLength(1);
    expect(screen.getAllByText(clearTemporary).length).toBeGreaterThan(0);
  });
  it('loads callflow and identities lazily for only the opened session', async()=>{
    const previousSessions=payloads['/sessions']; const previousFilter=payloads['/sessions/filter'];
    const second={...session,session_id:'s2',anchor_capture_id:'c2',first_packet_number:46,ue_pseudonym:'ue-second'};
    payloads['/sessions']=[session,second]; payloads['/sessions/filter']=[session,second];
    try {
      open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Afficher toutes les sessions'}));
      await screen.findAllByText('ue-second');
      await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url).endsWith('/sessions/s1/callflow'))).toBe(true));
      expect(fetcher.mock.calls.some(([url])=>String(url).endsWith('/sessions/s2/callflow'))).toBe(false);
      expect(fetcher.mock.calls.some(([url])=>String(url).endsWith('/sessions/s2/identities'))).toBe(false);
    } finally { payloads['/sessions']=previousSessions; payloads['/sessions/filter']=previousFilter; }
  });
  it('keeps identities directly accessible without deriving access from auth/me', async()=>{
    const previous=payloads['/auth/me']; payloads['/auth/me']={role:'viewer'};
    try {
      open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Afficher toutes les sessions'}));
      expect((await screen.findAllByText(clearSubscriber)).length).toBeGreaterThan(0);
      expect(fetcher.mock.calls.some(([url])=>String(url).includes('/sessions/s1/identities'))).toBe(true);
      expect(screen.queryByText('connexion requise')).not.toBeInTheDocument();
    } finally { payloads['/auth/me']=previous; }
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
  it('manages session columns from the actions menu and restores defaults', async()=>{
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Afficher toutes les sessions'}));
    await screen.findAllByText('ue-test');
    fireEvent.click(screen.getByTitle("Plus d'actions"));
    fireEvent.click(screen.getByRole('button',{name:'Gérer les colonnes'}));
    const manager=screen.getByRole('dialog',{name:'Gérer les colonnes'});
    expect(manager).toHaveTextContent('NAS — 5GS / EPS');
    expect(manager).toHaveTextContent('NGAP / S1AP');
    expect(manager).toHaveTextContent('Corrélation multi-protocole');
    expect(screen.getByRole('checkbox',{name:'Numéro'})).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox',{name:'Cause'}));
    expect(screen.queryByRole('columnheader',{name:'Cause'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Retour aux actions'));
    fireEvent.click(screen.getByRole('button',{name:'Réinitialiser les colonnes'}));
    expect(screen.getByRole('columnheader',{name:'Cause'})).toBeInTheDocument();
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
    expect(await screen.findByRole('alert')).toHaveTextContent('Détail indisponible · /sessions/s1 · GET /sessions/s1 · HTTP 404');
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
  it('Nodes uses probes and server version; capture actions remain directly available', async()=>{
    open('nodes'); await screen.findByText('lab-probe'); expect(screen.getByText('probe-test')).toBeInTheDocument();
    expect(screen.getByText('POLARIS connecté')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Ajouter une sonde'})).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Déploiements'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('lab-probe'));
    fireEvent.click(await screen.findByRole('tab',{name:'Actions'}));
    await screen.findByRole('textbox',{name:'Cible de capture'}); expect(screen.getByRole('textbox',{name:'Cible de capture'})).toBeEnabled();
    expect(screen.getByRole('button',{name:'Valider la capture'})).toBeEnabled();
    expect(screen.getByRole('button',{name:'Démarrer la capture'})).toBeEnabled();
    expect(screen.getByRole('button',{name:'Arrêter la capture'})).toBeEnabled();
  });
  it('shows a neutral inline error when the server refuses a capture action', async()=>{
    fetcher.mockImplementation(async (url: string, options: RequestInit = {}) => {
      const path=url.replace('/api/v1','').split('?')[0] ?? '';
      if(path==='/captures/validate' && options.method==='POST') return new Response(JSON.stringify({error:{code:'FORBIDDEN'}}),{status:403,headers:{'Content-Type':'application/json'}});
      return new Response(JSON.stringify({data:payloads[path] ?? [],meta:{total:1}}),{headers:{'Content-Type':'application/json'}});
    });
    const browserAlert=vi.spyOn(window,'alert').mockImplementation(()=>{});
    open('nodes'); fireEvent.click(await screen.findByText('lab-probe')); fireEvent.click(await screen.findByRole('tab',{name:'Actions'}));
    fireEvent.click(await screen.findByRole('button',{name:'Valider la capture'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Action refusée par le serveur (HTTP 403)');
    expect(browserAlert).not.toHaveBeenCalled();
    browserAlert.mockRestore();
  });
  it('registers a probe with the published OIRAN payload', async()=>{
    open('nodes');
    fireEvent.click(await screen.findByRole('button',{name:'Ajouter une sonde'}));
    fireEvent.change(screen.getByLabelText('Nom de la sonde'),{target:{value:'Lab vProbe Site A'}});
    fireEvent.change(screen.getByLabelText('Serveur ou namespace'),{target:{value:'namespace.container.local'}});
    fireEvent.change(screen.getByLabelText('Adresse de gestion'),{target:{value:'10.77.0.1'}});
    fireEvent.change(screen.getByLabelText('Site de la sonde'),{target:{value:'Lab A'}});
    fireEvent.click(screen.getByRole('button',{name:'Enregistrer la sonde'}));
    await waitFor(()=>expect(fetcher.mock.calls.some(([url,options])=>String(url)==='/api/v1/probes' && options?.method==='POST')).toBe(true));
    const request=fetcher.mock.calls.find(([url,options])=>String(url)==='/api/v1/probes' && options?.method==='POST');
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({probe_id:'vprobe-lab-vprobe-site-a',probe_type:'virtual',host:'namespace.container.local',mgmt_ip:'10.77.0.1',site:'Lab A'});
  });
  it('hides unsupported probe mutation controls in real mode', async()=>{
    open('nodes'); await screen.findByText('lab-probe');
    expect(screen.queryByRole('button',{name:'Actions lab-probe'})).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url,options])=>String(url).includes('/probes/p1')&&['PUT','DELETE'].includes(String(options?.method)))).toBe(false);
  });
  it('does not expose user or role management screens', async()=>{
    open('nodes');
    await screen.findByRole('tab',{name:'Node Manager'});
    expect(screen.queryByRole('tab',{name:'Users & Roles'})).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([url])=>/\/api\/v1\/(users|roles)(?:\?|$)/.test(String(url)))).toBe(false);
  });
  it('keeps POLARIS connected when only probes fails and names the failing endpoint', async()=>{
    fetcher.mockImplementation(async (url: string) => {
      const path=url.replace('/api/v1','').split('?')[0] ?? '';
      if(path==='/probes') return new Response(JSON.stringify({error:{code:'UPSTREAM'}}),{status:502,headers:{'Content-Type':'application/json'}});
      return new Response(JSON.stringify({data:payloads[path] ?? [],meta:{total:1}}),{headers:{'Content-Type':'application/json'}});
    });
    open('nodes');
    expect(await screen.findByText('POLARIS connecté')).toBeInTheDocument();
    expect(await screen.findAllByText(/GET \/api\/v1\/probes → HTTP 502/)).not.toHaveLength(0);
  });
  it('adds then removes a fictive interface through the Administration contract', async()=>{
    let interfaces=[...(payloads['/interfaces'] as Array<Record<string,unknown>>)];
    fetcher.mockImplementation(async (url: string, options: RequestInit = {}) => {
      const path=url.replace('/api/v1','').split('?')[0] ?? '';
      if (path==='/interfaces' && options.method==='POST') {
        const body=JSON.parse(String(options.body)); interfaces=[...interfaces,body];
        return new Response(JSON.stringify({data:body,meta:{}}),{headers:{'Content-Type':'application/json'}});
      }
      if (path==='/interfaces/TEST-FICTIVE' && options.method==='DELETE') {
        interfaces=interfaces.filter(row=>row['name']!=='TEST-FICTIVE');
        return new Response(JSON.stringify({data:{deleted:true},meta:{}}),{headers:{'Content-Type':'application/json'}});
      }
      const data=path==='/interfaces'?interfaces:payloads[path] ?? [];
      return new Response(JSON.stringify({data,meta:{total:Array.isArray(data)?data.length:1}}),{headers:{'Content-Type':'application/json'}});
    });
    open('nodes');
    fireEvent.click(await screen.findByText('lab-probe'));
    fireEvent.click(await screen.findByRole('tab',{name:'Live Capture'}));
    fireEvent.click(await screen.findByRole('button',{name:'Ajouter une interface'}));
    fireEvent.change(screen.getByLabelText('Nom logique (N2, S1-MME, IMS…)'),{target:{value:'TEST-FICTIVE'}});
    fireEvent.change(screen.getByLabelText('Bridge ou NIC'),{target:{value:'br-fictive'}});
    fireEvent.change(screen.getByLabelText('Filtre BPF'),{target:{value:'udp port 9'}});
    fireEvent.change(screen.getByLabelText('Protocole attendu'),{target:{value:'TEST'}});
    fireEvent.click(screen.getByRole('button',{name:'Confirmer'}));
    const fictive=await screen.findByText('TEST-FICTIVE');
    fireEvent.click(within(fictive.closest('tr')!).getByRole('button',{name:'Supprimer'}));
    const removalDialog=screen.getByRole('dialog');
    fireEvent.change(within(removalDialog).getByLabelText('Tapez TEST-FICTIVE'),{target:{value:'TEST-FICTIVE'}});
    fireEvent.click(within(removalDialog).getByRole('button',{name:'Supprimer'}));
    await waitFor(()=>expect(screen.queryByText('TEST-FICTIVE')).not.toBeInTheDocument());
    const post=fetcher.mock.calls.find(([url,options])=>String(url)==='/api/v1/interfaces' && options?.method==='POST');
    const remove=fetcher.mock.calls.find(([url,options])=>String(url)==='/api/v1/interfaces/TEST-FICTIVE' && options?.method==='DELETE');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({name:'TEST-FICTIVE',device:'br-fictive',bpf_filter:'udp port 9',protocol:'TEST'});
    expect(JSON.parse(String(remove?.[1]?.body))).toEqual({confirmation:'TEST-FICTIVE',preserve_segments:true});
  });
  it('KPI displays health ratio from metrics, not a generated series', async()=>{
    open('kpi'); await screen.findByText('50.0 %');
    expect(screen.queryByRole('button',{name:'KPI Builder'})).not.toBeInTheDocument();
    expect(screen.queryByText('Succès Registration')).not.toBeInTheDocument();
  });
  it('Live exposes the real trace search without enabling Demo', async()=>{
    open('live'); expect(screen.getByRole('button',{name:'Rechercher'})).toBeEnabled();
    expect(screen.getByRole('option',{name:'Pseudonyme'})).toBeInTheDocument();
  });
  it('Settings reads every lab component and UI package version', async()=>{
    open('settings'); fireEvent.click(screen.getByRole('button',{name:/À propos/})); expect(await screen.findByText('api-source')).toBeInTheDocument(); expect(screen.getByText('ui-source')).toBeInTheDocument(); expect(screen.getAllByText('3.0.0').length).toBeGreaterThan(0); expect(screen.getByText('POLARIS 3.0.0')).toBeInTheDocument(); expect(screen.queryByRole('button',{name:/Sécurité/})).not.toBeInTheDocument();
  });
  it('Dashboard sits under KPI and is gone from the top menu', async()=>{
    open('kpi');
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(screen.getByText('local à ce navigateur')).toBeInTheDocument();
    expect(screen.getByText('Aucune requête enregistrée.')).toBeInTheDocument();
  });
  it('legacy #templates opens the KPI Dashboard tab', async()=>{
    open('templates'); await screen.findByText('local à ce navigateur');
    await waitFor(()=>expect(window.location.hash).toBe('#kpi'));
  });
  it('offline remains empty, no automatic demo fallback', async()=>{
    fetcher.mockRejectedValue(new TypeError('offline')); open('home'); await screen.findAllByText(/Erreur réseau pour GET \/health/);
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
