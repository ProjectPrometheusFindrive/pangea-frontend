import { AlertTriangle } from 'lucide-react';

interface PremiumBannerProps {
  vehiclesWithoutDevice: number;
}

export function PremiumBanner({ vehiclesWithoutDevice }: PremiumBannerProps) {
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
    </div>
  );
}
