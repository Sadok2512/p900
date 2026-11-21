import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PolarisApp from '@/components/polaris/PolarisApp';
import { PolarisDataProvider } from '@/lib/polaris-api';

const session = { session_id: 's1', anchor_capture_id:'c1', first_packet_number:45, ue_pseudonym: 'ue-test', technology: '5G SA', state: 'ACTIVE', procedure:'Registration', decode_completeness:100, interfaces:['N2'], message_count:1, ue_ip:'198.51.100.10' };
const event = { event_id:'e1', capture_id:'c1', interface:'N2', protocol:'NGAP', message_name:'Registration Accept', source_participant:'AMF', destination_participant:'UE', direction:'CORE_TO_RAN', decoding_status:'DECODED', semantic_status:'SUCCESS', procedure_group:'Registration', packet_references:[{packet_number:45}], decoded_ie_tree:{result:'accepted'}, errors:[] };
const clearSubscriber=['001','01','012','345','6789'].join('');
const clearTemporary=['0x','C0','FF','EE','01'].join('');
const identities={imsi:clearSubscriber,tmsi:[{value:clearTemporary}],s_tmsi:[{value:['01',clearTemporary.slice(2)].join('')}],m_tmsi:[{value:clearTemporary.slice(2)}],imei:{value:['35','2099','00','176','148'].join('')},msisdn:['33','6','00','00','00','01'].join('')};
const payloads: Record<string,unknown> = {
  '/auth/me':{role:'operator',permissions:['probes.create','probes.update','probes.delete','probes.software_update']}, '/health':{status:'healthy',coordination_open:false,quarantined_segments:{count:1,items:[{source_path:'/capture/N2-00042.pcapng',source_sha256:'test-sha'}]}}, '/version':{backend_api:'2.11.6',web_frontend:'2.11.6',platform_core:'2.11.6',session_engine:'0.5.7',correlation_engine:'0.6.6',event_schema:'1.6.1',callflow_schema:'1.3.2',decoders:{ngap:'0.6.0'}},
  '/metrics':{capture_state:'active',pending_segments:7,segments_ingested:18,ingestion_failures:0,open_segments:2,zero_event_segments:1,dumpcap_active:6,dumpcap_expected:12,capture_owned_bytes_percent:563.8018}, '/storage/safety':{filesystem:{usage_percent:75,available_bytes:268435456}},
  '/sessions':[session], '/sessions/filter':[session], '/sessions/s1':session, '/sessions/s1/events':[event], '/sessions/s1/callflow':{events:[event]}, '/sessions/s1/procedures':[], '/sessions/s1/correlations':{edges:[{edge_id:'edge-1',source_event_id:'e1',target_event_id:'e1',source_interface:'N2',target_interface:'N2',matching_identifiers:['ctx=test'],rule_id:'context-rule',rule_version:'1',matched_rules:['context-rule'],evidence_description:'same context',evidence_type:'EXACT_CONTEXT',confidence:'EXACT',scope:'session',limitations:[],packet_references:[]}]},
  '/sessions/catalog':{columns:[],filters:{},always_present_columns:[],session_count:1,protocol_tree:[{interface:'N2',protocols:[{protocol:'NGAP',messages:[{message:'TEST.Message',detail:{occurrences:1,params:[{param_path:'test/cause',type:'enum',occurrences:1,observed_values:[{value:'ok',count:1}],decoded_from_octets:true}]}}]}]}],network_elements:[{role:'AMF',address:'amf-test',occurrences:1}],scope:{}},
  '/sessions/catalog/search':{results:[{interface:'N2',protocol:'NGAP',message:'TEST.Message',param_path:'test/cause',type:'enum',occurrences:1}],total:1,query:{q:'cause'}},
  '/sessions/catalog/param':{interface:'N2',protocol:'NGAP',message:'TEST.Message',param_path:'test/cause',type:'enum',occurrences:1,observed_values:[{value:'ok',count:1}],decoded_from_octets:true,example_sessions:[{session_id:'s1',event_id:'e1',capture_id:'c1',seq:45}]},
  '/sessions/columns':[{...session,fields:[{interface:'N2',protocol:'NGAP',message:'TEST.Message',param_path:'test/cause',mode:'last',value:'ok',proof:[{event_id:'e1',capture_id:'c1',seq:45}]}]}],
  '/events/e1':{...event,decoded_ie_tree:{...event.decoded_ie_tree,imsi:clearSubscriber}}, '/events/e1/provenance':{capture_id:'c1',event_id:'e1',packet_number:45}, '/packets':[{id:'p1'}], '/packets/c1/45/dissect':{dissection:['subscriber',clearSubscriber].join('=')}, '/sessions/s1/identities':identities, '/identities/lookup':{subscriber_pseudonym:'subscriber-psn-test',sessions:['s1'],matches:[]},
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
    expect(screen.getByText('Stock capture')).toBeInTheDocument();
    expect(screen.getByTestId('capture-stock-percent')).toHaveTextContent('563,8 %');
    expect(screen.getByText('Segments quarantinés')).toBeInTheDocument();
    expect(screen.getByTestId('quarantine-count')).toHaveTextContent('1');
    fireEvent.click(screen.getByText('Voir la liste'));
    expect(screen.getByText('N2-00042.pcapng')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('/capture/');
    expect(screen.queryByRole('button',{name:'operator'})).not.toBeInTheDocument();
  });
  it('Home renders an em dash when capture stock and quarantine are null', async()=>{
    const previousHealth=payloads['/health']; const previousMetrics=payloads['/metrics'];
    payloads['/health']={status:'healthy',quarantined_segments:null};
    payloads['/metrics']={capture_state:'active',capture_owned_bytes_percent:null};
    try {
      open('home');
      expect(await screen.findByTestId('capture-stock-percent')).toHaveTextContent('—');
      expect(screen.getByTestId('quarantine-count')).toHaveTextContent('—');
    } finally { payloads['/health']=previousHealth; payloads['/metrics']=previousMetrics; }
  });
  it('Analyzer executes filter, displays session and reads callflow and provenance', async()=>{
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'}));
    fireEvent.click(screen.getByRole('button',{name:'Exécuter la requête'}));
    await screen.findAllByText('ue-test');
    await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url).includes('/sessions/s1/callflow?'))).toBe(true));
    await screen.findAllByText('Registration Accept');
    await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url).endsWith('/events/e1/provenance'))).toBe(true));
    expect(document.body.textContent).not.toContain('private');
    expect(document.body.textContent).not.toContain('198.51.100.10');
    expect(fetcher.mock.calls.some(([url,options])=>String(url)==='/api/v1/sessions/filter' && options.method==='POST')).toBe(true);
  });
  it('2.8.3 rend les 3 lots 100/100/58, le compteur complet et les 58 badges vTAP', async()=>{
    const makeEvents=(start:number,count:number,probeType?:string)=>Array.from({length:count},(_,offset)=>({
      ...event,
      event_id:`evt-${start+offset}`,
      seq:start+offset,
      message_name:`SBI message ${start+offset}`,
      ...(probeType?{probe_type:probeType}:{}),
    }));
    fetcher.mockImplementation(async (url:string)=>{
      const raw=String(url); const path=raw.replace('/api/v1','').split('?')[0]??'';
      if(path==='/sessions/s1/callflow'){
        const cursor=new URLSearchParams(raw.split('?')[1]??'').get('cursor');
        const data=!cursor
          ? {events:makeEvents(0,100),pagination:{next_cursor:'c1',returned_events:100,total_events:258}}
          : cursor==='c1'
            ? {events:makeEvents(100,100),pagination:{next_cursor:'c2',returned_events:100,total_events:258}}
            : {events:makeEvents(200,58,'vtap'),pagination:{next_cursor:null,returned_events:58,total_events:258}};
        return new Response(JSON.stringify({data,meta:{}}),{headers:{'Content-Type':'application/json'}});
      }
      const operatorEnvelope=/\/identities$|^\/identities$|^\/events\/|^\/packets\/.*\/dissect$/.test(path);
      return new Response(JSON.stringify({data:payloads[path]??[],meta:{total:1,...(operatorEnvelope?{identity_access:'operator'}:{})}}),{headers:{'Content-Type':'application/json'}});
    });
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'})); fireEvent.click(screen.getByRole('button',{name:'Exécuter la requête'}));
    expect(await screen.findByText('258 / 258')).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([url])=>String(url).includes('/sessions/s1/callflow')).map(([url])=>String(url))).toHaveLength(3);
    fireEvent.click(screen.getByRole('button',{name:'Messages'}));
    expect(await screen.findAllByTitle('probe_type=vtap')).toHaveLength(58);
  },15000);
  it('2.7.0 renders every session-query step without undefined scope buttons', async()=>{
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'}));
    for (const name of ['Périmètre réseau','Période','Interface & protocole','Critères','Colonnes','Aperçu & exécuter']) {
      fireEvent.click(screen.getByRole('button',{name:new RegExp(name)}));
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
    expect(document.body.textContent).not.toContain('undefined');
    expect(screen.getByText(/disponible avec oiran-api 2.19.0/)).toBeInTheDocument();
  });
  it('2.7.1 reproduces the criteria workbench and uses a real count request', async()=>{
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'}));
    fireEvent.click(screen.getByRole('button',{name:/Critères/}));
    expect(screen.getByText('La session contient… Chaque critère est soit un message entier, soit un paramètre restreint à des valeurs choisies. Reliez-les par ET ou OU.')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'C1'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Message'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Paramètre'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Paramètre'}));
    expect(screen.getByRole('textbox',{name:'Chercher un paramètre'})).toHaveAttribute('placeholder','Rechercher cause, message, paramètre…');
    expect(screen.getByRole('textbox',{name:'Chercher un paramètre'})).toBeDisabled();
    expect(screen.getByText(/recherche exacte — catalogue disponible avec oiran-api 2.19.0/)).toBeInTheDocument();
    expect(screen.getByText('Arbre du message')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Tout déplier'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Replier'})).toBeDisabled();
    expect(screen.getByText('Aucun paramètre sélectionné — le critère porte sur le message entier.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'+ Critère'}));
    expect(screen.getByRole('button',{name:'C2'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Supprimer C2'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'ET'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'OU'})).toBeInTheDocument();
    await waitFor(()=>expect(fetcher.mock.calls.some(([url,options])=>String(url)==='/api/v1/sessions/filter'&&options.method==='POST'&&JSON.parse(String(options.body)).limit===0)).toBe(true));
    await waitFor(()=>expect(screen.getByLabelText('Estimation des sessions')).toHaveTextContent('1'));
  },10000);
  it('does not call the 2.19 catalog before 2.19.0 and enables it automatically at 2.19.0', async()=>{
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'}));
    fireEvent.click(screen.getByRole('button',{name:/Critères/})); fireEvent.click(screen.getByRole('button',{name:'Paramètre'}));
    await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url)==='/api/v1/version')).toBe(true));
    expect(fetcher.mock.calls.some(([url])=>String(url).startsWith('/api/v1/sessions/catalog'))).toBe(false);
    expect(screen.getByRole('textbox',{name:'Chercher un paramètre'})).toBeDisabled();
    cleanup();
    const previousVersion=payloads['/version'];
    payloads['/version']={backend_api:'2.19.0'};
    try {
      open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'}));
      fireEvent.click(screen.getByRole('button',{name:/Critères/})); fireEvent.click(screen.getByRole('button',{name:'Paramètre'}));
      await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url).startsWith('/api/v1/sessions/catalog?'))).toBe(true));
      expect(screen.getByRole('textbox',{name:'Chercher un paramètre'})).not.toBeDisabled();
      expect(screen.getByRole('combobox',{name:'Message du critère'})).toHaveAttribute('list','polaris-query-messages');
      await waitFor(()=>expect(document.querySelector('option[value="TEST.Message"]')).not.toBeNull());
    } finally { payloads['/version']=previousVersion; }
  },10000);
  it('2.8.0 explores observed parameters, executes criteria with proof, then adds a protocol column without refiltering', async()=>{
    const previousVersion=payloads['/version']; const previousFilter=payloads['/sessions/filter'];
    payloads['/version']={backend_api:'2.19.1'};
    payloads['/sessions/filter']=[{...session,matched_criteria:[{criterion_index:0,event_id:'e1',capture_id:'c1',seq:45}]}];
    try {
      open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'}));
      fireEvent.click(screen.getByRole('button',{name:/Critères/})); fireEvent.click(screen.getByRole('button',{name:'Paramètre'}));
      fireEvent.change(screen.getByRole('textbox',{name:'Chercher un paramètre'}),{target:{value:'cause'}});
      const observed=await screen.findByRole('button',{name:/N2 NGAP · TEST\.Message · test\/cause 1/});
      fireEvent.click(observed);
      await screen.findByText('Fiche observée');
      expect(await screen.findByRole('button',{name:/ok ×1/})).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button',{name:'Exécuter la requête'}));
      await screen.findByRole('button',{name:'✓ C1'});
      const filterCall=fetcher.mock.calls.find(([url,options])=>String(url)==='/api/v1/sessions/filter'&&options.method==='POST'&&JSON.parse(String(options.body)).limit===100);
      expect(JSON.parse(String(filterCall?.[1]?.body))).toEqual(expect.objectContaining({criteria:[expect.objectContaining({interface:'N2',protocol:'NGAP',message:'TEST.Message',param_path:'test/cause',op:'eq'})],combinator:'and'}));
      const before=fetcher.mock.calls.filter(([url,options])=>String(url)==='/api/v1/sessions/filter'&&options.method==='POST').length;
      fireEvent.click(screen.getByTitle("Plus d'actions")); fireEvent.click(screen.getByRole('button',{name:'Ajouter une colonne de protocole'}));
      fireEvent.change(screen.getByRole('textbox',{name:'Rechercher un paramètre après affichage'}),{target:{value:'cause'}});
      fireEvent.click(await screen.findByRole('button',{name:/N2 NGAP · TEST\.Message · test\/cause \+/}));
      await waitFor(()=>expect(fetcher.mock.calls.some(([url,options])=>String(url)==='/api/v1/sessions/columns'&&options.method==='POST')).toBe(true));
      const after=fetcher.mock.calls.filter(([url,options])=>String(url)==='/api/v1/sessions/filter'&&options.method==='POST').length;
      expect(after).toBe(before);
      expect(await screen.findByText('ok')).toBeInTheDocument();
    } finally { payloads['/version']=previousVersion; payloads['/sessions/filter']=previousFilter; }
  },15000);
  it('2.7.0 locks the six base columns and derives three columns per N1/N2/N3 interface', async()=>{
    const previousSessions=payloads['/sessions']; const previousFilter=payloads['/sessions/filter'];
    payloads['/sessions']=[{...session,interfaces:['N1','N2','N3']}]; payloads['/sessions/filter']=[{...session,interfaces:['N1','N2','N3']}];
    try {
      open('sessions'); await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url).startsWith('/api/v1/sessions?'))).toBe(true)); fireEvent.click(screen.getByRole('button',{name:/^Nouvelle requête$/}));
      fireEvent.click(screen.getByRole('button',{name:/Interface & protocole/}));
      fireEvent.click(await screen.findByRole('button',{name:'N1'}));
      fireEvent.click(screen.getByRole('button',{name:/Colonnes/}));
      for(const label of ['Début','Résultat','Cause','RAT','Abonné (IMSI)','Durée']) expect(screen.getByRole('checkbox',{name:label})).toBeDisabled();
      for(const label of ['N1 · Procédure NAS','N1 · Cause 5GMM/5GSM','N1 · TMSI / GUTI']) expect(screen.getByRole('checkbox',{name:label})).toBeChecked();
      expect(screen.getAllByRole('checkbox')).toHaveLength(10); // Démo + base 6 + N1 3
      fireEvent.click(screen.getByRole('button',{name:/Interface & protocole/}));
      fireEvent.click(screen.getByRole('button',{name:'N2'})); fireEvent.click(screen.getByRole('button',{name:'N3'}));
      fireEvent.click(screen.getByRole('button',{name:/Colonnes/}));
      for(const label of ['N2 · AMF','N2 · gNB','N2 · Cause NGAP','N3 · Volume UL/DL','N3 · Débit max','N3 · QFI / 5QI']) expect(screen.getByRole('checkbox',{name:label})).toBeChecked();
      expect(screen.getAllByRole('checkbox')).toHaveLength(16); // Démo + base 6 + variables 9
    } finally { payloads['/sessions']=previousSessions; payloads['/sessions/filter']=previousFilter; }
  },10000);
  it('2.7.0 opens protocol-column management after results without rerunning the filter', async()=>{
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:/^Nouvelle requête$/})); fireEvent.click(screen.getByRole('button',{name:'Exécuter la requête'}));
    await screen.findAllByText('ue-test');
    const before=fetcher.mock.calls.filter(([url,options])=>String(url)==='/api/v1/sessions/filter'&&options.method==='POST').length;
    fireEvent.click(screen.getByTitle("Plus d'actions")); fireEvent.click(screen.getByRole('button',{name:'Ajouter une colonne de protocole'}));
    expect(screen.getByRole('dialog',{name:'Ajouter une colonne de protocole'})).toHaveTextContent('disponibles avec oiran-api 2.19.0');
    const after=fetcher.mock.calls.filter(([url,options])=>String(url)==='/api/v1/sessions/filter'&&options.method==='POST').length;
    expect(after).toBe(before);
  });
  it('2.7.0 restores column choices with a saved query', async()=>{
    const previousSessions=payloads['/sessions']; payloads['/sessions']=[{...session,interfaces:['N1']}];
    try {
      open('sessions'); await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url).startsWith('/api/v1/sessions?'))).toBe(true)); fireEvent.click(screen.getByRole('button',{name:/^Nouvelle requête$/}));
      fireEvent.change(screen.getByPlaceholderText('Nouvelle requête'),{target:{value:'Colonnes sauvegardées'}});
      fireEvent.click(screen.getByRole('button',{name:/Interface & protocole/})); fireEvent.click(await screen.findByRole('button',{name:'N1'}));
      fireEvent.click(screen.getByRole('button',{name:/Colonnes/})); fireEvent.click(screen.getByRole('checkbox',{name:'N1 · Cause 5GMM/5GSM'}));
      fireEvent.click(screen.getByRole('button',{name:/Aperçu & exécuter/})); fireEvent.click(screen.getByRole('button',{name:'Enregistrer'}));
      fireEvent.click(screen.getByTitle('Requêtes')); const saved=await screen.findAllByText('Colonnes sauvegardées'); fireEvent.click(saved.at(-1)!);
      fireEvent.click(screen.getByRole('button',{name:/Colonnes/}));
      expect(screen.getByRole('checkbox',{name:'N1 · Procédure NAS'})).toBeChecked();
      expect(screen.getByRole('checkbox',{name:'N1 · Cause 5GMM/5GSM'})).not.toBeChecked();
    } finally { payloads['/sessions']=previousSessions; }
  });
  it('2.7.0 turns a direct IMSI search into the real identity filter body', async()=>{
    open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Nouvelle requête'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Recherche directe IMSI ou paramètre'}),{target:{value:clearSubscriber}});
    fireEvent.click(screen.getByRole('button',{name:/ajouter une condition identité/i}));
    fireEvent.click(screen.getByRole('button',{name:'Exécuter la requête'}));
    await waitFor(()=>expect(fetcher.mock.calls.some(([url,options])=>String(url)==='/api/v1/sessions/filter' && options.method==='POST')).toBe(true));
    const request=fetcher.mock.calls.find(([url,options])=>String(url)==='/api/v1/sessions/filter' && options.method==='POST' && JSON.parse(String(options.body)).limit===100);
    expect(JSON.parse(String(request?.[1]?.body))).toEqual(expect.objectContaining({search:clearSubscriber,technologies:['5G SA'],limit:100}));
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
      await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>String(url).includes('/sessions/s1/callflow?'))).toBe(true));
      expect(fetcher.mock.calls.some(([url])=>String(url).includes('/sessions/s2/callflow?'))).toBe(false);
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
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ limit: 100 }); // 2.5.1 — pagination, aucun filtre
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
    await waitFor(()=>expect(screen.queryByRole('columnheader',{name:'Cause'})).not.toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Retour aux actions'));
    fireEvent.click(screen.getByRole('button',{name:'Réinitialiser les colonnes'}));
    expect(screen.getByRole('columnheader',{name:'Cause'})).toBeInTheDocument();
  });
  it('keeps a session without session_id non-clickable and never requests a fallback id', async()=>{
    const previousSessions=payloads['/sessions']; const previousFilter=payloads['/sessions/filter'];
    payloads['/sessions']=[{...session,session_id:undefined}]; payloads['/sessions/filter']=[{...session,session_id:undefined}];
    try {
      open('sessions'); fireEvent.click(screen.getByRole('button',{name:'Afficher toutes les sessions'}));
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
  it('2.6.3 — Live : une trace IMSI armée sans aucun message ne fait pas planter la page', async()=>{
    class FakeEventSource { onmessage=null; onerror=null; addEventListener(){} close(){} constructor(){} }
    vi.stubGlobal('EventSource', FakeEventSource);
    const previous=payloads['/live/traces'];
    payloads['/live/traces']={trace_id:'trace-x',armed:true,expires_at:Math.floor(Date.now()/1000)+1800,subscriber_pseudonyms:['psn-test']};
    open('live');
    const input=screen.getByPlaceholderText('UE-…');
    fireEvent.change(input,{target:{value:'001010000000201'}});
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('imsi');
    fireEvent.click(screen.getByRole('button',{name:'Rechercher'}));
    expect(await screen.findByText('UE Info')).toBeInTheDocument();
    expect(screen.queryByText(/PDU #1 · 5QI 9/)).not.toBeInTheDocument();
    payloads['/live/traces']=previous;
  });
  it('2.7.2 — Live : un message réel (endpoints objets) s\'affiche sans planter', async()=>{
    const listeners: Record<string,(e:{data:string,lastEventId?:string})=>void> = {};
    class FakeEventSource { onerror=null; addEventListener(k:string,f:(e:{data:string})=>void){ listeners[k]=f; } close(){} constructor(){} }
    vi.stubGlobal('EventSource', FakeEventSource);
    const previous=payloads['/live/traces'];
    payloads['/live/traces']={trace_id:'trace-y',armed:false,expires_at:Math.floor(Date.now()/1000)+1800,subscriber_pseudonyms:['psn-test']};
    open('live');
    fireEvent.change(screen.getByPlaceholderText('UE-…'),{target:{value:'001010000000201'}});
    fireEvent.click(screen.getByRole('button',{name:'Rechercher'}));
    await screen.findByText('UE Info');
    await waitFor(()=>expect(listeners['message']).toBeTypeOf('function'));
    listeners['message']!({lastEventId:'1',data:JSON.stringify({interface:'N2',protocol:'NGAP',message_name:'InitialUEMessage',direction:'UPLINK',source:{address:'10.77.21.10',network_function:'gNB'},destination:{address:'10.77.21.11',network_function:'AMF'},capture_id:'cap',packet_number:7,event_id:'e7'})});
    expect(await screen.findAllByText('InitialUEMessage')).not.toHaveLength(0);
    for (const mode of ['Lignes','Flèches']) { const b=screen.queryByRole('button',{name:mode}); if(b) fireEvent.click(b); }
    expect(screen.getAllByText('InitialUEMessage').length).toBeGreaterThan(0);
    payloads['/live/traces']=previous;
  });
  it('2.8.7 — Live conserve NAS et NGAP du même paquet et remplace une révision en place', async()=>{
    const listeners: Record<string,(e:{data:string,lastEventId?:string})=>void> = {};
    class FakeEventSource { onerror=null; addEventListener(k:string,f:(e:{data:string})=>void){ listeners[k]=f; } close(){} constructor(){} }
    vi.stubGlobal('EventSource', FakeEventSource);
    const previous=payloads['/live/traces'];
    payloads['/live/traces']={trace_id:'trace-dedup',armed:false,expires_at:Math.floor(Date.now()/1000)+1800,subscriber_pseudonyms:['psn-test']};
    const message=(overrides:Record<string,unknown>)=>({interface:'N2',protocol:'NGAP',message_name:'NGAP message',source:{network_function:'gNB'},destination:{network_function:'AMF'},capture_id:'cap',packet_number:7,revision:0,...overrides});
    try {
      open('live');
      fireEvent.change(screen.getByPlaceholderText('UE-…'),{target:{value:'001010000000201'}});
      fireEvent.click(screen.getByRole('button',{name:'Rechercher'}));
      await screen.findByText('UE Info');
      await waitFor(()=>expect(listeners['message']).toBeTypeOf('function'));
      act(()=>listeners['message']!({data:JSON.stringify(message({stable_event_key:'ngap:cap:7',event_id:'ngap-7'}))}));
      act(()=>listeners['message']!({data:JSON.stringify(message({stable_event_key:'nas:cap:7',event_id:'nas-7',protocol:'NAS-5GS',message_name:'Registration Request'}))}));
      expect(await screen.findAllByText('NGAP message')).not.toHaveLength(0);
      expect(await screen.findAllByText('Registration Request')).not.toHaveLength(0);
      fireEvent.click(screen.getByRole('button',{name:'Lignes'}));
      const nasCell=screen.getAllByText('Registration Request').find((element)=>element.tagName==='TD'&&element.classList.contains('text-foreground'))!;
      fireEvent.click(nasCell);
      await waitFor(()=>expect(screen.getAllByText('Registration Request').some((element)=>element.tagName==='B')).toBe(true));
      expect(screen.getAllByText('NGAP message').some((element)=>element.tagName==='B')).toBe(false);
      act(()=>listeners['message']!({data:JSON.stringify(message({stable_event_key:'ngap:cap:7',event_id:'ngap-7-r1',revision:1,message_name:'NGAP message revised'}))}));
      expect(await screen.findAllByText('NGAP message revised')).not.toHaveLength(0);
      expect(screen.queryByText('NGAP message')).not.toBeInTheDocument();
      expect(screen.getAllByText('Registration Request').length).toBeGreaterThan(0);
    } finally { payloads['/live/traces']=previous; }
  });
  it('Settings reads every lab component and UI package version', async()=>{
    open('settings'); fireEvent.click(screen.getByRole('button',{name:/À propos/})); await screen.findAllByText('2.11.6'); expect(screen.getAllByText('2.8.7').length).toBeGreaterThan(0); expect(screen.getByText('0.6.6')).toBeInTheDocument(); expect(screen.getByText('ngap')).toBeInTheDocument(); expect(screen.getByText('POLARIS 2.8.7')).toBeInTheDocument(); expect(screen.queryByRole('button',{name:/Sécurité/})).not.toBeInTheDocument();
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
