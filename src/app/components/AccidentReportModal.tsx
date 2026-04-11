import { useEffect, useState } from 'react';
import { X, AlertTriangle, Loader2, Upload } from 'lucide-react';
import { getAccidentSeverity } from '../utils/issueUtils';

const MAX_BLACKBOX_FILE_BYTES = 50 * 1024 * 1024;

export type AccidentReportField = 'description' | 'assignee' | 'blackboxFile';

export interface AccidentReportFormValues {
  accidentType: 'major' | 'medium' | 'minor';
  description: string;
  assignee: string;
  blackboxFile: File;
}

export interface AccidentReportSubmitFeedback {
  formError?: string;
  fieldErrors?: Partial<Record<AccidentReportField, string>>;
}

export interface AccidentReportAssigneeOption {
  userId: string;
  label: string;
}

interface AccidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string;
  vehicleNumber: string;
  customerName: string;
  assigneeOptions: AccidentReportAssigneeOption[];
  isAssigneeLoading?: boolean;
  assigneeLoadError?: string | null;
  onSubmit: (report: AccidentReportFormValues) => Promise<AccidentReportSubmitFeedback | null>;
}

export function AccidentReportModal({
  isOpen,
  onClose,
  reservationId,
  vehicleNumber,
  customerName,
  assigneeOptions,
  isAssigneeLoading = false,
  assigneeLoadError = null,
  onSubmit,
}: AccidentReportModalProps) {
  const [accidentType, setAccidentType] = useState<'major' | 'medium' | 'minor'>('minor');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [blackboxFile, setBlackboxFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AccidentReportField, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (assigneeOptions.length > 0 && !assigneeId.trim()) {
      setAssigneeId(assigneeOptions[0].userId);
    }
  }, [assigneeId, assigneeOptions, isOpen]);

  if (!isOpen) {
    return null;
  }

  const clearFieldError = (field: AccidentReportField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setSubmitError(null);
  };

  const handleResetAndClose = () => {
    setAccidentType('minor');
    setDescription('');
    setAssigneeId(assigneeOptions[0]?.userId ?? '');
    setBlackboxFile(null);
    setSubmitError(null);
    setFieldErrors({});
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const nextErrors: Partial<Record<AccidentReportField, string>> = {};
    if (!description.trim()) {
      nextErrors.description = '사고 설명을 입력해 주세요.';
    }
    if (assigneeOptions.length > 0 && !assigneeId.trim()) {
      nextErrors.assignee = '담당자를 선택해 주세요.';
    }
    if (!blackboxFile) {
      nextErrors.blackboxFile = '블랙박스 첨부는 필수입니다.';
    } else if (blackboxFile.size > MAX_BLACKBOX_FILE_BYTES) {
      nextErrors.blackboxFile = '블랙박스 파일은 50MB 이하만 업로드할 수 있습니다.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      setSubmitError('입력값을 확인해 주세요.');
      return;
    }

    const selectedAssignee = assigneeOptions.find((option) => option.userId === assigneeId);
    const assigneeLabel = selectedAssignee?.label ?? '';

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const feedback = await onSubmit({
        accidentType,
        description: description.trim(),
        assignee: assigneeLabel,
        blackboxFile,
      });

      if (feedback) {
        if (feedback.formError) {
          setSubmitError(feedback.formError);
        }
        if (feedback.fieldErrors) {
          setFieldErrors((prev) => ({ ...prev, ...feedback.fieldErrors }));
        }
        return;
      }

      handleResetAndClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccidentTypeLabel = (type: 'major' | 'medium' | 'minor') => {
    switch (type) {
      case 'major':
        return '대형 사고';
      case 'medium':
        return '중형 사고';
      case 'minor':
      default:
        return '경미한 사고';
    }
  };

  const getAccidentTypeDescription = (type: 'major' | 'medium' | 'minor') => {
    switch (type) {
      case 'major':
        return '인명 피해 또는 차량 대파';
      case 'medium':
        return '차량 중파, 수리 필요';
      case 'minor':
      default:
        return '경미한 접촉, 스크래치';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">사고 등록</h2>
              <p className="text-sm text-gray-600">
                예약번호: {reservationId} | 차량번호: {vehicleNumber} | 고객명: {customerName}
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              사고 유형 *
            </label>
            <div className="space-y-2">
              {(['major', 'medium', 'minor'] as const).map((type) => (
                <label
                  key={type}
                  className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    accidentType === type
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="accidentType"
                    value={type}
                    checked={accidentType === type}
                    onChange={(event) => {
                      setAccidentType(event.target.value as 'major' | 'medium' | 'minor');
                      setSubmitError(null);
                    }}
                    className="mt-1"
                    disabled={isSubmitting}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {getAccidentTypeLabel(type)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        type === 'major' ? 'bg-red-100 text-red-700' :
                        type === 'medium' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {getAccidentSeverity(type)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {getAccidentTypeDescription(type)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              사고 설명 *
            </label>
            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                clearFieldError('description');
              }}
              rows={4}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                fieldErrors.description ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="사고 경위, 피해 범위, 현장 상황 등을 상세히 기록해주세요..."
              disabled={isSubmitting}
            />
            {fieldErrors.description && <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              블랙박스 첨부 *
            </label>
            <label className="cursor-pointer block">
              <div className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 transition-colors ${
                fieldErrors.blackboxFile
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>
                <Upload className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {blackboxFile ? blackboxFile.name : '블랙박스 파일 선택'}
                </span>
              </div>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={isSubmitting}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setBlackboxFile(file);
                  clearFieldError('blackboxFile');
                }}
              />
            </label>
            {blackboxFile && (
              <p className="mt-1 text-xs text-green-600">
                선택됨: {(blackboxFile.size / (1024 * 1024)).toFixed(1)}MB
              </p>
            )}
            {fieldErrors.blackboxFile && <p className="mt-1 text-xs text-red-600">{fieldErrors.blackboxFile}</p>}
            <p className="mt-1 text-xs text-gray-500">최대 50MB, 영상 파일만 업로드할 수 있습니다.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              담당자 배정
            </label>
            {isAssigneeLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                담당자 목록을 불러오는 중입니다.
              </div>
            ) : (
            <select
              value={assigneeId}
              onChange={(event) => {
                setAssigneeId(event.target.value);
                clearFieldError('assignee');
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                fieldErrors.assignee ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              disabled={isSubmitting || assigneeOptions.length === 0}
            >
              {assigneeOptions.length === 0 ? (
                <option value="">선택 가능한 담당자가 없습니다</option>
              ) : (
                <>
                  <option value="">담당자를 선택하세요</option>
                  {assigneeOptions.map((option) => (
                    <option key={option.userId} value={option.userId}>
                      {option.label}
                    </option>
                  ))}
                </>
              )}
            </select>
            )}
            {assigneeLoadError && <p className="mt-1 text-xs text-red-600">{assigneeLoadError}</p>}
            {fieldErrors.assignee && <p className="mt-1 text-xs text-red-600">{fieldErrors.assignee}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleResetAndClose}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={isSubmitting || isAssigneeLoading || assigneeOptions.length === 0}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? '등록 중...' : '사고 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
