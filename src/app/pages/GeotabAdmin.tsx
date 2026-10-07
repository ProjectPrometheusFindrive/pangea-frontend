import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { RefreshCw, Radio, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { TelemetryRouteMap } from '../components/TelemetryRouteMap';
import { assignPlatformDevice, bindPlatformVehicle, createPlatformVehicleAndBind, getPlatformDevice, listGeotabTenants, listPlatformDevices, listPlatformTenantVehicles, type PlatformDevice, type PlatformDeviceDetail, type PlatformTrip, type PlatformVehicle, type PlatformVehicleBindingResult } from '../../services/geotabAdmin';
import type { GeotabPosition } from '../../services/geotab';

const date = (v?: string | null) => v ? new Date(v).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '정보 없음';
const errorText = (e: unknown) => e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.';
const status = { online: '연결', offline: '미연결', unknown: '확인 필요' };
const button = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-40';

export default function GeotabAdmin() {
  const { user } = useAuth();
  // This component never mounts data hooks for a tenant administrator.
  return user?.role === 'super_admin' ? <GeotabAdminContent /> : <Navigate to="/forbidden" replace />;
}

function GeotabAdminContent() {
  const [devices, setDevices] = useState<PlatformDevice[]>([]);
  const [tenants, setTenants] = useState<{ companyId: string; name: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<PlatformDeviceDetail | null>(null);
  const [tenant, setTenant] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [capped, setCapped] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [notice, setNotice] = useState('');
  const [trip, setTrip] = useState<PlatformTrip | null>(null);
  const [tripRoute, setTripRoute] = useState<GeotabPosition[]>([]);
  const [tripBusy, setTripBusy] = useState(false);
  const [tripWarning, setTripWarning] = useState('');
  const [tripError, setTripError] = useState('');
  const [vehicles, setVehicles] = useState<PlatformVehicle[]>([]);
  const [vehicleVin, setVehicleVin] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleError, setVehicleError] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError('');
    Promise.all([listPlatformDevices(offset, abort.signal), listGeotabTenants(abort.signal)])
      .then(([result, companies]) => {
        if (abort.signal.aborted) return;
        setDevices(result.items); setHasMore(result.hasMore); setCapped(result.inventoryCapped);
        setTenants(companies.items);
        setSelected((old) => result.items.some((d) => d.id === old) ? old : result.items[0]?.id ?? '');
      }).catch((e) => { if (!abort.signal.aborted) { setError(errorText(e)); setDevices([]); setSelected(''); } })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [offset, refresh]);

  useEffect(() => {
    const abort = new AbortController();
    setDetail(null); setTrip(null); setConfirming(false); setDetailError(''); setNotice('');
    if (!selected) return () => abort.abort();
    setDetailLoading(true);
    getPlatformDevice(selected, {}, abort.signal).then((d) => {
      if (!abort.signal.aborted) { setDetail(d); setTenant(d.companyId ?? ''); }
    }).catch((e) => { if (!abort.signal.aborted) setDetailError(errorText(e)); })
      .finally(() => { if (!abort.signal.aborted) setDetailLoading(false); });
    return () => abort.abort();
  }, [selected, refresh]);

  useEffect(() => {
    const abort = new AbortController();
    setTripRoute([]); setTripError(''); setTripWarning('');
    if (!trip || !selected) return () => abort.abort();
    setTripBusy(true);
    getPlatformDevice(selected, { from: trip.start, to: trip.stop ?? new Date().toISOString() }, abort.signal).then((d) => {
      if (!abort.signal.aborted) {
        setTripRoute(d.positions);
        setTripWarning(d.routeTruncated ? '조회 상한으로 경로 일부만 표시합니다.' : d.routeSampled ? '경로를 최대 1,000개 지점으로 간소화했습니다.' : '');
      }
    }).catch((e) => { if (!abort.signal.aborted) setTripError(errorText(e)); })
      .finally(() => { if (!abort.signal.aborted) setTripBusy(false); });
    return () => abort.abort();
  }, [selected, trip]);

  useEffect(() => {
    const abort = new AbortController();
    setVehicles([]); setVehicleVin(''); setVehicleError(''); setVehicleLoading(false);
    const companyId = detail?.companyId;
    if (!companyId || detail.vehicle) return () => abort.abort();
    setVehicleLoading(true);
    listPlatformTenantVehicles(companyId, abort.signal)
      .then((result) => {
        if (abort.signal.aborted) return;
        setVehicles(result.items);
        setVehicleVin(result.items[0]?.vin ?? '');
      })
      .catch((e) => { if (!abort.signal.aborted) setVehicleError(errorText(e)); })
      .finally(() => { if (!abort.signal.aborted) setVehicleLoading(false); });
    return () => abort.abort();
  }, [detail?.companyId, detail?.vehicle]);

  const save = useCallback(async () => {
    if (!detail || saving) return;
    setSaving(true); setDetailError(''); setNotice('');
    try {
      const updated = await assignPlatformDevice(detail.id, tenant || null, detail.revision);
      setDetail((old) => old?.id === updated.id ? { ...old, ...updated } : old);
      setDevices((old) => old.map((d) => d.id === updated.id ? updated : d));
      setConfirming(false); setNotice('테넌트 설정을 저장했습니다. 지정 이후 데이터부터 연동됩니다.');
    } catch (e) { setDetailError(errorText(e)); setConfirming(false); }
    finally { setSaving(false); }
  }, [detail, tenant, saving]);
  const tenantName = (id?: string | null) => !id ? '미지정' : tenants.find((t) => t.companyId === id)?.name ?? id;
  const route = trip ? tripRoute : detail?.positions ?? [];
  const applyVehicleBinding = useCallback((result: PlatformVehicleBindingResult, message: string) => {
    setDetail((old) => old?.id === result.device.id ? { ...old, ...result.device } : old);
    setDevices((old) => old.map((row) => row.id === result.device.id ? result.device : row));
    setNotice(message);
    setVehicleError('');
  }, []);
  const bindExistingVehicle = useCallback(async () => {
    if (!detail?.companyId || !vehicleVin || vehicleSaving) return;
    setVehicleSaving(true); setVehicleError(''); setNotice('');
    try {
      const result = await bindPlatformVehicle(detail.id, detail.companyId, vehicleVin, detail.revision);
      applyVehicleBinding(result, '기존 차량과 단말을 매칭했습니다. 이후 수집 데이터부터 차량에 연결됩니다.');
    } catch (e) { setVehicleError(errorText(e)); }
    finally { setVehicleSaving(false); }
  }, [applyVehicleBinding, detail, vehicleSaving, vehicleVin]);
  const createAndBindVehicle = useCallback(async () => {
    if (!detail?.companyId || !vehicleNumber.trim() || vehicleSaving) return;
    setVehicleSaving(true); setVehicleError(''); setNotice('');
    try {
      const result = await createPlatformVehicleAndBind(detail.id, detail.companyId, vehicleNumber.trim(), detail.revision);
      applyVehicleBinding(result, result.created
        ? '차량 자산을 등록하고 단말을 매칭했습니다.'
        : '같은 VIN의 기존 차량을 확인해 단말을 매칭했습니다.');
      setVehicleNumber('');
    } catch (e) { setVehicleError(errorText(e)); }
    finally { setVehicleSaving(false); }
  }, [applyVehicleBinding, detail, vehicleNumber, vehicleSaving]);

  return <Layout title="Geotab 수집 모니터">
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Geotab 수집 모니터</h1>
          <p className="mt-1 text-sm text-slate-500">Super admin 전용 · 미등록 차량 포함 · 5분 주기 수집 · 시각은 한국시간(KST)</p></div>
        <button className={button} disabled={saving || loading || detailLoading} onClick={() => setRefresh((v) => v + 1)}><RefreshCw className="mr-2 inline h-4 w-4" />새로고침</button>
      </header>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {loading && <p role="status">수집된 단말을 불러오는 중...</p>}
      {!loading && !error && !devices.length && <p className="rounded-xl border bg-white p-8">수집된 단말이 없습니다. Collector의 장치 수집 및 원본 DB 연결을 확인해 주세요.</p>}
      {capped && <p className="text-amber-700">단말 조회 상한에 도달했습니다. 일부 단말이 생략될 수 있습니다.</p>}
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside aria-label="수집된 Geotab 단말" className="space-y-2">
          {devices.map((d) => <button key={d.id} disabled={saving} onClick={() => setSelected(d.id)} aria-pressed={selected === d.id}
            className={`w-full rounded-xl border p-4 text-left ${selected === d.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
            <span className="block font-semibold">{d.vehicle?.vehicleNumber || d.serialNumber || d.deviceId}</span>
            <span className="mt-1 block text-xs text-slate-600">{d.vehicle ? '차량 연결됨' : d.registeredCandidate ? '등록 차량 후보 · 매칭 필요' : 'Pangea 미등록/미매칭'} · {tenantName(d.companyId)}</span>
            <span className="mt-2 block text-sm"><Radio className="mr-1 inline h-4 w-4" />{status[d.connectionStatus]} · 수집 {d.collectionStatus === 'healthy' ? '정상' : '확인 필요'}</span>
            <span className="mt-2 block break-all text-xs text-slate-500">{d.sourceDatabase} / {d.deviceId}</span>
          </button>)}
          <div className="flex gap-2"><button className={button} disabled={offset === 0 || loading || saving} onClick={() => setOffset((n) => n - 50)}>이전</button><button className={button} disabled={!hasMore || loading || saving} onClick={() => setOffset((n) => n + 50)}>다음</button></div>
        </aside>
        <main className="min-w-0 space-y-4" aria-label="단말 상세">
          {detailLoading && <p role="status">단말 상세를 불러오는 중...</p>}
          {detailError && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{detailError}</p>}
          {notice && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{notice}</p>}
          {detail && <>
            <section className="rounded-xl border bg-white p-5">
              <h2 className="text-lg font-semibold">{detail.vehicle?.vehicleNumber || detail.serialNumber || detail.deviceId}</h2>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                {Object.entries({ '단말 일련번호': detail.serialNumber || '미수집', 'Geotab 식별자': `${detail.sourceDatabase} / ${detail.deviceId}`,
                  '단말 VIN': detail.providerVin || '미수집', '등록 차량': detail.vehicle ? `${detail.vehicle.vehicleNumber || detail.vehicle.vin} ${detail.vehicle.model || ''}` : '미매칭',
                  '연결 상태': `${status[detail.connectionStatus]} / ${detail.isDriving === null ? '주행 상태 미상' : detail.isDriving ? '주행 중' : '정차'}`,
                  '최근 수집 시각': date(detail.lastCollectedAt), '단말 최근 데이터 시각': date(detail.lastDataAt), '현재 테넌트': tenantName(detail.companyId) }).map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="mt-1 break-all font-medium">{v}</dd></div>)}
              </dl>
              {detail.registeredCandidate && <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">동일 VIN의 등록 차량 후보: {detail.registeredCandidate.vehicleNumber || detail.registeredCandidate.vin} ({tenantName(detail.registeredCandidate.companyId)}). 자동 연결하지 않습니다. 테넌트 지정 후 설정의 단말 차량 매칭에서 확인해 주세요.</p>}
              <p className="mt-3 text-xs text-slate-500">연결 상태는 Geotab 통신 플래그 기준입니다. 15분 이상 수집이 갱신되지 않으면 확인 필요로 표시하며, 주차 중 데이터 시각이 오래된 것만으로 단절로 판단하지 않습니다.</p>
              <details className="mt-3 text-xs"><summary>수집 체크포인트</summary>{detail.feeds.map((f) => <p key={f.entity}>{f.entity}: {date(f.updatedAt)}</p>)}</details>
            </section>
            <section className="rounded-xl border bg-white p-5" aria-label="테넌트 설정">
              <h2 className="font-semibold">테넌트 설정</h2>
              <p className="my-2 text-sm text-slate-500">지정 이후 데이터만 해당 테넌트로 전달합니다. 과거 위치는 이전하지 않습니다. 차량이 연결된 단말은 먼저 차량 매칭을 해제해야 변경할 수 있습니다.</p>
              <div className="flex flex-wrap gap-2"><select aria-label="단말 소속 테넌트" className="min-w-0 max-w-full rounded border p-2" value={tenant} disabled={saving || !!detail.vehicle} onChange={(e) => { setTenant(e.target.value); setConfirming(false); }}><option value="">미지정</option>{tenants.map((t) => <option key={t.companyId} value={t.companyId}>{t.name} ({t.companyId})</option>)}</select>
                <button className={button} disabled={saving || !!detail.vehicle || tenant === (detail.companyId ?? '')} onClick={() => setConfirming(true)}>테넌트 설정 저장</button></div>
              {confirming && <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3" role="group" aria-label="테넌트 변경 확인"><p className="mb-2 text-sm">{tenantName(detail.companyId)} → {tenantName(tenant)}로 변경할까요? 단말 위치의 공개 범위가 변경됩니다.</p><button className={button} disabled={saving} onClick={save}>{saving ? '저장 중...' : '변경 확인'}</button><button className={`${button} ml-2`} disabled={saving} onClick={() => setConfirming(false)}>취소</button></div>}
            </section>
            <section className="rounded-xl border bg-white p-5" aria-label="차량 자산 및 단말 매칭">
              <h2 className="font-semibold">차량 자산 및 단말 매칭</h2>
              {!detail.companyId && <p className="mt-2 text-sm text-slate-500">먼저 단말 소속 테넌트를 저장해 주세요.</p>}
              {detail.vehicle && <p className="mt-2 rounded bg-green-50 p-3 text-sm text-green-800">현재 매칭: {detail.vehicle.vehicleNumber || detail.vehicle.vin} · {detail.vehicle.vin}</p>}
              {detail.companyId && !detail.vehicle && <div className="mt-3 space-y-4">
                <div>
                  <h3 className="text-sm font-medium">등록된 차량에 매칭</h3>
                  <p className="mt-1 text-xs text-slate-500">{tenantName(detail.companyId)}에 이미 등록된 차량이 있으면 선택합니다.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select aria-label="연결할 기존 차량" className="min-w-0 max-w-full rounded border p-2" value={vehicleVin} disabled={vehicleLoading || vehicleSaving || !vehicles.length} onChange={(e) => setVehicleVin(e.target.value)}>
                      {!vehicles.length && <option value="">등록된 차량 없음</option>}
                      {vehicles.map((row) => <option key={row.vin} value={row.vin}>{row.vehicleNumber || row.vin} · {row.vin}</option>)}
                    </select>
                    <button className={button} disabled={!vehicleVin || vehicleLoading || vehicleSaving} onClick={() => void bindExistingVehicle()}>{vehicleSaving ? '처리 중...' : '기존 차량 매칭'}</button>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium">새 차량 자산 생성 후 매칭</h3>
                  <p className="mt-1 text-xs text-slate-500">VIN·제조사·모델·연식은 Geotab 수집값을 사용하고, 차량번호만 입력하면 자산 생성과 단말 매칭을 한 번에 처리합니다.</p>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-slate-500">VIN</dt><dd className="break-all font-medium">{detail.providerVin || '미수집'}</dd></div>
                    <div><dt className="text-slate-500">Geotab 차량 정보</dt><dd className="font-medium">{[detail.providerMake, detail.providerModel, detail.providerYear].filter(Boolean).join(' · ') || '미수집'}</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input aria-label="새 차량번호" className="min-w-0 rounded border p-2" placeholder="예: 282누7485" value={vehicleNumber} disabled={vehicleSaving} onChange={(e) => setVehicleNumber(e.target.value)} />
                    <button className={button} disabled={!detail.providerVin || !vehicleNumber.trim() || vehicleSaving} onClick={() => void createAndBindVehicle()}>{vehicleSaving ? '처리 중...' : '자산 등록 및 매칭'}</button>
                  </div>
                  {!detail.providerVin && <p className="mt-2 text-xs text-amber-700">Geotab VIN이 없어 자동 자산 등록은 사용할 수 없습니다.</p>}
                </div>
                {vehicleError && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{vehicleError}</p>}
              </div>}
            </section>
            <section className="overflow-hidden rounded-xl border bg-white" aria-label="최근 위치">
              <h2 className="p-4 font-semibold"><MapPin className="mr-1 inline h-4 w-4" />최근 위치</h2>
              {detail.latestPosition ? <><TelemetryRouteMap key={`${detail.id}-latest`} positions={[detail.latestPosition]} /><p className="p-3 text-sm text-slate-600">{date(detail.latestPosition.recordedAt)} · {detail.latestPosition.latitude.toFixed(5)}, {detail.latestPosition.longitude.toFixed(5)}</p></> : <p className="p-5 text-slate-500">유효한 최근 위치가 없습니다.</p>}
            </section>
            <section className="overflow-hidden rounded-xl border bg-white" aria-label="Trip 및 주행 경로">
              <div className="flex flex-wrap items-center justify-between gap-2 p-4"><h2 className="font-semibold">{trip ? '선택한 Trip 경로' : '최근 7일 경로'}</h2><button className={button} onClick={() => setTrip(null)}>최근 7일 전체</button></div>
              {tripBusy && trip ? <p className="p-4">Trip 경로를 불러오는 중...</p> : route.length ? <TelemetryRouteMap key={`${detail.id}-${trip?.start ?? 'all'}`} positions={route} /> : <p className="p-5 text-slate-500">해당 기간에 수집된 GPS 경로가 없습니다. Trip 요약만 수집됐거나 수집 시작 전 기록일 수 있습니다.</p>}
              {tripError && <p role="alert" className="p-3 text-red-700">{tripError}</p>}
              {(trip ? tripWarning : detail.routeTruncated || detail.routeSampled) && <p className="p-3 text-sm text-amber-700">{trip ? tripWarning : detail.routeTruncated ? '조회 상한으로 경로 일부만 표시합니다.' : '경로를 최대 1,000개 지점으로 간소화했습니다.'}</p>}
              <p className="px-4 py-2 text-xs text-slate-500">최근 7일에 시작한 Geotab Trip입니다. 경로는 해당 주행 시간대의 LogRecord를 사용합니다.</p>
              <div className="max-h-80 overflow-y-auto p-3">{detail.trips.map((t) => <button key={t.start} className={`mb-2 w-full rounded border p-3 text-left text-sm ${trip?.start === t.start ? 'border-blue-500 bg-blue-50' : ''}`} onClick={() => setTrip(t)} aria-pressed={trip?.start === t.start}><span className="block">{date(t.start)} → {date(t.stop)}</span><span className="text-slate-500">{t.distanceKm === null ? '거리 미수집' : `${t.distanceKm.toFixed(1)} km`} · {t.drivingDuration || '주행 시간 미수집'}</span></button>)}{!detail.trips.length && <p className="p-2 text-sm text-slate-500">해당 기간에 수집된 Trip이 없습니다.</p>}{detail.tripsTruncated && <p className="text-sm text-amber-700">최근 Trip 100개까지만 표시합니다.</p>}</div>
            </section>
          </>}
        </main>
      </div>
    </div>
  </Layout>;
}
