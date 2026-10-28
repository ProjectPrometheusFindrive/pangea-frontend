import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Activity, Loader2 } from 'lucide-react';
import { getAssetIncidents, type VehicleIncident } from '../../services/assets';
import { formatDateTimeKst } from '../utils/dateTimeFormat';
import { faultSummary } from './VehicleFaultEvidence';

const statusLabels: Record<string, string> = {
  open: '미조치', in_progress: '조치 중', completed: '완료', dismissed: '제외',
  confirmation_complete: '사고 아님 확인', accident_intake: '사고 접수',
};

export function VehicleIncidentHistory({ assetId }: { assetId: string }) {
  const [items, setItems] = useState<VehicleIncident[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getAssetIncidents(assetId, { page, signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      setItems((previous) => page === 1 ? result.items : [...previous, ...result.items]);
      setTotal(result.total);
    }).catch(() => {
      if (!controller.signal.aborted) setError('차량 이상 히스토리를 불러오지 못했습니다.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [assetId, page, retry]);

  return (
    <section aria-label="차량 이상 사건 목록" className="space-y-3">
      <p className="text-sm text-gray-600">차량 이상·도난 의심·사고 의심·단말 OFF 사건을 최근 발생 순으로 표시합니다. 완료된 사건도 유지됩니다.</p>
      {items.map((item) => (
        <article key={item.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900">{item.title}</h3>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">{statusLabels[item.status] || item.status}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">{formatDateTimeKst(item.occurredAt || item.createdAt, '발생 시각 미기록')}</p>
          <p className="mt-2 break-words text-sm text-gray-700">
            {item.type === 'vehicle_fault' ? `${item.faultDetails?.code ? `코드 ${item.faultDetails.code} · ` : ''}${faultSummary(item.faultDetails)}`
              : item.type === 'theft_suspected' ? `${item.evidenceSummary?.geofenceName || '지정 구역'} 장기 체류${item.evidenceSummary?.thresholdMinutes != null ? ` · 기준 ${item.evidenceSummary.thresholdMinutes}분` : ''}`
                : item.type === 'terminal_off' ? '단말 통신 중단 감지' : '사고 의심 신호 감지'}
          </p>
          {item.actionItemId ? (
            <Link to={`/action-required?actionItemId=${encodeURIComponent(item.actionItemId)}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:underline">이슈카드 보기</Link>
          ) : <p className="mt-3 text-xs text-gray-500">연결된 이슈카드가 없습니다.</p>}
        </article>
      ))}
      {loading && <p role="status" className="flex items-center gap-2 py-4 text-sm text-blue-700"><Loader2 className="h-4 w-4 animate-spin" />히스토리를 불러오는 중입니다.</p>}
      {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<button type="button" onClick={() => setRetry((value) => value + 1)} className="ml-3 underline">다시 시도</button></div>}
      {!loading && !error && items.length === 0 && <div className="py-8 text-center text-sm text-gray-500"><Activity className="mx-auto mb-2 h-8 w-8" />기록된 차량 이상 사건이 없습니다.</div>}
      {!loading && !error && items.length < total && <button type="button" onClick={() => setPage((value) => value + 1)} className="w-full rounded-lg border p-3 text-sm font-semibold text-blue-700">이전 사건 더 보기</button>}
    </section>
  );
}
