import { createContext, useContext, useState, type ReactNode } from 'react';
import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request, requestFrom, PolarisApiError, type RequestOptions } from './client';
import { demoResponse } from './demo';
import { ALL_KPIS, mockSeries, seedRand, SAVED } from './demo/catalogue';
import { TR_CATS, TR_APPS, TR_CELLS, TR_V, TR_FLOWS } from './demo/traffic';
import { SYS_DASH, ANOMS } from './demo/kpi';
import { DIR, S5G, SLTE, NODES, IFC_C } from './demo/live';
import { records, toLegacyCallflow, filterBody, querySupport, type Draft } from './adapters';
import type { Health, Version, Metrics, Safety, Session, SessionCells, Event, Probe, RecordData, QueryParams, Envelope, Correlation, SessionIdentities, CellReferenceList, CellReferenceReport } from './types';
const Mode = createContext({ demo: false, setDemo: (_value: boolean) => {} });
export function PolarisDataProvider({ children }: { children: ReactNode }) { const [demo, setDemo] = useState(false); return <Mode.Provider value={{ demo, setDemo }}>{children}</Mode.Provider>; }
export const usePolarisMode = () => useContext(Mode);
export const resourceOptions = <T,>(path: string, params: QueryParams = {}, demo = false, requestOptions: RequestOptions = {}) => queryOptions({ queryKey: ['polaris', demo ? 'demo' : 'api', path, params], queryFn: ({ signal }) => { const fixture = demo ? demoResponse<T>(path, params) : undefined; return fixture ? Promise.resolve(fixture) : request<T>(path, { ...requestOptions, params, signal }); }, staleTime: path === '/auth/me' ? 30_000 : 15_000, retry: false, refetchOnWindowFocus: false });
export function useResource<T>(path: string, params: QueryParams = {}, enabled = true, allowDemo = true, requestOptions: RequestOptions = {}) {
  const { demo } = usePolarisMode();
  return useQuery({ ...resourceOptions<T>(path, params, allowDemo && demo, requestOptions), enabled });
}
export const useHealth = () => useQuery({ ...resourceOptions<Health>('/health', {}, false, { timeoutMs: 8_000 }), refetchInterval: 5_000, refetchIntervalInBackground: true });
export const useVersion = () => useQuery({ ...resourceOptions<Version>('/version', {}, false), refetchInterval: 30_000, refetchIntervalInBackground: true });
export const useMetrics = () => useResource<Metrics>('/metrics');
export const useLiveMetrics = () => useQuery({ ...resourceOptions<Metrics>('/metrics', {}, false), refetchInterval: 5_000, refetchIntervalInBackground: true });
export const useStorageSafety = () => useQuery({ ...resourceOptions<Safety>('/storage/safety', {}, false), refetchInterval: 15_000, refetchIntervalInBackground: true });
export const useSessions = (params: QueryParams = {}, enabled = true) => useResource<Session[]>('/sessions', params, enabled);
const idPath = (id: string | number | null | undefined) => encodeURIComponent(String(id ?? ''));
const detailRequest = { priority: 'detail' as const, timeoutMs: 60_000 };
export const useSession = (id?: string | number | null) => useResource<Session>(`/sessions/${idPath(id)}`, {}, id != null, true, detailRequest);
export const useEvents = (id?: string | number | null) => useResource<Event[]>(`/sessions/${idPath(id)}/events`, {}, id != null, true, detailRequest);
export const useProcedures = (id?: string | number | null) => useResource<RecordData[]>(`/sessions/${idPath(id)}/procedures`, {}, id != null, true, detailRequest);
export const useCallflow = (id?: string | number | null) => useResource<RecordData | Event[]>(`/sessions/${idPath(id)}/callflow`, {}, id != null, true, detailRequest);
export const useCorrelations = (id?: string | number | null) => useResource<Correlation[] | { edges: Correlation[] }>(`/sessions/${idPath(id)}/correlations`, {}, id != null, true, detailRequest);
export const useSessionCells = (id?: string | number | null) => useResource<SessionCells>(`/sessions/${idPath(id)}/cells`, {}, id != null, true, detailRequest);
export const useEvent = (id?: string | number | null, clearIdentities=false) => useQuery({ queryKey:['polaris','api','event',id,clearIdentities?'clear':'redacted'], queryFn:({signal})=>request<Event>(`/events/${idPath(id)}`,{signal,clearIdentityResponse:clearIdentities}), enabled:id!=null, retry:false, refetchOnWindowFocus:false });
export const useProvenance = (id?: string | number | null) => useResource<RecordData>(`/events/${idPath(id)}/provenance`, {}, id != null);
export const usePackets = (params: QueryParams = {}, enabled = true) => useResource<RecordData[]>('/packets', params, enabled);
export const usePacket = (id?: string | number | null) => useResource<RecordData>(`/packets/${idPath(id)}`, {}, id != null);
export const useUes = (params: QueryParams = {}) => useResource<RecordData[]>('/ues', params);
export const useUe = (id?: string | number | null) => useResource<RecordData>(`/ues/${idPath(id)}`, {}, id != null);
export const useUeSessions = (id?: string | number | null) => useResource<Session[]>(`/ues/${idPath(id)}/sessions`, {}, id != null);
export const useDatasets = () => useResource<RecordData[]>('/datasets');
export const useDatasetSessions = (id?: string | number | null) => useResource<Session[]>(`/datasets/${idPath(id)}/sessions`, {}, id != null);
export const useLteSessions = (id?: string | number | null) => useResource<Session[]>(`/lte/evidence/${idPath(id)}/sessions`, {}, id != null);
export const useAvailableCauses = () => useResource<unknown[]>('/sessions/available_causes');
export const useProbes = () => { const { demo } = usePolarisMode(); return useQuery({ ...resourceOptions<Probe[]>('/probes', {}, demo), refetchInterval: 5_000, refetchIntervalInBackground: true }); };
export function useCreateProbe() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body: RecordData) => request<Probe>('/probes', { method: 'POST', body }), onSuccess: () => { client.invalidateQueries({ queryKey: ['polaris', 'api', '/probes'] }); } });
}
export function useManageProbe() {
  const client=useQueryClient();
  return useMutation({ mutationFn: ({ action, id, body }: { action: 'edit' | 'delete' | 'software'; id: string; body: RecordData }) => {
    const encoded=idPath(id);
    const path=action==='software'?`/probes/${encoded}/software-update`:`/probes/${encoded}`;
    const method=action==='edit'?'PUT':action==='delete'?'DELETE':'POST';
    return request<Probe>(path,{method,body});
  }, onSuccess:()=>{ client.invalidateQueries({queryKey:['polaris']}); } });
}
export const useProbe = (id?: string | number | null) => useResource<Probe>(`/probes/${idPath(id)}`, {}, id != null);
export const useProbeInterfaces = (id?: string | number | null) => useResource<RecordData[]>(`/probes/${idPath(id)}/interfaces`, {}, id != null);
export const useInterfaces = () => { const { demo } = usePolarisMode(); return useQuery({ ...resourceOptions<RecordData[]>('/interfaces', {}, demo), refetchInterval: 15_000, refetchIntervalInBackground: true }); };
export const useInterfaceRuntime = () => { const { demo } = usePolarisMode(); return useQuery({ ...resourceOptions<RecordData[]>('/interfaces/runtime', {}, demo), refetchInterval: 5_000, refetchIntervalInBackground: true }); };
export const useCaptures = () => useResource<RecordData[]>('/captures');
export const useCaptureMetrics = (id?: string | number | null) => useResource<Metrics>(`/captures/${idPath(id)}/metrics`, {}, id != null);
export const useModules = () => useResource<RecordData[]>('/modules');
export const useCorrelationRules = () => useResource<RecordData[]>('/correlation/rules');
export function useProbeResources(id?: string | number | null) { return { probe: useProbe(id), interfaces: useInterfaces(), probeInterfaces: useProbeInterfaces(id), captures: useCaptures(), modules: useModules() }; }
export function useSessionBundle(id?: string | number | null) {
  const { demo } = usePolarisMode();
  const session = useSession(id), events = useEvents(demo ? null : id), procedures = useProcedures(demo ? null : id), callflow = useCallflow(demo ? null : id), correlations = useCorrelations(demo ? null : id), cells = useSessionCells(demo ? null : id);
  const detail = demo ? null : toLegacyCallflow(callflow.data?.data ?? events.data?.data, procedures.data?.data, correlations.data?.data);
  return { session, events, procedures, callflow, correlations, cells, detail };
}
export function useSessionFilter() {
  const { demo } = usePolarisMode(); const client = useQueryClient();
  return useMutation({ mutationFn: async (draft: Draft) => { const unsupported = querySupport(draft, demo); if (unsupported) throw new PolarisApiError('UNAVAILABLE', unsupported, 0); return demo ? demoResponse<Session[]>('/sessions/filter') as Envelope<Session[]> : request<Session[]>('/sessions/filter', { method: 'POST', body: filterBody(draft) }); }, onSuccess: () => { client.invalidateQueries({ queryKey: ['polaris', 'api', '/sessions'] }); } });
}
export function useCaptureAction() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async ({ action, id, target }: { action: 'start' | 'validate' | 'stop'; id?: string | number; target?: string }) => request<RecordData>(action === 'stop' ? `/captures/${idPath(id)}/stop` : `/captures/${action}`, { method: 'POST', body: { target } }), onSuccess: () => { client.invalidateQueries({ queryKey: ['polaris'] }); } });
}
// Catalogue definitions are not measured values. Only the demo adapter can generate series.
export function useKpiCatalogue() { const { demo } = usePolarisMode(); return { catalogue: ALL_KPIS, mockSeries: demo ? mockSeries : () => [], seedRand }; }
export function useDemoLibrary() { const { demo } = usePolarisMode(); return { saved: demo ? SAVED : [], tabs: demo ? [{id:'t1',k:'Requête',n:'Échecs · run 482',conds:[['Résultat','Échec']]},{id:'t2',k:'Session',n:'UE-9b14 · PDU Session',conds:[['UE','UE-9b14']]},{id:'t3',k:'Comparaison',n:'UE-9b14 ↔ UE-7f3a',ue:['UE-9b14','UE-7f3a'],conds:[]},{id:'t4',k:'Trace',n:'UE-7f3a',ue:['UE-7f3a'],conds:[]}] : [] }; }
export function useLiveDemo() { const { demo } = usePolarisMode(); return { demo, directory: demo ? DIR : {}, scripts: demo ? { '5G': S5G, LTE: SLTE } : {}, nodes: NODES, colors: IFC_C }; }
export { records };

export function useTrafficDemo() { const { demo } = usePolarisMode(); return { TR_CATS: demo ? TR_CATS : [], TR_APPS: demo ? TR_APPS : [], TR_CELLS: demo ? TR_CELLS : [], TR_FLOWS: demo ? TR_FLOWS : [], TR_V, seedRand }; }
export function useKpiDemo() { const { demo } = usePolarisMode(); return { dashboards: demo ? SYS_DASH : [], anomalies: demo ? ANOMS : [] }; }

// Subscriber journey (OIRAN 2.13.0) and identity vault (operator, 2.12.0). Absent routes surface as errors, never as invented data.
const pseudoPath = (p?: string | null) => encodeURIComponent(String(p ?? ''));
export const useSubscriberJourney = (p?: string | null) => useResource<RecordData>(`/subscribers/${pseudoPath(p)}/journey`, {}, !!p, true);
export const useSubscriberTmsi = (p?: string | null, clearIdentities=false) => useQuery({ queryKey:['polaris','api','subscriber-tmsi',p,clearIdentities?'clear':'redacted'], queryFn:({signal})=>request<RecordData[]>(`/subscribers/${pseudoPath(p)}/tmsi`,{signal,clearIdentityResponse:clearIdentities}), enabled:!!p, retry:false, refetchOnWindowFocus:false });
export const useSessionIdentities = (id?: string | null, enabled = true) => useQuery({ queryKey:['polaris','clear-identities','session',id], queryFn:({signal})=>request<SessionIdentities>(`/sessions/${idPath(id)}/identities`,{signal,clearIdentityResponse:true,...detailRequest}), enabled:!!id&&enabled, retry:false, refetchOnWindowFocus:false });
export const useIdentityLookup = (q: string, enabled=true) => useQuery({ queryKey:['polaris','clear-identities','lookup',q], queryFn:({signal})=>request<RecordData>('/identities',{params:{q},signal,clearIdentityResponse:true}), enabled:enabled&&q.trim().length>=4, retry:false, refetchOnWindowFocus:false });
export const usePacketDissection = (captureId?: string | null, packetNumber?: number | null, enabled=true) => useQuery({ queryKey:['polaris','api','dissect',captureId,packetNumber], queryFn:({signal})=>request<RecordData>(`/packets/${idPath(captureId)}/${packetNumber}/dissect`,{signal,clearIdentityResponse:true}), enabled:enabled&&!!captureId&&packetNumber!=null, retry:false, refetchOnWindowFocus:false });
// Administration (no demo): users, roles and audit come only from the lab server, which enforces permissions.
export const useAdminUsers = () => useResource<RecordData[]>('/users', {}, true, false);
export const useAdminRoles = () => useResource<RecordData[]>('/roles', {}, true, false);
export const useAuditLog = () => useResource<RecordData[]>('/audit', {}, true, false);
export const useCellReference = () => useResource<CellReferenceList>('/cell-reference', {}, true, false);
export function useCellReferenceValidation() {
  return useMutation({mutationFn:(csv:string)=>request<CellReferenceReport>('/cell-reference',{method:'POST',params:{dry_run:true},rawBody:csv,contentType:'text/csv'})});
}
export function useCellReferenceImport() {
  const client=useQueryClient();
  return useMutation({mutationFn:(csv:string)=>request<RecordData>('/cell-reference',{method:'POST',rawBody:csv,contentType:'text/csv'}),onSuccess:()=>client.invalidateQueries({queryKey:['polaris']})});
}
export function useCellReferenceActivation() {
  const client=useQueryClient();
  return useMutation({mutationFn:(snapshotId:string)=>request<RecordData>(`/cell-reference/${idPath(snapshotId)}/activate`,{method:'POST'}),onSuccess:()=>client.invalidateQueries({queryKey:['polaris']})});
}
const polarisOptions = <T,>(path: string, options: RequestOptions = {}) => queryOptions({ queryKey: ['polaris-control', path], queryFn: ({ signal }) => requestFrom<T>('/polaris-api/v1', path, { ...options, signal }), staleTime: 5_000, retry: false, refetchOnWindowFocus: false });
export const usePolarisControlHealth = () => useQuery({ ...polarisOptions<Health>('/health', { timeoutMs: 8_000 }), refetchInterval: 5_000, refetchIntervalInBackground: true });
// Unreachable simulator: back off to 60 s so the topology stops flickering every 5 s.
const simulatorPoll = (q: { state: { status: string } }) => (q.state.status === 'error' ? 60_000 : 15_000);
export const usePolarisLab = () => useQuery({ ...polarisOptions<RecordData>('/lab'), refetchInterval: simulatorPoll });
export const usePolarisNodes = () => useQuery({ ...polarisOptions<RecordData>('/nodes'), refetchInterval: simulatorPoll });
export const usePolarisUes = () => useQuery({ ...polarisOptions<RecordData>('/ues'), refetchInterval: simulatorPoll });
export function useInterfaceMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ action, name, body }: { action: 'add' | 'update' | 'delete' | 'rollback'; name?: string; body?: RecordData }) => {
    const suffix = name ? `/${encodeURIComponent(name)}` : '';
    const path = action === 'rollback' ? `/interfaces${suffix}/rollback` : `/interfaces${suffix}`;
    const method = action === 'add' ? 'POST' : action === 'update' ? 'PUT' : action === 'delete' ? 'DELETE' : 'POST';
    return request<RecordData>(path, { method, body });
  }, onSuccess: () => { client.invalidateQueries({ queryKey: ['polaris'] }); } });
}
