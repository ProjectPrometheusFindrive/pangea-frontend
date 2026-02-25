import { Sparkles, AlertTriangle } from 'lucide-react';

interface PremiumBannerProps {
  vehiclesWithoutDevice: number;
  onCTAClick: () => void;
}

export function PremiumBanner({ vehiclesWithoutDevice, onCTAClick }: PremiumBannerProps) {
  return (
    <div className="bg-orange-50 rounded-lg px-4 py-3 border border-orange-200 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
        <p className="text-sm text-gray-700">
          <span className="font-bold text-orange-600">{vehiclesWithoutDevice}대</span> 차량에 단말이 설치되지 않았습니다
        </p>
      </div>
      <button
        onClick={onCTAClick}
        className="px-4 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors shrink-0"
      >
        일괄 설치 신청
      </button>
    </div>
  );
}