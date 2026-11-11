import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PolarisApp from '@/components/polaris/PolarisApp';
import { PolarisDataProvider } from '@/lib/polaris-api';

const session = { id: 's1', capture_id: 'c1', seq: 12, event_id: 'e1', ue_id: 'ue-test', technology: '5G SA', status: 'success', procedure:'Registration' };
const event = { event_id:'e1', seq:12, capture_id:'c1', interface:'N2', message:'Registration Accept', source:'AMF', destination:'UE' };
const payloads: Record<string,unknown> = {
  '/auth/me':{role:'operator'}, '/health':{status:'healthy',coordination_open:false}, '/version':{version:'lab-test',decoder_version:'decoder-test'},
  '/metrics':{capture_state:'active',pending_segments:7,segments_ingested:18,ingestion_failures:0,open_segments:2,zero_event_segments:1,dumpcap_active:6,dumpcap_expected:12}, '/storage/safety':{free_percent:25},
  '/sessions':[session], '/sessions/filter':[session], '/sessions/s1':session, '/sessions/s1/events':[event], '/sessions/s1/callflow':{events:[event]}, '/sessions/s1/procedures':[], '/sessions/s1/correlations':[],
  '/events/e1':{...event,decoded:{message:'Registration Accept',guti:'private'}}, '/events/e1/provenance':{capture_id:'c1',event_id:'e1',seq:12,packet_number:45}, '/packets':[{id:'p1'}],
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
    await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url).endsWith('/events/e1/provenance'))).toBe(true));
    expect(document.body.textContent).not.toContain('private');
    expect(fetcher.mock.calls.some(([url,options])=>String(url)==='/api/v1/sessions/filter' && options.method==='POST')).toBe(true);
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
  it('Settings reads lab version and UI package version', async()=>{
    open('settings'); fireEvent.click(screen.getByRole('button',{name:/À propos/})); await screen.findByText('lab-test'); expect(screen.getByText('0.9.0')).toBeInTheDocument();
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
});
