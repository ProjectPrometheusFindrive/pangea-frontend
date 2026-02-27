import { AlertTriangle } from 'lucide-react';

interface PremiumBannerProps {
  vehiclesWithoutDevice: number;
  onCTAClick: () => void;
  disabled?: boolean;
}

export function PremiumBanner({ vehiclesWithoutDevice, onCTAClick, disabled = false }: PremiumBannerProps) {
  return (
    <div className="bg-orange-50 rounded-lg px-4 py-3 border border-orange-200 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
        <p className="text-sm text-gray-700">
          {vehiclesWithoutDevice > 0 ? (
            <>
              <span className="font-bold text-orange-600">{vehiclesWithoutDevice}대</span> 차량에 단말이 설치되지 않았습니다
            </>
          ) : (
            '모든 차량에 단말이 설치되어 있습니다'
          )}
        </p>
      </div>
      <button
        onClick={onCTAClick}
        disabled={disabled}
        className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors shrink-0 ${
          disabled
            ? 'bg-orange-200 text-orange-500 cursor-not-allowed'
            : 'bg-orange-600 text-white hover:bg-orange-700'
        }`}
      >
        {disabled ? '신청 대상 없음' : '일괄 설치 신청'}
      </button>
    </div>
  );
}
