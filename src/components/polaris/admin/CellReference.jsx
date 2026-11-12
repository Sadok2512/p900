import React, { useState } from 'react';
import { useCellReference, useCellReferenceActivation, useCellReferenceImport, useCellReferenceValidation } from '@/lib/polaris-api';

const th='h-8 px-3 text-left font-medium text-muted-foreground bg-surface-2 border-b border-border-subtle';
const td='h-9 px-3 border-b border-border-subtle';
const MAX_BYTES=5*1024*1024;
const value=v=>v==null||v===''?'—':String(v);

export default function CellReference({Card}) {
  const catalogue=useCellReference(), validation=useCellReferenceValidation(), importer=useCellReferenceImport(), activation=useCellReferenceActivation();
  const [csv,setCsv]=useState(''); const [fileName,setFileName]=useState(''); const [localError,setLocalError]=useState('');
  const report=validation.data?.data; const list=catalogue.data?.data; const errors=report?.errors??[]; const preview=report?.preview??[];
  const choose=async event=>{
    const file=event.target.files?.[0]; setLocalError(''); setCsv(''); setFileName(file?.name??''); validation.reset(); importer.reset();
    if(!file) return;
    if(file.size>MAX_BYTES){setLocalError('Fichier trop volumineux : maximum 5 Mo.');return;}
    try { const text=await file.text(); setCsv(text); validation.mutate(text); } catch { setLocalError('Lecture du fichier impossible.'); }
  };
  const failure=localError||validation.error?.message||importer.error?.message||activation.error?.message;
  return <div className="space-y-5">
    <Card title="Importer un référentiel cellules">
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3"><label className="h-8 px-3 rounded-md border border-border bg-white text-[12.5px] grid place-items-center cursor-pointer hover:bg-surface-2">Sélectionner un CSV<input aria-label="Fichier CSV du référentiel" type="file" accept=".csv,text/csv" onChange={choose} className="sr-only"/></label><span className="text-[12px] text-muted-foreground">{fileName||'Aucun fichier sélectionné'} · maximum 5 Mo</span></div>
        {validation.isPending&&<div className="text-[12.5px] text-muted-foreground">Validation à blanc…</div>}
        {failure&&<div role="alert" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-[12px] text-danger">{failure}</div>}
        {report&&<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12.5px]"><div className="rounded-md border border-border p-3"><div className="text-muted-foreground">Cellules valides</div><div className="text-[20px] font-semibold">{report.valid_rows}</div></div><div className="rounded-md border border-border p-3"><div className="text-muted-foreground">Erreurs</div><div className={`text-[20px] font-semibold ${errors.length?'text-danger':'text-success'}`}>{errors.length}</div></div><div className="rounded-md border border-border p-3"><div className="text-muted-foreground">Technologies</div><div className="font-mono mt-1">{Object.entries(report.cells_by_technology??{}).map(([technology,count])=>`${technology}: ${count}`).join(' · ')||'—'}</div></div></div>}
        {!!preview.length&&<div className="overflow-auto rounded-md border border-border"><table className="w-full text-[12px]"><thead><tr>{['RAT','PLMN','gNB/eNB','NCI/ECI','Cell ID','Latitude','Longitude'].map(label=><th key={label} className={th}>{label}</th>)}</tr></thead><tbody>{preview.map((cell,index)=><tr key={`${cell.technology}-${cell.nci??cell.eci}-${index}`}><td className={td}>{cell.technology}</td><td className={`${td} font-mono`}>{cell.mcc}-{cell.mnc}</td><td className={`${td} font-mono`}>{value(cell.gnb_id??cell.enb_id)}</td><td className={`${td} font-mono`}>{value(cell.nci??cell.eci)}</td><td className={`${td} font-mono`}>{cell.cell_id}</td><td className={`${td} font-mono`}>{cell.latitude}</td><td className={`${td} font-mono`}>{cell.longitude}</td></tr>)}</tbody></table></div>}
        {!!errors.length&&<div className="overflow-auto rounded-md border border-danger-line"><table className="w-full text-[12px]"><thead><tr>{['Ligne','Colonne','Code','Message'].map(label=><th key={label} className={`${th} text-danger`}>{label}</th>)}</tr></thead><tbody>{errors.map((error,index)=><tr key={`${error.line}-${error.column}-${error.code}-${index}`} className="bg-danger-soft text-danger"><td className={td}>{error.line}</td><td className={td}>{error.column}</td><td className={`${td} font-mono`}>{error.code}</td><td className={td}>{error.message}</td></tr>)}</tbody></table></div>}
        <div className="flex items-center gap-3"><button type="button" disabled={!csv||!report||errors.length>0||validation.isPending||importer.isPending} onClick={()=>importer.mutate(csv)} className="h-8 px-3 rounded-md bg-[var(--app-accent)] text-white text-[12.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed">{importer.isPending?'Import en cours…':"Confirmer l'import"}</button>{importer.isSuccess&&<span className="text-[12px] text-success">Snapshot importé.</span>}</div>
      </div>
    </Card>
    <Card title="Snapshots du référentiel">
      {catalogue.isError?<div role="alert" className="p-4 text-[12px] text-danger">{catalogue.error.message}</div>:<div className="overflow-auto"><table className="w-full text-[12.5px]"><thead><tr>{['Snapshot','Cellules','Technologies','Importé','État','Action'].map(label=><th key={label} className={th}>{label}</th>)}</tr></thead><tbody>{(list?.snapshots??[]).map(snapshot=>{const active=list?.active_snapshot_id===snapshot.snapshot_id;return <tr key={snapshot.snapshot_id}><td className={`${td} font-mono`}>{snapshot.snapshot_id}</td><td className={td}>{snapshot.cell_count}</td><td className={td}>{Object.entries(snapshot.cells_by_technology??{}).map(([technology,count])=>`${technology}: ${count}`).join(' · ')||'—'}</td><td className={td}>{snapshot.imported_epoch_ms?new Date(snapshot.imported_epoch_ms).toISOString():'—'}</td><td className={td}>{active?'Actif':'Inactif'}</td><td className={td}><button type="button" disabled={active||activation.isPending} onClick={()=>activation.mutate(snapshot.snapshot_id)} className="h-7 px-2.5 rounded border border-border bg-white hover:bg-surface-2 disabled:opacity-40">Activer</button></td></tr>})}{!catalogue.isPending&&!(list?.snapshots??[]).length&&<tr><td colSpan="6" className="p-4 text-subtle">Aucun snapshot importé.</td></tr>}</tbody></table></div>}
    </Card>
  </div>;
}
