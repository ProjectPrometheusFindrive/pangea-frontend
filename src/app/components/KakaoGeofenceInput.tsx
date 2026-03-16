import { useEffect, useRef, useState } from 'react';

export type KakaoGeofenceShape = 'circle' | 'polygon';

export interface GeofencePoint { lat: number; lng: number; }

interface KakaoGeofenceInputErrors {
  lat?: string;
  lng?: string;
  radiusMeter?: string;
  polygon?: string;
}

interface KakaoGeofenceInputProps {
  shape: KakaoGeofenceShape;
  lat: string;
  lng: string;
  radiusMeter: string;
  polygonPoints?: GeofencePoint[];
  disabled?: boolean;
  shapeLocked?: boolean;
  errors?: KakaoGeofenceInputErrors;
  onShapeChange: (shape: KakaoGeofenceShape) => void;
  onPolygonChange: (points: GeofencePoint[]) => void;
  onCenterChange?: (lat: number, lng: number) => void;
  onRadiusChange?: (radiusMeter: number) => void;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  // Kakao DrawingManager polygon point format: { x: lng, y: lat }
  if (typeof pt.y === 'number' && typeof pt.x === 'number') {
    return { lat: pt.y, lng: pt.x };
  }
  return null;
}

/**
 * Kakao Maps getPath() returns an MVCArray which has getLength()/getAt()
 * but is NOT a native Array (Array.isArray returns false).
 * This helper converts any array-like (MVCArray, native Array, iterable) to a plain array.
 */
function toPlainArray(arrLike: any): any[] {
  if (!arrLike) return [];
  if (Array.isArray(arrLike)) return arrLike;
  // MVCArray: has getLength() and getAt()
  if (typeof arrLike.getLength === 'function' && typeof arrLike.getAt === 'function') {
    const result: any[] = [];
    const len = arrLike.getLength() as number;
    for (let i = 0; i < len; i++) result.push(arrLike.getAt(i));
    return result;
  }
  // getArray() fallback
  if (typeof arrLike.getArray === 'function') {
    const inner = arrLike.getArray();
    if (Array.isArray(inner)) return inner;
  }
  // Last resort: try Array.from
  try { return Array.from(arrLike as Iterable<any>); } catch { return []; }
}

function extractPolygonPath(poly: any): Array<{ lat: number; lng: number }> {
  try {
    if (typeof poly.getPath === 'function') {
      return toPlainArray(poly.getPath()).map(toLatLng).filter(Boolean) as Array<{ lat: number; lng: number }>;
    }
    if (typeof poly.getPoints === 'function') {
      return toPlainArray(poly.getPoints()).map(toLatLng).filter(Boolean) as Array<{ lat: number; lng: number }>;
    }
    if (poly.path != null) {
      return toPlainArray(poly.path).map(toLatLng).filter(Boolean) as Array<{ lat: number; lng: number }>;
    }
    if (poly.points != null) {
      return toPlainArray(poly.points).map(toLatLng).filter(Boolean) as Array<{ lat: number; lng: number }>;
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
  polygonPoints,
  disabled = false,
  shapeLocked = false,
  errors,
  onShapeChange,
  onPolygonChange,
  onCenterChange,
  onRadiusChange,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleCenterMarkerRef = useRef<any>(null);
  const circleDrawingRef = useRef<{ lat: number; lng: number } | null>(null);
  const onPolygonChangeRef = useRef(onPolygonChange);
  onPolygonChangeRef.current = onPolygonChange;
  // Exposed so mouseup handler can call syncFromData without recreating DM
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncFromDataRef = useRef<(() => void) | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  const onRadiusChangeRef = useRef(onRadiusChange);
  onRadiusChangeRef.current = onRadiusChange;
  const shapeRef = useRef(shape);
  shapeRef.current = shape;
  // Capture initial polygonPoints for one-time map load (editing existing geofence).
  // Never updated after mount — prevents feedback loop when user draws.
  const initialPolygonPointsRef = useRef(polygonPoints);

  const [circleDrawingPhase, setCircleDrawingPhase] = useState<'idle' | 'setting-radius'>('idle');

  const [isMapsReady, setIsMapsReady] = useState(false);
  const [isDrawingReady, setIsDrawingReady] = useState(false);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [drawnPointCount, setDrawnPointCount] = useState(
    Array.isArray(polygonPoints) ? polygonPoints.length : 0,
  );

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

      const syncFromData = () => {
        try {
          const data = dm.getData();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const polygons: any[] = Array.isArray(data?.polygon) ? data.polygon : [];
          if (polygons.length === 0) {
            onPolygonChangeRef.current([]);
            setDrawnPointCount(0);
            return;
          }
          const paths = polygons.map(extractPolygonPath).filter((pts: Array<{ lat: number; lng: number }>) => pts.length > 0);
          if (paths.length === 0) {
            onPolygonChangeRef.current([]);
            setDrawnPointCount(0);
            return;
          }
          const pts = paths[0] as GeofencePoint[];
          onPolygonChangeRef.current(pts);
          setDrawnPointCount(pts.length);
        } catch (error) {
          console.error('syncFromData error:', error);
        }
      };

      // drawend receives the just-drawn overlay as first argument.
      // We try direct extraction first, then fall back to getData() with a delay
      // because the DM may not have committed the polygon to its data store yet.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onDrawEnd = (overlay: any) => {
        const pts = overlay ? extractPolygonPath(overlay) : [];
        if (pts.length >= 3) {
          onPolygonChangeRef.current(pts);
          setDrawnPointCount(pts.length);
        } else {
          // Give the DM a tick to commit the polygon, then sync from getData()
          setTimeout(syncFromData, 50);
        }
      };

      syncFromDataRef.current = syncFromData;

      kakao.maps.event.addListener(dm, 'drawend', onDrawEnd);
      kakao.maps.event.addListener(dm, 'remove', () => setTimeout(syncFromData, 50));
      kakao.maps.event.addListener(dm, 'edit', () => setTimeout(syncFromData, 50));

      return () => {
        try { dm.cancel(); } catch { /* ignore */ }
        drawingManagerRef.current = null;
      };
    } catch (error) {
      console.error('Failed to initialize DrawingManager:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMapInitialized, isDrawingReady, disabled]);

  // Activate/deactivate polygon drawing based on shape (with delay for DM readiness).
  // When shapeLocked (editing existing geofence), skip dm.select() — dm.put() already
  // places the polygon in editable state; calling select() would start a new drawing session.
  useEffect(() => {
    const timer = setTimeout(() => {
      const dm = drawingManagerRef.current;
      if (!dm) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kakao = (window as any).kakao;
      try {
        if (shape === 'polygon' && !shapeLocked) {
          dm.select(kakao.maps.drawing.OverlayType.POLYGON);
        } else if (shape !== 'polygon') {
          dm.cancel();
        }
      } catch { /* ignore */ }
    }, 150);
    return () => clearTimeout(timer);
  }, [shape, isMapInitialized, isDrawingReady, shapeLocked]);

  // Circle mode: 1st click = set center, mousemove = preview radius, 2nd click = confirm radius
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapInitialized || shape !== 'circle' || disabled) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clickHandler = (mouseEvent: any) => {
      const latlng = mouseEvent.latLng;
      const clickLat = latlng.getLat() as number;
      const clickLng = latlng.getLng() as number;

      if (!circleDrawingRef.current) {
        // Phase 1: set center
        circleDrawingRef.current = { lat: clickLat, lng: clickLng };
        setCircleDrawingPhase('setting-radius');
        onCenterChangeRef.current?.(clickLat, clickLng);

        // Place/move marker at center
        if (circleCenterMarkerRef.current) {
          circleCenterMarkerRef.current.setPosition(latlng);
        } else {
          circleCenterMarkerRef.current = new kakao.maps.Marker({ position: latlng, map });
        }

        // Create circle with tiny initial radius so it's visible
        if (circleOverlayRef.current) {
          circleOverlayRef.current.setPosition(latlng);
          circleOverlayRef.current.setRadius(1);
        } else {
          const circle = new kakao.maps.Circle({
            center: latlng,
            radius: 1,
            strokeWeight: 3, strokeColor: '#0066ff', strokeOpacity: 0.8, strokeStyle: 'solid',
            fillColor: '#0066ff', fillOpacity: 0.15,
          });
          circle.setMap(map);
          circleOverlayRef.current = circle;
        }
      } else {
        // Phase 2: confirm radius
        const dist = Math.round(haversineMeters(
          circleDrawingRef.current.lat, circleDrawingRef.current.lng,
          clickLat, clickLng,
        ));
        const radius = Math.max(dist, 1);
        circleDrawingRef.current = null;
        setCircleDrawingPhase('idle');
        onRadiusChangeRef.current?.(radius);
        if (circleOverlayRef.current) circleOverlayRef.current.setRadius(radius);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const moveHandler = (mouseEvent: any) => {
      if (!circleDrawingRef.current || !circleOverlayRef.current) return;
      const latlng = mouseEvent.latLng;
      const dist = Math.max(Math.round(haversineMeters(
        circleDrawingRef.current.lat, circleDrawingRef.current.lng,
        latlng.getLat() as number, latlng.getLng() as number,
      )), 1);
      circleOverlayRef.current.setRadius(dist);
    };

    kakao.maps.event.addListener(map, 'click', clickHandler);
    kakao.maps.event.addListener(map, 'mousemove', moveHandler);
    return () => {
      kakao.maps.event.removeListener(map, 'click', clickHandler);
      kakao.maps.event.removeListener(map, 'mousemove', moveHandler);
      circleDrawingRef.current = null;
      setCircleDrawingPhase('idle');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, isMapInitialized, disabled]);

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

  // When editing an existing polygon (shapeLocked), sync state after every pointerup on
  // the map container. DrawingManager does not fire any event when a vertex is dragged,
  // so we use a native DOM pointerup to detect when a drag has finished.
  useEffect(() => {
    if (!isMapInitialized || !shapeLocked || shape !== 'polygon') return;
    const container = mapContainerRef.current;
    if (!container) return;
    const handler = () => { setTimeout(() => syncFromDataRef.current?.(), 150); };
    container.addEventListener('pointerup', handler);
    return () => { container.removeEventListener('pointerup', handler); };
  }, [isMapInitialized, shapeLocked, shape]);

  // Load polygon from initial polygonPoints prop into map (one-time, for editing existing geofence).
  // Uses initialPolygonPointsRef so user drawing doesn't re-trigger this effect.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || shape !== 'polygon' || !isMapInitialized) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao;
    const points = Array.isArray(initialPolygonPointsRef.current)
      ? initialPolygonPointsRef.current.filter((p) => !isNaN(p.lat) && !isNaN(p.lng))
      : [];
    clearPolygonOverlays();

    if (points.length < 3) return;

    const latLngs = points.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
    const dm = drawingManagerRef.current;

    if (dm) {
      try {
        // dm.put() places the polygon in editable state; no need to call dm.select()
        dm.put(kakao.maps.drawing.OverlayType.POLYGON, latLngs);
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
  }, [shape, isDrawingReady, isMapInitialized]); // intentionally omit polygonPoints — uses initialPolygonPointsRef

  // Circle preview from props (editing existing geofence)
  useEffect(() => {
    const map = mapRef.current;
    // Skip while user is actively drawing (mouse interaction handles it directly)
    if (!map || shape !== 'circle' || !isMapInitialized || circleDrawingRef.current) return;

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
      if (circleCenterMarkerRef.current) {
        circleCenterMarkerRef.current.setMap(null);
        circleCenterMarkerRef.current = null;
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
        strokeWeight: 3, strokeColor: '#0066ff', strokeOpacity: 0.8, strokeStyle: 'solid',
        fillColor: '#0066ff', fillOpacity: 0.15,
      });
      circle.setMap(map);
      circleOverlayRef.current = circle;
    }
    // Place marker at center
    if (circleCenterMarkerRef.current) {
      circleCenterMarkerRef.current.setPosition(center);
    } else {
      circleCenterMarkerRef.current = new kakao.maps.Marker({ position: center, map });
    }
    // Auto-zoom based on radius
    const level = radiusNum <= 200 ? 4 : radiusNum <= 500 ? 5 : radiusNum <= 1000 ? 6 : radiusNum <= 3000 ? 7 : radiusNum <= 10000 ? 9 : 11;
    map.setLevel(level);
    map.setCenter(center);
  }, [lat, lng, radiusMeter, shape, isMapInitialized]);

  // Remove circle + marker when switching to polygon
  useEffect(() => {
    if (shape !== 'circle') {
      if (circleOverlayRef.current) {
        try { circleOverlayRef.current.setMap(null); } catch { /* ignore */ }
        circleOverlayRef.current = null;
      }
      if (circleCenterMarkerRef.current) {
        try { circleCenterMarkerRef.current.setMap(null); } catch { /* ignore */ }
        circleCenterMarkerRef.current = null;
      }
      circleDrawingRef.current = null;
      setCircleDrawingPhase('idle');
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
      if (circleCenterMarkerRef.current) {
        try { circleCenterMarkerRef.current.setMap(null); } catch { /* ignore */ }
        circleCenterMarkerRef.current = null;
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
        {isMapsReady && !disabled && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            {shape === 'polygon'
              ? shapeLocked
                ? <span>꼭짓점을 드래그해 위치를 조정하거나, ✕ 버튼으로 삭제 후 새로 그릴 수 있습니다.</span>
                : <span>지도를 클릭해 꼭짓점을 추가하고, 마지막 점을 한 번 더 클릭하면 그리기가 종료됩니다.</span>
              : circleDrawingPhase === 'setting-radius'
                ? <span>마우스를 움직여 반경을 조절하고, 클릭해 확정하세요.</span>
                : <span>지도를 클릭해 원형 지오펜스의 중심을 설정하세요.</span>
            }
          </div>
        )}

        <div
          ref={mapContainerRef}
          style={{ height: '400px' }}
          className={`w-full rounded-lg border border-gray-300 ${!disabled ? 'cursor-crosshair' : ''}`}
        />
      </div>

      {shape === 'polygon' && (
        <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm">
          {errors?.polygon
            ? <p className="text-red-600">{errors.polygon}</p>
            : drawnPointCount >= 3
              ? <span className="text-blue-700">꼭짓점 {drawnPointCount}개 · 지도에서 수정 가능합니다.</span>
              : <span className="text-blue-500">지도에서 다각형을 그려주세요. (최소 3개 꼭짓점)</span>
          }
        </div>
      )}
    </div>
  );
}
