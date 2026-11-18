import React, { useEffect, useMemo, useState } from 'react';
import { records, supportsQueryApi, useDatasets, useQueryCatalog, useQueryCatalogParam, useQueryCatalogSearch, useSessionEstimate, useVersion } from '@/lib/polaris-api';

const STEPS = [
  ['Périmètre réseau', 'Choisissez la technologie et les éléments de réseau dont les traces sont observées. Site et cellule arrivent en V2.'],
  ['Période', "Cadrez la recherche sur l’horaire de capture, ou sur un run de scénario."],
  ['Interface & protocole', 'Choisissez les interfaces réellement observées dans le périmètre.'],
  ['Critères', 'La session contient… Chaque critère est soit un message entier, soit un paramètre restreint à des valeurs choisies. Reliez-les par ET ou OU.'],
  ['Colonnes', 'Choisissez les colonnes variables liées aux interfaces. Les six colonnes de base restent verrouillées.'],
  ['Aperçu & exécuter', 'Vérifiez la requête, puis enregistrez ou exécutez. La sortie est toujours une liste de sessions.'],
];

export const SESSION_QUERY_BASE_COLUMN_KEYS = ['start','res','cause','rat','sub','dur'];
export const SESSION_QUERY_INTERFACE_COLUMNS = {
  N1: [['proc','Procédure NAS'],['n1cause','Cause 5GMM/5GSM'],['tmsi','TMSI / GUTI']],
  N2: [['core','AMF'],['ran','gNB'],['ngapcause','Cause NGAP']],
  N3: [['n3volume','Volume UL/DL'],['n3rate','Débit max'],['n3qos','QFI / 5QI']],
  N4: [['n4seid','SEID'],['n4cause','Cause PFCP'],['n4lat','Latence']],
  SBI: [['sbiservices','Services'],['sbihttp','Statut HTTP'],['sbiidentities','MSISDN / IMEI']],
  'S1-MME': [['core','MME'],['ran','eNB'],['s1cause','Cause S1AP'],['mtmsi','M-TMSI']],
  S11: [['s11apn','APN'],['s11qci','QCI'],['s11cause','Cause S11']],
  'S1-U': [['s1uvolume','Volume UL/DL'],['s1urate','Débit max'],['s1uteid','TEID']],
};
export const defaultVariableColumns = interfaces => interfaces.flatMap(name=>(SESSION_QUERY_INTERFACE_COLUMNS[name]||[]).map(([key])=>key));

const unique = values => [...new Set(values.filter(value => value != null && String(value).trim() && String(value) !== '—' && String(value) !== 'undefined').map(String))];
const Button = ({active=false,disabled=false,children,...props}) => <button type="button" disabled={disabled} {...props} className={`h-8 px-3 rounded-md border text-[12.5px] transition ${active?'border-[var(--app-accent)] bg-[var(--app-accent)] text-white':'border-border bg-white text-ink-2 hover:border-border-strong'} disabled:cursor-not-allowed disabled:opacity-45`}>{children}</button>;
const Icon = ({children}) => <span className="w-5 h-5 rounded-full bg-muted text-[11px] font-semibold grid place-items-center text-ink-2 shrink-0">{children}</span>;

const criterionLabel = criterion => {
  if (!criterion?.[1]) return 'incomplet';
  if (criterion[0] === 'IMSI') return `IMSI ••••${String(criterion[1]).slice(-4)}`;
  if (criterion[0] === 'Paramètre') return `${criterion[5] || criterion[1]} présent`;
  return `${criterion[1]} présent`;
};

const catalogMessages = catalog => records(catalog?.protocol_tree).flatMap(iface=>records(iface.protocols).flatMap(protocol=>records(protocol.messages).map(message=>({interface:iface.interface,protocol:protocol.protocol,name:message.message,occurrences:message.detail?.occurrences??0,params:records(message.detail?.params)}))));
const catalogFields = (catalog,messageName,interfaceName) => catalogMessages(catalog).filter(item=>item.name===messageName&&(!interfaceName||item.interface===interfaceName)).flatMap(item=>item.params.map(param=>({...param,interface:item.interface,protocol:item.protocol,message:item.name,path:param.param_path})));

function CriteriaStep({draft,update,observedInterfaces,queryApiEnabled,catalog}) {
  const criteria=draft.conds.length?draft.conds:[['Message','','=','','Message']];
  const [current,setCurrent]=useState(0);
  const [parameterSearch,setParameterSearch]=useState('');
  const [treeFilter,setTreeFilter]=useState('');
  const index=Math.min(current,criteria.length-1);
  const criterion=criteria[index];
  const mode=criterion[0]==='IMSI'?'Identité':criterion[4]||criterion[0]||'Message';
  const messages=catalogMessages(catalog);
  const fields=catalogFields(catalog,criterion[1],criterion[3]);
  const visibleFields=fields.filter(item=>!treeFilter.trim()||`${item.path} ${item.name||''}`.toLowerCase().includes(treeFilter.trim().toLowerCase()));
  const search=useQueryCatalogSearch(parameterSearch,observedInterfaces,queryApiEnabled&&mode==='Paramètre');
  const searchResults=records(search.data?.data?.results);
  const selected={interface:criterion[3],protocol:criterion[6],message:criterion[1],param_path:criterion[5]};
  const detail=useQueryCatalogParam(selected,queryApiEnabled&&mode==='Paramètre');
  const observedValues=records(detail.data?.data?.observed_values);
  useEffect(()=>{if(current>=criteria.length)setCurrent(Math.max(0,criteria.length-1));},[criteria.length,current]);
  const replace=next=>{const values=[...criteria];values[index]=next;update({conds:values});};
  const setMode=next=>replace([next==='Paramètre'?'Paramètre':'Message','', '=', criterion[3]||'',next,'','','']);
  const selectResult=item=>replace([item.param_path?'Paramètre':'Message',item.message,'=',item.interface,item.param_path?'Paramètre':'Message',item.param_path||'',item.protocol,'']);
  const add=()=>{update({conds:[...criteria,['Message','','=','','Message']]});setCurrent(criteria.length);};
  const remove=()=>{const values=criteria.filter((_,position)=>position!==index);update({conds:values});setCurrent(Math.max(0,index-1));};
  return <div className="space-y-4">
    <section className="polaris-card p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {criteria.map((_,position)=><button key={position} type="button" onClick={()=>setCurrent(position)} className={`h-8 min-w-10 rounded-md border px-3 text-[12px] font-semibold ${position===index?'border-[var(--app-accent)] bg-brand-soft text-[var(--app-accent)]':'border-border bg-white text-muted-foreground'}`}>C{position+1}</button>)}
        <div className="ml-2 inline-flex rounded-md border border-border p-0.5">
          {['Message','Paramètre'].map(value=><button key={value} type="button" onClick={()=>setMode(value)} disabled={mode==='Identité'} className={`h-7 rounded px-3 text-[12px] ${mode===value?'bg-[var(--app-accent)] text-white font-semibold':'text-muted-foreground'} disabled:opacity-45`}>{value}</button>)}
          {mode==='Identité'&&<button type="button" className="h-7 rounded bg-[var(--app-accent)] px-3 text-[12px] font-semibold text-white">Identité</button>}
        </div>
        <button type="button" onClick={add} className="ml-auto h-8 rounded-md border border-border bg-white px-3 text-[12px] hover:bg-surface-2">+ Critère</button>
        {criteria.length>1&&<button type="button" onClick={remove} className="h-8 rounded-md border border-border bg-white px-3 text-[12px] hover:bg-surface-2">Supprimer C{index+1}</button>}
      </div>

      {mode==='Identité'?<div className="mt-4 rounded-md border border-border bg-surface-2 p-3 text-[12.5px]"><span className="mr-2 rounded bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-[var(--app-accent)]">ACTIF</span>IMSI ••••{String(criterion[1]).slice(-4)}<div className="mt-1 text-[11.5px] text-muted-foreground">Jamais d’écho en clair hors UI authentifiée.</div></div>:<>
        {mode==='Paramètre'&&<div className="mt-4"><label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Explorateur de protocoles <span className="normal-case font-normal">· messages et paramètres observés</span></label><input aria-label="Chercher un paramètre" disabled={!queryApiEnabled} value={parameterSearch} onChange={event=>setParameterSearch(event.target.value)} placeholder="Rechercher cause, message, paramètre…" className="mt-2 h-9 w-full rounded-md border border-border px-3 text-[12.5px] disabled:bg-surface-2 disabled:opacity-60"/>{!queryApiEnabled&&<div className="mt-2 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-[11.5px] text-muted-foreground">Catalogue des paramètres disponible avec oiran-api 2.19.0 — aucune suggestion inventée.</div>}{parameterSearch&&queryApiEnabled&&<div className="mt-2 max-h-44 overflow-auto rounded-md border border-border bg-white p-1">{search.isFetching?<div className="p-2 text-[12px] text-muted-foreground">Recherche…</div>:searchResults.length?searchResults.map((item,position)=><button type="button" key={`${item.interface}-${item.protocol}-${item.message}-${item.param_path}-${position}`} onClick={()=>selectResult(item)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11.5px] hover:bg-surface-2"><span className="rounded bg-brand-soft px-1.5 py-0.5 font-semibold text-[var(--app-accent)]">{item.interface}</span><span className="font-mono">{item.protocol} · {item.message}{item.param_path?` · ${item.param_path}`:''}</span><span className="ml-auto tabular-nums text-muted-foreground">{item.occurrences}</span></button>):<div className="p-2 text-[12px] text-muted-foreground">Aucun résultat observé.</div>}</div>}</div>}
        <div className="mt-4"><label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Message <span className="normal-case font-normal">· recherche exacte — catalogue disponible avec oiran-api 2.19.0</span></label><div className="mt-2 flex flex-wrap gap-2"><input aria-label="Message du critère" list={queryApiEnabled?'polaris-query-messages':undefined} value={criterion[1]||''} onChange={event=>replace([mode==='Paramètre'?'Paramètre':'Message',event.target.value,criterion[2]||'=',criterion[3]||'',mode,criterion[5]||'',criterion[6]||'',criterion[7]||''])} placeholder="Nom exact du message" className="h-9 min-w-[320px] flex-1 rounded-md border border-border px-3 font-mono text-[12px]"/>{queryApiEnabled&&<datalist id="polaris-query-messages">{messages.map((item,position)=><option key={`${item.interface}-${item.protocol}-${item.name}-${position}`} value={item.name}/>)}</datalist>}<select aria-label="Interface du critère" value={criterion[3]||''} onChange={event=>replace([criterion[0],criterion[1],criterion[2]||'=',event.target.value,mode,criterion[5]||'',criterion[6]||'',criterion[7]||''])} className="h-9 rounded-md border border-border bg-white px-3 text-[12px]"><option value="">Toutes interfaces</option>{observedInterfaces.map(name=><option key={name}>{name}</option>)}</select></div>{mode==='Message'&&<div className="mt-2 text-[11.5px] text-muted-foreground">Le critère porte sur le message entier. La saisie reste libre et exige une correspondance exacte.</div>}</div>
        {mode==='Paramètre'&&<div className="mt-4"><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Arbre du message</div><div className="mt-2 overflow-hidden rounded-md border border-border"><div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 p-2"><input aria-label="Filtrer dans le message" disabled={!queryApiEnabled} value={treeFilter} onChange={event=>setTreeFilter(event.target.value)} placeholder={`Filtrer dans ${criterion[1]?.split('.').at(-1)||'le message'}…`} className="h-8 min-w-[260px] flex-1 rounded border border-border bg-white px-2 text-[12px] disabled:bg-surface-2 disabled:opacity-60"/><span className="text-[11.5px] text-muted-foreground">{queryApiEnabled?visibleFields.length:0} paramètre{visibleFields.length>1?'s':''}</span><button type="button" disabled className="h-7 px-2 text-[11.5px] opacity-45">Tout déplier</button><button type="button" disabled className="h-7 px-2 text-[11.5px] opacity-45">Replier</button></div><div className="min-h-28 p-4 text-[12px] text-muted-foreground">{!queryApiEnabled?'Arbre non chargé : GET /api/v1/sessions/catalog est disponible avec oiran-api 2.19.0.':visibleFields.length?<div className="grid gap-1">{visibleFields.map(item=><button type="button" key={`${item.interface}-${item.protocol}-${item.path}`} onClick={()=>replace(['Paramètre',criterion[1],criterion[2]||'=',item.interface,'Paramètre',item.path,item.protocol,criterion[7]||''])} className="rounded px-2 py-1 text-left font-mono hover:bg-surface-2">{item.path} <span className="font-sans text-muted-foreground">· {item.type} · {item.occurrences}</span></button>)}</div>:'Aucun paramètre renvoyé par le catalogue pour ce message.'}</div><div className="border-t border-border bg-surface-2 px-3 py-2 text-[11.5px] text-muted-foreground">{criterion[5]?`Paramètre sélectionné : ${criterion[5]}`:'Aucun paramètre sélectionné — le critère porte sur le message entier.'}</div></div>{criterion[5]&&<div className="mt-3 rounded-md border border-border bg-surface-2 p-3"><div className="flex items-center gap-2 text-[12px]"><b>Fiche observée</b>{detail.isFetching&&<span className="text-muted-foreground">chargement…</span>}{detail.data?.data?.type&&<span className="rounded bg-white px-2 py-0.5 font-mono">{detail.data.data.type}</span>}<span className="ml-auto tabular-nums text-muted-foreground">{detail.data?.data?.occurrences??'—'} occurrence(s)</span></div><div className="mt-2 flex flex-wrap gap-2"><select aria-label="Opérateur du paramètre" value={criterion[2]||'='} onChange={event=>replace([criterion[0],criterion[1],event.target.value,criterion[3],mode,criterion[5],criterion[6],criterion[7]||''])} className="h-8 rounded border border-border bg-white px-2 text-[12px]"><option>=</option><option>≠</option><option>&gt;</option><option>&lt;</option><option>contient</option></select><input aria-label="Valeur du paramètre" list="polaris-query-values" value={criterion[7]||''} onChange={event=>replace([criterion[0],criterion[1],criterion[2]||'=',criterion[3],mode,criterion[5],criterion[6],event.target.value])} placeholder="Valeur observée" className="h-8 min-w-56 rounded border border-border bg-white px-2 font-mono text-[12px]"/><datalist id="polaris-query-values">{observedValues.map((item,position)=><option key={`${item.value}-${position}`} value={item.value}>{item.count}</option>)}</datalist></div><div className="mt-2 flex flex-wrap gap-1">{observedValues.slice(0,12).map((item,position)=><button type="button" key={`${item.value}-${position}`} onClick={()=>replace([criterion[0],criterion[1],criterion[2]||'=',criterion[3],mode,criterion[5],criterion[6],String(item.value)])} className="rounded border border-border bg-white px-2 py-1 font-mono text-[11px]">{String(item.value)} <span className="text-muted-foreground">×{item.count}</span></button>)}</div></div>}</div>}
      </>}
    </section>
    {criteria.length>1&&<><div className="flex items-center gap-2 rounded-lg border border-border bg-white p-3 text-[12px]"><span className="text-muted-foreground">critères reliés par</span>{['ET','OU'].map(value=><button key={value} type="button" onClick={()=>update({join:value})} className={`h-8 rounded-md border px-3 font-semibold ${draft.join===value?'border-[var(--app-accent)] bg-[var(--app-accent)] text-white':'border-border bg-white text-muted-foreground'}`}>{value}</button>)}{draft.join==='OU'&&<span className="text-[11.5px] text-warning">Exécution disponible avec oiran-api 2.19.0</span>}</div><div className="grid gap-2">{criteria.map((value,position)=><div key={position} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-[12px]"><span className="rounded bg-brand-soft px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[var(--app-accent)]">C{position+1}</span><span className="font-mono">{criterionLabel(value)}</span>{position<criteria.length-1&&<span className="ml-auto text-[10.5px] font-semibold text-muted-foreground">{draft.join}</span>}</div>)}</div></>}
  </div>;
}

function normalizeDraft(draft) {
  return {
    ...draft,
    rat: draft.rat || '5G SA',
    nodes: Array.isArray(draft.nodes) ? draft.nodes : [],
    periodMode: draft.periodMode || 'period',
    period: draft.period || '1 h',
    interfaces: Array.isArray(draft.interfaces) ? draft.interfaces : [],
    variableColumns: Array.isArray(draft.variableColumns) ? draft.variableColumns : defaultVariableColumns(Array.isArray(draft.interfaces) ? draft.interfaces : []),
    customColumns: Array.isArray(draft.customColumns) ? draft.customColumns : [],
    conds: Array.isArray(draft.conds) ? draft.conds : [],
    join: draft.join || 'ET',
  };
}

export default function SessionQueryEditor({draft,setDraft,dirty,run,save,cancel,sessionRows=[]}) {
  const d = normalizeDraft(draft);
  const datasets = useDatasets();
  const version = useVersion();
  const queryApiEnabled = supportsQueryApi(version.data);
  const catalogScope = useMemo(()=>({...(d.interfaces.length?{interfaces:d.interfaces.join(',')}:{}),...(d.rat?{technologies:d.rat}:{}),...(d.periodMode==='run'&&d.scope?{run_id:d.scope}:{})}),[d.interfaces,d.rat,d.periodMode,d.scope]);
  const catalog = useQueryCatalog(queryApiEnabled,catalogScope);
  const [step,setStep] = useState(0);
  const [search,setSearch] = useState('');
  const [customFrom,setCustomFrom] = useState('');
  const [customTo,setCustomTo] = useState('');
  const [columnSearch,setColumnSearch] = useState('');
  const [columnMode,setColumnMode] = useState('last');
  const columnResults = useQueryCatalogSearch(columnSearch,d.interfaces,queryApiEnabled);
  const up = patch => setDraft({...d,...patch});
  const toggle = (key,value) => up({[key]:d[key].includes(value)?d[key].filter(item=>item!==value):[...d[key],value]});
  const toggleInterface = value => {
    const selected=d.interfaces.includes(value);
    const keys=(SESSION_QUERY_INTERFACE_COLUMNS[value]||[]).map(([key])=>key);
    up({
      interfaces:selected?d.interfaces.filter(item=>item!==value):[...d.interfaces,value],
      variableColumns:selected?d.variableColumns.filter(key=>!keys.includes(key)):[...new Set([...d.variableColumns,...keys])],
    });
  };

  const rowsForRat = useMemo(()=>sessionRows.filter(row=>!row.rat || row.rat===d.rat || row.technology===d.rat),[sessionRows,d.rat]);
  const observedNodes = useMemo(()=>unique(records(catalog.data?.data?.network_elements).map(item=>item.role)).sort(),[catalog.data]);
  const observedInterfaces = useMemo(()=>{const fromCatalog=records(catalog.data?.data?.protocol_tree).map(item=>item.interface);return unique(fromCatalog.length?fromCatalog:rowsForRat.flatMap(row=>Array.isArray(row.interfaces)?row.interfaces:[])).sort();},[catalog.data,rowsForRat]);
  const runOptions = useMemo(()=>records(datasets.data?.data,'datasets').map(item=>({
    id:item.dataset_id ?? item.id ?? null,
    label:item.name ?? item.label ?? item.dataset_id ?? item.id ?? null,
  })).filter(item=>item.id && item.label),[datasets.data]);
  const digits = search.replace(/\D/g,'');
  const identitySearch = digits.length >= 5 || /^imsi\b/i.test(search.trim());
  const parameterSearch = search.trim() && !identitySearch;
  const addIdentity = () => {
    if (!digits) return;
    up({conds:[...d.conds,['IMSI',digits,'=']]});
    setSearch('');
    setStep(3);
  };
  const estimateKey=JSON.stringify({conds:d.conds,join:d.join,rat:d.rat,nodes:d.nodes,periodMode:d.periodMode,period:d.period,from:d.from,to:d.to,scope:d.scope,interfaces:d.interfaces});
  const [estimateDraft,setEstimateDraft]=useState(d);
  useEffect(()=>{const timer=setTimeout(()=>setEstimateDraft(d),350);return()=>clearTimeout(timer);},[estimateKey]);
  const estimate=useSessionEstimate(estimateDraft);
  const estimateTotal=Number(estimate.data?.meta?.total);
  const estimateLabel=estimate.isFetching?'calcul…':Number.isFinite(estimateTotal)?estimateTotal.toLocaleString('fr-FR'):'—';
  const addCustomColumn=item=>{
    if(!item?.param_path)return;
    const id=`${item.interface}|${item.protocol}|${item.message}|${item.param_path}|${columnMode}`;
    if(d.customColumns.some(column=>column.id===id))return;
    up({customColumns:[...d.customColumns,{id,label:`${item.interface} · ${item.param_path.split('/').at(-1)}`,interface:item.interface,protocol:item.protocol,message:item.message,param_path:item.param_path,mode:columnMode}]});
  };

  const scopeLabel = d.periodMode==='run' ? (runOptions.find(item=>String(item.id)===String(d.scope))?.label || 'Run non sélectionné') : d.period;
  const summary = [d.rat,...d.nodes,scopeLabel,...d.interfaces,...d.conds.filter(c=>c[1]).map(c=>`${c[0]} ${c[2]||'='} ${c[0]==='IMSI'?'••••'+String(c[1]).slice(-4):c[1]}`)];

  const stepBody = [
    <div key="network" className="space-y-6">
      <section><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-2">Technologie (RAT)</div><div className="flex gap-2">{['5G SA','LTE'].map(rat=><Button key={rat} active={d.rat===rat} onClick={()=>up({rat,nodes:[],interfaces:[],variableColumns:[]})}>{rat}</Button>)}</div></section>
      <section><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-2">Éléments de réseau observés</div><div className="flex flex-wrap gap-2">{observedNodes.map(node=><Button key={node} active={d.nodes.includes(node)} onClick={()=>toggle('nodes',node)}>{node}</Button>)}{!observedNodes.length&&<span className="text-[12.5px] text-muted-foreground">Aucun élément remonté par les sessions observées.</span>}</div><p className="mt-2 text-[11.5px] text-subtle">Site / Cellule : V2 — aucune valeur inventée.</p></section>
    </div>,
    <div key="period" className="space-y-5">
      <div className="inline-flex rounded-lg border border-border p-1">{[['period','Plage horaire'],['run','Run de scénario']].map(([mode,label])=><button type="button" key={mode} onClick={()=>up({periodMode:mode,scope:mode==='run'?d.scope:''})} className={`h-8 px-3 rounded-md text-[12.5px] ${d.periodMode===mode?'bg-[var(--app-accent)] text-white font-semibold':'text-muted-foreground'}`}>{label}</button>)}</div>
      {d.periodMode==='period'?<><div className="flex flex-wrap gap-2">{['15 min','1 h','24 h','personnalisée'].map(period=><Button key={period} active={d.period===period} onClick={()=>up({period})}>{period}</Button>)}</div>{d.period==='personnalisée'&&<div className="flex flex-wrap gap-3"><label className="text-[12px] text-muted-foreground">Début<input aria-label="Début personnalisé" type="datetime-local" value={customFrom} onChange={e=>{setCustomFrom(e.target.value);up({from:e.target.value});}} className="block mt-1 h-9 rounded-md border border-border px-2 text-foreground"/></label><label className="text-[12px] text-muted-foreground">Fin<input aria-label="Fin personnalisée" type="datetime-local" value={customTo} onChange={e=>{setCustomTo(e.target.value);up({to:e.target.value});}} className="block mt-1 h-9 rounded-md border border-border px-2 text-foreground"/></label></div>}</>:<div>{runOptions.length?<select aria-label="Run de scénario" value={d.scope||''} onChange={e=>up({scope:e.target.value})} className="h-9 min-w-[320px] rounded-md border border-border bg-white px-3 text-[12.5px]"><option value="">Sélectionner un run observé</option>{runOptions.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>:<div className="text-[12.5px] text-muted-foreground">Aucun run exploitable renvoyé par l’API.</div>}</div>}
    </div>,
    <div key="interfaces" className="space-y-4"><div><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-2">Interfaces observées · {d.rat}</div><div className="flex flex-wrap gap-2">{observedInterfaces.map(name=><Button key={name} active={d.interfaces.includes(name)} onClick={()=>toggleInterface(name)}>{name}</Button>)}{!observedInterfaces.length&&<span className="text-[12.5px] text-muted-foreground">Aucune interface observée.</span>}</div></div><p className="text-[11.5px] text-subtle">Aucune sélection = toutes les interfaces. Le protocole reste celui observé par l’API ; aucune correspondance n’est fabriquée.</p></div>,
    <CriteriaStep key="criteria" draft={d} update={up} observedInterfaces={observedInterfaces} queryApiEnabled={queryApiEnabled} catalog={catalog.data?.data}/>,
    <div key="columns" className="space-y-5">
      <section className="rounded-lg border border-border p-4"><div className="flex items-center gap-2"><div className="font-semibold text-[13px]">Base</div><span className="rounded bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">VERROUILLÉE</span></div><div className="mt-3 flex flex-wrap gap-2">{['Début','Résultat','Cause','RAT','Abonné (IMSI)','Durée'].map(label=><label key={label} className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px]"><input type="checkbox" checked disabled/>{label}</label>)}</div></section>
      {d.interfaces.map(name=><details key={name} open className="rounded-lg border border-border p-4"><summary className="cursor-pointer font-semibold text-[13px]">{name} · {(SESSION_QUERY_INTERFACE_COLUMNS[name]||[]).length} colonnes</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{(SESSION_QUERY_INTERFACE_COLUMNS[name]||[]).map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[12px]"><input type="checkbox" aria-label={`${name} · ${label}`} checked={d.variableColumns.includes(key)} onChange={()=>toggle('variableColumns',key)}/>{label}<select aria-label={`Agrégation ${name} · ${label}`} value="dernière" disabled className="ml-auto max-w-[92px] rounded border border-border bg-surface-2 px-1 py-0.5 text-[10.5px]"><option>dernière</option><option>première</option><option>toutes</option><option>nombre</option></select></label>)}</div></details>)}
      {!d.interfaces.length&&<div className="rounded-lg border border-dashed border-border p-4 text-[12.5px] text-muted-foreground">Sélectionnez une interface à l’étape 3 pour ajouter ses colonnes variables.</div>}
      <section className={`rounded-lg border border-dashed border-border bg-surface-2 p-4 ${queryApiEnabled?'':'opacity-70'}`}><div className="font-semibold text-[13px]">Colonnes protocolaires</div><p className="mt-1 text-[12px] text-muted-foreground">{queryApiEnabled?'Valeurs et preuves calculées par POST /sessions/columns.':'Arbre de paramètres et agrégations disponibles avec oiran-api 2.19.0.'}</p>{d.customColumns.length>0&&<div className="mt-3 grid gap-2">{d.customColumns.map(column=><div key={column.id} className="flex items-center gap-2 rounded border border-border bg-white px-3 py-2 text-[12px]"><span className="font-mono">{column.label}</span><span className="rounded bg-surface-2 px-2 py-0.5">{column.mode}</span><button type="button" onClick={()=>up({customColumns:d.customColumns.filter(item=>item.id!==column.id)})} className="ml-auto text-danger">Retirer</button></div>)}</div>}<div className="mt-3 flex flex-wrap gap-2"><input aria-label="Rechercher une colonne protocolaire" disabled={!queryApiEnabled} value={columnSearch} onChange={event=>setColumnSearch(event.target.value)} placeholder="Rechercher un paramètre observé" className="h-8 min-w-72 flex-1 rounded border border-border bg-white px-2 text-[12px]"/><select aria-label="Mode de la colonne protocolaire" disabled={!queryApiEnabled} value={columnMode} onChange={event=>setColumnMode(event.target.value)} className="h-8 rounded border border-border bg-white px-2 text-[12px]"><option value="last">dernière</option><option value="first">première</option><option value="all">toutes</option><option value="count">nombre</option></select></div>{columnSearch&&<div className="mt-2 max-h-40 overflow-auto rounded border border-border bg-white p-1">{records(columnResults.data?.data?.results).filter(item=>item.param_path).map((item,position)=><button type="button" key={`${item.interface}-${item.protocol}-${item.message}-${item.param_path}-${position}`} onClick={()=>addCustomColumn(item)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11.5px] hover:bg-surface-2"><span className="rounded bg-brand-soft px-1.5 py-0.5 font-semibold text-[var(--app-accent)]">{item.interface}</span><span className="font-mono">{item.protocol} · {item.message} · {item.param_path}</span><span className="ml-auto">+</span></button>)}</div>}</section>
    </div>,
    <div key="review" className="space-y-5"><div><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-2">Récapitulatif</div><div className="flex flex-wrap gap-2">{summary.map((value,index)=><span key={`${value}-${index}`} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12px]">{value}</span>)}</div></div><div><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-2">Colonnes</div><div className="text-[12px] text-ink-2">6 colonnes de base + {d.variableColumns.length} variable{d.variableColumns.length>1?'s':''}</div></div><div className="rounded-lg border border-dashed border-border p-4 bg-surface-2"><div className="text-[12px] font-semibold">Sessions correspondantes</div><div className="mt-1 text-[12px] text-muted-foreground">Compte via <code>limit: 0</code> disponible avec oiran-api 2.19.0. L’exécution charge la liste réelle paginée.</div></div><div className="flex flex-wrap items-center gap-2"><input aria-label="Nom de la requête" value={d.name||''} onChange={e=>up({name:e.target.value})} placeholder="Nom de la requête" className="h-9 min-w-[280px] rounded-md border border-border px-3 text-[12.5px]"/><Button onClick={save}>Enregistrer</Button><button type="button" onClick={run} className="h-9 px-5 rounded-md bg-[var(--app-accent)] text-white text-[13px] font-semibold">Exécuter →</button></div></div>,
  ][step];

  return <div className="flex-1 min-h-0 overflow-auto scroll-thin bg-surface-2"><div className="w-full px-8 py-6">
    <header className="polaris-card px-6 py-5"><div className="flex flex-wrap items-start gap-4"><div><div className="text-[12px] text-muted-foreground">POLARIS Analyzer · Requête de sessions</div><input value={d.name||''} onChange={e=>up({name:e.target.value})} placeholder="Nouvelle requête" className="mt-1 w-[520px] max-w-full bg-transparent text-[28px] font-semibold tracking-[-0.02em] outline-none"/><p className="mt-1 text-[13px] text-muted-foreground">La sortie est toujours une liste de sessions.</p></div><div className="ml-auto text-right"><div className="text-[10.5px] text-muted-foreground">estimation · sans exécution</div><div className="mt-0.5 text-[24px] font-semibold tabular-nums text-foreground" aria-label="Estimation des sessions">{estimateLabel}</div><div className="text-[10.5px] text-muted-foreground">sessions trouvées</div>{dirty&&<div className="mt-1 text-[11.5px] text-warning">● Modifications non enregistrées</div>}</div></div>
      <div className="relative mt-5"><input aria-label="Recherche directe IMSI ou paramètre" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Recherche directe : IMSI ou nom de paramètre" className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-[var(--app-accent)]"/>{search.trim()&&<div className="absolute inset-x-0 top-11 z-20 rounded-lg border border-border bg-white p-2 shadow-lg">{identitySearch?<button type="button" onClick={addIdentity} className="w-full rounded-md px-3 py-2 text-left text-[12.5px] hover:bg-surface-2"><b>Identité</b> · IMSI se terminant par ••••{digits.slice(-4)} → ajouter une condition identité</button>:parameterSearch?<div className="rounded-md px-3 py-2 text-[12.5px] text-muted-foreground">{queryApiEnabled?'Recherche dans le catalogue oiran-api 2.19.0 activée.':'Catalogue de paramètres disponible avec oiran-api 2.19.0 — aucune valeur suggérée localement.'}</div>:null}</div>}</div>
    </header>
    <div className="mt-4 grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]"><aside className="polaris-card p-4"><div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Progression</div><ol className="mt-3 space-y-1">{STEPS.map(([title],index)=><li key={title}><button type="button" onClick={()=>setStep(index)} aria-current={step===index?'step':undefined} className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-[12.5px] ${step===index?'bg-brand-soft font-semibold text-[var(--app-accent)]':'text-muted-foreground hover:bg-surface-2'}`}><Icon>{index+1}</Icon>{title}</button></li>)}</ol></aside>
      <main className="polaris-card p-6"><div className="mb-6"><div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--app-accent)]">Étape {String(step+1).padStart(2,'0')} / 06</div><h1 className="mt-1 text-[22px] font-semibold">{STEPS[step][0]}</h1><p className="mt-1 text-[13px] text-muted-foreground">{STEPS[step][1]}</p></div>{stepBody}</main></div>
    <footer className="sticky bottom-0 mt-4 flex items-center gap-2 rounded-xl border border-border bg-white/95 p-3 shadow-sm backdrop-blur"><button type="button" onClick={cancel} className="h-9 px-3 rounded-md border border-border text-[12.5px]">← Retour aux requêtes</button><button type="button" disabled={step===0} onClick={()=>setStep(value=>Math.max(0,value-1))} className="ml-auto h-9 px-3 rounded-md border border-border text-[12.5px] disabled:opacity-40">← Retour</button>{step<5?<button type="button" onClick={()=>setStep(value=>Math.min(5,value+1))} className="h-9 px-4 rounded-md bg-[var(--app-accent)] text-white text-[12.5px] font-semibold">Suivant →</button>:null}<button type="button" onClick={run} className="h-9 px-4 rounded-md bg-[var(--app-accent)] text-white text-[12.5px] font-semibold">Exécuter la requête</button></footer>
  </div></div>;
}
