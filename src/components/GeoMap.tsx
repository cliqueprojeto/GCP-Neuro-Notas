import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarker { id: string; lat: number; lon: number; label: string; color?: string; tag?: string }

/** Mapa OpenStreetMap (Leaflet) com marcadores coloridos e, opcionalmente, o trajeto de uma rota. */
export function GeoMap({ markers, route, onMarker, height = 360, className = '' }: {
  markers: MapMarker[];
  route?: [number, number][] | null;
  onMarker?: (id: string) => void;
  height?: number | string;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const cb = useRef(onMarker);
  cb.current = onMarker;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.setView([-15.78, -47.93], 4);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    if (route?.length) {
      L.polyline(route, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(g);
      L.polyline(route, { color: '#7c3aed', weight: 5, opacity: 0.95 }).addTo(g);
      pts.push(...route);
    }
    for (const mk of markers) {
      if (!isFinite(mk.lat) || !isFinite(mk.lon)) continue;
      const icon = L.divIcon({
        className: 'gm-pin-wrap',
        html: `<span class="gm-pin" style="--pc:${mk.color || '#7c3aed'}">${mk.tag ? `<b>${mk.tag}</b>` : ''}</span>`,
        iconSize: [30, 40],
        iconAnchor: [15, 38],
        popupAnchor: [0, -34],
      });
      const marker = L.marker([mk.lat, mk.lon], { icon, title: mk.label }).addTo(g);
      marker.bindTooltip(mk.label.length > 60 ? mk.label.slice(0, 60) + '…' : mk.label, { direction: 'top', offset: [0, -34] });
      marker.on('click', () => cb.current?.(mk.id));
      pts.push([mk.lat, mk.lon]);
    }
    if (pts.length === 1) m.setView(pts[0], 15);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts as L.LatLngExpression[]), { padding: [36, 36], maxZoom: 16 });
  }, [markers, route]);

  return <div ref={el} className={'geo-map ' + className} style={{ height }} />;
}
