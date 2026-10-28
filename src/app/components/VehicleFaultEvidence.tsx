import { formatDateTimeKst } from '../utils/dateTimeFormat';

export interface FaultDetails {
  code?: string;
  name?: string;
  diagnosticType?: string;
  state?: string;
  severity?: string;
  occurredAt?: string;
  effectOnComponent?: string;
  recommendation?: string;
}

export function faultSummary(details?: FaultDetails | null): string {
  if (details?.diagnosticType === 'GoFault' && details.code === '290') {
    return '단말 공급 전압 저하로 단말 재시작 감지';
  }
  return details?.name || '차량 이상 신호 감지';
}

export function VehicleFaultEvidence({ details }: { details: FaultDetails }) {
  const severity = ({ CheckAtNextHalt: '다음 정차 시 점검', CheckImmediately: '즉시 점검', NoRepairNeeded: '수리 불필요' } as Record<string, string>)[details.severity || ''] || details.severity;
  const state = ({ Active: '활성', Pending: '확인 대기', Cleared: '해제', Inactive: '비활성', FaultStatusActiveId: '활성', FaultStatusPendingId: '확인 대기' } as Record<string, string>)[details.state || ''] || details.state;
  return (
    <section aria-label="차량 이상 진단 정보" className="mt-3 space-y-3 text-sm text-gray-800">
      <p className="font-semibold">{faultSummary(details)}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
        <dt>진단 코드</dt><dd>{details.code || '미기록'}</dd>
        <dt>진단 구분</dt><dd>{details.diagnosticType === 'GoFault' ? 'Geotab 단말 진단 (GoFault)' : details.diagnosticType || '미기록'}</dd>
        <dt>발생 시각</dt><dd>{formatDateTimeKst(details.occurredAt, '미기록')}</dd>
        <dt>발생 당시 상태</dt><dd>{state || '미기록'}</dd>
        <dt>제공사 점검 수준</dt><dd>{severity || '미기록'}</dd>
      </dl>
      {details.diagnosticType === 'GoFault' && details.code === '290' && (
        <div className="rounded-md bg-white/70 p-3 text-xs leading-6">
          <p className="font-semibold">권장 점검 요약</p>
          <ul className="list-disc pl-4">
            <li>MyGeotab Measurements에서 발생 시점의 전압 기록 확인</li>
            <li>단말 전원 차단·재연결 여부와 커넥터·배선 연결 상태 확인</li>
            <li>전원 공급 문제, 전원 차단 스위치, 단말 분리 여부 점검</li>
            <li>일반적인 전원 문제를 배제한 뒤에도 반복되면 전문 점검</li>
          </ul>
        </div>
      )}
      <div className="space-y-2 text-xs">
        <p><strong>Geotab 진단 원문</strong><br />{details.name || '미제공'}</p>
        <p className="whitespace-pre-line break-words"><strong>감지 조건·영향 원문</strong><br />{details.effectOnComponent || '미제공'}</p>
        <p className="whitespace-pre-line break-words"><strong>Geotab 권장 조치 원문</strong><br />{details.recommendation || '미제공'}</p>
      </div>
      {details.diagnosticType === 'GoFault' && <p className="text-xs">단말 진단 정보입니다. 이 신호만으로 차량 엔진 고장이나 배터리 불량을 확정할 수 없습니다.</p>}
    </section>
  );
}
