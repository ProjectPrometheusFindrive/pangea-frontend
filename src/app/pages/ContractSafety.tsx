import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { listGeotabTenants } from '../../services/geotabAdmin';
import { getSafetySettings, saveSafetySettings, listSafetyContracts, getSafetyContract, excludeSafetyRecord, type SafetyPolicy, type SafetyContract, type SafetyDetail, type SafetyRecord } from '../../services/contractSafety';

const status: Record<string, string> = { not_applicable: '적용 전 계약', awaiting_pickup: '대여 시작 대기', provisional: '잠정', final: '확정', insufficient_distance: '평가 거리 부족', sync_pending: '집계 대기', data_pending: '자료 확인 필요' };
const category: Record<string, string> = { acceleration: '급가속', braking: '급제동', cornering: '급회전', speeding: '과속' };
const warning: Record<string, string> = { unsupported_formula: '평가 기준 버전 확인 필요', incomplete_trip: '운행 종료 자료 수집 대기', invalid_custody_period: '인도·반납 시각 확인 필요', uncovered_binding: '평가 기간 중 단말 매칭 공백', boundary_trip: '인도·반납 또는 차량 교체 시각에 걸친 운행 확인 필요', invalid_trip: '운행거리·시간 자료 확인 필요', invalid_event: '이벤트 시각 확인 필요', overlapping_contract: '다른 계약과 차량 사용 기간 중복', overlapping_trips: '운행 구간 중복', event_without_trip: '연결할 운행 자료가 없는 이벤트' };
const time = (v?: string) => v ? new Date(v).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) : '—';
const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-40';
const errorText = (e: unknown) => e instanceof Error ? e.message : '처리하지 못했습니다.';

export default function ContractSafety() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const superAdmin = user?.role === 'super_admin';
  const canEdit = superAdmin || user?.role === 'admin';
  const [companies, setCompanies] = useState<{ companyId: string; name: string }[]>([]);
  const company = superAdmin ? params.get('companyId') ?? '' : user?.companyId ?? '';
  const selected = params.get('contractId') ?? '';
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<SafetyContract[]>([]);
  const [more, setMore] = useState(false);
  const [settings, setSettings] = useState<SafetyPolicy | null>(null);
  const [minimum, setMinimum] = useState('300');
  const [detail, setDetail] = useState<SafetyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<SafetyRecord | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!superAdmin) return;
    const abort = new AbortController();
    listGeotabTenants(abort.signal).then(r => { if (!abort.signal.aborted) setCompanies(r.items); })
      .catch(e => { if (!abort.signal.aborted) setError(errorText(e)); });
    return () => abort.abort();
  }, [superAdmin]);

  useEffect(() => {
    const abort = new AbortController();
    setItems([]); setSettings(null); setError(''); setNotice(''); setEditing(null);
    if (!company) return () => abort.abort();
    setLoading(true);
    Promise.all([getSafetySettings(company, abort.signal), listSafetyContracts(company, offset, abort.signal)]).then(([s, r]) => {
      if (abort.signal.aborted) return;
      setSettings(s); setMinimum(String(s.minimumDistanceKm)); setItems(r.items); setMore(r.hasMore);
    }).catch(e => { if (!abort.signal.aborted) setError(errorText(e)); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [company, offset, refresh]);

  useEffect(() => {
    const abort = new AbortController();
    setDetail(null); setEditing(null); setDetailLoading(false);
    if (!company || !selected) return () => abort.abort();
    setDetailLoading(true);
    getSafetyContract(company, selected, abort.signal).then(r => { if (!abort.signal.aborted) setDetail(r); })
      .catch(e => { if (!abort.signal.aborted) setError(errorText(e)); })
      .finally(() => { if (!abort.signal.aborted) setDetailLoading(false); });
    return () => abort.abort();
  }, [company, selected, refresh]);

  async function saveSettings() {
    if (!settings) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await saveSafetySettings(company, Number(minimum), settings.revision);
      setSettings(r); setNotice('저장했습니다. 새로 생성하는 계약부터 적용됩니다.');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  async function saveExclusion() {
    if (!editing || !selected) return;
    setBusy(true); setError('');
    try {
      const r = await excludeSafetyRecord(company, selected, editing.key, !editing.excluded, reason);
      setDetail(r); setEditing(null); setReason('');
      setItems(old => old.map(i => i.contractId === r.contractId ? r : i));
      setNotice('평가 변경과 사유를 저장하고 점수를 재계산했습니다.');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  const selectContract = (id: string) => setParams({ ...(superAdmin ? { companyId: company } : {}), ...(id ? { contractId: id } : {}) });
  return <Layout title="계약 안전운전">
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-slate-900">계약 안전운전점수</h1><p className="mt-1 text-sm text-slate-500">대표 계약자 명의로 계약 기간의 운행을 평가합니다. 추가 운전자도 같은 계약에 포함됩니다.</p></div>
        <button className={button} onClick={() => setRefresh(v => v + 1)} disabled={loading || busy}>새로고침</button>
      </div>
      {superAdmin && <label className="block text-sm font-medium">회사 선택<select className="ml-3 rounded-lg border p-2" aria-label="회사 선택" value={company} disabled={busy} onChange={e => { setOffset(0); setParams({ companyId: e.target.value }); }}>
        <option value="">회사를 선택하세요</option>{companies.map(c => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
      </select></label>}
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{notice}</div>}
      {!company ? <p className="rounded-xl border bg-white p-6">평가할 회사를 선택해 주세요.</p> : <>
        {settings && <section aria-label="평가 설정" className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">평가 설정</h2>
          <div className="flex flex-wrap items-center gap-3"><label className="text-sm">최소 주행거리 (km)<input aria-label="최소 주행거리 (km)" type="number" min={1} max={100000} step={1} className="ml-2 w-28 rounded border p-2" value={minimum} disabled={!canEdit || busy} onChange={e => setMinimum(e.target.value)} /></label>
            {canEdit && <button className={button} disabled={busy || !Number.isInteger(Number(minimum)) || Number(minimum) < 1 || Number(minimum) > 100000} onClick={saveSettings}>설정 저장</button>}
            <span className="text-sm text-slate-500">반납 후 확정 대기 {settings.settlementDelayMinutes}분 · 새 계약부터 적용</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">급가속·급제동·급회전 각 20%, 과속 40%. 급조작은 거리당 횟수, 과속은 주행시간 비율로 산정합니다. 계약 생성 시 기준을 고정합니다.</p>
        </section>}
        <section aria-label="계약별 안전운전점수" className="overflow-x-auto rounded-xl border bg-white">
          {loading ? <p className="p-6" role="status">계약을 불러오는 중입니다.</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['계약', '대표 계약자', '차량', '평가 거리', '점수', '상태', '상세'].map(v => <th key={v} className="p-3">{v}</th>)}</tr></thead>
            <tbody>{items.map(i => <tr key={i.contractId} className="border-t"><td className="p-3">{i.contractId}</td><td className="p-3">{i.representativeName}</td><td className="p-3">{i.vehicleNumber || '—'}</td><td className="p-3">{i.metrics.distanceKm?.toFixed(1) ?? '0'} / {i.policy.minimumDistanceKm ?? '—'}km</td><td className="p-3 font-bold">{i.score == null ? '—' : `${i.score.toFixed(1)}점`}</td><td className="p-3">{status[i.status] ?? i.status}</td><td className="p-3"><button className={button} onClick={() => selectContract(i.contractId)}>상세 보기</button></td></tr>)}</tbody></table>}
          {!loading && items.length === 0 && <p className="p-6 text-slate-500">등록된 계약이 없습니다.</p>}
          <div className="flex justify-end gap-2 border-t p-3"><button className={button} disabled={offset === 0 || loading} onClick={() => setOffset(v => Math.max(0, v - 20))}>이전</button><button className={button} disabled={!more || loading} onClick={() => setOffset(v => v + 20)}>다음</button></div>
        </section>
        {detailLoading && <p role="status">평가 상세를 불러오는 중입니다.</p>}
        {detail && <section aria-label="계약 평가 상세" className="space-y-4 rounded-xl border bg-white p-4">
          <div className="flex justify-between gap-3"><h2 className="font-bold">{detail.contractId} · {detail.representativeName}</h2><button className={button} onClick={() => selectContract('')}>상세 닫기</button></div>
          <p className="text-lg font-bold">{detail.score == null ? status[detail.status] : `${detail.score.toFixed(1)}점 · ${status[detail.status]}`}</p>
          <p className="text-sm text-slate-500">인도 {time(detail.startedAt)} / 반납 {time(detail.returnedAt)} · 기준 {detail.policy.minimumDistanceKm ?? '—'}km · {detail.policy.formulaVersion ?? '미적용'}</p>
          {detail.warnings.map(w => <p key={w} className="rounded bg-amber-50 p-2 text-sm text-amber-900">{warning[w] ?? w}</p>)}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries(category).map(([key, name]) => <div key={key} className="rounded border p-3"><p className="text-sm text-slate-500">{name}</p><p className="font-bold">{detail.metrics.counts?.[key] ?? 0}회{key === 'speeding' && ` · ${detail.metrics.speedingPercent?.toFixed(2) ?? '0'}%`}</p>{detail.score != null && <p className="text-xs">항목 점수 {detail.metrics.components?.[key]?.toFixed(1)}</p>}</div>)}</div>
          <h3 className="font-semibold">월별 참고 현황</h3>
          <div className="flex flex-wrap gap-3">{detail.monthly.map(m => <div key={m.month} className="rounded border p-3 text-sm">{m.month} · {m.distanceKm.toFixed(1)}km · {m.score == null ? '평가 거리 부족' : `${m.score.toFixed(1)}점`}</div>)}{detail.monthly.length === 0 && <p className="text-sm text-slate-500">집계된 운행이 없습니다.</p>}</div>
          <h3 className="font-semibold">평가 이벤트·운행</h3><p className="text-xs text-slate-500">오탐 이벤트 또는 직원 운행은 관리자가 사유를 남겨 제외할 수 있습니다. 운행을 제외하면 그 안의 이벤트와 거리도 함께 제외합니다.</p>
          <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{['항목', '시각', '평가 상태', '사유', ...(canEdit ? ['조정'] : [])].map(v => <th key={v} className="p-2">{v}</th>)}</tr></thead><tbody>{[...detail.events, ...detail.trips].map(r => <tr key={r.key} className="border-t"><td className="p-2">{r.category ? category[r.category] : `운행 ${r.distanceKm?.toFixed(1)}km`}</td><td className="p-2">{time(r.start)}</td><td className="p-2">{r.excluded ? '제외' : r.boundary ? '경계 확인 필요' : '포함'}</td><td className="p-2">{r.exclusionReason || '—'}</td>{canEdit && <td className="p-2"><button className={button} disabled={busy} onClick={() => { setEditing(r); setReason(''); }}>{r.excluded ? '평가 복원' : '평가 제외'}</button></td>}</tr>)}</tbody></table></div>
          {editing && <div role="group" aria-label="평가 조정 사유" className="rounded border border-blue-200 p-3"><label className="block text-sm">{editing.excluded ? '복원' : '제외'} 사유<textarea aria-label="조정 사유" className="mt-2 block w-full rounded border p-2" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></label><div className="mt-2 flex gap-2"><button className={button} disabled={busy || !reason.trim()} onClick={saveExclusion}>사유 저장 및 재계산</button><button className={button} disabled={busy} onClick={() => setEditing(null)}>취소</button></div></div>}
          <h3 className="font-semibold">점수·평가 변경 이력</h3><ul className="space-y-1 text-sm text-slate-600">{detail.history?.map((h, i) => <li key={`${h.at}-${i}`}>{time(h.at)} · {h.type === 'exclusion' ? `${h.excluded ? '평가 제외' : '평가 복원'} · ${h.reason}` : `재계산 · ${h.beforeScore ?? '—'} → ${h.score ?? '—'}점`} · {h.actor === 'system' ? '자동 집계' : h.actor}</li>)}</ul>
          <Link className="inline-block text-sm text-blue-700 underline" to="/reservations">대여 예약으로 이동</Link>
        </section>}
      </>}
    </div>
  </Layout>;
}
