import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useBlocker } from 'react-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { getRentalProspects, updateRentalProspect, type RentalProspect, type RentalProspectData } from '../../services/rentalProspects';

const count = (n: number | null) => n === null ? '미제공' : `${n.toLocaleString()}대`;
const hasLocation = (p: RentalProspect) => p.latitude !== null && p.longitude !== null;
const vehicleDetails = (p: RentalProspect) => `승용 ${count(p.passengerVehicles)} · 승합 ${count(p.vans)} · 전기승용 ${count(p.electricPassengerVehicles)} · 전기승합 ${count(p.electricVans)}`;

function ProspectMap({ items, selected, onSelect, onBounds }: {
  items: RentalProspect[]; selected?: string;
  onSelect: (id: string) => void; onBounds: (bounds: L.LatLngBounds) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const fitted = useRef(false);
  const centeredSelection = useRef<string>();
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current).setView([37.45, 127.15], 9);
    map.current = instance;
    L.tileLayer(import.meta.env.VITE_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).on('tileerror', () => setTileError(true)).addTo(instance);
    const changed = () => onBounds(instance.getBounds());
    instance.on('moveend', changed);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(element.current);
    changed();
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, [onBounds]);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const group = L.featureGroup().addTo(instance);
    markers.current.clear();
    items.filter(hasLocation).forEach(p => {
      const content = document.createElement('div');
      content.style.whiteSpace = 'normal';
      content.style.width = '280px';
      content.style.maxWidth = '70vw';
      const title = document.createElement('strong'); title.textContent = p.name; content.append(title);
      [p.officeType, p.address, p.phone || '전화번호 미제공', `총 보유 ${count(p.totalVehicles)}`, vehicleDetails(p),
        `기준일 ${p.referenceDate || '미제공'}`, p.excluded ? '마케팅 제외' : '마케팅 대상'].forEach(text => {
        const line = document.createElement('div'); line.textContent = text; content.append(line);
      });
      const marker = L.circleMarker([p.latitude!, p.longitude!], {
        radius: p.totalVehicles === null ? 5 : Math.max(5, Math.min(42, Math.sqrt(p.totalVehicles) * 1.25)),
        color: p.excluded ? '#64748b' : '#2563eb', fillOpacity: 0.55, weight: 2,
      }).bindTooltip(content).on('click', () => onSelect(p.id)).addTo(group);
      markers.current.set(p.id, marker);
    });
    if (!fitted.current && group.getLayers().length) {
      instance.fitBounds(group.getBounds(), { padding: [35, 35], maxZoom: 11 }); fitted.current = true;
    }
    onBounds(instance.getBounds());
    return () => { group.remove(); };
  }, [items, onSelect, onBounds]);
  useEffect(() => {
    markers.current.forEach((marker, id) => marker.setStyle({ weight: selected === id ? 4 : 2 }));
    if (selected && centeredSelection.current !== selected) {
      centeredSelection.current = selected;
      const marker = markers.current.get(selected);
      if (marker) { map.current?.panTo(marker.getLatLng()); marker.openTooltip(); }
    }
  }, [selected, items]);
  return <div className="relative min-h-[500px] flex-1">
    <div ref={element} className="h-full min-h-[500px] w-full rounded-xl" style={{ zIndex: 0 }} aria-label="경기도 렌터카 업체 지도" />
    {tileError && <p role="alert" className="absolute bottom-8 left-3 z-10 bg-white p-2 text-xs">지도 배경을 불러오지 못했습니다. 네트워크를 확인해 주세요.</p>}
  </div>;
}

function ProspectWorkspace() {
  const [data, setData] = useState<RentalProspectData>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('target');
  const [bounds, setBounds] = useState<L.LatLngBounds>();
  const [selected, setSelected] = useState<string>();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getRentalProspects(controller.signal).then(setData).catch(e => {
      if (!controller.signal.aborted) setError(e.message || '업체 정보를 불러오지 못했습니다.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  const dirty = Boolean(data?.items.some(p => drafts[p.id] !== undefined && drafts[p.id] !== p.memo));
  const blocker = useBlocker(dirty);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const filtered = useMemo(() => (data?.items || []).filter(p =>
    (filter === 'all' || (filter === 'excluded' ? p.excluded : !p.excluded)) &&
    `${p.name} ${p.address} ${p.phone}`.toLowerCase().includes(query.trim().toLowerCase())), [data, filter, query]);
  const visible = useMemo(() => filtered.filter(p => hasLocation(p) && bounds?.contains([p.latitude!, p.longitude!])), [filtered, bounds]);
  const missing = filtered.filter(p => !hasLocation(p));
  const office = data?.items.find(p => p.id === selected);
  const choose = useCallback((id: string) => { setSelected(id); setNotice(''); }, []);
  const changeBounds = useCallback((value: L.LatLngBounds) => setBounds(value), []);
  async function save(patch: { memo?: string; excluded?: boolean }) {
    if (!office || saving) return;
    const id = office.id;
    setSaving(true); setNotice('');
    try {
      const updated = await updateRentalProspect(id, patch);
      setData(current => current ? { ...current, items: current.items.map(p => p.id === id ? { ...p, ...updated } : p) } : current);
      if (patch.memo !== undefined) setDrafts(current => { const next = { ...current }; delete next[id]; return next; });
      setNotice('저장했습니다.');
    } catch (e) { setNotice(e instanceof Error ? e.message : '저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setSaving(false); }
  }
  return <Layout title="경기도 렌터카 영업 지도">
    {blocker.state === 'blocked' && <div role="dialog" aria-modal="true" aria-label="저장하지 않은 메모" className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-md rounded-xl bg-white p-6">
        <h2 className="font-semibold">저장하지 않은 메모가 있습니다</h2>
        <p className="my-3 text-sm">다른 페이지로 이동하면 작성 중인 메모가 사라집니다.</p>
        <button className="mr-3 rounded bg-blue-700 px-3 py-2 text-white" onClick={() => blocker.reset()}>계속 작성</button>
        <button className="rounded border px-3 py-2" onClick={() => blocker.proceed()}>저장하지 않고 이동</button>
      </div>
    </div>}
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <header><h1 className="text-2xl font-semibold">경기도 렌터카 영업 지도</h1><p className="mt-1 text-sm text-slate-500">점을 가리켜 업체 정보를 확인하고, 클릭하여 영업 메모를 관리하세요.</p></header>
      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="업체 검색" placeholder="업체명, 주소, 전화번호 검색" value={query} onChange={e => setQuery(e.target.value)} className="w-72 rounded-lg border bg-white p-2" />
        <select aria-label="마케팅 대상 필터" value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border bg-white p-2">
          <option value="target">마케팅 대상만</option><option value="all">전체 업체</option><option value="excluded">제외 업체만</option>
        </select>
        <span className="text-sm text-slate-600">지도 내 {visible.length}곳 · 조건 일치 {filtered.length}곳 · 좌표 미제공 {missing.length}곳</span>
      </div>
      {loading && <p role="status">업체 정보를 불러오는 중입니다…</p>}
      {error && <p role="alert">{error} <button onClick={() => setRetry(v => v + 1)} className="underline">다시 시도</button></p>}
      <div className="flex min-h-[600px] flex-1 flex-col gap-4 xl:flex-row">
        <ProspectMap items={filtered} selected={selected} onSelect={choose} onBounds={changeBounds} />
        <aside className="flex max-h-[850px] w-full flex-col gap-3 overflow-auto rounded-xl border bg-white p-4 xl:w-[380px] xl:shrink-0" aria-label="업체 목록 및 영업 메모">
          {office && <section className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <h2 className="font-semibold">{office.name}</h2><p className="text-sm">{office.officeType} · {office.address}</p>
            <p className="my-2">{office.phone ? <a href={`tel:${office.phone}`}>{office.phone}</a> : '전화번호 미제공'}</p>
            <p className="text-sm">총 보유 {count(office.totalVehicles)}</p><p className="text-xs">{vehicleDetails(office)}</p>
            <p className="mt-1 text-xs text-slate-500">기준일 {office.referenceDate || '미제공'} · {office.provider}</p>
            <label className="mt-3 block text-sm">연락 및 영업 메모
              <textarea aria-label="영업 메모" maxLength={10000} rows={5} value={drafts[office.id] ?? office.memo} disabled={saving}
                onChange={e => setDrafts(current => ({ ...current, [office.id]: e.target.value }))} className="mt-1 w-full rounded border bg-white p-2" />
            </label>
            <button onClick={() => save({ memo: drafts[office.id] ?? office.memo })} disabled={saving} className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">{saving ? '저장 중…' : '메모 저장'}</button>
            {drafts[office.id] !== undefined && drafts[office.id] !== office.memo && <span className="ml-2 text-xs">저장하지 않은 메모</span>}
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={office.excluded} disabled={saving} onChange={e => save({ excluded: e.target.checked })} />마케팅 대상에서 제외 (즉시 저장)</label>
            {office.updatedAt && <p className="mt-2 text-xs text-slate-500">최근 저장 {new Date(office.updatedAt).toLocaleString('ko-KR')}</p>}
            <p role="status" className="mt-2 text-sm">{notice}</p>
          </section>}
          <h2 className="font-semibold">현재 지도 내 업체 · {visible.length}곳</h2>
          {!loading && !visible.length && <p className="text-sm text-slate-500">표시할 업체가 없습니다. 지도를 이동하거나 필터를 변경하세요.</p>}
          {visible.map(p => <button key={p.id} onClick={() => choose(p.id)} className={`rounded-lg border p-3 text-left ${selected === p.id ? 'border-blue-500 bg-blue-50' : ''}`}>
            <span className="block font-medium">{p.name} {p.excluded && <span className="text-xs text-slate-500">제외</span>}</span>
            <span className="block text-sm text-slate-600">{p.address}</span><span className="block text-sm">{p.phone || '전화번호 미제공'} · {count(p.totalVehicles)}</span>
            {drafts[p.id] !== undefined && drafts[p.id] !== p.memo && <span className="text-xs text-amber-700">저장하지 않은 메모</span>}
          </button>)}
          {missing.length > 0 && <details><summary className="cursor-pointer text-sm">좌표 미제공 업체 {missing.length}곳 (지도 표시 불가)</summary>{missing.map(p => <button key={p.id} onClick={() => choose(p.id)} className="block w-full border-b py-2 text-left text-sm">{p.name} · {p.address}</button>)}</details>}
        </aside>
      </div>
      <footer className="text-xs text-slate-500">원 크기: 총 보유 차량 수 (최소·최대 크기 제한, 미제공은 작은 점) · 파랑: 대상 / 회색: 제외 · 차종별 수치는 원천값이며 전기차를 총량에 중복 합산하지 않습니다.<br />
        <a href={data?.sourceUrl || 'https://www.data.go.kr/data/15025689/standard.do'} target="_blank" rel="noreferrer" className="underline">출처: 공공데이터포털 전국렌터카업체정보표준데이터</a> · 수집일 {data?.fetchedAt?.slice(0, 10) || '—'} · 경기도 주소가 있는 공개 사업장 기준이며 전체 업체를 보장하지 않습니다.
      </footer>
    </div>
  </Layout>;
}

export default function RentalProspects() {
  const { user } = useAuth();
  return user?.role === 'super_admin' ? <ProspectWorkspace /> : <Navigate to="/forbidden" replace />;
}
