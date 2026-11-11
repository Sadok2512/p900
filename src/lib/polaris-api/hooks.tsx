import { createContext, useContext, useState, type ReactNode } from 'react';
import { queryOptions, useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { request, PolarisApiError } from './client';
import { demoResponse } from './demo';
import { ALL_KPIS, mockSeries, seedRand, SAVED } from './demo/catalogue';
import { TR_CATS, TR_APPS, TR_CELLS, TR_V, TR_FLOWS } from './demo/traffic';
import { SYS_DASH, ANOMS } from './demo/kpi';
import { DIR, S5G, SLTE, NODES, IFC_C } from './demo/live';
import { records, toLegacyCallflow, filterBody, querySupport, canCapture, type Draft } from './adapters';
import type { AuthMe, Health, Version, Metrics, Safety, Session, Event, Probe, RecordData, QueryParams, Envelope, Correlation } from './types';
const Mode = createContext({ demo: false, setDemo: (_value: boolean) => {} });
export function PolarisDataProvider({ children }: { children: ReactNode }) { const [demo, setDemo] = useState(false); return <Mode.Provider value={{ demo, setDemo }}>{children}</Mode.Provider>; }
export const usePolarisMode = () => useContext(Mode);
export const resourceOptions = <T,>(path: string, params: QueryParams = {}, demo = false) => queryOptions({ queryKey: ['polaris', demo ? 'demo' : 'api', path, params], queryFn: ({ signal }) => { const fixture = demo ? demoResponse<T>(path) : undefined; return fixture ? Promise.resolve(fixture) : request<T>(path, { params, signal }); }, staleTime: path === '/auth/me' ? 30_000 : 15_000, retry: false, refetchOnWindowFocus: false });
export function useResource<T>(path: string, params: QueryParams = {}, enabled = true, allowDemo = true) {
  const { demo } = usePolarisMode();
  return useQuery({ ...resourceOptions<T>(path, params, allowDemo && demo), enabled });
}
export const useAuthMe = () => useResource<AuthMe>('/auth/me', {}, true, false);
export const useHealth = () => useResource<Health>('/health');
export const useVersion = () => useResource<Version>('/version', {}, true, false);
export const useMetrics = () => useResource<Metrics>('/metrics');
export const useLiveMetrics = () => useQuery({ ...resourceOptions<Metrics>('/metrics', {}, false), refetchInterval: 10_000, refetchIntervalInBackground: true });
export const useStorageSafety = () => useResource<Safety>('/storage/safety');
export const useSessions = (params: QueryParams = {}, enabled = true) => useResource<Session[]>('/sessions', params, enabled);
const idPath = (id: string | number | null | undefined) => encodeURIComponent(String(id ?? ''));
export const useSession = (id?: string | number | null) => useResource<Session>(`/sessions/${idPath(id)}`, {}, id != null);
export const useEvents = (id?: string | number | null) => useResource<Event[]>(`/sessions/${idPath(id)}/events`, {}, id != null);
export const useProcedures = (id?: string | number | null) => useResource<RecordData[]>(`/sessions/${idPath(id)}/procedures`, {}, id != null);
export const useCallflow = (id?: string | number | null) => useResource<RecordData | Event[]>(`/sessions/${idPath(id)}/callflow`, {}, id != null);
export const useCorrelations = (id?: string | number | null) => useResource<Correlation[] | { edges: Correlation[] }>(`/sessions/${idPath(id)}/correlations`, {}, id != null);
export function useSessionAnchors(sessions: Session[], enabled = true): Record<string, Event | undefined> {
  const rows = sessions.filter(session => session.session_id);
  const queries = useQueries({ queries: rows.map(session => ({ ...resourceOptions<RecordData | Event[]>(`/sessions/${idPath(session.session_id)}/callflow`, {}, false), enabled })) });
  return Object.fromEntries(rows.map((session, index) => {
    const value = queries[index]?.data?.data;
    const body = value && typeof value === 'object' && !Array.isArray(value) ? value as RecordData : {};
    return [String(session.session_id), records<Event>(Array.isArray(value) ? value : body['events'] ?? body['messages'])[0]];
  }));
}
export const useEvent = (id?: string | number | null) => useResource<Event>(`/events/${idPath(id)}`, {}, id != null);
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
export const useProbes = () => useResource<Probe[]>('/probes');
export const useProbe = (id?: string | number | null) => useResource<Probe>(`/probes/${idPath(id)}`, {}, id != null);
export const useProbeInterfaces = (id?: string | number | null) => useResource<RecordData[]>(`/probes/${idPath(id)}/interfaces`, {}, id != null);
export const useInterfaces = () => useResource<RecordData[]>('/interfaces');
export const useCaptures = () => useResource<RecordData[]>('/captures');
export const useCaptureMetrics = (id?: string | number | null) => useResource<Metrics>(`/captures/${idPath(id)}/metrics`, {}, id != null);
export const useModules = () => useResource<RecordData[]>('/modules');
export const useCorrelationRules = () => useResource<RecordData[]>('/correlation/rules');
export function useProbeResources(id?: string | number | null) { return { probe: useProbe(id), interfaces: useInterfaces(), probeInterfaces: useProbeInterfaces(id), captures: useCaptures(), modules: useModules() }; }
export function useSessionBundle(id?: string | number | null) {
  const { demo } = usePolarisMode();
  const session = useSession(id), events = useEvents(demo ? null : id), procedures = useProcedures(demo ? null : id), callflow = useCallflow(demo ? null : id), correlations = useCorrelations(demo ? null : id);
  const detail = demo ? null : toLegacyCallflow(callflow.data?.data ?? events.data?.data, procedures.data?.data, correlations.data?.data);
  return { session, events, procedures, callflow, correlations, detail };
}
export function useSessionFilter() {
  const { demo } = usePolarisMode(); const client = useQueryClient();
  return useMutation({ mutationFn: async (draft: Draft) => { const unsupported = querySupport(draft, demo); if (unsupported) throw new PolarisApiError('UNAVAILABLE', unsupported, 0); return demo ? demoResponse<Session[]>('/sessions/filter') as Envelope<Session[]> : request<Session[]>('/sessions/filter', { method: 'POST', body: filterBody(draft) }); }, onSuccess: () => { client.invalidateQueries({ queryKey: ['polaris', 'api', '/sessions'] }); } });
}
export function useCaptureAction(role: unknown, coordinationOpen: unknown) {
  const client = useQueryClient();
  return useMutation({ mutationFn: async ({ action, id, target, confirmed }: { action: 'start' | 'validate' | 'stop'; id?: string | number; target?: string; confirmed: boolean }) => { if (!canCapture(role, coordinationOpen) || !confirmed) throw new PolarisApiError('FORBIDDEN', 'Accès refusé (rôle)', 403); return request<RecordData>(action === 'stop' ? `/captures/${idPath(id)}/stop` : `/captures/${action}`, { method: 'POST', body: { target } }); }, onSuccess: () => { client.invalidateQueries({ queryKey: ['polaris'] }); } });
}
// Catalogue definitions are not measured values. Only the demo adapter can generate series.
export function useKpiCatalogue() { const { demo } = usePolarisMode(); return { catalogue: ALL_KPIS, mockSeries: demo ? mockSeries : () => [], seedRand }; }
export function useDemoLibrary() { const { demo } = usePolarisMode(); return { saved: demo ? SAVED : [], tabs: demo ? [{id:'t1',k:'Requête',n:'Échecs · run 482',conds:[['Résultat','Échec']]},{id:'t2',k:'Session',n:'UE-9b14 · PDU Session',conds:[['UE','UE-9b14']]},{id:'t3',k:'Comparaison',n:'UE-9b14 ↔ UE-7f3a',ue:['UE-9b14','UE-7f3a'],conds:[]},{id:'t4',k:'Trace',n:'UE-7f3a',ue:['UE-7f3a'],conds:[]}] : [] }; }
export function useLiveDemo() { const { demo } = usePolarisMode(); return { demo, directory: demo ? DIR : {}, scripts: demo ? { '5G': S5G, LTE: SLTE } : {}, nodes: NODES, colors: IFC_C }; }
export { records };

export function useTrafficDemo() { const { demo } = usePolarisMode(); return { TR_CATS: demo ? TR_CATS : [], TR_APPS: demo ? TR_APPS : [], TR_CELLS: demo ? TR_CELLS : [], TR_FLOWS: demo ? TR_FLOWS : [], TR_V, seedRand }; }
export function useKpiDemo() { const { demo } = usePolarisMode(); return { dashboards: demo ? SYS_DASH : [], anomalies: demo ? ANOMS : [] }; }
