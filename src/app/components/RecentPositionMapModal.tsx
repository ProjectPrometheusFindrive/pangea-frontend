import { useEffect, useRef, useState } from 'react';
import { X, Loader2, MapPin } from 'lucide-react';
import { getGeotabRecentPositions, type GeotabPosition } from '../../services/geotab';
import { TelemetryRouteMap } from './TelemetryRouteMap';
import { queryKakaoAddress } from '../../services/kakaoAddress.js';

interface RecentPositionMapModalProps { vehicleId: string; vehicleLabel: string; companyId?: string; onClose: () => void; }

export function RecentPositionMapModal({ vehicleId, vehicleLabel, companyId, onClose }: RecentPositionMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [positions, setPositions] = useState<GeotabPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [addressStatus, setAddressStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const hasMapKey = Boolean(import.meta.env.VITE_KAKAO_MAP_API_KEY);
  const latest = positions[positions.length - 1];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setPositions([]);
    getGeotabRecentPositions(vehicleId, { signal: controller.signal, companyId })
      .then((payload) => { if (!controller.signal.aborted) setPositions(Array.isArray(payload.positions) ? payload.positions : []); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '최근 위치를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [vehicleId, companyId]);

  useEffect(() => {
    setAddress(null);
    setAddressStatus(hasMapKey ? 'loading' : 'unavailable');
    if (!latest || !hasMapKey) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => { if (!cancelled) setAddressStatus('unavailable'); }, 10000);
    if (mapsReady) {
      const services = (window as any).kakao?.maps?.services;
      queryKakaoAddress(services, latest.longitude, latest.latitude, (name: string | null) => {
          if (cancelled) return;
          window.clearTimeout(timeout);
          setAddress(name || null);
          setAddressStatus(name ? 'ready' : 'unavailable');
      });
    }
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [latest?.latitude, latest?.longitude, mapsReady, hasMapKey, vehicleId, companyId]);

  useEffect(() => {
    const key = import.meta.env.VITE_KAKAO_MAP_API_KEY as string | undefined;
    if (!key) return;
    let alive = true;
    let poll: number | undefined;
    const timeout = window.setTimeout(() => { if (alive) { setMapFailed(true); setAddressStatus('unavailable'); } window.clearInterval(poll); }, 10000);
    const ready = () => { if (alive) { window.clearTimeout(timeout); setMapsReady(true); setMapFailed(false); } };
    const load = () => { if ((window as any).kakao?.maps) { window.clearInterval(poll); (window as any).kakao.maps.load(ready); } };
    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existing) { poll = window.setInterval(load, 100); load(); }
    else {
      const script = document.createElement('script');
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`;
      script.onload = load;
      script.onerror = () => { if (alive) { window.clearTimeout(timeout); setMapFailed(true); setAddressStatus('unavailable'); } };
      document.head.appendChild(script);
    }
    return () => { alive = false; window.clearTimeout(timeout); window.clearInterval(poll); };
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current || positions.length === 0) return;
    const kakao = (window as any).kakao;
    const points = positions.map((item) => new kakao.maps.LatLng(item.latitude, item.longitude));
    mapRef.current = new kakao.maps.Map(mapContainerRef.current, { center: points[0], level: 7 });
    const bounds = new kakao.maps.LatLngBounds();
    const line = new kakao.maps.Polyline({ path: points, strokeWeight: 4, strokeColor: '#2563eb', strokeOpacity: 0.8 });
    line.setMap(mapRef.current); overlaysRef.current.push(line);
    points.forEach((point: any) => bounds.extend(point));
    const startMarker = new kakao.maps.Marker({ position: points[0], title: '경로 시작' });
    const latestMarker = new kakao.maps.Marker({ position: points[points.length - 1], title: '최근 위치' });
    startMarker.setMap(mapRef.current);
    latestMarker.setMap(mapRef.current);
    overlaysRef.current.push(startMarker, latestMarker);
    mapRef.current.setBounds(bounds, 40);
    return () => { overlaysRef.current.forEach((overlay) => overlay.setMap(null)); overlaysRef.current = []; mapRef.current = null; };
  }, [mapsReady, positions]);

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="최근 위치 조회">
    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold text-gray-900">최근 위치 조회</h2><p className="text-xs text-gray-500">{vehicleLabel}</p></div><button type="button" onClick={onClose} aria-label="최근 위치 조회 닫기" className="rounded p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
      <div className="min-h-0 overflow-y-auto">
      {loading && <div className="flex items-center gap-2 p-5 text-sm text-blue-700"><Loader2 className="h-4 w-4 animate-spin" />최근 위치를 불러오는 중입니다.</div>}
      {error && <p className="m-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!loading && !error && positions.length === 0 && <p className="m-5 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">최근 위치 데이터가 없습니다.</p>}
      {latest && <section aria-label="마지막 위치 주소" className="border-b px-5 py-3 text-sm">
        <p className="font-semibold text-gray-900">마지막 위치</p>
        <p aria-live="polite" className="mt-1 text-gray-800">{address || (addressStatus === 'loading' ? '주소를 조회하는 중입니다.' : '주소를 확인할 수 없습니다. 아래 좌표를 참고해 주세요.')}</p>
        <p className="mt-1 text-xs text-gray-500">관측 시각 {new Date(latest.recordedAt).toLocaleString('ko-KR')} · {latest.latitude.toFixed(5)}, {latest.longitude.toFixed(5)}</p>
      </section>}
      <div className="relative">
        {(!hasMapKey || mapFailed) && positions.length > 0 ? <TelemetryRouteMap positions={positions} /> : <div ref={mapContainerRef} className="min-h-[360px] w-full bg-slate-100" aria-label="최근 위치 경로 지도" />}
      </div>
      {positions.length > 0 && <div className="max-h-32 overflow-y-auto border-t px-5 py-3 text-xs text-gray-600">{positions.slice(-5).reverse().map((position, index) => <div key={`${position.recordedAt}-${index}`} className="flex items-center gap-2"><MapPin className={`h-3 w-3 ${index === 0 ? 'text-red-600' : 'text-blue-600'}`} />{index === 0 ? '최근 위치 · ' : ''}{new Date(position.recordedAt).toLocaleString('ko-KR')} · {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}</div>)}</div>}
      </div>
    </div>
  </div>;
}
