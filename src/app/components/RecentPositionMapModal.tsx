import { useEffect, useRef, useState } from 'react';
import { X, Loader2, MapPin } from 'lucide-react';
import { getGeotabRecentPositions, type GeotabPosition } from '../../services/geotab';

interface RecentPositionMapModalProps { vehicleId: string; vehicleLabel: string; onClose: () => void; }

export function RecentPositionMapModal({ vehicleId, vehicleLabel, onClose }: RecentPositionMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [positions, setPositions] = useState<GeotabPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const hasMapKey = Boolean(import.meta.env.VITE_KAKAO_MAP_API_KEY);

  useEffect(() => {
    const controller = new AbortController();
    getGeotabRecentPositions(vehicleId, { signal: controller.signal })
      .then((payload) => setPositions(Array.isArray(payload.positions) ? payload.positions : []))
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '최근 위치를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [vehicleId]);

  useEffect(() => {
    const key = import.meta.env.VITE_KAKAO_MAP_API_KEY as string | undefined;
    if (!key) return;
    const ready = () => setMapsReady(true);
    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existing) { const timer = window.setInterval(() => { if ((window as any).kakao?.maps) { window.clearInterval(timer); (window as any).kakao.maps.load(ready); } }, 100); return () => window.clearInterval(timer); }
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`;
    script.onload = () => (window as any).kakao?.maps.load(ready);
    document.head.appendChild(script);
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
      {loading && <div className="flex items-center gap-2 p-5 text-sm text-blue-700"><Loader2 className="h-4 w-4 animate-spin" />최근 위치를 불러오는 중입니다.</div>}
      {error && <p className="m-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!loading && !error && positions.length === 0 && <p className="m-5 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">최근 위치 데이터가 없습니다.</p>}
      <div className="relative">
        <div ref={mapContainerRef} className="min-h-[360px] w-full bg-slate-100" aria-label="최근 위치 경로 지도" />
        {!hasMapKey && positions.length > 0 && <p className="absolute inset-x-4 top-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">지도 키가 설정되지 않아 좌표 목록으로 표시합니다.</p>}
      </div>
      {positions.length > 0 && <div className="max-h-32 overflow-y-auto border-t px-5 py-3 text-xs text-gray-600">{positions.slice(-5).reverse().map((position, index) => <div key={`${position.recordedAt}-${index}`} className="flex items-center gap-2"><MapPin className={`h-3 w-3 ${index === 0 ? 'text-red-600' : 'text-blue-600'}`} />{index === 0 ? '최근 위치 · ' : ''}{new Date(position.recordedAt).toLocaleString('ko-KR')} · {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}</div>)}</div>}
    </div>
  </div>;
}
