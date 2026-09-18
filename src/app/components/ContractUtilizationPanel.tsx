import { useEffect, useMemo, useState } from 'react';
import { getContractUtilization, type ContractUtilizationResponse } from '../../services/home';
import { todayDateKst } from '../utils/dateTimeFormat';

function defaultRange() {
  const today = todayDateKst();
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 29);
  return { from: date.toISOString().slice(0, 10), to: today };
}

export function ContractUtilizationPanel({ companyId, role }: { companyId?: string | null; role?: string }) {
  const defaults = useMemo(defaultRange, []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [companyInput, setCompanyInput] = useState(companyId ?? '');
  const [data, setData] = useState<ContractUtilizationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const scopedCompany = role === 'super_admin' ? companyInput.trim() : companyId;
  const rangeError = from && to && (to < from || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 >= 366)
    ? '종료일은 시작일 이후여야 하며 조회 기간은 최대 366일입니다.' : '';
  useEffect(() => {
    if (!scopedCompany || !from || !to || rangeError) { setData(null); setLoading(false); setError(false); return undefined; }
    let active = true;
    setLoading(true); setError(false); setData(null);
    getContractUtilization({ from, to, companyId: scopedCompany }).then((value) => { if (active) setData(value); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, scopedCompany, retry, rangeError]);
  const excluded = Object.entries(data?.excludedCounts ?? {}).filter(([, count]) => count > 0).map(([key, count]) => `${key}: ${count}건`).join(' · ');
  return <section data-testid="contract-utilization-panel" className="rounded-xl border border-gray-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-gray-900">계약 점유율</h2><span className="text-xs text-gray-500">KST · contract-occupancy-v1</span></div>
    {role === 'super_admin' && <label className="mt-3 block text-xs text-gray-500">회사 ID <input aria-label="회사 ID" value={companyInput} onChange={(event) => setCompanyInput(event.target.value)} placeholder="회사 ID" className="ml-1 rounded border px-2 py-1" /></label>}
    <div className="mt-3 flex flex-wrap gap-2"><label className="text-xs text-gray-500">시작일 <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="ml-1 rounded border px-1 py-0.5" /></label><label className="text-xs text-gray-500">종료일 <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="ml-1 rounded border px-1 py-0.5" /></label></div>
    <p className="mt-2 text-xs text-gray-500">산식: 차량별 대여중·완료 계약의 중복 제거 점유시간 합 ÷ (대상 차량 수 × 조회기간). 예약·취소·보관/비활성·정비 자산과 기간 누락은 제외합니다.</p>
    {!scopedCompany && <p className="mt-2 text-sm text-gray-500">회사를 선택하면 조회할 수 있습니다.</p>}
    {rangeError && <p role="alert" className="mt-2 text-sm text-red-600">{rangeError}</p>}
    {loading && <p className="mt-2 text-sm text-gray-500">계약 점유율을 불러오는 중입니다.</p>}
    {error && <div role="alert"><p className="mt-2 text-sm text-red-600">조회에 실패했습니다.</p><button type="button" className="mt-2 rounded border px-2 py-1 text-sm" onClick={() => setRetry((value) => value + 1)}>다시 시도</button></div>}
    {data && !loading && !error && <>
    <p className="mt-2 text-2xl font-bold text-blue-700">{Math.round(data.kpi.utilizationRate * 100)}%</p>
    <p className="text-xs text-gray-500">대상 차량 {data.kpi.assetCount}대 · 실제 주행률이 아닌 계약 점유율</p>
    {excluded && <p className="mt-2 text-xs text-gray-500">제외: {excluded}</p>}
    {data.rows.length === 0 && <p className="mt-3 text-sm text-gray-500">조회할 대상 차량이 없습니다.</p>}
    <div className="mt-4 grid gap-2 text-sm">{data.rows.map((row) => <div className="flex justify-between border-b border-gray-100 py-1" key={row.assetId}><span>{row.vehicleNumber || row.vin || row.assetId}{row.model ? ` · ${row.model}` : ''}</span><span>{Math.round(row.utilizationRate * 100)}%</span></div>)}</div>
    {data.limitations.map((limitation) => <p className="mt-2 text-xs text-gray-500" key={limitation}>{limitation}</p>)}
    </>}
  </section>;
}
