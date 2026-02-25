import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { type AccidentReport, getAccidentSeverity } from '../utils/issueUtils';

interface AccidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleNumber: string;
  customerName: string;
  onSubmit: (report: Omit<AccidentReport, 'id'>) => void;
}

export function AccidentReportModal({ isOpen, onClose, vehicleNumber, customerName, onSubmit }: AccidentReportModalProps) {
  const [accidentType, setAccidentType] = useState<'major' | 'medium' | 'minor'>('minor');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('이영희');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!description.trim()) {
      alert('사고 설명을 입력해주세요.');
      return;
    }

    const severity = getAccidentSeverity(accidentType);
    const report: Omit<AccidentReport, 'id'> = {
      vehicleNumber,
      customerName,
      reportDate: new Date().toISOString().split('T')[0],
      accidentType,
      severity,
      description,
      status: '신규',
      assignee,
    };

    onSubmit(report);
    
    // 초기화
    setAccidentType('minor');
    setDescription('');
    setAssignee('이영희');
    onClose();
  };

  const getAccidentTypeLabel = (type: 'major' | 'medium' | 'minor') => {
    switch (type) {
      case 'major': return '대형 사고';
      case 'medium': return '중형 사고';
      case 'minor': return '경미한 사고';
    }
  };

  const getAccidentTypeDescription = (type: 'major' | 'medium' | 'minor') => {
    switch (type) {
      case 'major': return '인명 피해 또는 차량 대파';
      case 'medium': return '차량 중파, 수리 필요';
      case 'minor': return '경미한 접촉, 스크래치';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">사고 등록</h2>
              <p className="text-sm text-gray-600">차량번호: {vehicleNumber} | 고객명: {customerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-6">
          {/* 사고 유형 선택 */}
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
                    onChange={(e) => setAccidentType(e.target.value as 'major' | 'medium' | 'minor')}
                    className="mt-1"
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

          {/* 사고 설명 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              사고 설명 *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="사고 경위, 피해 범위, 현장 상황 등을 상세히 기록해주세요..."
            />
          </div>

          {/* 담당자 배정 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              담당자 배정
            </label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="이영희">이영희</option>
              <option value="박철수">박철수</option>
              <option value="최지우">최지우</option>
              <option value="김서연">김서연</option>
              <option value="정다은">정다은</option>
            </select>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
          >
            사고 등록
          </button>
        </div>
      </div>
    </div>
  );
}
