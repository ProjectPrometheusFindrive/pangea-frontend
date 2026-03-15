import { useEffect, useMemo, useRef, useState } from 'react';

export type KakaoGeofenceShape = 'circle' | 'polygon';

interface KakaoGeofenceInputErrors {
  lat?: string;
  lng?: string;
  radiusMeter?: string;
  pointsText?: string;
}

interface KakaoGeofenceInputProps {
  shape: KakaoGeofenceShape;
  lat: string;
  lng: string;
  radiusMeter: string;
  pointsText: string;
  disabled?: boolean;
  shapeLocked?: boolean;
  errors?: KakaoGeofenceInputErrors;
  onShapeChange: (shape: KakaoGeofenceShape) => void;
  onPointsTextChange: (value: string) => void;
}

function parsePreviewPoints(pointsText: string): Array<{ lat: string; lng: string }> {
  return pointsText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tokens = line.split(',').map((token) => token.trim());
      return {
        lat: tokens[0] ?? '',
        lng: tokens[1] ?? '',
      };
    });
}

function parsePointsFromText(text: string): Array<{ lat: number; lng: number }> {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const tokens = line.split(',').map((t) => t.trim());
      const lat = parseFloat(tokens[0] ?? '');
      const lng = parseFloat(tokens[1] ?? '');
      if (!isNaN(lat) && !isNaN(lng)) {
        return [{ lat, lng }];
      }
      return [];
    });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toLatLng(pt: any): { lat: number; lng: number } | null {
  if (!pt) return null;
  if (typeof pt.getLat === 'function' && typeof pt.getLng === 'function') {
    return { lat: pt.getLat() as number, lng: pt.getLng() as number };
  }
  if (typeof pt.getY === 'function' && typeof pt.getX === 'function') {
    return { lat: pt.getY() as number, lng: pt.getX() as number };
  }
  if (typeof pt.lat === 'number' && typeof pt.lng === 'number') {
    return { lat: pt.lat, lng: pt.lng };
  }
  return null;
}

function extractPolygonPath(poly: any): Array<{ lat: number; lng: number }> {
  try {
    if (typeof poly.getPath === 'function') {
      const path = poly.getPath();
      const arr = typeof path?.getArray === 'function' ? path.getArray() : path;
      return (Array.isArray(arr) ? arr : []).map(toLatLng).filter(Boolean) as Array<{ lat: number; lng: number }>;
    }
    if (typeof poly.getPoints === 'function') {
      return (poly.getPoints() as any[]).map(toLatLng).filter(Boolean) as Array<{ lat: number; lng: number }>;
    }
    if (Array.isArray(poly.path)) {
      return (poly.path as any[]).map(toLatLng).filter(Boolean) as Array<{ lat: number; lng: number }>;
    }
    if (Array.isArray(poly.points)) {
      return (poly.points as any[]).map(toLatLng).filter(Boolean) as Array<{ lat: number; lng: number }>;
    }
  } catch {
    // ignore
  }
  return [];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function KakaoGeofenceInput({
  shape,
  lat,
  lng,
  radiusMeter,
  pointsText,
  disabled = false,
  shapeLocked = false,
  errors,
  onShapeChange,
  onPointsTextChange,
}: KakaoGeofenceInputProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawingManagerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingPolygonsRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleOverlayRef = useRef<any>(null);
  const onPointsTextChangeRef = useRef(onPointsTextChange);
  onPointsTextChangeRef.current = onPointsTextChange;

  const [isMapsReady, setIsMapsReady] = useState(false);
  const [isDrawingReady, setIsDrawingReady] = useState(false);
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  const previewPoints = useMemo(() => parsePreviewPoints(pointsText), [pointsText]);

  // Load Kakao Maps SDK
  useEffect(() => {
    const apiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY as string | undefined;
    if (!apiKey) return;

    const loadDrawingLibrary = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).kakao?.maps?.drawing) {
        setIsDrawingReady(true);
        return;
      }
      // drawing 라이브러리가 없으면 추가 스크립트로 로드
      const drawingScript = document.createElement('script');
      drawingScript.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,drawing&autoload=false`;
      drawingScript.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).kakao?.maps.load(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((window as any).kakao?.maps?.drawing) setIsDrawingReady(true);
        });
      };
      document.head.appendChild(drawingScript);
    };

    const markReady = () => {
      setIsMapsReady(true);
      loadDrawingLibrary();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    if (kakao?.maps) {
      kakao.maps.load(markReady);
      return;
    }

    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existing) {
      const poll = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const k = (window as any).kakao;
        if (k?.maps) {
          k.maps.load(markReady);
          clearInterval(poll);
        }
      }, 100);
      setTimeout(() => clearInterval(poll), 5000);
      return;
    }

    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,drawing&autoload=false`;
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).kakao?.maps.load(markReady);
    };
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isMapsReady || !mapContainerRef.current || mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    kakao.maps.load(() => {
      if (!mapContainerRef.current) return;
      try {
        mapRef.current = new kakao.maps.Map(mapContainerRef.current, {
          center: new kakao.maps.LatLng(36.3, 127.8),
          level: 13,
        });
        setIsMapInitialized(true);
      } catch (error) {
        console.error('Failed to initialize Kakao map:', error);
      }
    });
  }, [isMapsReady]); // map 초기화는 isMapsReady에 의존

  // Relayout on resize
  useEffect(() => {
    if (!isMapInitialized) return;
    const container = mapContainerRef.current;
    if (!container) return;

    let raf: number | null = null;
    const ro = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          const map = mapRef.current;
          if (!map) return;
          const center = map.getCenter();
          map.relayout();
          map.setCenter(center);
        } catch { /* ignore */ }
      });
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isMapInitialized]);

  // Initialize DrawingManager once (regardless of shape)
  useEffect(() => {
    if (!isMapInitialized || !mapRef.current || disabled || drawingManagerRef.current || !isDrawingReady) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    try {
      const dm = new kakao.maps.drawing.DrawingManager({
        map: mapRef.current,
        drawingMode: [kakao.maps.drawing.OverlayType.POLYGON],
        guideTooltip: ['draw', 'drag', 'edit'],
        polygonOptions: {
          strokeWeight: 4,
          strokeColor: '#0066ff',
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
          fillColor: '#0066ff',
          fillOpacity: 0.2,
          draggable: true,
          removable: true,
          editable: true,
        },
      });
      drawingManagerRef.current = dm;

      const syncToText = () => {
        try {
          const data = dm.getData();
          if (!Array.isArray(data.polygon) || data.polygon.length === 0) return;
          const paths = data.polygon.map(extractPolygonPath).filter((pts: Array<{ lat: number; lng: number }>) => pts.length > 0);
          if (paths.length === 0) return;
          const text = (paths[0] as Array<{ lat: number; lng: number }>).map((p) => `${p.lat},${p.lng}`).join('\n');
          onPointsTextChangeRef.current(text);
        } catch (error) {
          console.error('Error syncing drawing data:', error);
        }
      };

      kakao.maps.event.addListener(dm, 'drawend', syncToText);
      kakao.maps.event.addListener(dm, 'remove', syncToText);
      kakao.maps.event.addListener(dm, 'edit', syncToText);

      return () => {
        try { dm.cancel(); } catch { /* ignore */ }
        drawingManagerRef.current = null;
      };
    } catch (error) {
      console.error('Failed to initialize DrawingManager:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapInitialized, isDrawingReady, disabled]);

  // Activate/deactivate polygon drawing based on shape
  useEffect(() => {
    const dm = drawingManagerRef.current;
    if (!dm) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    try {
      if (shape === 'polygon') {
        dm.select(kakao.maps.drawing.OverlayType.POLYGON);
      } else {
        dm.cancel();
      }
    } catch { /* ignore */ }
  }, [shape, isMapInitialized, isDrawingReady]);

  // Helper: clear polygon overlays from map
  const clearPolygonOverlays = () => {
    const dm = drawingManagerRef.current;
    if (dm) {
      try {
        const overlays = dm.getOverlays?.();
        if (overlays && Array.isArray(overlays.polygon)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          overlays.polygon.forEach((ov: any) => { try { dm.remove(ov); } catch { /* ignore */ } });
        } else {
          const data = dm.getData();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.polygon?.forEach((p: any) => { try { dm.remove(p); } catch { /* ignore */ } });
        }
        try { dm.cancel(); } catch { /* ignore */ }
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingPolygonsRef.current.forEach((poly: any) => { try { poly.setMap(null); } catch { /* ignore */ } });
    existingPolygonsRef.current = [];
  };

  // Load polygon from pointsText into map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || shape !== 'polygon' || !isMapInitialized) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    const points = parsePointsFromText(pointsText);
    clearPolygonOverlays();

    if (points.length < 3) return;

    const latLngs = points.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
    const dm = drawingManagerRef.current;

    if (dm) {
      try {
        dm.put(kakao.maps.drawing.OverlayType.POLYGON, latLngs);
        setTimeout(() => {
          try { dm.select(kakao.maps.drawing.OverlayType.POLYGON); } catch { /* ignore */ }
        }, 100);
      } catch {
        const polygon = new kakao.maps.Polygon({
          path: latLngs,
          strokeWeight: 4, strokeColor: '#0066ff', strokeOpacity: 0.8, strokeStyle: 'solid',
          fillColor: '#0066ff', fillOpacity: 0.2,
        });
        polygon.setMap(map);
        existingPolygonsRef.current.push(polygon);
      }
    } else {
      const polygon = new kakao.maps.Polygon({
        path: latLngs,
        strokeWeight: 4, strokeColor: '#0066ff', strokeOpacity: 0.8, strokeStyle: 'solid',
        fillColor: '#0066ff', fillOpacity: 0.2,
      });
      polygon.setMap(map);
      existingPolygonsRef.current.push(polygon);
    }

    const bounds = new kakao.maps.LatLngBounds();
    latLngs.forEach((ll: unknown) => bounds.extend(ll));
    if (!bounds.isEmpty()) map.setBounds(bounds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsText, shape, isDrawingReady, isMapInitialized]);

  // Circle preview on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || shape !== 'circle' || !isMapInitialized) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseFloat(radiusMeter);

    if (isNaN(latNum) || isNaN(lngNum) || isNaN(radiusNum) || radiusNum <= 0) {
      if (circleOverlayRef.current) {
        circleOverlayRef.current.setMap(null);
        circleOverlayRef.current = null;
      }
      return;
    }

    const center = new kakao.maps.LatLng(latNum, lngNum);
    if (circleOverlayRef.current) {
      circleOverlayRef.current.setPosition(center);
      circleOverlayRef.current.setRadius(radiusNum);
    } else {
      const circle = new kakao.maps.Circle({
        center,
        radius: radiusNum,
        strokeWeight: 4, strokeColor: '#0066ff', strokeOpacity: 0.8, strokeStyle: 'solid',
        fillColor: '#0066ff', fillOpacity: 0.2,
      });
      circle.setMap(map);
      circleOverlayRef.current = circle;
    }
    // Zoom level based on radius: smaller radius → higher zoom
    const level = radiusNum <= 200 ? 4 : radiusNum <= 500 ? 5 : radiusNum <= 1000 ? 6 : radiusNum <= 3000 ? 7 : radiusNum <= 10000 ? 9 : 11;
    map.setLevel(level);
    map.setCenter(center);
  }, [lat, lng, radiusMeter, shape, isMapInitialized]);

  // Remove circle when switching to polygon
  useEffect(() => {
    if (shape !== 'circle' && circleOverlayRef.current) {
      circleOverlayRef.current.setMap(null);
      circleOverlayRef.current = null;
    }
  }, [shape]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPolygonOverlays();
      if (circleOverlayRef.current) {
        try { circleOverlayRef.current.setMap(null); } catch { /* ignore */ }
        circleOverlayRef.current = null;
      }
      if (drawingManagerRef.current) {
        try { drawingManagerRef.current.cancel(); } catch { /* ignore */ }
        drawingManagerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onShapeChange('circle')}
            disabled={disabled || shapeLocked}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              shape === 'circle'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            원형
          </button>
          <button
            type="button"
            onClick={() => onShapeChange('polygon')}
            disabled={disabled || shapeLocked}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              shape === 'polygon'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            다각형
          </button>
          {shapeLocked && (
            <span className="text-xs text-blue-700">
              기존 지오펜스는 현재 형태 그대로 편집합니다.
            </span>
          )}
        </div>

        {!isMapsReady && (
          <div className="mb-2 text-sm text-gray-500">카카오 지도를 로딩 중입니다...</div>
        )}
        {isMapsReady && !disabled && shape === 'polygon' && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>지도를 클릭해 점을 추가하고, 마지막 점을 한 번 더 클릭하면 그리기가 종료됩니다.</span>
          </div>
        )}

        <div
          ref={mapContainerRef}
          style={{ height: '400px' }}
          className={`w-full rounded-lg border border-gray-300 ${!disabled && shape === 'polygon' ? 'cursor-crosshair' : ''}`}
        />
      </div>

      {shape === 'polygon' ? (
        <div className="rounded-xl border border-blue-100 bg-white p-4">
          <label className="mb-1 block text-sm font-medium text-blue-900">다각형 꼭짓점 *</label>
          <textarea
            value={pointsText}
            disabled={disabled}
            onChange={(event) => onPointsTextChange(event.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'37.566500,126.978000\n37.567100,126.979300\n37.565700,126.980200'}
            className="w-full rounded-lg border border-blue-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
          />
          {errors?.pointsText && <p className="mt-1 text-xs text-red-600">{errors.pointsText}</p>}

          <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            한 줄에 `lat,lng` 형식으로 입력하세요. 최소 3개의 꼭짓점이 필요합니다.
          </div>

          {previewPoints.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-blue-900">
                꼭짓점: {previewPoints.length}개
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {previewPoints.map((point, index) => (
                  <div
                    key={`${point.lat}-${point.lng}-${index}`}
                    className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800"
                  >
                    <span className="font-semibold">P{index + 1}</span>
                    {' '}
                    {point.lat || '-'}, {point.lng || '-'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-blue-100 bg-white p-4 text-sm text-blue-800">
          <p>원형 지오펜스는 아래 중심 좌표와 반경 입력란을 사용합니다.</p>
          <p className="mt-2 text-xs text-blue-700">
            현재 중심: {lat || '-'}, {lng || '-'} / 반경 {radiusMeter || '-'}m
          </p>
          {(errors?.lat || errors?.lng || errors?.radiusMeter) && (
            <p className="mt-2 text-xs text-red-600">
              {errors?.lat ?? errors?.lng ?? errors?.radiusMeter}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
