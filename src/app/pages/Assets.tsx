import { Layout } from '../components/Layout';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Upload,
  X,
  Loader2,
  FileText,
  Calendar as CalendarIcon,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router';
import { PageStateBoundary } from '../components/PageStateBoundary';
import { PremiumInstallationRequestSection } from '../components/PremiumInstallationRequestSection';
import { VehicleDetailModal } from '../components/VehicleDetailModal';
import {
  EMPTY_ASSET_EDIT_FORM,
  buildAssetPatchPayload,
  isAssetEditFormDirty,
  mapAssetEditFieldErrors,
  toAssetEditForm,
  type AssetEditField,
  type AssetEditForm,
} from './assetsDetailForm';
import {
  isCreateDirty as isCreateDirtyForMode,
  resolveCreateModeSwitch,
  type CreateMode,
  type UploadStep,
} from './assetCreateMode';
import {
  COMPANY_PROFILE_SETTINGS_PATH as COMPANY_PROFILE_SETTINGS_ROUTE,
  getAssetCreateReadiness,
} from './assetCreateReadiness.js';
import {
  getCollectionFromPayload,
  getPageErrorActionLabel,
  handlePageErrorAction,
  isPayloadEmpty,
  usePageEndpointState,
} from '../hooks/usePageEndpointState';
import { useAuth } from '../context/AuthContext';
import { useAuthorization } from '../context/AuthorizationContext';
import { useCompany } from '../context/CompanyContext';
import { ACTION_PERMISSIONS } from '../authorization';
import type { VehicleAsset } from '../types/assets';
import { ApiError } from '../../services/api';
import {
  createAsset,
  deleteAsset,
  getAssetDetail,
  getAssetHistory,
  getAssetsList,
  patchAsset,
} from '../../services/assets';
import {
  getOcrExtractJob,
  signAssetUpload,
  submitOcrExtractJob,
  uploadFileToSignedUrl,
  type OcrDocType,
  type OcrExtractedField,
} from '../../services/assetOcr';

interface Asset extends VehicleAsset {
  id: string;
  companyId?: string;
  hasDevice: boolean;
  version?: number;
  updatedAt?: string;
  createdAt?: string;
  plate?: string;
  memo?: string;
  category?: string;
  color?: string;
  vehicleType?: string;
  contractStatus?: string;
}

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

interface CreateFormState {
  vehicleNumber: string;
  vin: string;
  model: string;
  year: string;
  owner: string;
  insuranceExpiry: string;
}

interface UploadedFiles {
  vehicleRegistration: File | null;
  insurance: File | null;
  loanSchedule: File[];
}

interface OcrSuggestion {
  docType: OcrDocType;
  fieldName: string;
  value: string;
  confidence: number;
}

type StatusFilterCode = 'all' | 'rental' | 'reserved' | 'available' | 'maintenance';
type CreateField = keyof Pick<CreateFormState, 'vehicleNumber' | 'vin' | 'model' | 'year'>;
type FieldErrorMap<TField extends string> = Partial<Record<TField, string>>;
type UploadedFileKey = keyof UploadedFiles;

interface OcrDocConfig {
  key: UploadedFileKey;
  docType: OcrDocType;
  label: string;
  required: boolean;
  allowsMultiple?: boolean;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const ASSET_HISTORY_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const TOTAL_COUNT_KEYS = ['total', 'totalCount', 'count', 'itemsCount', 'totalElements'];
const DEFAULT_CREATE_FORM_STATE: CreateFormState = {
  vehicleNumber: '',
  vin: '',
  model: '',
  year: '',
  owner: '',
  insuranceExpiry: '',
};
const STATUS_TO_QUERY_MAP: Record<string, Exclude<StatusFilterCode, 'all'>> = {
  rental: 'rental',
  in_use: 'rental',
  대여중: 'rental',
  reserved: 'reserved',
  예약: 'reserved',
  예약됨: 'reserved',
  available: 'available',
  idle: 'available',
  가용: 'available',
  maintenance: 'maintenance',
  repair: 'maintenance',
  정비중: 'maintenance',
};
const OCR_DOC_CONFIGS: OcrDocConfig[] = [
  {
    key: 'vehicleRegistration',
    docType: 'registrationDoc',
    label: '차량등록증',
    required: true,
  },
  {
    key: 'insurance',
    docType: 'insuranceDoc',
    label: '보험가입증서',
    required: false,
  },
  {
    key: 'loanSchedule',
    docType: 'amortizationSchedule',
    label: '상환계획서',
    required: false,
    allowsMultiple: true,
  },
];
const OCR_ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/x-icon',
]);
const OCR_EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
};
const OCR_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const OCR_POLL_INTERVAL_MS = 1500;
const OCR_HIDDEN_POLL_INTERVAL_MS = 3000;
const OCR_POLL_TIMEOUT_MS = 90_000;
const INVALID_COMPANY_IDS = new Set(['0000000000', '__global__', 'company-local', 'null', 'none']);
const COMPANY_PROFILE_REQUIRED_MESSAGE = '회사 정보가 비어 있습니다. 설정 > 회사 정보에서 회사명을 먼저 저장한 뒤 다시 시도해 주세요.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toBooleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function toFileExtension(name: string): string | null {
  const normalizedName = name.trim().toLowerCase();
  const separatorIndex = normalizedName.lastIndexOf('.');
  if (separatorIndex < 0 || separatorIndex >= normalizedName.length - 1) {
    return null;
  }
  return normalizedName.slice(separatorIndex + 1);
}

function resolveOcrContentType(file: File): string | null {
  const fileContentType = file.type.trim().toLowerCase();
  if (OCR_ALLOWED_CONTENT_TYPES.has(fileContentType)) {
    return fileContentType;
  }

  const extension = toFileExtension(file.name);
  if (extension && OCR_EXTENSION_TO_CONTENT_TYPE[extension]) {
    return OCR_EXTENSION_TO_CONTENT_TYPE[extension];
  }

  return null;
}

function getFilesForOcrDoc(uploadedFiles: UploadedFiles, docConfig: OcrDocConfig): File[] {
  if (docConfig.key === 'loanSchedule') {
    return uploadedFiles.loanSchedule;
  }

  const file = uploadedFiles[docConfig.key];
  return file ? [file] : [];
}

function getOcrDocLabel(docConfig: OcrDocConfig, fileIndex: number, totalFiles: number): string {
  if (!docConfig.allowsMultiple || totalFiles <= 1) {
    return docConfig.label;
  }
  return `${docConfig.label} ${fileIndex + 1}`;
}

function toReadableFileSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)}KB`;
  }
  return `${size}B`;
}

function normalizeTenantCompanyId(value: unknown): string | null {
  const companyId = toStringValue(value);
  if (!companyId) {
    return null;
  }
  return INVALID_COMPANY_IDS.has(companyId.toLowerCase()) ? null : companyId;
}

function waitForDuration(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ApiError('ABORTED', 'Request aborted'));
      return;
    }

    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);

    const handleAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', handleAbort);
      reject(new ApiError('ABORTED', 'Request aborted'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

function toRetryAfterSeconds(error: ApiError): number | null {
  if (!isRecord(error.payload) || !isRecord(error.payload.error) || !Array.isArray(error.payload.error.details)) {
    return null;
  }

  for (const detail of error.payload.error.details) {
    if (!isRecord(detail)) {
      continue;
    }
    const retryAfter = toNumberValue(detail.retryAfterSeconds);
    if (retryAfter !== null && retryAfter > 0) {
      return retryAfter;
    }
  }

  return null;
}

function isRetryableOcrError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status !== undefined && [429, 500, 502, 503, 504].includes(error.status)) {
      return true;
    }
    return error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR';
  }

  return false;
}

function toOcrFailureMessage(error: unknown, documentLabel: string): string {
  if (error instanceof ApiError) {
    if (error.status === 415) {
      return `${documentLabel}: 파일 형식이 올바르지 않습니다. PDF/JPG/PNG/WebP 파일을 사용해 주세요.`;
    }
    if (error.status === 400) {
      return `${documentLabel}: ${error.message || 'OCR 처리에 실패했습니다. 수동 입력으로 진행해 주세요.'}`;
    }
    if (error.status === 413) {
      return `${documentLabel}: 파일 크기가 OCR 제한(25MB)을 초과했습니다.`;
    }
    if (error.status === 403) {
      return `${documentLabel}: 업로드/추출 권한이 없습니다. 회사 권한을 확인해 주세요.`;
    }
    if (error.status === 429) {
      const retryAfterSeconds = toRetryAfterSeconds(error);
      if (retryAfterSeconds !== null) {
        return `${documentLabel}: OCR 요청이 많아 제한되었습니다. ${retryAfterSeconds}초 후 다시 시도해 주세요.`;
      }
      return `${documentLabel}: OCR 요청이 많아 제한되었습니다. 잠시 후 다시 시도해 주세요.`;
    }
    if (error.status === 504 || error.code === 'TIMEOUT') {
      return `${documentLabel}: OCR 처리 시간이 초과되었습니다. 수동 입력으로 진행하거나 다시 시도해 주세요.`;
    }
    if (error.status !== undefined && error.status >= 500) {
      return `${documentLabel}: 서버 오류로 OCR 처리에 실패했습니다. 다시 시도해 주세요.`;
    }
    if (error.code === 'NETWORK_ERROR') {
      return `${documentLabel}: 네트워크 오류로 OCR 처리에 실패했습니다. 연결 상태를 확인해 주세요.`;
    }

    return `${documentLabel}: ${error.message || 'OCR 처리에 실패했습니다.'}`;
  }

  if (error instanceof Error && error.message) {
    return `${documentLabel}: ${error.message}`;
  }

  return `${documentLabel}: OCR 처리에 실패했습니다.`;
}

function normalizeDateText(value: string): string {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/);
  if (!match) {
    return normalized;
  }

  const year = match[1];
  const month = match[2].padStart(2, '0');
  const day = match[3].padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toSuggestionValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function applyOcrFieldsToCreateForm(
  previousForm: CreateFormState,
  extractedItems: Array<{ docType: OcrDocType; fields: OcrExtractedField[] }>,
): {
  nextForm: CreateFormState;
  suggestions: OcrSuggestion[];
  appliedValues: Partial<Record<keyof CreateFormState, string>>;
} {
  const nextForm: CreateFormState = {
    ...previousForm,
  };
  const appliedValues: Partial<Record<keyof CreateFormState, string>> = {};
  const suggestions: OcrSuggestion[] = [];

  const applyField = (field: keyof CreateFormState, value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }
    nextForm[field] = normalized;
    appliedValues[field] = normalized;
  };

  for (const item of extractedItems) {
    for (const field of item.fields) {
      const suggestionValue = toSuggestionValue(field.value);
      if (!suggestionValue) {
        continue;
      }

      suggestions.push({
        docType: item.docType,
        fieldName: field.name,
        value: suggestionValue,
        confidence: field.confidence,
      });

      const normalizedName = field.name.trim().toLowerCase();
      if (normalizedName === 'plate' || normalizedName === 'vehiclenumber') {
        applyField('vehicleNumber', suggestionValue.replace(/\s+/g, '').toUpperCase());
        continue;
      }
      if (normalizedName === 'vin') {
        applyField('vin', suggestionValue.toUpperCase());
        continue;
      }
      if (normalizedName === 'model') {
        applyField('model', suggestionValue);
        continue;
      }
      if (normalizedName === 'year') {
        const yearMatch = suggestionValue.match(/\d{4}/);
        if (yearMatch) {
          applyField('year', yearMatch[0]);
        }
        continue;
      }
      if (normalizedName === 'insuranceexpirydate' || normalizedName === 'insuranceexpiry') {
        applyField('insuranceExpiry', normalizeDateText(suggestionValue));
        continue;
      }
      if (normalizedName === 'rentername' || normalizedName === 'owner' || normalizedName === 'name') {
        applyField('owner', suggestionValue);
      }
    }
  }

  return {
    nextForm,
    suggestions,
    appliedValues,
  };
}

function toPositiveInteger(value: string | null, fallbackValue: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

function toStatusFilterCode(statusValue: string | null): StatusFilterCode {
  if (!statusValue) {
    return 'all';
  }

  const normalized = statusValue.trim();
  if (!normalized || normalized === 'all') {
    return 'all';
  }

  return STATUS_TO_QUERY_MAP[normalized] ?? 'all';
}

function toStatusQueryValue(statusValue: string | null): string | undefined {
  if (!statusValue) {
    return undefined;
  }

  const normalized = statusValue.trim();
  if (!normalized || normalized === 'all') {
    return undefined;
  }

  return STATUS_TO_QUERY_MAP[normalized] ?? normalized;
}

function toCanonicalKnownStatus(statusValue: string | null): Exclude<StatusFilterCode, 'all'> | null {
  if (!statusValue) {
    return null;
  }

  const normalized = statusValue.trim();
  if (!normalized || normalized === 'all') {
    return null;
  }

  return STATUS_TO_QUERY_MAP[normalized] ?? null;
}

function normalizeAssetStatus(statusValue: string | null): VehicleAsset['status'] {
  if (statusValue === '대여중' || statusValue === '예약' || statusValue === '가용' || statusValue === '정비중') {
    return statusValue;
  }

  if (statusValue === 'reserved' || statusValue === '예약됨' || statusValue === '예약중') {
    return '예약';
  }
  if (statusValue === 'rental' || statusValue === 'in_use') {
    return '대여중';
  }
  if (statusValue === 'available' || statusValue === 'idle') {
    return '가용';
  }
  if (statusValue === 'maintenance' || statusValue === 'repair') {
    return '정비중';
  }

  return '가용';
}

function normalizeAssetIssues(issueValue: unknown): string[] {
  if (!Array.isArray(issueValue)) {
    return [];
  }

  return issueValue
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }
      if (isRecord(entry)) {
        return toStringValue(entry.label) ?? toStringValue(entry.name) ?? toStringValue(entry.type) ?? '';
      }
      return '';
    })
    .filter((entry) => entry.length > 0);
}

function toAssetRecord(row: unknown, index: number): Asset | null {
  if (!isRecord(row)) {
    return null;
  }

  const vehicleNumber = toStringValue(row.vehicleNumber)
    ?? toStringValue(row.plateNumber)
    ?? toStringValue(row.plate)
    ?? toStringValue(row.number);

  if (!vehicleNumber) {
    return null;
  }

  const hasDevice = toBooleanValue(row.hasDevice) ?? toBooleanValue(row.hasPremiumDevice) ?? false;
  const plateValue = toStringValue(row.plate) ?? toStringValue(row.vehicleNumber) ?? vehicleNumber;
  const statusValue = toStringValue(row.status)
    ?? toStringValue(row.assetStatus)
    ?? toStringValue(row.contractStatus);

  return {
    id: toStringValue(row.id)
      ?? toStringValue(row.assetId)
      ?? toStringValue(row.uuid)
      ?? `A${String(index + 1).padStart(3, '0')}`,
    companyId: toStringValue(row.companyId) ?? undefined,
    vehicleNumber,
    plate: plateValue,
    model: toStringValue(row.model) ?? toStringValue(row.vehicleModel) ?? '차종 미확인',
    status: normalizeAssetStatus(statusValue),
    issues: normalizeAssetIssues(row.issues),
    insuranceExpiry: toStringValue(row.insuranceExpiry) ?? toStringValue(row.insuranceExpiryDate) ?? '-',
    nextInspection: toStringValue(row.nextInspection) ?? toStringValue(row.nextInspectionDate) ?? '-',
    vin: toStringValue(row.vin) ?? toStringValue(row.chassisNumber) ?? '-',
    year: toStringValue(row.year) ?? toStringValue(row.modelYear) ?? '-',
    owner: toStringValue(row.owner) ?? toStringValue(row.ownerName) ?? '-',
    version: toNumberValue(row.version) ?? undefined,
    createdAt: toStringValue(row.createdAt) ?? undefined,
    updatedAt: toStringValue(row.updatedAt) ?? undefined,
    memo: toStringValue(row.memo) ?? undefined,
    category: toStringValue(row.category) ?? undefined,
    color: toStringValue(row.color) ?? undefined,
    vehicleType: toStringValue(row.vehicleType) ?? undefined,
    contractStatus: toStringValue(row.contractStatus) ?? undefined,
    hasPremiumDevice: hasDevice,
    hasDevice,
  };
}

function toAssetRows(payload: unknown): Asset[] {
  const rows = getCollectionFromPayload(payload, ['assets', 'items', 'rows', 'list']);
  if (!rows) {
    return [];
  }

  if (rows.length === 0) {
    return [];
  }

  return rows
    .map((row, index) => toAssetRecord(row, index))
    .filter((row): row is Asset => row !== null);
}

function unwrapAssetDetail(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  if (isRecord(payload.asset)) {
    return payload.asset;
  }
  if (isRecord(payload.item)) {
    return payload.item;
  }
  if (isRecord(payload.detail)) {
    return payload.detail;
  }
  if (isRecord(payload.data)) {
    return unwrapAssetDetail(payload.data);
  }

  return payload;
}

function toAssetDetail(payload: unknown): Asset | null {
  const rows = getCollectionFromPayload(payload, ['assets', 'items', 'rows', 'list']);
  if (rows && rows.length > 0) {
    return toAssetRecord(rows[0], 0);
  }

  return toAssetRecord(unwrapAssetDetail(payload), 0);
}

function toAssetHistoryEntries(payload: unknown): AssetHistoryEntry[] {
  const rows = getCollectionFromPayload(payload, ['items', 'rows', 'list', 'history']);
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows
    .map((row) => {
      if (!isRecord(row)) {
        return null;
      }

      const rawChanges = Array.isArray(row.changes) ? row.changes : [];
      const changes = rawChanges
        .map((entry) => {
          if (!isRecord(entry)) {
            return null;
          }
          const field = toStringValue(entry.field);
          if (!field) {
            return null;
          }
          return {
            field,
            before: entry.before,
            after: entry.after,
          };
        })
        .filter((entry): entry is AssetHistoryChange => entry !== null);

      const event = toStringValue(row.event);
      const at = toStringValue(row.at);
      const versionFrom = toNumberValue(row.versionFrom);
      const versionTo = toNumberValue(row.versionTo);

      if (!event || !at || versionFrom === null || versionTo === null) {
        return null;
      }

      return {
        event,
        at,
        actor: toStringValue(row.actor),
        versionFrom,
        versionTo,
        changes,
      } satisfies AssetHistoryEntry;
    })
    .filter((entry): entry is AssetHistoryEntry => entry !== null);
}

function toErrorFieldEntries(error: ApiError): Array<{ name: string; reason: string }> {
  const entries: Array<{ name: string; reason: string }> = [];

  if (Array.isArray(error.fields)) {
    for (const fieldEntry of error.fields) {
      if (!isRecord(fieldEntry)) {
        continue;
      }

      const name = toStringValue(fieldEntry.name) ?? toStringValue(fieldEntry.field);
      const reason = toStringValue(fieldEntry.reason) ?? toStringValue(fieldEntry.message);
      if (!name || !reason) {
        continue;
      }
      entries.push({ name, reason });
    }
  }

  const payloadError = isRecord(error.payload) && isRecord(error.payload.error)
    ? error.payload.error
    : null;

  if (payloadError && Array.isArray(payloadError.details)) {
    for (const detailEntry of payloadError.details) {
      if (!isRecord(detailEntry)) {
        continue;
      }

      const name = toStringValue(detailEntry.name)
        ?? toStringValue(detailEntry.field)
        ?? toStringValue(detailEntry.path)
        ?? toStringValue(detailEntry.loc);
      const reason = toStringValue(detailEntry.reason)
        ?? toStringValue(detailEntry.message)
        ?? toStringValue(detailEntry.detail)
        ?? toStringValue(detailEntry.error);

      if (!name || !reason) {
        continue;
      }
      entries.push({ name, reason });
    }
  }

  return entries;
}

function mapFieldErrors<TField extends string>(
  entries: Array<{ name: string; reason: string }>,
  fieldMap: Record<string, TField>,
): FieldErrorMap<TField> {
  const mapped: FieldErrorMap<TField> = {};

  for (const { name, reason } of entries) {
    const mappedName = fieldMap[name];
    if (!mappedName) {
      continue;
    }
    if (!mapped[mappedName]) {
      mapped[mappedName] = reason;
    }
  }

  return mapped;
}

function toCreateFieldErrors(error: ApiError): FieldErrorMap<CreateField> {
  return mapFieldErrors<CreateField>(toErrorFieldEntries(error), {
    vehicleNumber: 'vehicleNumber',
    plate: 'vehicleNumber',
    vin: 'vin',
    model: 'model',
    year: 'year',
  });
}

function toAssetEditFieldErrors(error: ApiError): FieldErrorMap<AssetEditField> {
  return mapAssetEditFieldErrors(toErrorFieldEntries(error));
}

function toCreatePayload(form: CreateFormState, companyId: string | null): {
  payload: {
    vin: string;
    plate: string;
    vehicleNumber: string;
    companyId?: string;
    model?: string;
    year?: number;
  } | null;
  fieldErrors: FieldErrorMap<CreateField>;
} {
  const fieldErrors: FieldErrorMap<CreateField> = {};

  const vehicleNumber = form.vehicleNumber.trim();
  const vin = form.vin.trim();
  const model = form.model.trim();
  const yearText = form.year.trim();

  if (!vehicleNumber) {
    fieldErrors.vehicleNumber = '차량번호를 입력해 주세요.';
  }
  if (!vin) {
    fieldErrors.vin = '차대번호를 입력해 주세요.';
  }

  let year: number | undefined;
  if (yearText.length > 0) {
    const parsedYear = Number(yearText);
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 3000) {
      fieldErrors.year = '연식은 4자리 숫자로 입력해 주세요.';
    } else {
      year = parsedYear;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { payload: null, fieldErrors };
  }

  return {
    payload: {
      vin,
      plate: vehicleNumber,
      vehicleNumber,
      companyId: companyId ?? undefined,
      model: model || undefined,
      year,
    },
    fieldErrors,
  };
}

function getTotalCountFromObject(source: unknown): number | null {
  if (!isRecord(source)) {
    return null;
  }

  for (const key of TOTAL_COUNT_KEYS) {
    const count = toNumberValue(source[key]);
    if (count !== null) {
      return count;
    }
  }

  if (isRecord(source.meta)) {
    const nestedCount = getTotalCountFromObject(source.meta);
    if (nestedCount !== null) {
      return nestedCount;
    }
  }

  if (isRecord(source.page)) {
    const nestedCount = getTotalCountFromObject(source.page);
    if (nestedCount !== null) {
      return nestedCount;
    }
  }

  if (isRecord(source.pagination)) {
    const nestedCount = getTotalCountFromObject(source.pagination);
    if (nestedCount !== null) {
      return nestedCount;
    }
  }

  return null;
}

function cleanupAssetsQueryParams(params: URLSearchParams): void {
  if (params.get('page') === String(DEFAULT_PAGE)) {
    params.delete('page');
  }

  if (params.get('size') === String(DEFAULT_PAGE_SIZE)) {
    params.delete('size');
  }

  if (params.get('status') === 'all') {
    params.delete('status');
  }

  const query = params.get('q');
  if (!query || query.trim().length === 0) {
    params.delete('q');
  }
}

export default function Assets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canPerformAction } = useAuthorization();
  const { company } = useCompany();
  const canWriteAssets = canPerformAction(ACTION_PERMISSIONS.assetsWrite);

  const page = toPositiveInteger(searchParams.get('page'), DEFAULT_PAGE);
  const pageSize = toPositiveInteger(searchParams.get('size'), DEFAULT_PAGE_SIZE);
  const statusParam = searchParams.get('status');
  const statusFilterCode = toStatusFilterCode(statusParam);
  const statusQueryValue = toStatusQueryValue(statusParam);
  const vehicleQuery = (searchParams.get('vehicle') ?? '').trim();
  const queryKeyword = searchParams.get('q') ?? searchParams.get('search') ?? '';
  const keyword = (queryKeyword || vehicleQuery).trim();
  const selectedAssetId = (searchParams.get('assetId') ?? '').trim();

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>('ocr');
  const [uploadStep, setUploadStep] = useState<UploadStep>('upload');
  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE_FORM_STATE);
  const [createFieldErrors, setCreateFieldErrors] = useState<FieldErrorMap<CreateField>>({});
  const [createSaveError, setCreateSaveError] = useState<string | null>(null);
  const [isCreateSaving, setIsCreateSaving] = useState(false);
  const [ocrProgressMessage, setOcrProgressMessage] = useState<string | null>(null);
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [ocrSuggestions, setOcrSuggestions] = useState<OcrSuggestion[]>([]);
  const [ocrCanRetry, setOcrCanRetry] = useState(false);
  const [ocrAppliedValues, setOcrAppliedValues] = useState<Partial<Record<keyof CreateFormState, string>>>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({
    vehicleRegistration: null,
    insurance: null,
    loanSchedule: [],
  });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [assetsErrorStatus, setAssetsErrorStatus] = useState<number | null>(null);
  const [detailNotice, setDetailNotice] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailForm, setDetailForm] = useState<AssetEditForm>(EMPTY_ASSET_EDIT_FORM);
  const [detailFieldErrors, setDetailFieldErrors] = useState<FieldErrorMap<AssetEditField>>({});
  const [detailSaveError, setDetailSaveError] = useState<string | null>(null);
  const [detailConflictNotice, setDetailConflictNotice] = useState<string | null>(null);
  const [isDetailSaving, setIsDetailSaving] = useState(false);
  const [isDetailDeleting, setIsDetailDeleting] = useState(false);
  const [assetHistory, setAssetHistory] = useState<AssetHistoryEntry[]>([]);
  const [isAssetHistoryLoading, setIsAssetHistoryLoading] = useState(false);
  const [assetHistoryError, setAssetHistoryError] = useState<string | null>(null);
  const detailRequestSequenceRef = useRef(0);
  const detailAbortControllerRef = useRef<AbortController | null>(null);
  const historyRequestSequenceRef = useRef(0);
  const historyAbortControllerRef = useRef<AbortController | null>(null);
  const ocrRequestSequenceRef = useRef(0);
  const ocrAbortControllerRef = useRef<AbortController | null>(null);

  const updateAssetsSearchParams = useCallback((
    mutator: (params: URLSearchParams) => void,
    replace = false,
  ) => {
    const nextParams = new URLSearchParams(searchParams);
    mutator(nextParams);
    cleanupAssetsQueryParams(nextParams);
    setSearchParams(nextParams, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const legacySearch = searchParams.get('search');
    const canonicalQuery = searchParams.get('q');
    if (!legacySearch || canonicalQuery) {
      return;
    }

    updateAssetsSearchParams((params) => {
      params.set('q', legacySearch);
      params.delete('search');
    }, true);
  }, [searchParams, updateAssetsSearchParams]);

  useEffect(() => {
    const canonicalStatus = toCanonicalKnownStatus(statusParam);
    if (!statusParam || !canonicalStatus || statusParam === canonicalStatus) {
      return;
    }

    updateAssetsSearchParams((params) => {
      params.set('status', canonicalStatus);
    }, true);
  }, [statusParam, updateAssetsSearchParams]);

  const requestAssets = useCallback(async (signal: AbortSignal) => {
    try {
      return await getAssetsList({
        page,
        size: pageSize,
        status: statusQueryValue,
        q: keyword || undefined,
        signal,
      });
    } catch (error) {
      setAssetsErrorStatus(error instanceof ApiError ? error.status ?? null : null);
      throw error;
    }
  }, [keyword, page, pageSize, statusQueryValue]);

  const handleAssetsSuccess = useCallback((payload: unknown) => {
    setAssets(toAssetRows(payload));
    setTotalCount(getTotalCountFromObject(payload));
    setAssetsErrorStatus(null);
  }, []);

  const isAssetsPayloadEmpty = useCallback((payload: unknown) => {
    const rows = getCollectionFromPayload(payload, ['assets', 'items', 'rows', 'list']);
    if (rows) {
      return rows.length === 0;
    }
    return isPayloadEmpty(payload, ['assets', 'items', 'rows', 'list']);
  }, []);

  const {
    isLoading: isAssetsLoading,
    error: assetsError,
    errorKind: assetsErrorKind,
    isEmpty: isAssetsApiEmpty,
    run: hydrateAssets,
  } = usePageEndpointState<unknown>({
    request: requestAssets,
    onSuccess: handleAssetsSuccess,
    isEmpty: isAssetsPayloadEmpty,
  });

  useEffect(() => {
    void hydrateAssets();
  }, [hydrateAssets]);

  const handleAssetsRetry = useCallback(() => {
    void hydrateAssets();
  }, [hydrateAssets]);

  const abortOcrProcessing = useCallback(() => {
    ocrRequestSequenceRef.current += 1;
    ocrAbortControllerRef.current?.abort();
    ocrAbortControllerRef.current = null;
  }, []);

  const resetOcrFeedback = useCallback(() => {
    setOcrProgressMessage(null);
    setOcrWarnings([]);
    setOcrSuggestions([]);
    setOcrCanRetry(false);
    setOcrAppliedValues({});
  }, []);

  const resetCreateModalState = useCallback(() => {
    abortOcrProcessing();
    setCreateMode('ocr');
    setUploadStep('upload');
    setCreateForm(DEFAULT_CREATE_FORM_STATE);
    setCreateFieldErrors({});
    setCreateSaveError(null);
    setIsCreateSaving(false);
    resetOcrFeedback();
    setUploadedFiles({
      vehicleRegistration: null,
      insurance: null,
      loanSchedule: [],
    });
  }, [abortOcrProcessing, resetOcrFeedback]);

  useEffect(() => () => {
    detailAbortControllerRef.current?.abort();
    historyAbortControllerRef.current?.abort();
    abortOcrProcessing();
  }, [abortOcrProcessing]);

  const isCreateDirty = useMemo(() => isCreateDirtyForMode({
    createMode,
    uploadStep,
    createForm,
    uploadedFiles,
  }), [createForm, createMode, uploadStep, uploadedFiles]);

  const isDetailDirty = useMemo(() => {
    if (!selectedAsset) {
      return false;
    }
    return isAssetEditFormDirty(selectedAsset, detailForm);
  }, [detailForm, selectedAsset]);

  useEffect(() => {
    const hasUnsavedChanges = (
      (showModal && isCreateDirty && !isCreateSaving)
      || (showDetailModal && isDetailDirty && !isDetailSaving)
    );
    if (!hasUnsavedChanges || typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isCreateDirty, isCreateSaving, isDetailDirty, isDetailSaving, showDetailModal, showModal]);

  const openCreateModal = useCallback(() => {
    if (!canWriteAssets) {
      toast.error('차량 자산 등록 권한이 없습니다.');
      return;
    }
    resetCreateModalState();
    setShowModal(true);
  }, [canWriteAssets, resetCreateModalState]);

  const closeCreateModal = useCallback((): boolean => {
    if (isCreateSaving) {
      return false;
    }
    if (showModal && isCreateDirty && typeof window !== 'undefined') {
      const shouldDiscard = window.confirm('저장하지 않은 등록 정보가 있습니다. 닫으시겠습니까?');
      if (!shouldDiscard) {
        return false;
      }
    }

    setShowModal(false);
    resetCreateModalState();
    return true;
  }, [isCreateDirty, isCreateSaving, resetCreateModalState, showModal]);

  const closeDetailModalState = useCallback(() => {
    detailAbortControllerRef.current?.abort();
    historyAbortControllerRef.current?.abort();
    setShowDetailModal(false);
    setSelectedAsset(null);
    setIsDetailLoading(false);
    setDetailNotice(null);
    setIsDetailSaving(false);
    setIsDetailDeleting(false);
    setDetailForm(EMPTY_ASSET_EDIT_FORM);
    setDetailFieldErrors({});
    setDetailSaveError(null);
    setDetailConflictNotice(null);
    setAssetHistory([]);
    setAssetHistoryError(null);
    setIsAssetHistoryLoading(false);
    updateAssetsSearchParams((params) => {
      params.delete('assetId');
      params.delete('vehicle');
    }, true);
  }, [updateAssetsSearchParams]);

  const resetAssetFilters = useCallback(() => {
    updateAssetsSearchParams((params) => {
      params.delete('q');
      params.delete('search');
      params.delete('status');
      params.delete('assetId');
      params.delete('vehicle');
      params.set('page', String(DEFAULT_PAGE));
      params.set('size', String(DEFAULT_PAGE_SIZE));
    });
  }, [updateAssetsSearchParams]);

  const handleAssetsErrorAction = useCallback(() => {
    if (assetsErrorStatus === 400) {
      if (typeof window !== 'undefined') {
        window.alert('잘못된 필터 값이 감지되어 필터를 초기화합니다.');
      }
      resetAssetFilters();
      return;
    }
    handlePageErrorAction(assetsErrorKind, navigate);
  }, [assetsErrorKind, assetsErrorStatus, navigate, resetAssetFilters]);

  useEffect(() => {
    if (!vehicleQuery || isAssetsLoading || assets.length === 0) {
      return;
    }

    const targetAsset = assets.find((asset) => asset.vehicleNumber === vehicleQuery);
    if (!targetAsset) {
      return;
    }

    if (selectedAssetId === targetAsset.id && !searchParams.get('vehicle')) {
      return;
    }

    updateAssetsSearchParams((params) => {
      params.set('assetId', targetAsset.id);
      params.set('q', vehicleQuery);
      params.delete('search');
      params.delete('vehicle');
      params.set('page', '1');
    }, true);
  }, [
    assets,
    isAssetsLoading,
    searchParams,
    selectedAssetId,
    updateAssetsSearchParams,
    vehicleQuery,
  ]);

  const hydrateAssetHistory = useCallback(async (assetId: string) => {
    const requestSequence = historyRequestSequenceRef.current + 1;
    historyRequestSequenceRef.current = requestSequence;
    historyAbortControllerRef.current?.abort();
    const controller = new AbortController();
    historyAbortControllerRef.current = controller;

    setIsAssetHistoryLoading(true);
    setAssetHistoryError(null);

    try {
      const payload = await getAssetHistory(assetId, {
        page: 1,
        pageSize: ASSET_HISTORY_PAGE_SIZE,
        signal: controller.signal,
      });
      if (controller.signal.aborted || historyRequestSequenceRef.current !== requestSequence) {
        return;
      }
      setAssetHistory(toAssetHistoryEntries(payload));
    } catch (error) {
      if (controller.signal.aborted || historyRequestSequenceRef.current !== requestSequence) {
        return;
      }
      const historyErrorMessage = error instanceof ApiError
        ? error.message
        : '변경 이력을 불러오지 못했습니다.';
      setAssetHistoryError(`이력 조회 실패: ${historyErrorMessage}`);
      setAssetHistory([]);
    } finally {
      if (!controller.signal.aborted && historyRequestSequenceRef.current === requestSequence) {
        setIsAssetHistoryLoading(false);
      }
    }
  }, []);

  const hydrateAssetDetail = useCallback(async (
    assetId: string,
    options: { preserveForm?: boolean; preserveConflictNotice?: boolean } = {},
  ) => {
    const requestSequence = detailRequestSequenceRef.current + 1;
    detailRequestSequenceRef.current = requestSequence;
    detailAbortControllerRef.current?.abort();
    const controller = new AbortController();
    detailAbortControllerRef.current = controller;

    setIsDetailLoading(true);
    setDetailNotice(null);

    try {
      const payload = await getAssetDetail(assetId, { signal: controller.signal });
      if (controller.signal.aborted || detailRequestSequenceRef.current !== requestSequence) {
        return;
      }

      const nextAsset = toAssetDetail(payload);
      if (!nextAsset) {
        setSelectedAsset(null);
        setShowDetailModal(false);
        setDetailNotice('자산 상세 정보를 확인할 수 없습니다. 목록에서 다시 선택해 주세요.');
        return;
      }

      setSelectedAsset(nextAsset);
      if (!options.preserveForm) {
        setDetailForm(toAssetEditForm(nextAsset));
        setDetailFieldErrors({});
        setDetailSaveError(null);
      }
      if (!options.preserveConflictNotice) {
        setDetailConflictNotice(null);
      }

      setShowDetailModal(true);
      void hydrateAssetHistory(nextAsset.id);
    } catch (error) {
      if (controller.signal.aborted || detailRequestSequenceRef.current !== requestSequence) {
        return;
      }

      if (error instanceof ApiError && error.status === 404) {
        setSelectedAsset(null);
        setShowDetailModal(false);
        setDetailNotice('요청한 자산이 존재하지 않습니다. 목록에서 다시 선택해 주세요.');
        updateAssetsSearchParams((params) => {
          params.delete('assetId');
          params.delete('vehicle');
        }, true);
        return;
      }

      const detailErrorMessage = error instanceof ApiError
        ? error.message
        : '상세 정보를 불러오지 못했습니다.';
      setDetailNotice(`상세 조회 실패: ${detailErrorMessage}`);
      setShowDetailModal(false);
    } finally {
      if (!controller.signal.aborted && detailRequestSequenceRef.current === requestSequence) {
        setIsDetailLoading(false);
      }
    }
  }, [hydrateAssetHistory, updateAssetsSearchParams]);

  useEffect(() => {
    if (!selectedAssetId) {
      return;
    }

    void hydrateAssetDetail(selectedAssetId);
  }, [hydrateAssetDetail, selectedAssetId]);

  const handleHistoryRetry = useCallback(() => {
    if (!selectedAsset) {
      return;
    }
    void hydrateAssetHistory(selectedAsset.id);
  }, [hydrateAssetHistory, selectedAsset]);

  const handleConflictRefresh = useCallback(() => {
    if (!selectedAsset) {
      return;
    }
    void hydrateAssetDetail(selectedAsset.id, { preserveForm: true });
    void hydrateAssets();
  }, [hydrateAssetDetail, hydrateAssets, selectedAsset]);

  const handleKeywordChange = useCallback((nextKeyword: string) => {
    updateAssetsSearchParams((params) => {
      if (nextKeyword.trim().length > 0) {
        params.set('q', nextKeyword);
      } else {
        params.delete('q');
      }
      params.delete('search');
      params.delete('assetId');
      params.delete('vehicle');
      params.set('page', '1');
    });
  }, [updateAssetsSearchParams]);

  const handleStatusChange = useCallback((nextStatus: StatusFilterCode) => {
    updateAssetsSearchParams((params) => {
      if (nextStatus === 'all') {
        params.delete('status');
      } else {
        params.set('status', nextStatus);
      }
      params.delete('assetId');
      params.delete('vehicle');
      params.set('page', '1');
    });
  }, [updateAssetsSearchParams]);

  const handlePageChange = useCallback((nextPage: number) => {
    const safeNextPage = Math.max(1, nextPage);
    updateAssetsSearchParams((params) => {
      params.set('page', String(safeNextPage));
      params.delete('assetId');
      params.delete('vehicle');
    });
  }, [updateAssetsSearchParams]);

  const handlePageSizeChange = useCallback((nextPageSize: number) => {
    updateAssetsSearchParams((params) => {
      params.set('size', String(nextPageSize));
      params.set('page', '1');
      params.delete('assetId');
      params.delete('vehicle');
    });
  }, [updateAssetsSearchParams]);

  const handleDetailModalOpen = useCallback((asset: Asset) => {
    if (showDetailModal && isDetailDirty && typeof window !== 'undefined') {
      const shouldDiscard = window.confirm('저장하지 않은 수정 내용이 있습니다. 다른 자산을 여시겠습니까?');
      if (!shouldDiscard) {
        return;
      }
    }

    updateAssetsSearchParams((params) => {
      params.set('assetId', asset.id);
      params.delete('vehicle');
    });
  }, [isDetailDirty, showDetailModal, updateAssetsSearchParams]);

  const handleDetailModalClose = useCallback((): boolean => {
    if (isDetailSaving) {
      return false;
    }
    if (showDetailModal && isDetailDirty && typeof window !== 'undefined') {
      const shouldDiscard = window.confirm('저장하지 않은 수정 내용이 있습니다. 닫으시겠습니까?');
      if (!shouldDiscard) {
        return false;
      }
    }

    closeDetailModalState();
    return true;
  }, [closeDetailModalState, isDetailDirty, isDetailSaving, showDetailModal]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case '가용':
        return 'bg-green-100 text-green-700';
      case '대여중':
        return 'bg-blue-100 text-blue-700';
      case '예약':
      case '예약됨':
      case '예약중':
        return 'bg-purple-100 text-purple-700';
      case '정비중':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const statusCountMap = useMemo(() => ({
    rental: assets.filter((asset) => asset.status === '대여중').length,
    reserved: assets.filter((asset) => asset.status === '예약').length,
    available: assets.filter((asset) => asset.status === '가용').length,
    maintenance: assets.filter((asset) => asset.status === '정비중').length,
  }), [assets]);

  const totalPages = useMemo(() => {
    if (totalCount === null) {
      return null;
    }
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [pageSize, totalCount]);
  const hasPrevPage = page > 1;
  const hasNextPage = totalPages !== null
    ? page < totalPages
    : assets.length >= pageSize && !isAssetsApiEmpty;
  const isOutOfRangePage = totalPages !== null && page > totalPages;
  const isOutOfRangeError = assetsErrorStatus === 400 && page > 1 && assets.length === 0;
  const shouldShowOutOfRangeEmpty = isOutOfRangePage || isOutOfRangeError;

  const isAssetsEmpty = (
    !isAssetsLoading
    && !assetsError
    && (isAssetsApiEmpty || assets.length === 0)
  ) || isOutOfRangeError;
  const premiumInstallableAssets = useMemo(() => (
    assets
      .filter((asset) => !asset.hasDevice)
      .map((asset) => ({
        id: asset.id,
        companyId: asset.companyId,
        vehicleNumber: asset.vehicleNumber,
        model: asset.model,
        vin: asset.vin,
        owner: asset.owner,
      }))
  ), [assets]);

  const handleCreateFieldChange = useCallback((field: keyof CreateFormState, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    setCreateSaveError(null);
    if (field in createFieldErrors) {
      setCreateFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field as CreateField];
        return next;
      });
    }
  }, [createFieldErrors]);

  const handleDetailFieldChange = useCallback((field: AssetEditField, value: string) => {
    if (field === 'status') {
      setDetailForm((prev) => ({ ...prev, status: value as VehicleAsset['status'] }));
    } else {
      setDetailForm((prev) => ({ ...prev, [field]: value }));
    }
    setDetailSaveError(null);
    setDetailConflictNotice(null);
    if (field in detailFieldErrors) {
      setDetailFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [detailFieldErrors]);

  const pollOcrJobUntilTerminal = useCallback(async (
    jobId: string,
    docLabel: string,
    controller: AbortController,
    requestSequence: number,
  ) => {
    const startedAt = Date.now();
    let pollCount = 0;

    while (Date.now() - startedAt < OCR_POLL_TIMEOUT_MS) {
      if (controller.signal.aborted || requestSequence !== ocrRequestSequenceRef.current) {
        throw new ApiError('ABORTED', 'Request aborted');
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        setOcrProgressMessage(`${docLabel} OCR 진행 상태를 백그라운드에서 확인 중입니다.`);
        await waitForDuration(OCR_HIDDEN_POLL_INTERVAL_MS, controller.signal);
        continue;
      }

      const jobPayload = await getOcrExtractJob(jobId, { signal: controller.signal });
      if (controller.signal.aborted || requestSequence !== ocrRequestSequenceRef.current) {
        throw new ApiError('ABORTED', 'Request aborted');
      }

      if (jobPayload.status === 'queued' || jobPayload.status === 'running') {
        pollCount += 1;
        setOcrProgressMessage(`${docLabel} OCR 분석 중... (${pollCount})`);
        await waitForDuration(OCR_POLL_INTERVAL_MS, controller.signal);
        continue;
      }

      return jobPayload;
    }

    throw new ApiError('TIMEOUT', `${docLabel} OCR 처리 시간이 초과되었습니다.`, {
      status: 504,
    });
  }, []);

  const handleDocumentFileSelect = useCallback((fileKey: UploadedFileKey, selectedFiles: File | File[] | null) => {
    const nextFiles = Array.isArray(selectedFiles)
      ? selectedFiles
      : selectedFiles
        ? [selectedFiles]
        : [];

    if (nextFiles.length === 0) {
      return;
    }

    const matchedDocConfig = OCR_DOC_CONFIGS.find((item) => item.key === fileKey);
    if (!matchedDocConfig) {
      return;
    }

    for (const [index, file] of nextFiles.entries()) {
      const docLabel = getOcrDocLabel(matchedDocConfig, index, nextFiles.length);
      const contentType = resolveOcrContentType(file);

      if (!contentType) {
        setCreateSaveError(`${docLabel}: Unsupported file type. Use PDF/JPG/PNG/WebP files.`);
        return;
      }

      if (file.size > OCR_MAX_FILE_SIZE_BYTES) {
        setCreateSaveError(
          `${docLabel}: File is too large. Current ${toReadableFileSize(file.size)} / max ${toReadableFileSize(OCR_MAX_FILE_SIZE_BYTES)}.`,
        );
        return;
      }
    }

    abortOcrProcessing();
    setUploadStep('upload');
    setCreateSaveError(null);
    setCreateFieldErrors({});
    setOcrProgressMessage(null);
    setOcrWarnings([]);
    setOcrSuggestions([]);
    setOcrCanRetry(false);
    setCreateForm((previous) => {
      const nextForm = { ...previous };
      for (const [fieldName, appliedValue] of Object.entries(ocrAppliedValues)) {
        const key = fieldName as keyof CreateFormState;
        if (nextForm[key].trim() === appliedValue) {
          nextForm[key] = '';
        }
      }
      return nextForm;
    });
    setOcrAppliedValues({});

    setUploadedFiles((previous) => {
      if (fileKey === 'loanSchedule') {
        return {
          ...previous,
          loanSchedule: [...previous.loanSchedule, ...nextFiles],
        };
      }

      if (fileKey === 'vehicleRegistration') {
        return {
          ...previous,
          vehicleRegistration: nextFiles[0] ?? null,
        };
      }

      return {
        ...previous,
        insurance: nextFiles[0] ?? null,
      };
    });
  }, [abortOcrProcessing, ocrAppliedValues]);

  const handleStartOcrExtraction = useCallback(async () => {
    if (!canWriteAssets) {
      setCreateSaveError('차량 자산 등록 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }

    if (isCreateSaving || uploadStep === 'processing') {
      return;
    }

    const registrationFile = uploadedFiles.vehicleRegistration;
    if (!registrationFile) {
      setCreateSaveError('차량등록증 파일은 필수입니다.');
      return;
    }

    const companyId = normalizeTenantCompanyId(user?.companyId);
    if (!companyId) {
      setCreateSaveError('회사 정보가 없어 OCR 업로드를 시작할 수 없습니다. 다시 로그인 후 시도해 주세요.');
      return;
    }

    const requestSequence = ocrRequestSequenceRef.current + 1;
    ocrRequestSequenceRef.current = requestSequence;
    ocrAbortControllerRef.current?.abort();
    const controller = new AbortController();
    ocrAbortControllerRef.current = controller;

    const baseCreateForm = { ...createForm };
    for (const [fieldName, appliedValue] of Object.entries(ocrAppliedValues)) {
      const key = fieldName as keyof CreateFormState;
      if (baseCreateForm[key].trim() === appliedValue) {
        baseCreateForm[key] = '';
      }
    }

    setCreateForm(baseCreateForm);
    setOcrAppliedValues({});
    setUploadStep('processing');
    setCreateSaveError(null);
    setCreateFieldErrors({});
    setOcrProgressMessage('OCR 요청을 준비하고 있습니다...');
    setOcrWarnings([]);
    setOcrSuggestions([]);
    setOcrCanRetry(false);

    const warnings: string[] = [];
    const extractedItems: Array<{ docType: OcrDocType; fields: OcrExtractedField[] }> = [];
    let shouldEnableRetry = false;
    let requiredDocumentFailureMessage: string | null = null;

    try {
      for (const docConfig of OCR_DOC_CONFIGS) {
        const files = getFilesForOcrDoc(uploadedFiles, docConfig);
        if (files.length === 0) {
          continue;
        }

        for (const [fileIndex, file] of files.entries()) {
          const docLabel = getOcrDocLabel(docConfig, fileIndex, files.length);

          try {
            const resolvedContentType = resolveOcrContentType(file);
            if (!resolvedContentType) {
              throw new ApiError('UNSUPPORTED_MEDIA_TYPE', 'Unsupported file type.', {
                status: 415,
              });
            }

            if (file.size > OCR_MAX_FILE_SIZE_BYTES) {
              throw new ApiError('PAYLOAD_TOO_LARGE', 'OCR file size limit exceeded.', {
                status: 413,
              });
            }

            setOcrProgressMessage(`${docLabel} upload URL requested...`);
            const signedUpload = await signAssetUpload({
              fileName: file.name,
              contentType: resolvedContentType,
              fileSize: file.size,
              folder: `company/${companyId}/docs`,
            }, { signal: controller.signal });
            if (controller.signal.aborted || requestSequence !== ocrRequestSequenceRef.current) {
              return;
            }

            const uploadContentType = signedUpload.contentType?.trim() || resolvedContentType;
            setOcrProgressMessage(`${docLabel} uploading...`);
            await uploadFileToSignedUrl(
              signedUpload.uploadUrl,
              file,
              uploadContentType,
              { signal: controller.signal },
            );
            if (controller.signal.aborted || requestSequence !== ocrRequestSequenceRef.current) {
              return;
            }

            setOcrProgressMessage(`${docLabel} OCR job requested...`);
            let jobPayload = await submitOcrExtractJob({
              docType: docConfig.docType,
              objectName: signedUpload.objectName,
              sourceName: file.name,
              contentType: uploadContentType,
            }, { signal: controller.signal });
            if (controller.signal.aborted || requestSequence !== ocrRequestSequenceRef.current) {
              return;
            }

            if (jobPayload.status === "queued" || jobPayload.status === "running") {
              jobPayload = await pollOcrJobUntilTerminal(
                jobPayload.jobId,
                docLabel,
                controller,
                requestSequence,
              );
            }

            if (jobPayload.status === "failed") {
              const errorType = jobPayload.error?.type ?? 'SERVER_ERROR';
              const errorMessage = jobPayload.error?.message ?? 'OCR job failed.';
              throw new ApiError(errorType, errorMessage, {
                status: jobPayload.error?.httpStatus,
                payload: jobPayload,
              });
            }

            extractedItems.push({
              docType: docConfig.docType,
              fields: Array.isArray(jobPayload.extractedFields) ? jobPayload.extractedFields : [],
            });
            if (Array.isArray(jobPayload.warnings)) {
              for (const warning of jobPayload.warnings) {
                warnings.push(`[${docLabel}] ${warning.message}`);
              }
            }
          } catch (error) {
            if (controller.signal.aborted || requestSequence !== ocrRequestSequenceRef.current) {
              return;
            }

            const failureMessage = toOcrFailureMessage(error, docLabel);
            warnings.push(failureMessage);
            shouldEnableRetry = shouldEnableRetry || isRetryableOcrError(error);
            if (docConfig.required) {
              requiredDocumentFailureMessage = failureMessage;
              break;
            }
          }
        }

        if (requiredDocumentFailureMessage) {
          break;
        }
      }
    } finally {
      if (ocrAbortControllerRef.current === controller) {
        ocrAbortControllerRef.current = null;
      }
    }

    if (requestSequence !== ocrRequestSequenceRef.current) {
      return;
    }

    const {
      nextForm,
      suggestions,
      appliedValues,
    } = applyOcrFieldsToCreateForm(baseCreateForm, extractedItems);

    setCreateForm(nextForm);
    setOcrAppliedValues(appliedValues);
    setOcrSuggestions(suggestions);
    setOcrWarnings(warnings);
    setOcrCanRetry(shouldEnableRetry);
    setOcrProgressMessage(null);
    setUploadStep('preview');

    if (requiredDocumentFailureMessage) {
      setCreateSaveError(`${requiredDocumentFailureMessage} 수동 입력 모드로 계속 진행할 수 있습니다.`);
      toast.error('OCR 자동 추출에 실패했습니다. 수동 입력으로 전환합니다.');
      return;
    }

    if (suggestions.length === 0) {
      setCreateSaveError('OCR 자동 추출 결과가 없어 수동 입력이 필요합니다.');
      return;
    }

    setCreateSaveError(null);
    toast.success(`OCR 추출 완료: ${suggestions.length}개 제안값을 확인해 주세요.`);
  }, [
    canWriteAssets,
    createForm,
    isCreateSaving,
    ocrAppliedValues,
    pollOcrJobUntilTerminal,
    uploadStep,
    uploadedFiles,
    user?.companyId,
  ]);

  const handleCreateModeChange = useCallback((nextMode: CreateMode) => {
    abortOcrProcessing();
    const nextUploadStep = resolveCreateModeSwitch({
      nextMode,
      hasRegistrationFile: uploadedFiles.vehicleRegistration !== null,
      hasOcrOutput: ocrSuggestions.length > 0 || ocrWarnings.length > 0,
    });

    setCreateMode(nextMode);
    setUploadStep(nextUploadStep);
    setOcrProgressMessage(null);
    if (nextUploadStep === 'upload') {
      resetOcrFeedback();
    }

    if (nextMode === 'manual' && uploadStep === 'processing') {
      setCreateSaveError('OCR 처리를 중단하고 직접 입력 모드로 전환했습니다.');
      return;
    }

    setCreateSaveError(null);
  }, [
    abortOcrProcessing,
    ocrSuggestions.length,
    ocrWarnings.length,
    resetOcrFeedback,
    uploadStep,
    uploadedFiles.vehicleRegistration,
  ]);

  const handleSwitchToManualMode = useCallback(() => {
    handleCreateModeChange('manual');
  }, [handleCreateModeChange]);

  const handleCreateSave = useCallback(async () => {
    if (!canWriteAssets) {
      setCreateSaveError('차량 자산 등록 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }

    if (isCreateSaving) {
      return;
    }

    const companyId = normalizeTenantCompanyId(user?.companyId);
    const createReadiness = getAssetCreateReadiness({
      tenantCompanyId: companyId,
      company,
    });
    if (!createReadiness.isReady || !companyId) {
      setCreateSaveError(createReadiness.message);
      return;
    }

    const { payload, fieldErrors } = toCreatePayload(createForm, companyId);
    if (!payload) {
      setCreateFieldErrors(fieldErrors);
      setCreateSaveError('필수 입력값을 확인해 주세요.');
      return;
    }

    setIsCreateSaving(true);
    setCreateSaveError(null);
    setCreateFieldErrors({});

    try {
      const responsePayload = await createAsset(payload);
      const createdAsset = toAssetDetail(responsePayload);
      if (!createdAsset) {
        throw new Error('생성 응답에서 자산 정보를 확인할 수 없습니다.');
      }

      setShowModal(false);
      resetCreateModalState();

      updateAssetsSearchParams((params) => {
        params.set('assetId', createdAsset.id);
        params.delete('vehicle');
      }, true);

      void hydrateAssets();
      toast.success('차량 자산이 등록되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          const nextFieldErrors = toCreateFieldErrors(error);
          if (Object.keys(nextFieldErrors).length > 0) {
            setCreateFieldErrors(nextFieldErrors);
          }
          setCreateSaveError(error.message || '입력값을 확인해 주세요.');
          return;
        }
        if (error.status === 403) {
          setCreateSaveError('차량 자산 등록 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 409) {
          setCreateSaveError(error.message || '이미 등록된 차량 정보입니다. 입력값을 확인해 주세요.');
          return;
        }
      }

      setCreateSaveError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      toast.error('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsCreateSaving(false);
    }
  }, [canWriteAssets, company, createForm, hydrateAssets, isCreateSaving, resetCreateModalState, updateAssetsSearchParams, user?.companyId]);

  const handleDeleteAsset = useCallback(async () => {
    if (!canWriteAssets) {
      setDetailSaveError('차량 자산 삭제 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }
    if (!selectedAsset || isDetailDeleting || isDetailSaving) {
      return;
    }
    if (typeof window !== 'undefined') {
      const shouldDelete = window.confirm(`'${selectedAsset.vehicleNumber}' 차량을 삭제하시겠습니까?`);
      if (!shouldDelete) {
        return;
      }
    }

    setIsDetailDeleting(true);
    setDetailSaveError(null);

    try {
      await deleteAsset(selectedAsset.id);
      closeDetailModalState();
      void hydrateAssets();
      toast.success('차량 자산이 삭제되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setDetailSaveError('차량 자산 삭제 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 404) {
          closeDetailModalState();
          void hydrateAssets();
          toast.info('이미 삭제되었거나 존재하지 않는 차량입니다.');
          return;
        }
      }
      setDetailSaveError('차량 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      toast.error('차량 삭제에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsDetailDeleting(false);
    }
  }, [canWriteAssets, closeDetailModalState, hydrateAssets, isDetailDeleting, isDetailSaving, selectedAsset]);

  const handleDetailSave = useCallback(async () => {
    if (!canWriteAssets) {
      setDetailSaveError('차량 자산 수정 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
      return;
    }

    if (!selectedAsset || isDetailSaving) {
      return;
    }
    if (!isDetailDirty) {
      toast.info('변경된 내용이 없습니다.');
      return;
    }
    if (typeof selectedAsset.version !== 'number') {
      setDetailSaveError('자산 버전 정보를 확인할 수 없습니다. 상세 정보를 새로고침해 주세요.');
      return;
    }

    const { payload, fieldErrors } = buildAssetPatchPayload({
      asset: { ...selectedAsset, version: selectedAsset.version },
      form: detailForm,
    });

    if (Object.keys(fieldErrors).length > 0) {
      setDetailFieldErrors(fieldErrors);
      setDetailSaveError('입력값을 확인해 주세요.');
      return;
    }

    if (Object.keys(payload).length === 1) {
      toast.info('변경된 내용이 없습니다.');
      return;
    }

    setIsDetailSaving(true);
    setDetailSaveError(null);
    setDetailFieldErrors({});
    setDetailConflictNotice(null);

    try {
      const responsePayload = await patchAsset(selectedAsset.id, payload);
      const updatedAsset = toAssetDetail(responsePayload);
      if (!updatedAsset) {
        throw new Error('수정 응답에서 자산 정보를 확인할 수 없습니다.');
      }

      setSelectedAsset(updatedAsset);
      setDetailForm(toAssetEditForm(updatedAsset));
      setDetailFieldErrors({});
      setDetailSaveError(null);
      setDetailConflictNotice(null);
      setAssets((prevAssets) => prevAssets.map((asset) => (asset.id === updatedAsset.id ? { ...asset, ...updatedAsset } : asset)));
      void hydrateAssetHistory(updatedAsset.id);
      void hydrateAssets();
      toast.success('차량 정보가 업데이트되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          const nextFieldErrors = toAssetEditFieldErrors(error);
          if (Object.keys(nextFieldErrors).length > 0) {
            setDetailFieldErrors(nextFieldErrors);
          }
          setDetailSaveError(error.message || '입력값을 확인해 주세요.');
          return;
        }
        if (error.status === 403) {
          setDetailSaveError('차량 자산 수정 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 409) {
          setDetailConflictNotice('다른 변경 사항이 먼저 저장되었습니다. 최신 데이터로 새로고침 후 다시 저장해 주세요.');
          setDetailSaveError(error.message || '버전 충돌이 발생했습니다.');
          void hydrateAssetDetail(selectedAsset.id, { preserveForm: true, preserveConflictNotice: true });
          return;
        }
      }

      setDetailSaveError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      toast.error('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsDetailSaving(false);
    }
  }, [
    canWriteAssets,
    detailForm,
    hydrateAssetDetail,
    hydrateAssetHistory,
    hydrateAssets,
    isDetailDirty,
    isDetailSaving,
    selectedAsset,
  ]);

  return (
    <Layout title="차량 자산">
      <div className="p-6">
        <PremiumInstallationRequestSection
          assets={premiumInstallableAssets}
          user={user ?? null}
        />

        {detailNotice && (
          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
            {detailNotice}
          </div>
        )}

        {isDetailLoading && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            자산 상세 정보를 불러오는 중입니다.
          </div>
        )}

        {/* 상단 헤더 & 필터 */}
        <div className="mb-6 mt-4 space-y-4">
          {/* 검색창 */}
          <div className="relative">
            <label htmlFor="assets-search-query" className="sr-only">
              자산 검색
            </label>
            <input
              id="assets-search-query"
              name="queryKeyword"
              type="text"
              aria-label="자산 검색"
              placeholder="차량번호 또는 차종으로 검색..."
              value={queryKeyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
            {queryKeyword && (
              <button
                onClick={() => handleKeywordChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* 상태 필터 버튼 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">차량 상태:</span>
            <button
              onClick={() => handleStatusChange('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilterCode === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              전체 ({assets.length})
            </button>
            <button
              onClick={() => handleStatusChange('rental')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilterCode === 'rental'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              대여중 ({statusCountMap.rental})
            </button>
            <button
              onClick={() => handleStatusChange('reserved')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilterCode === 'reserved'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              예약 ({statusCountMap.reserved})
            </button>
            <button
              onClick={() => handleStatusChange('available')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilterCode === 'available'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              가용 ({statusCountMap.available})
            </button>
            <button
              onClick={() => handleStatusChange('maintenance')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilterCode === 'maintenance'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              정비중 ({statusCountMap.maintenance})
            </button>
          </div>

          {/* 페이지 크기 & 등록 버튼 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">페이지 크기:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              >
                {!PAGE_SIZE_OPTIONS.includes(pageSize) && (
                  <option value={pageSize}>{pageSize}개</option>
                )}
                {PAGE_SIZE_OPTIONS.map((sizeOption) => (
                  <option key={sizeOption} value={sizeOption}>
                    {sizeOption}개
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                {totalCount !== null
                  ? `총 ${totalCount}대`
                  : `${assets.length}대 표시 중`}
              </span>
            </div>
            
            <button
              onClick={openCreateModal}
              disabled={!canWriteAssets}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              차량 자산 등록
            </button>
          </div>
        </div>

        {/* 자산 테이블 */}
        <PageStateBoundary
          isLoading={isAssetsLoading}
          error={isOutOfRangeError ? null : assetsError}
          isEmpty={isAssetsEmpty}
          errorDescription={
            assetsErrorStatus === 400
              ? '필터 값이 올바르지 않습니다. 필터를 초기화하고 다시 시도해 주세요.'
              : '차량 자산 목록을 불러오는 중 문제가 발생했습니다.'
          }
          emptyTitle="조건에 맞는 차량이 없습니다"
          emptyDescription={
            shouldShowOutOfRangeEmpty
              ? '요청한 페이지 범위를 벗어났습니다. 첫 페이지에서 다시 확인해 주세요.'
              : '검색어 또는 필터를 조정해 다시 확인해 주세요.'
          }
          onRetry={handleAssetsRetry}
          errorActionLabel={assetsErrorStatus === 400 ? '필터 초기화' : getPageErrorActionLabel(assetsErrorKind)}
          onErrorAction={handleAssetsErrorAction}
          emptyActionLabel={shouldShowOutOfRangeEmpty ? '첫 페이지로 이동' : '필터 초기화'}
          onEmptyAction={shouldShowOutOfRangeEmpty ? () => handlePageChange(1) : resetAssetFilters}
          className="min-h-[280px]"
        >
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">차량번호</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">차종</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태이상 요약</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">보험만료일</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">다음 정기점검일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assets.map((asset) => (
                    <tr
                      key={asset.id}
                      data-testid={`asset-row-${asset.id}`}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleDetailModalOpen(asset)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {asset.vehicleNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {asset.model}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(asset.status)}`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          {asset.issues.slice(0, 2).map((issue, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700"
                            >
                              {issue}
                            </span>
                          ))}
                          {asset.issues.length === 0 && (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {asset.insuranceExpiry}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {asset.nextInspection}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <p className="text-sm text-gray-600">
                {totalCount !== null
                  ? `총 ${totalCount}대 · ${page} / ${totalPages ?? page} 페이지`
                  : `현재 페이지 ${page} · ${assets.length}대`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!hasPrevPage || isAssetsLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!hasNextPage || isAssetsLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  다음
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </PageStateBoundary>

        {/* OCR 업로드 모달 */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[600px] max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-[#1e2939]">
                    {createMode === 'ocr' ? '차량등록증 업로드 (OCR)' : '차량 자산 직접 입력'}
                  </h2>
                  <button
                    onClick={closeCreateModal}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    data-testid="asset-create-mode-ocr-button"
                    onClick={() => handleCreateModeChange('ocr')}
                    disabled={isCreateSaving}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      createMode === 'ocr'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    OCR
                  </button>
                  <button
                    type="button"
                    data-testid="asset-create-mode-manual-button"
                    onClick={() => handleCreateModeChange('manual')}
                    disabled={isCreateSaving}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      createMode === 'manual'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    직접 입력
                  </button>
                </div>

                {isCreateDirty && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    저장 전 변경사항이 있습니다.
                  </div>
                )}

                {createSaveError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <p>{createSaveError}</p>
                    {createSaveError === COMPANY_PROFILE_REQUIRED_MESSAGE && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowModal(false);
                          navigate(COMPANY_PROFILE_SETTINGS_ROUTE);
                        }}
                        className="mt-3 inline-flex items-center rounded-md bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm ring-1 ring-inset ring-red-200 hover:bg-red-100"
                      >
                        회사 정보 설정으로 이동
                      </button>
                    )}
                  </div>
                )}

                {/* 단계 표시 */}
                {createMode === 'ocr' && (
                  <div className="flex items-center justify-center mb-8">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-2 ${uploadStep === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${uploadStep === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                          1
                        </div>
                        <span className="text-sm font-medium">업로드</span>
                      </div>
                      <div className="w-12 h-0.5 bg-gray-300" />
                      <div className={`flex items-center gap-2 ${uploadStep === 'processing' ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${uploadStep === 'processing' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                          2
                        </div>
                        <span className="text-sm font-medium">처리중</span>
                      </div>
                      <div className="w-12 h-0.5 bg-gray-300" />
                      <div className={`flex items-center gap-2 ${uploadStep === 'preview' ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${uploadStep === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                          3
                        </div>
                        <span className="text-sm font-medium">미리보기</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 업로드 단계 */}
                {createMode === 'ocr' && uploadStep === 'upload' && (
                  <div className="space-y-4">
                    {/* 차량등록증 업로드 (필수) */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">
                        <FileText className="w-4 h-4" />
                        차량등록증 (필수)
                      </label>
                      <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-700">차량등록증을 업로드하세요</p>
                        <p className="text-xs text-gray-500 mt-1">또는 파일을 드래그하세요</p>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={(event) => {
                            handleDocumentFileSelect('vehicleRegistration', event.target.files?.[0] ?? null);
                            event.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                      {uploadedFiles.vehicleRegistration && (
                        <p className="text-xs text-green-600 mt-2">✓ {uploadedFiles.vehicleRegistration.name}</p>
                      )}
                    </div>

                    {/* 보험증서 업로드 (선택) */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">
                        <CalendarIcon className="w-4 h-4" />
                        보험가입증서 (선택)
                      </label>
                      <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
                        <Upload className="w-6 h-6 text-gray-400 mb-1" />
                        <p className="text-sm text-gray-700">보험가입증서 업로드</p>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            handleDocumentFileSelect('insurance', e.target.files?.[0] ?? null);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                      {uploadedFiles.insurance && (
                        <p className="text-xs text-green-600 mt-2">✓ {uploadedFiles.insurance.name}</p>
                      )}
                    </div>

                    {/* 차량대출 상환계획표 업로드 (선택) */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">
                        <DollarSign className="w-4 h-4" />
                        차량구매 대출 상환계획서 (선택)
                      </label>
                      <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
                        <Upload className="w-6 h-6 text-gray-400 mb-1" />
                        <p className="text-sm text-gray-700">상환계획서 업로드</p>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          onChange={(event) => {
                            handleDocumentFileSelect('loanSchedule', Array.from(event.target.files ?? []));
                            event.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                      {uploadedFiles.loanSchedule.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {uploadedFiles.loanSchedule.map((file, index) => (
                            <p key={`${file.name}-${file.lastModified}-${index}`} className="text-xs text-green-600">
                              - {file.name}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mt-4">
                      * 차량등록증은 필수 항목입니다. 문서를 다시 업로드하면 이전 OCR 제안값은 폐기됩니다.
                    </p>

                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          void handleStartOcrExtraction();
                        }}
                        disabled={!canWriteAssets || !uploadedFiles.vehicleRegistration || isCreateSaving}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        OCR 추출 시작
                      </button>
                      <p className="text-xs text-gray-500">
                        추출 중에는 상태를 polling으로 확인하며, 느린 응답 시 수동 입력으로 전환할 수 있습니다.
                      </p>
                    </div>
                  </div>
                )}

                {/* 처리중 단계 */}
                {createMode === 'ocr' && uploadStep === 'processing' && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <p className="text-base text-gray-700">OCR 처리중...</p>
                    <p className="text-sm text-gray-500 text-center">
                      {ocrProgressMessage ?? '잠시만 기다려주세요'}
                    </p>
                    <button
                      type="button"
                      onClick={handleSwitchToManualMode}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      수동 입력으로 전환
                    </button>
                  </div>
                )}

                {/* 미리보기 단계 */}
                {uploadStep === 'preview' && (
                  <div className="space-y-4">
                    {createMode === 'ocr' ? (
                      <>
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <p className="text-xs text-gray-600">
                            OCR 제안 {ocrSuggestions.length}건 · 경고 {ocrWarnings.length}건
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void handleStartOcrExtraction();
                              }}
                              disabled={!canWriteAssets || !uploadedFiles.vehicleRegistration || isCreateSaving}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              OCR 다시 실행
                            </button>
                            <button
                              type="button"
                              onClick={() => setUploadStep('upload')}
                              disabled={isCreateSaving}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              문서 다시 선택
                            </button>
                          </div>
                        </div>

                        {ocrSuggestions.length > 0 && (
                          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                            OCR 결과를 폼에 자동 반영했습니다. 저장 전 값이 정확한지 확인해 주세요.
                          </div>
                        )}

                        {ocrWarnings.length > 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <p className="font-semibold">확인 필요</p>
                            <ul className="mt-1 space-y-1">
                              {ocrWarnings.slice(0, 4).map((warning, index) => (
                                <li key={`${warning}-${index}`}>• {warning}</li>
                              ))}
                            </ul>
                            {ocrWarnings.length > 4 && (
                              <p className="mt-1">외 {ocrWarnings.length - 4}건</p>
                            )}
                          </div>
                        )}

                        {ocrCanRetry && (
                          <p className="text-xs text-gray-500">
                            OCR 실패/타임아웃이 포함되어 다시 시도할 수 있습니다.
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        OCR 없이 직접 입력합니다. 차량번호와 차대번호만 입력해도 저장할 수 있습니다.
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">차량번호</label>
                      <input
                        data-testid="asset-create-vehicle-number-input"
                        type="text"
                        value={createForm.vehicleNumber}
                        onChange={(e) => handleCreateFieldChange('vehicleNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {createFieldErrors.vehicleNumber && (
                        <p className="mt-1 text-xs text-red-600">{createFieldErrors.vehicleNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">차대번호</label>
                      <input
                        data-testid="asset-create-vin-input"
                        type="text"
                        value={createForm.vin}
                        onChange={(e) => handleCreateFieldChange('vin', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {createFieldErrors.vin && (
                        <p className="mt-1 text-xs text-red-600">{createFieldErrors.vin}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">차종</label>
                      <input
                        data-testid="asset-create-model-input"
                        type="text"
                        value={createForm.model}
                        onChange={(e) => handleCreateFieldChange('model', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {createFieldErrors.model && (
                        <p className="mt-1 text-xs text-red-600">{createFieldErrors.model}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">연식</label>
                      <input
                        data-testid="asset-create-year-input"
                        type="text"
                        value={createForm.year}
                        onChange={(e) => handleCreateFieldChange('year', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {createFieldErrors.year && (
                        <p className="mt-1 text-xs text-red-600">{createFieldErrors.year}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">소유자</label>
                      <input
                        type="text"
                        value={createForm.owner}
                        onChange={(e) => handleCreateFieldChange('owner', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">보험만료일</label>
                      <input
                        type="text"
                        value={createForm.insuranceExpiry}
                        onChange={(e) => handleCreateFieldChange('insuranceExpiry', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        data-testid="asset-create-save-button"
                        onClick={handleCreateSave}
                        disabled={!canWriteAssets || isCreateSaving}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="inline-flex items-center gap-2">
                          {isCreateSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                          {isCreateSaving ? '저장 중...' : '확인 및 저장'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 자산 상세 모달 - VehicleDetailModal 컴포넌트 사용 */}
        {selectedAsset && (
          <VehicleDetailModal
            asset={selectedAsset}
            historyEntries={assetHistory}
            isHistoryLoading={isAssetHistoryLoading}
            historyError={assetHistoryError}
            onHistoryRetry={handleHistoryRetry}
            onConflictRefresh={handleConflictRefresh}
            isOpen={showDetailModal}
            onClose={handleDetailModalClose}
            editForm={detailForm}
            fieldErrors={detailFieldErrors}
            saveError={detailSaveError}
            conflictNotice={detailConflictNotice}
            isSaving={isDetailSaving}
            isDeleting={isDetailDeleting}
            isDirty={isDetailDirty}
            canEdit={canWriteAssets}
            onEditFieldChange={handleDetailFieldChange}
            handleSave={handleDetailSave}
            handleDelete={handleDeleteAsset}
            getStatusColor={getStatusColor}
          />
        )}
      </div>
    </Layout>
  );
}
