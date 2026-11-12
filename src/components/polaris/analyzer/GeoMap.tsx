import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoPoint } from './geo';

maplibregl.setWorkerUrl(workerUrl);
const OSM: maplibregl.StyleSpecification = { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] };
const STYLE: Record<'light' | 'dark' | 'osm', string | maplibregl.StyleSpecification> = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark', osm: OSM };
// Map marker colours: NR blue / LTE green, UE in ink (signalling-style inline colours).
const RAT_C: Record<string, string> = { NR: '#2563EB', LTE: '#16A34A' };
function markerEl(p: GeoPoint, active: boolean) {
  const el = document.createElement('button'); el.type = 'button';
  const c = p.kind === 'cell' ? RAT_C[p.rat ?? ''] ?? '#64748B' : '#0F172A';
  el.setAttribute('aria-label', p.label);
  el.style.cssText = p.kind === 'cell'
    ? `width:${active ? 18 : 14}px;height:${active ? 18 : 14}px;background:${p.serving ? c : '#fff'};border:2px solid ${c};transform:rotate(45deg);border-radius:3px;cursor:pointer;box-shadow:${active ? `0 0 0 4px ${c}33` : 'none'}`
    : p.kind === 'ue-actual'
      ? `width:14px;height:14px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 0 0 2px ${c};cursor:pointer`
      : `width:16px;height:16px;border-radius:50%;background:#fff;border:2px dashed ${c};cursor:pointer`;
  return el;
}
export default function GeoMap({ points, trajectory, theme, activeCell, onPick }: { points: GeoPoint[]; trajectory: GeoPoint[]; theme: 'light' | 'dark' | 'osm'; activeCell: string | null; onPick: (p: GeoPoint) => void }) {
  const box = useRef<HTMLDivElement>(null); const map = useRef<maplibregl.Map | null>(null); const markers = useRef<maplibregl.Marker[]>([]);
  const pick = useRef(onPick); pick.current = onPick;
  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({ container: box.current, style: STYLE[theme], center: [2.35, 48.85], zoom: 3, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.FullscreenControl(), 'top-right');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.current = m;
    const ro = new ResizeObserver(() => m.resize()); ro.observe(box.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);
  useEffect(() => { map.current?.setStyle(STYLE[theme]); }, [theme]);
  useEffect(() => {
    const m = map.current; if (!m) return;
    markers.current.forEach(x => x.remove());
    markers.current = points.map(p => { const el = markerEl(p, p.kind === 'cell' && p.cellId != null && p.cellId === activeCell); el.title = p.label; el.onclick = e => { e.stopPropagation(); pick.current(p); }; return new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(m); });
    const draw = () => {
      const data = { type: 'FeatureCollection' as const, features: trajectory.length ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: trajectory.map(p => [p.lon, p.lat]) } }] : [] };
      const src = m.getSource('traj') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data); else { m.addSource('traj', { type: 'geojson', data }); m.addLayer({ id: 'traj', type: 'line', source: 'traj', paint: { 'line-color': '#0F172A', 'line-width': 2, 'line-dasharray': [2, 1] } }); }
    };
    if (m.isStyleLoaded()) draw(); m.on('styledata', draw);
    if (points.length) { const b = new maplibregl.LngLatBounds(); points.forEach(p => b.extend([p.lon, p.lat])); m.fitBounds(b, { padding: 50, maxZoom: 15, duration: 0 }); }
    return () => { m.off('styledata', draw); };
  }, [points, trajectory, activeCell]);
  return <div ref={box} className="absolute inset-0" />;
}
