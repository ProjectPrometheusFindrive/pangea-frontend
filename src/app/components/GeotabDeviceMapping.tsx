import { useEffect, useState } from 'react';
import { getGeotabDevices, getGeotabMappingVehicles, mapGeotabDevice, type GeotabDevice } from '../../services/geotab';
import { RecentPositionMapModal } from './RecentPositionMapModal';
import { formatDateTimeKst } from '../utils/dateTimeFormat';

interface Props {
  companyId: string;
}

export function GeotabDeviceMapping({ companyId }: Props) {
  const [devices, setDevices] = useState<GeotabDevice[]>([]);
  const [vehicles, setVehicles] = useState<{ vin: string; vehicleNumber: string }[]>([]);
  const [search, setSearch] = useState('');
  const [vehicleError, setVehicleError] = useState('');
  const [hasMoreVehicles, setHasMoreVehicles] = useState(false);
  const [selected, setSelected] = useState('');
  const [vin, setVin] = useState('');
  const [installedAt, setInstalledAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [mapVehicle, setMapVehicle] = useState<GeotabDevice | null>(null);
  const device = devices.find((row) => row.id === selected);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getGeotabMappingVehicles(search, { companyId, signal: controller.signal })
        .then((result) => { if (!controller.signal.aborted) { setVehicles(result.items); setHasMoreVehicles(result.hasMore); setVehicleError(''); } })
        .catch(() => { if (!controller.signal.aborted) { setVehicles([]); setVehicleError('차량 목록 조회에 실패했습니다. 다시 검색해 주세요.'); } });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [companyId, search, reload]);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    getGeotabDevices({ companyId, signal: controller.signal })
      .then(({ items }) => { if (!controller.signal.aborted) setDevices(items); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '단말 목록을 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [companyId, reload]);

  const save = async (unlink = false) => {
    if (!device || busy || (!unlink && !vin)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const mapped = await mapGeotabDevice(device.id, {
        vin: unlink ? null : vin, revision: device.revision,
        effectiveFrom: !unlink && installedAt && device.revision === 0 ? new Date(installedAt).toISOString() : undefined,
      }, { companyId });
      setDevices((rows) => rows.map((row) => row.id === mapped.id ? mapped : row));
      setVin(mapped.vin ?? ''); setInstalledAt('');
      setNotice(unlink ? '단말 매칭을 해제했습니다. 기존 경로는 원래 차량에 보존됩니다.' : '일련번호와 차량 매칭을 저장했습니다. 매칭 시점 이후 수집·재수집되는 데이터에 적용됩니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '매칭에 실패했습니다. 새로고침 후 다시 시도하세요.');
    } finally { setBusy(false); }
  };

  return <section className="mb-4 rounded-xl border border-indigo-100 bg-white p-4" aria-label="Geotab 단말 차량 매칭">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="font-semibold text-slate-900">Geotab 단말 · 차량번호 매칭</h2>
        <p className="mt-1 text-xs text-slate-600">MyGeotab 차량명이나 b1 같은 ID 대신 단말의 일련번호로 Pangea 차량을 연결합니다.</p></div>
      <button type="button" disabled={busy} onClick={() => { setSelected(''); setVin(''); setInstalledAt(''); setReload((n) => n + 1); }} className="shrink-0 rounded border px-3 py-2 text-xs disabled:opacity-50">단말 새로고침</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-indigo-700">{notice}</p>}
    {!busy && !error && devices.length === 0 && <p className="mt-3 text-sm text-slate-500">아직 수집된 단말이 없습니다. Collector의 테넌트 설정과 수집 상태를 확인하세요.</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <label className="text-xs font-semibold">수집된 단말 일련번호
        <select aria-label="수집된 단말 일련번호" className="mt-1 w-full rounded border p-2 text-sm" value={selected} disabled={busy} onChange={(e) => {
          const row = devices.find((item) => item.id === e.target.value);
          setSelected(e.target.value); setVin(row?.vin ?? ''); setInstalledAt(''); setNotice('');
        }}>
          <option value="">단말 선택 ({devices.length}대)</option>
          {devices.map((row) => <option key={row.id} value={row.id}>{row.serialNumber || '일련번호 없음'} · {row.deviceId} · {row.vehicleNumber || '미매칭'}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold">연결할 Pangea 차량번호
        <input aria-label="매칭 차량 검색" placeholder="차량번호 또는 VIN 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1 w-full rounded border p-2 text-sm" />
        <select aria-label="연결할 Pangea 차량번호" value={vin} disabled={busy || !device} className="mt-1 w-full rounded border p-2 text-sm" onChange={(e) => setVin(e.target.value)}>
          <option value="">차량 선택</option>
          {device?.vin && !vehicles.some((row) => row.vin === device.vin) && <option value={device.vin}>{device.vehicleNumber} · {device.vin}</option>}
          {vehicles.map((row) => <option value={row.vin} key={row.vin}>{row.vehicleNumber} · {row.vin}</option>)}
        </select>
        {vehicleError && <span className="block text-red-700">{vehicleError}</span>}
        {hasMoreVehicles && <span className="block">상위 100대 표시 중입니다. 검색어를 입력해 주세요.</span>}
      </label>
    </div>
    {device && <div className="mt-3 space-y-2 text-xs text-slate-600">
      <p>단말 ID: {device.deviceId} · DB: {device.sourceDatabase} · 종류: {device.deviceType || '미확인'}</p>
      <p>단말 보고 VIN: {device.providerVin || '없음'} · MyGeotab 차량번호: {device.providerPlate || '미입력'}</p>
      <p>현재 매칭: {device.vehicleNumber || '미매칭'} · 마지막 단말 목록 수집: {formatDateTimeKst(device.lastSyncedAt)}</p>
      {device.revision === 0 && <label className="block">최초 장착 시점 (선택, 비워두면 지금부터)
        <input aria-label="최초 장착 시점" type="datetime-local" value={installedAt} onChange={(e) => setInstalledAt(e.target.value)} disabled={busy} className="ml-2 rounded border p-2" />
        <span className="mt-1 block">과거 시점을 지정할 때는 해당 기간에도 이 차량에 장착되어 있었는지 확인하세요. 과거 데이터 수집은 알림을 재발송하지 않습니다.</span>
      </label>}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => void save()} disabled={busy || !vin || !device.serialNumber} className="rounded bg-indigo-600 px-3 py-2 text-white disabled:opacity-50">차량 매칭 저장</button>
        {device.mapped && <button type="button" onClick={() => { if (window.confirm('매칭을 해제할까요? 이후 데이터는 차량에 연결되지 않습니다.')) void save(true); }} disabled={busy} className="rounded border px-3 py-2">매칭 해제</button>}
        {device.vin && <button type="button" onClick={() => setMapVehicle(device)} className="rounded border px-3 py-2">최근 위치 조회</button>}
      </div>
    </div>}
    {mapVehicle?.vin && <RecentPositionMapModal vehicleId={mapVehicle.vin} vehicleLabel={mapVehicle.vehicleNumber || mapVehicle.vin} companyId={companyId} onClose={() => setMapVehicle(null)} />}
  </section>;
}
