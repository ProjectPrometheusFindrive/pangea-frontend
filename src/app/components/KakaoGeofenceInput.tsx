import { useMemo } from 'react';
import { MapPin } from 'lucide-react';

export type KakaoGeofenceShape = 'circle' | 'polygon';

interface KakaoGeofenceInputErrors {
  lat?: string;
  lng?: string;
  radiusMeter?: string;
  pointsText?: string;
}

interface KakaoGeofenceInputProps {
  shape: KakaoGeofenceShape;
  lat: string;
  lng: string;
  radiusMeter: string;
  pointsText: string;
  disabled?: boolean;
  shapeLocked?: boolean;
  errors?: KakaoGeofenceInputErrors;
  onShapeChange: (shape: KakaoGeofenceShape) => void;
  onPointsTextChange: (value: string) => void;
}

function parsePreviewPoints(pointsText: string): Array<{ lat: string; lng: string }> {
  return pointsText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tokens = line.split(',').map((token) => token.trim());
      return {
        lat: tokens[0] ?? '',
        lng: tokens[1] ?? '',
      };
    });
}

export function KakaoGeofenceInput({
  shape,
  lat,
  lng,
  radiusMeter,
  pointsText,
  disabled = false,
  shapeLocked = false,
  errors,
  onShapeChange,
  onPointsTextChange,
}: KakaoGeofenceInputProps) {
  const previewPoints = useMemo(() => parsePreviewPoints(pointsText), [pointsText]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onShapeChange('circle')}
            disabled={disabled || shapeLocked}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              shape === 'circle'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            \원\형
          </button>
          <button
            type="button"
            onClick={() => onShapeChange('polygon')}
            disabled={disabled || shapeLocked}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              shape === 'polygon'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            \다\각\형
          </button>
          {shapeLocked && (
            <span className="text-xs text-blue-700">
              \기\존 \지\오\펜\스\는 \현\재 \형\태 \그\대\로 \편\집\합\니\다.
            </span>
          )}
        </div>

        <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/40">
          <div className="text-center text-blue-900">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-blue-400" />
            <p className="font-medium">
              {shape === 'polygon' ? 'Polygon vertex editor' : 'Circle center editor'}
            </p>
            <p className="mt-1 text-sm text-blue-700">
              {shape === 'polygon'
                ? 'Paste one lat,lng pair per line to define the polygon.'
                : 'Enter center coordinates and radius to define the circle.'}
            </p>
          </div>
        </div>
      </div>

      {shape === 'polygon' ? (
        <div className="rounded-xl border border-blue-100 bg-white p-4">
          <label className="mb-1 block text-sm font-medium text-blue-900">Polygon points *</label>
          <textarea
            value={pointsText}
            disabled={disabled}
            onChange={(event) => onPointsTextChange(event.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'37.566500,126.978000\n37.567100,126.979300\n37.565700,126.980200'}
            className="w-full rounded-lg border border-blue-200 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
          />
          {errors?.pointsText && <p className="mt-1 text-xs text-red-600">{errors.pointsText}</p>}

          <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            \한 \줄\에 `lat,lng` \형\식\으\로 \입\력\하\세\요. \최\소 3\개\의 \꼭\짓\점\이 \필\요\합\니\다.
          </div>

          {previewPoints.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-blue-900">
                Preview points: {previewPoints.length}
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {previewPoints.map((point, index) => (
                  <div
                    key={`${point.lat}-${point.lng}-${index}`}
                    className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800"
                  >
                    <span className="font-semibold">P{index + 1}</span>
                    {' '}
                    {point.lat || '-'}, {point.lng || '-'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-blue-100 bg-white p-4 text-sm text-blue-800">
          <p>\원\형 \지\오\펜\스\는 \아\래 \중\심 \좌\표\와 \반\경 \입\력\란\을 \사\용\합\니\다.</p>
          <p className="mt-2 text-xs text-blue-700">
            Current center: {lat || '-'}, {lng || '-'} / radius {radiusMeter || '-'}
          </p>
          {(errors?.lat || errors?.lng || errors?.radiusMeter) && (
            <p className="mt-2 text-xs text-red-600">
              {errors?.lat ?? errors?.lng ?? errors?.radiusMeter}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
