import { useEffect, useRef, useState } from 'react';
import type { SettingsGeofence } from '../../services/settings';

interface KakaoGeofenceOverviewMapProps {
  geofences: SettingsGeofence[];
  height?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function calcPolygonCentroid(points: Array<{ lat: number; lng: number }>): { lat: number; lng: number } {
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  return { lat, lng };
}

export function KakaoGeofenceOverviewMap({ geofences, height = 320 }: KakaoGeofenceOverviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [isMapsReady, setIsMapsReady] = useState(false);
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  // Load Kakao Maps SDK
  useEffect(() => {
    const apiKey = import.meta.env.VITE_KAKAO_MAP_API_KEY as string | undefined;
    if (!apiKey) return;

    const markReady = () => setIsMapsReady(true);

    const kakao = (window as any).kakao;
    if (kakao?.maps) {
      kakao.maps.load(markReady);
      return;
    }

    const existing = document.querySelector('script[src*="dapi.kakao.com"]');
    if (existing) {
      const poll = setInterval(() => {
        const k = (window as any).kakao;
        if (k?.maps) { k.maps.load(markReady); clearInterval(poll); }
      }, 100);
      setTimeout(() => clearInterval(poll), 5000);
      return;
    }

    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services,drawing&autoload=false`;
    script.onload = () => { (window as any).kakao?.maps.load(markReady); };
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isMapsReady || !mapContainerRef.current || mapRef.current) return;
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
        console.error('Failed to initialize overview Kakao map:', error);
      }
    });
  }, [isMapsReady]);

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
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [isMapInitialized]);

  // Render geofence overlays + labels
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapInitialized) return;

    const kakao = (window as any).kakao;

    // Clear previous overlays
    overlaysRef.current.forEach((ov) => { try { ov.setMap(null); } catch { /* ignore */ } });
    overlaysRef.current = [];

    if (geofences.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();
    let boundsExtended = false;

    for (const gf of geofences) {
      const hasPolygon = Array.isArray(gf.points) && gf.points.length >= 3;
      const color = gf.active ? '#0066ff' : '#999999';
      let labelLatLng: any = null;

      if (hasPolygon && gf.points) {
        const path = gf.points.map((p) => new kakao.maps.LatLng(p.lat, p.lng));
        const polygon = new kakao.maps.Polygon({
          path,
          strokeWeight: 2,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
          fillColor: color,
          fillOpacity: 0.15,
        });
        polygon.setMap(map);
        overlaysRef.current.push(polygon);
        path.forEach((ll: any) => { bounds.extend(ll); boundsExtended = true; });

        const centroid = calcPolygonCentroid(gf.points);
        labelLatLng = new kakao.maps.LatLng(centroid.lat, centroid.lng);
      } else if (gf.center) {
        const center = new kakao.maps.LatLng(gf.center.lat, gf.center.lng);
        const circle = new kakao.maps.Circle({
          center,
          radius: gf.radiusMeter || 500,
          strokeWeight: 2,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
          fillColor: color,
          fillOpacity: 0.15,
        });
        circle.setMap(map);
        overlaysRef.current.push(circle);
        bounds.extend(center);
        boundsExtended = true;
        labelLatLng = center;
      }

      // Name label via CustomOverlay
      if (labelLatLng) {
        const content = `<div style="background:rgba(255,255,255,0.9);border:1px solid ${color};border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:${color};white-space:nowrap;pointer-events:none;">${gf.name}</div>`;
        const label = new kakao.maps.CustomOverlay({
          position: labelLatLng,
          content,
          yAnchor: 1.5,
          zIndex: 3,
        });
        label.setMap(map);
        overlaysRef.current.push(label);
      }
    }

    if (boundsExtended && !bounds.isEmpty()) {
      map.setBounds(bounds, 60);
    }
  }, [geofences, isMapInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      overlaysRef.current.forEach((ov) => { try { ov.setMap(null); } catch { /* ignore */ } });
      overlaysRef.current = [];
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{ height: `${height}px` }}
      className="w-full rounded-lg border border-gray-200"
    />
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
