import React, { useState } from 'react';
import { X, Activity, History, Info, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import type { VehicleAsset } from '../types/assets';
import { useNavigate } from 'react-router';
import type { AssetEditForm } from '../pages/assetsDetailForm';
import { formatDateTimeKst } from '../utils/dateTimeFormat';
import { navigateToPremiumInquiry } from '../utils/premiumInquiry';
import { DateTextPicker } from './DateTextPicker';

interface AssetActivityEntry {
  id: string;
  timestamp: string;
  category: string;
  event: string;
  details: string;
  actorName: string | null;
  status: string | null;
  reservationId: string | null;
  customerName: string | null;
}

function formatActivityDate(isoString: string): string {
  return formatDateTimeKst(isoString, '-');
}

function getActivityStatusBadge(status: string | null): { label: string; className: string } {
  switch (status) {
    case '예약중': return { label: '예약중', className: 'bg-purple-100 text-purple-700' };
    case '대여중': return { label: '대여중', className: 'bg-blue-100 text-blue-700' };
    case '완료':
    case '결제 완료':
    case '해소': return { label: status, className: 'bg-green-100 text-green-700' };
    case '반납 지연':
    case '미납/결제 문제':
    case '접수됨': return { label: status, className: 'bg-amber-100 text-amber-700' };
    case '취소': return { label: '취소', className: 'bg-gray-100 text-gray-500' };
    default: return { label: status || '-', className: 'bg-gray-100 text-gray-600' };
  }
}

interface VehicleDetailModalProps {
  asset: VehicleAsset & {
    id?: string;
    version?: number;
    updatedAt?: string;
    memo?: string;
    plate?: string;
  };
  activityEntries: AssetActivityEntry[];
  isActivityLoading: boolean;
  activityError: string | null;
  onActivityRetry: () => void;
  onConflictRefresh: () => void;
  isOpen: boolean;
  onClose: () => boolean;
  editForm: AssetEditForm;
  fieldErrors: Partial<Record<keyof AssetEditForm, string>>;
  saveError: string | null;
  conflictNotice: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  isDirty: boolean;
  canEdit: boolean;
  onEditFieldChange: (field: keyof AssetEditForm, value: string) => void;
  handleSave: () => void;
  handleDelete: () => void;
  getStatusColor: (status: string) => string;
  detailUploadedFiles: { insurance: File | null; loanSchedule: File | null };
  onDetailInsuranceFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDetailLoanScheduleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function VehicleDetailModal({
  asset,
  activityEntries,
  isActivityLoading,
  activityError,
  onActivityRetry,
  onConflictRefresh,
  isOpen,
  onClose,
  editForm,
  fieldErrors,
  saveError,
  conflictNotice,
  isSaving,
  isDeleting,
  isDirty,
  canEdit,
  onEditFieldChange,
  handleSave,
  getStatusColor,
  detailUploadedFiles,
  onDetailInsuranceFileSelect,
  onDetailLoanScheduleFileSelect,
}: VehicleDetailModalProps) {
  const [detailTab, setDetailTab] = useState<'info' | 'history' | 'sensor'>('info');
  const navigate = useNavigate();

  if (!isOpen) {
    return null;
  }

  const closeModal = () => {
    const closed = onClose();
    if (closed) {
      setDetailTab('info');
    }
  };

  return (
    <div data-testid="asset-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[85vh] w-[1100px] max-w-[92vw] flex-col rounded-xl bg-white">
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#1e2939]">{'차량 상세 정보'}</h2>
            <button onClick={closeModal} className="rounded-lg p-2 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex gap-1 border-b border-gray-200">
            <button
              onClick={() => setDetailTab('info')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                detailTab === 'info' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Info className="h-4 w-4" />
              {'기본 정보'}
            </button>
            <button
              onClick={() => setDetailTab('history')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                detailTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <History className="h-4 w-4" />
              {'예약 히스토리'}
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">
                {activityEntries.length}
              </span>
            </button>
            <button
              onClick={() => setDetailTab('sensor')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                detailTab === 'sensor' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Activity className="h-4 w-4" />
              {'차량 이상 히스토리'}
              {asset.hasPremiumDevice && asset.deviceStatus && <Zap className="h-3 w-3 text-yellow-500" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {detailTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">{'차량번호'}</label>
                  <p className="mt-1 text-lg font-bold text-gray-900">{asset.vehicleNumber}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">{'차종'}</label>
                  <p className="mt-1 text-lg font-medium text-gray-900">{asset.model}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">{'연식'}</label>
                  <p className="mt-1 text-lg text-gray-900">{asset.year && asset.year !== '-' ? asset.year : '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">{'차대번호'}</label>
                  <p className="mt-1 font-mono text-base text-gray-900">{asset.vin}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">{'현재 상태'}</label>
                  <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(asset.status)}`}>
                    {asset.status}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">{'소유주'}</label>
                  <p className="mt-1 text-lg text-gray-900">{asset.owner}</p>
                </div>
              </div>

              {asset.issues.length > 0 && (
                <div>
                  <label className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-gray-500">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    {'차량 이슈'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {asset.issues.map((issue, idx) => (
                      <button
                        key={`${issue}-${idx}`}
                        onClick={() => {
                          const closed = onClose();
                          if (closed) {
                            navigate(`/action-required?filter=${encodeURIComponent(issue)}`);
                          }
                        }}
                        className="rounded-lg bg-red-100 px-3 py-2 font-medium text-red-700 transition-colors hover:bg-red-200"
                      >
                        {issue}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 border-t pt-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">{'보험 및 점검 정보 수정'}</h3>
                  {isDirty && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      {'저장할 변경사항이 있음'}
                    </span>
                  )}
                </div>

                {!canEdit && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    {'현재 계정은 자산 정보를 수정할 권한이 없습니다.'}
                  </div>
                )}

                {conflictNotice && (
                  <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                    <p>{conflictNotice}</p>
                    <button
                      type="button"
                      onClick={onConflictRefresh}
                      className="mt-2 text-xs font-semibold text-orange-800 underline underline-offset-2"
                    >
                      {'최신 데이터로 불러오기'}
                    </button>
                  </div>
                )}

                {saveError && (
                  <div data-testid="asset-detail-save-error" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {saveError}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-600">{'보험가입증서 업로드'}</label>
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200">{'파일 선택'}</div>
                        {detailUploadedFiles.insurance ? (
                          <span className="text-sm text-green-600">{'✓ '}{detailUploadedFiles.insurance.name}</span>
                        ) : (
                          <span className="text-sm text-gray-500">{'선택된 파일 없음'}</span>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={onDetailInsuranceFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-600">{'보험만료일'}</label>
                    <DateTextPicker
                      inputTestId="asset-detail-insurance-expiry-input"
                      ariaLabel="보험만료일"
                      value={editForm.insuranceExpiry}
                      onChange={(value) => onEditFieldChange('insuranceExpiry', value)}
                      disabled={!canEdit || isSaving}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-600">{'자동차종합검사 결과표 업로드'}</label>
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200">{'파일 선택'}</div>
                        <span className="text-sm text-gray-500">{'선택된 파일 없음'}</span>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-600">{'다음 정기점검일'}</label>
                    <DateTextPicker
                      inputTestId="asset-detail-next-inspection-input"
                      ariaLabel="다음 정기점검일"
                      value={editForm.nextInspection}
                      onChange={(value) => onEditFieldChange('nextInspection', value)}
                      disabled={!canEdit || isSaving}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-600">{'차량구매 대출 상환계획서 업로드'}</label>
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200">{'파일 선택'}</div>
                        {detailUploadedFiles.loanSchedule ? (
                          <span className="text-sm text-green-600">{'✓ '}{detailUploadedFiles.loanSchedule.name}</span>
                        ) : (
                          <span className="text-sm text-gray-500">{'선택된 파일 없음'}</span>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={onDetailLoanScheduleFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {detailTab === 'history' && (
            <div className="space-y-4">
              {isActivityLoading && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 py-6 text-sm text-blue-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {'활동 이력을 불러오는 중입니다.'}
                </div>
              )}

              {activityError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <p>{activityError}</p>
                  <button
                    type="button"
                    onClick={onActivityRetry}
                    className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2"
                  >
                    {'다시 시도'}
                  </button>
                </div>
              )}

              {!isActivityLoading && !activityError && activityEntries.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-gray-200 bg-gray-50">
                        <tr>
                          <th className="w-[150px] whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'시각'}</th>
                          <th className="w-[90px] whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'구분'}</th>
                          <th className="w-[140px] whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'이벤트'}</th>
                          <th className="min-w-[380px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'상세 내용'}</th>
                          <th className="w-[120px] whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'작업자'}</th>
                          <th className="w-[110px] whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'상태'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {activityEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                              {formatActivityDate(entry.timestamp)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                              {entry.category}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {entry.reservationId ? (
                                <button
                                  onClick={() => {
                                    navigate(`/reservations?search=${encodeURIComponent(entry.reservationId)}`);
                                  }}
                                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {entry.event}
                                </button>
                              ) : (
                                <span className="text-sm font-medium text-gray-900">{entry.event}</span>
                              )}
                            </td>
                            <td className="min-w-[380px] px-4 py-3 text-sm text-gray-700">
                              <div className="whitespace-pre-line break-words leading-6">{entry.details}</div>
                              {entry.customerName && (
                                <div className="mt-1 text-xs text-gray-500">{`고객: ${entry.customerName}`}</div>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                              {entry.actorName || '-'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${getActivityStatusBadge(entry.status).className}`}>
                                {getActivityStatusBadge(entry.status).label}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                !isActivityLoading && !activityError && (
                  <div className="py-12 text-center text-gray-400">
                    <History className="mx-auto mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">{'이 차량의 활동 이력이 없습니다.'}</p>
                  </div>
                )
              )}
            </div>
          )}

          {detailTab === 'sensor' && (
            <div className="space-y-4">
              {asset.hasPremiumDevice ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-green-600" />
                      <span className="font-bold text-green-800">{'프리미엄 단말 연동'}</span>
                    </div>
                    <p className="text-sm text-green-700">{'실시간 차량 상태 모니터링 중입니다.'}</p>
                    <p className="mt-1 text-xs text-green-600">
                      {`마지막 업데이트: ${asset.deviceStatus ? formatDateTimeKst(asset.deviceStatus.lastUpdate, '-') : '-'}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-purple-600" />
                    <h3 className="font-bold text-purple-800">{'프리미엄 단말 설치'}</h3>
                  </div>
                  <p className="mb-4 text-sm text-purple-700">
                    {'단말을 설치하면 차량 이상, 위치 이탈, 도난 의심 상태를 실시간으로 모니터링할 수 있습니다.'}
                  </p>
                  <button
                    onClick={() => {
                      navigateToPremiumInquiry(navigate, 'vehicle-detail-modal');
                    }}
                    className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-bold text-white transition-all hover:from-purple-700 hover:to-blue-700"
                  >
                    {'프리미엄으로 업그레이드'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {detailTab === 'info' ? (
          <div className="flex gap-3 border-t border-gray-200 p-6">
            <button onClick={closeModal} className="flex-1 rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200">
              {'닫기'}
            </button>
            <button
              onClick={handleSave}
              data-testid="asset-detail-save-button"
              disabled={!canEdit || isSaving || isDeleting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSaving ? '저장 중...' : canEdit ? '저장' : '수정 권한 없음'}
              </span>
            </button>
          </div>
        ) : (
          <div className="border-t border-gray-200 p-6">
            <button onClick={closeModal} className="w-full rounded-lg bg-gray-100 px-4 py-3 font-medium text-gray-700 hover:bg-gray-200">
              {'닫기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
