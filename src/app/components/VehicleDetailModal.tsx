import { useState } from 'react';
import { X, Activity, History, Info, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import type { VehicleAsset } from '../types/assets';
import { useNavigate } from 'react-router';
import type { AssetEditForm } from '../pages/assetsDetailForm';
import { navigateToPremiumInquiry } from '../utils/premiumInquiry';

interface AssetHistoryChange {
  field: string;
  before?: unknown;
  after?: unknown;
}

interface AssetHistoryEntry {
  event: string;
  at: string;
  actor: string | null;
  versionFrom: number;
  versionTo: number;
  changes: AssetHistoryChange[];
}

interface VehicleDetailModalProps {
  asset: VehicleAsset & {
    id?: string;
    version?: number;
    updatedAt?: string;
    memo?: string;
    plate?: string;
  };
  historyEntries: AssetHistoryEntry[];
  isHistoryLoading: boolean;
  historyError: string | null;
  onHistoryRetry: () => void;
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
}

function formatDateInputValue(value: string | undefined): string {
  if (!value || value === '-') {
    return '';
  }
  const trimmed = value.trim();
  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) {
    return isoPrefix[1];
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
}

function formatHistoryValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function VehicleDetailModal({
  asset,
  historyEntries,
  isHistoryLoading,
  historyError,
  onHistoryRetry,
  onConflictRefresh,
  isOpen,
  onClose,
  saveError,
  conflictNotice,
  isSaving,
  isDeleting,
  isDirty,
  canEdit,
  handleSave,
  getStatusColor,
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
      <div className="flex max-h-[85vh] w-[700px] flex-col rounded-xl bg-white">
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
                {historyEntries.length}
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
                    <div className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">{'파일 선택'}</div>
                    <p className="mt-1 text-xs text-gray-500">{'선택된 파일 없음'}</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-600">{'보험만료일'}</label>
                    <input
                      data-testid="asset-detail-insurance-expiry-input"
                      type="date"
                      value={formatDateInputValue(asset.insuranceExpiry)}
                      readOnly
                      disabled={!canEdit || isSaving}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-600">{'자동차종합검사 결과표 업로드'}</label>
                    <div className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">{'파일 선택'}</div>
                    <p className="mt-1 text-xs text-gray-500">{'선택된 파일 없음'}</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-600">{'다음 정기점검일'}</label>
                    <input
                      data-testid="asset-detail-next-inspection-input"
                      type="date"
                      value={formatDateInputValue(asset.nextInspection)}
                      readOnly
                      disabled={!canEdit || isSaving}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-600">{'차량구매 대출 상환계획서 업로드'}</label>
                    <div className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700">{'파일 선택'}</div>
                    <p className="mt-1 text-xs text-gray-500">{'선택된 파일 없음'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {detailTab === 'history' && (
            <div className="space-y-4">
              {isHistoryLoading && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 py-6 text-sm text-blue-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {'예약 히스토리를 불러오는 중입니다.'}
                </div>
              )}

              {historyError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <p>{historyError}</p>
                  <button
                    type="button"
                    onClick={onHistoryRetry}
                    className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2"
                  >
                    {'다시 시도'}
                  </button>
                </div>
              )}

              {!isHistoryLoading && !historyError && historyEntries.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-gray-200 bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'시각'}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'이벤트'}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'버전'}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'변경 내용'}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">{'작업자'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {historyEntries.map((entry, entryIndex) => (
                          <tr key={`${entry.event}-${entry.at}-${entryIndex}`} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-700">
                              {new Date(entry.at).toLocaleString('ko-KR')}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                                {entry.event}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-700">
                              {`v${entry.versionFrom} -> v${entry.versionTo}`}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700">
                              {entry.changes.length > 0 ? (
                                <div className="space-y-1">
                                  {entry.changes.map((change, changeIndex) => (
                                    <p key={`${change.field}-${changeIndex}`}>
                                      <span className="font-semibold">{change.field}</span>
                                      {`: ${formatHistoryValue(change.before)} -> ${formatHistoryValue(change.after)}`}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <span>-</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-700">{entry.actor ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                !isHistoryLoading && !historyError && (
                  <div className="py-12 text-center text-gray-400">
                    <History className="mx-auto mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">{'이 차량의 예약 히스토리가 없습니다.'}</p>
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
                      {`마지막 업데이트: ${asset.deviceStatus ? new Date(asset.deviceStatus.lastUpdate).toLocaleString('ko-KR') : '-'}`}
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
