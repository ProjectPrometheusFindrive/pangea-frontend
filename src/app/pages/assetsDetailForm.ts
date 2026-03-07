import type { VehicleAsset } from '../types/assets';

function toTrimmedString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function normalizePatchStatusValue(status: VehicleAsset['status']): string {
  if (status === '예약') {
    return '예약중';
  }
  return status;
}

export interface AssetEditForm {
  plate: string;
  model: string;
  year: string;
  status: VehicleAsset['status'];
  memo: string;
  color: string;
  category: string;
  vehicleType: string;
}

export type AssetEditField = keyof AssetEditForm;
export type AssetEditFieldErrors = Partial<Record<AssetEditField, string>>;

export interface AssetEditFormSource {
  plate?: string;
  vehicleNumber?: string;
  model?: string;
  year?: string | number;
  status: VehicleAsset['status'];
  memo?: string;
  color?: string;
  category?: string;
  vehicleType?: string;
}

export interface AssetEditPatchAsset extends AssetEditFormSource {
  version: number;
}

export interface AssetPatchPayload {
  version: number;
  plate?: string;
  vehicleNumber?: string;
  model?: string;
  year?: number;
  status?: string;
  memo?: string;
  color?: string;
  category?: string;
  vehicleType?: string;
}

export const EMPTY_ASSET_EDIT_FORM: AssetEditForm = {
  plate: '',
  model: '',
  year: '',
  status: '가용',
  memo: '',
  color: '',
  category: '',
  vehicleType: '',
};

export function toAssetEditForm(asset: AssetEditFormSource): AssetEditForm {
  return {
    plate: toTrimmedString(asset.plate ?? asset.vehicleNumber),
    model: toTrimmedString(asset.model),
    year: toTrimmedString(asset.year),
    status: asset.status,
    memo: toTrimmedString(asset.memo),
    color: toTrimmedString(asset.color),
    category: toTrimmedString(asset.category),
    vehicleType: toTrimmedString(asset.vehicleType),
  };
}

export function isAssetEditFormDirty(asset: AssetEditFormSource, form: AssetEditForm): boolean {
  const baseline = toAssetEditForm(asset);
  return (
    baseline.plate !== form.plate.trim()
    || baseline.model !== form.model.trim()
    || baseline.year !== form.year.trim()
    || baseline.status !== form.status
    || baseline.memo !== form.memo.trim()
    || baseline.color !== form.color.trim()
    || baseline.category !== form.category.trim()
    || baseline.vehicleType !== form.vehicleType.trim()
  );
}

export function buildAssetPatchPayload({
  asset,
  form,
}: {
  asset: AssetEditPatchAsset;
  form: AssetEditForm;
}): { payload: AssetPatchPayload; fieldErrors: AssetEditFieldErrors } {
  const fieldErrors: AssetEditFieldErrors = {};
  const baseline = toAssetEditForm(asset);
  const nextPlate = form.plate.trim();
  const nextModel = form.model.trim();
  const nextYearText = form.year.trim();
  const nextMemo = form.memo.trim();
  const nextColor = form.color.trim();
  const nextCategory = form.category.trim();
  const nextVehicleType = form.vehicleType.trim();

  if (!nextPlate) {
    fieldErrors.plate = '차량번호를 입력해 주세요.';
  }

  let parsedYear: number | undefined;
  if (nextYearText.length > 0) {
    const numericYear = Number(nextYearText);
    if (!Number.isInteger(numericYear) || numericYear < 1900 || numericYear > 3000) {
      fieldErrors.year = '연식은 4자리 숫자로 입력해 주세요.';
    } else {
      parsedYear = numericYear;
    }
  } else if (baseline.year.length > 0 && baseline.year !== nextYearText) {
    fieldErrors.year = '연식을 수정하려면 유효한 숫자를 입력해 주세요.';
  }

  const payload: AssetPatchPayload = {
    version: asset.version,
  };

  if (baseline.plate !== nextPlate) {
    payload.plate = nextPlate;
    payload.vehicleNumber = nextPlate;
  }
  if (baseline.model !== nextModel) {
    payload.model = nextModel || undefined;
  }
  if (baseline.year !== nextYearText && parsedYear !== undefined) {
    payload.year = parsedYear;
  }
  if (baseline.status !== form.status) {
    payload.status = normalizePatchStatusValue(form.status);
  }
  if (baseline.memo !== nextMemo) {
    payload.memo = nextMemo;
  }
  if (baseline.color !== nextColor) {
    payload.color = nextColor || undefined;
  }
  if (baseline.category !== nextCategory) {
    payload.category = nextCategory || undefined;
  }
  if (baseline.vehicleType !== nextVehicleType) {
    payload.vehicleType = nextVehicleType || undefined;
  }

  return {
    payload,
    fieldErrors,
  };
}

export function mapAssetEditFieldErrors(
  entries: Array<{ name: string; reason: string }>,
): AssetEditFieldErrors {
  const fieldNameMap: Record<string, AssetEditField> = {
    vehicleNumber: 'plate',
    plate: 'plate',
    model: 'model',
    year: 'year',
    status: 'status',
    memo: 'memo',
    color: 'color',
    category: 'category',
    vehicleType: 'vehicleType',
  };

  const mapped: AssetEditFieldErrors = {};
  for (const entry of entries) {
    const targetField = fieldNameMap[entry.name];
    if (!targetField || mapped[targetField]) {
      continue;
    }
    mapped[targetField] = entry.reason;
  }

  return mapped;
}
