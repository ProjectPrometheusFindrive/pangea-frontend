import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeotabPosition } from '../../services/geotab';

/** Small key-free map fallback. Loads only visible OSM tiles with browser caching.
 * No vehicle identity or route payload is sent to the tile service.
 */
export function TelemetryRouteMap({ positions }: { positions: GeotabPosition[] }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [zoomDelta, setZoomDelta] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tileError, setTileError] = useState(false);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const height = 360;
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const route = useMemo(() => {
    let previousX: number | undefined;
    return positions.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)).map((p) => {
      const latitude = Math.max(-85.0511, Math.min(85.0511, p.latitude)) * Math.PI / 180;
      let x = (p.longitude + 180) / 360;
      if (previousX !== undefined) x += Math.round(previousX - x);
      previousX = x;
      return { x, y: (1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2 };
    });
  }, [positions]);
  if (!route.length) return <div className="h-[360px] bg-slate-100" />;
  const minX = Math.min(...route.map((p) => p.x)); const maxX = Math.max(...route.map((p) => p.x));
  const minY = Math.min(...route.map((p) => p.y)); const maxY = Math.max(...route.map((p) => p.y));
  const fitted = Math.min(17, Math.floor(Math.log2(Math.min(Math.max(100, width - 80) / (256 * Math.max(maxX - minX, 1e-8)), (height - 80) / (256 * Math.max(maxY - minY, 1e-8))))));
  const zoom = Math.max(1, Math.min(19, fitted + zoomDelta));
  const scale = 256 * 2 ** zoom;
  const left = (minX + maxX) / 2 * scale - width / 2 - pan.x;
  const top = (minY + maxY) / 2 * scale - height / 2 - pan.y;
  const pixels = route.map((p) => ({ x: p.x * scale - left, y: p.y * scale - top }));
  const latest = pixels[pixels.length - 1];
  const tiles = [];
  for (let x = Math.floor(left / 256); x <= Math.floor((left + width) / 256); x++) {
    for (let y = Math.max(0, Math.floor(top / 256)); y <= Math.min(2 ** zoom - 1, Math.floor((top + height) / 256)); y++) {
      const wrapped = ((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom;
      tiles.push(<img key={`${zoom}/${x}/${y}`} src={`https://tile.openstreetmap.org/${zoom}/${wrapped}/${y}.png`} alt="" draggable={false}
        onError={() => setTileError(true)} style={{ position: 'absolute', width: 256, height: 256, maxWidth: 'none', left: x * 256 - left, top: y * 256 - top }} />);
    }
  }
  return <div ref={host} className="relative h-[360px] w-full overflow-hidden bg-slate-100" aria-label="최근 위치 경로 지도">
    <div className="absolute inset-0 cursor-grab touch-none" onPointerDown={(event) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    }} onPointerMove={(event) => {
      if (drag.current) setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y });
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {tiles}
      <svg width={width} height={height} className="pointer-events-none absolute inset-0" role="img" aria-label="차량 최근 경로와 최근 위치">
        <polyline data-testid="telemetry-route-line" points={pixels.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="white" strokeWidth="7" />
        <polyline points={pixels.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#2563eb" strokeWidth="4" />
        <circle cx={pixels[0].x} cy={pixels[0].y} r="5" fill="#2563eb" stroke="white" strokeWidth="2" />
        <circle data-testid="telemetry-latest-marker" cx={latest.x} cy={latest.y} r="8" fill="#dc2626" stroke="white" strokeWidth="3" />
        <text x={latest.x + 12} y={latest.y - 12} fontSize="12" fontWeight="700" paintOrder="stroke" stroke="white" strokeWidth="4" fill="#991b1b">최근 위치</text>
      </svg>
    </div>
    <div className="absolute left-3 top-3 flex gap-1">
      <button aria-label="지도 확대" className="rounded border bg-white px-3 py-2" onClick={() => { setZoomDelta((v) => Math.min(19 - fitted, v + 1)); setPan({ x: 0, y: 0 }); }}>+</button>
      <button aria-label="지도 축소" className="rounded border bg-white px-3 py-2" onClick={() => { setZoomDelta((v) => Math.max(1 - fitted, v - 1)); setPan({ x: 0, y: 0 }); }}>−</button>
      <button className="rounded border bg-white px-3 py-2 text-xs" onClick={() => { setZoomDelta(0); setPan({ x: 0, y: 0 }); }}>경로 맞춤</button>
    </div>
    {tileError && <p className="absolute bottom-8 left-3 right-3 rounded bg-amber-50 p-2 text-xs text-amber-800">배경 지도를 불러오지 못했습니다. 경로와 좌표는 계속 표시합니다.</p>}
    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute bottom-0 right-0 bg-white/90 px-2 py-1 text-[10px] text-blue-700">© OpenStreetMap contributors</a>
  </div>;
}
