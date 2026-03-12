import { Layout } from '../components/Layout';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Plus,
  MapPin,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  RefreshCw,
} from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { KakaoGeofenceInput, type KakaoGeofenceShape } from '../components/KakaoGeofenceInput';
import { PageStateBoundary } from '../components/PageStateBoundary';
import {
  getCollectionFromPayload,
  getPageErrorActionLabel,
  handlePageErrorAction,
  usePageEndpointState,
} from '../hooks/usePageEndpointState';
import { reservations as templateReservations } from '../data/mockData';
import { ApiError } from '../../services/api';
import { useAuthorization } from '../context/AuthorizationContext';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { ACTION_PERMISSIONS } from '../authorization';
import { createAsset, getAssetsList } from '../../services/assets';
import { getReservationsList } from '../../services/reservations';
import {
  getOcrExtractJob,
  signAssetUpload,
  submitOcrExtractJob,
  uploadFileToSignedUrl,
  type OcrExtractedField,
} from '../../services/assetOcr';
import {
  getSettingsCompany,
  listSettingsCompanies,
  putSettingsCompany,
  listSettingsGeofences,
  createSettingsGeofence,
  updateSettingsGeofence,
  deleteSettingsGeofence,
  listSettingsMembers,
  patchSettingsMemberRole,
  patchSettingsMemberStatus,
  type SettingsCompanyOption,
  type SettingsCompanyProfile,
  type SettingsCompanyUpdateRequest,
  type SettingsGeofence,
  type SettingsGeofencePoint,
  type SettingsMember,
} from '../../services/settings';
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  type Invitation,
  type InvitationRole,
} from '../../services/invitations';
import {
  buildInvitationCreatePayload,
  getInvitationStatusBadgeColor,
  resolveSettingsCompanyScope,
  toInvitationRoleLabel,
  toInvitationStatusLabel,
  upsertPendingInvitation,
  validateInvitationDraft,
} from './settingsInvitations';
import { canAccessBulkOcr } from './settingsBulkOcr';

type TabType = 'bulk' | 'company' | 'geofence' | 'accounts';
type UploadType = 'vehicles' | 'reservations' | 'ocr';
type CurrentDataType = Extract<UploadType, 'vehicles' | 'reservations'>;
type CompanyField = 'name' | 'businessNumber' | 'phone' | 'email' | 'address';
type GeofenceField = 'name' | 'lat' | 'lng' | 'radiusMeter' | 'pointsText';
type MemberRoleField = 'role';
type InvitationField = 'email' | 'role' | 'companyId';
type InvitationStatusFilter = 'pending' | 'accepted' | 'expired' | 'revoked' | 'all';
type FieldErrorMap<TField extends string> = Partial<Record<TField, string>>;

interface UploadResult {
  success: boolean;
  total: number;
  valid: number;
  errors: string[];
}

interface BulkOcrResult {
  fileName: string;
  status: 'success' | 'error';
  message: string;
  assetId?: string;
}

interface CompanyFormState {
  name: string;
  businessNumber: string;
  phone: string;
  email: string;
  address: string;
}

interface GeofenceFormState {
  name: string;
  shape: KakaoGeofenceShape;
  lat: string;
  lng: string;
  radiusMeter: string;
  pointsText: string;
  active: boolean;
}

interface InvitationFormState {
  email: string;
  role: InvitationRole;
}

interface SettingsHydrationPayload {
  company: SettingsCompanyProfile;
  geofences: SettingsGeofence[];
  members: SettingsMember[];
  invitations: Invitation[];
  invitationLoadError: string | null;
}

const DEFAULT_SETTINGS_SCHEMA_VERSION = 'v1';
const CURRENT_DATA_COUNT_KEYS = ['total', 'totalCount', 'count', 'size', 'itemsCount', 'totalElements'];
const CURRENT_DATA_PAGE_SIZE = 200;
const BULK_OCR_ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);
const BULK_OCR_EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const BULK_OCR_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const BULK_OCR_POLL_INTERVAL_MS = 1000;
const BULK_OCR_POLL_TIMEOUT_MS = 90_000;
const INVALID_COMPANY_IDS = new Set(['0000000000', '__global__', 'company-local', 'null', 'none']);
const CSV_VALIDATION_ONLY_NOTICE = '?꾩옱??CSV 寃利앸쭔 吏?먰빀?덈떎. ??μ? 吏?먮릺吏 ?딆쑝??寃利?寃곌낵瑜??뺤씤?????ㅻⅨ ?깅줉 寃쎈줈瑜??댁슜??二쇱꽭??';

const DEFAULT_COMPANY_FORM_STATE: CompanyFormState = {
  name: '',
  businessNumber: '',
  phone: '',
  email: '',
  address: '',
};

const DEFAULT_GEOFENCE_FORM_STATE: GeofenceFormState = {
  name: '',
  shape: 'circle',
  lat: '',
  lng: '',
  radiusMeter: '',
  pointsText: '',
  active: true,
};

const DEFAULT_INVITATION_FORM_STATE: InvitationFormState = {
  email: '',
  role: 'member',
};
const DEFAULT_INVITATION_STATUS_FILTER: InvitationStatusFilter = 'pending';

function toInvitationStatusQuery(
  invitationStatusFilter: InvitationStatusFilter,
): Exclude<InvitationStatusFilter, 'all'> | undefined {
  return invitationStatusFilter === 'all' ? undefined : invitationStatusFilter;
}

function sortInvitations(items: Invitation[]): Invitation[] {
  return items.reduce<Invitation[]>((results, invitation) => upsertPendingInvitation(results, invitation), []);
}

function invitationMatchesStatusFilter(invitation: Invitation, invitationStatusFilter: InvitationStatusFilter): boolean {
  return invitationStatusFilter === 'all' || invitation.status === invitationStatusFilter;
}

function createEmptySettingsHydrationPayload(): SettingsHydrationPayload {
  return {
    company: {
      companyId: '',
      name: '',
      businessNumber: null,
      phone: null,
      email: null,
      address: null,
      updatedAt: null,
      schemaVersion: DEFAULT_SETTINGS_SCHEMA_VERSION,
    },
    geofences: [],
    members: [],
    invitations: [],
    invitationLoadError: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
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
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return null;
}

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackMessage;
}

function waitForDuration(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(resolve, ms);
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function toFileExtension(name: string): string | null {
  const normalizedName = name.trim().toLowerCase();
  const separatorIndex = normalizedName.lastIndexOf('.');
  if (separatorIndex < 0 || separatorIndex >= normalizedName.length - 1) {
    return null;
  }
  return normalizedName.slice(separatorIndex + 1);
}

function resolveBulkOcrContentType(file: File): string | null {
  const fileContentType = file.type.trim().toLowerCase();
  if (BULK_OCR_ALLOWED_CONTENT_TYPES.has(fileContentType)) {
    return fileContentType;
  }

  const extension = toFileExtension(file.name);
  if (extension && BULK_OCR_EXTENSION_TO_CONTENT_TYPE[extension]) {
    return BULK_OCR_EXTENSION_TO_CONTENT_TYPE[extension];
  }

  return null;
}

function normalizeTenantCompanyId(value: unknown): string | null {
  const companyId = toStringValue(value);
  if (!companyId) {
    return null;
  }
  return INVALID_COMPANY_IDS.has(companyId.toLowerCase()) ? null : companyId;
}

function normalizeSettingsCompanyOptions(items: SettingsCompanyOption[]): SettingsCompanyOption[] {
  const optionsByCompanyId = new Map<string, SettingsCompanyOption>();

  for (const item of items) {
    const companyId = normalizeTenantCompanyId(item.companyId);
    if (!companyId) {
      continue;
    }
    const name = toStringValue(item.name) ?? companyId;
    optionsByCompanyId.set(companyId, {
      companyId,
      name,
    });
  }

  return Array.from(optionsByCompanyId.values()).sort((left, right) => (
    `${left.name}\u0000${left.companyId}`.localeCompare(`${right.name}\u0000${right.companyId}`)
  ));
}

function toBulkOcrCreatePayload(
  fields: OcrExtractedField[],
  companyId: string,
): {
  vin: string;
  plate: string;
  vehicleNumber: string;
  companyId: string;
  model?: string;
  year?: number;
} | null {
  const values = new Map<string, string>();

  for (const field of fields) {
    const name = toStringValue(field.name)?.toLowerCase();
    const value = toStringValue(field.value);
    if (!name || !value) {
      continue;
    }
    if (!values.has(name)) {
      values.set(name, value);
    }
  }

  const vin = values.get('vin');
  const plate = values.get('plate') ?? values.get('vehiclenumber');
  if (!vin || !plate) {
    return null;
  }

  const yearValue = values.get('year');
  const parsedYear = yearValue ? Number(yearValue) : NaN;

  return {
    vin,
    plate,
    vehicleNumber: plate,
    companyId,
    model: values.get('model') || undefined,
    year: Number.isInteger(parsedYear) ? parsedYear : undefined,
  };
}

function isRetryableMutationError(error: ApiError): boolean {
  if (error.status !== undefined && error.status >= 500) {
    return true;
  }
  return (
    error.code === 'NETWORK_ERROR'
    || error.code === 'TIMEOUT'
    || error.code === 'ABORTED'
    || error.code === 'SERVER_ERROR'
  );
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
    const targetField = fieldMap[name];
    if (!targetField) {
      continue;
    }
    if (!mapped[targetField]) {
      mapped[targetField] = reason;
    }
  }

  return mapped;
}

function toCompanyForm(profile: SettingsCompanyProfile): CompanyFormState {
  return {
    name: toStringValue(profile.name) ?? '',
    businessNumber: toStringValue(profile.businessNumber) ?? '',
    phone: toStringValue(profile.phone) ?? '',
    email: toStringValue(profile.email) ?? '',
    address: toStringValue(profile.address) ?? '',
  };
}

function toGeofenceForm(geofence: SettingsGeofence): GeofenceFormState {
  const hasPolygonPoints = Array.isArray(geofence.points) && geofence.points.length >= 3;
  return {
    name: geofence.name,
    shape: hasPolygonPoints ? 'polygon' : 'circle',
    lat: String(geofence.center.lat),
    lng: String(geofence.center.lng),
    radiusMeter: hasPolygonPoints && geofence.radiusMeter <= 0 ? '' : String(geofence.radiusMeter),
    pointsText: hasPolygonPoints
      ? geofence.points.map((point) => `${point.lat},${point.lng}`).join('\n')
      : '',
    active: geofence.active,
  };
}

function parseGeofencePolygonPoints(pointsText: string): {
  points: SettingsGeofencePoint[];
  error: string | null;
} {
  const lines = pointsText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    return {
      points: [],
      error: '瑗?쭞??醫뚰몴??理쒖냼 3媛쒓? ?꾩슂?⑸땲??',
    };
  }

  const points: SettingsGeofencePoint[] = [];
  for (const [index, line] of lines.entries()) {
    const tokens = line.split(',').map((token) => token.trim());
    if (tokens.length !== 2) {
      return {
        points: [],
        error: `${index + 1}踰덉㎏ 以꾩? lat,lng ?뺤떇?댁뼱???⑸땲??`,
      };
    }

    const lat = toNumberValue(tokens[0]);
    const lng = toNumberValue(tokens[1]);
    if (lat === null || lng === null) {
      return {
        points: [],
        error: `${index + 1}踰덉㎏ 以?醫뚰몴瑜??レ옄濡??낅젰??二쇱꽭??`,
      };
    }

    points.push({ lat, lng });
  }

  return {
    points,
    error: null,
  };
}

function areGeofencePointsEqual(
  left: SettingsGeofencePoint[] | undefined,
  right: SettingsGeofencePoint[] | undefined,
): boolean {
  const normalizedLeft = Array.isArray(left) ? left : [];
  const normalizedRight = Array.isArray(right) ? right : [];
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((point, index) => (
    point.lat === normalizedRight[index]?.lat
    && point.lng === normalizedRight[index]?.lng
  ));
}

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return '-';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString('ko-KR');
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-700';
    case 'member':
      return 'bg-blue-100 text-blue-700';
    case 'viewer':
      return 'bg-slate-100 text-slate-700';
    case 'installer':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function toRoleLabel(role: string): string {
  if (role === 'admin') {
    return '관리자';
  }
  if (role === 'member') {
    return '운영자';
  }
  if (role === 'viewer') {
    return '조회자';
  }
  if (role === 'installer') {
    return '설치 기사';
  }
  return role || '미지정';
}

function canReviewPendingMemberStatus(
  member: Pick<SettingsMember, 'role' | 'status'>,
  actorRole: string | null | undefined,
  canManageMemberRoles: boolean,
): boolean {
  if (!canManageMemberRoles) {
    return false;
  }

  if (member.status === 'pending') {
    if (member.role === 'installer') {
      return actorRole === 'super_admin';
    }

    return true;
  }

  return false;
}

function toMemberStatusLabel(status: string): string {
  switch (status) {
    case 'approved':
      return '승인';
    case 'pending':
      return '확인 대기';
    case 'rejected':
      return '확인 거절';
    case 'withdrawn':
      return '철회';
    default:
      return status || '미확인';
  }
}

function getMemberStatusBadgeColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'withdrawn':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getTotalCountFromPayload(payload: unknown, fallbackValue: number): number {
  if (!isRecord(payload)) {
    return fallbackValue;
  }

  for (const key of CURRENT_DATA_COUNT_KEYS) {
    const numericValue = toNumberValue(payload[key]);
    if (numericValue !== null) {
      return numericValue;
    }
  }

  if (isRecord(payload.meta)) {
    for (const key of CURRENT_DATA_COUNT_KEYS) {
      const numericValue = toNumberValue(payload.meta[key]);
      if (numericValue !== null) {
        return numericValue;
      }
    }
  }

  if (isRecord(payload.data)) {
    return getTotalCountFromPayload(payload.data, fallbackValue);
  }

  return fallbackValue;
}

function getKnownTotalCountFromPayload(payload: unknown): number | null {
  if (!isRecord(payload)) {
    return null;
  }

  for (const key of CURRENT_DATA_COUNT_KEYS) {
    const numericValue = toNumberValue(payload[key]);
    if (numericValue !== null) {
      return numericValue;
    }
  }

  if (isRecord(payload.meta)) {
    for (const key of CURRENT_DATA_COUNT_KEYS) {
      const numericValue = toNumberValue(payload.meta[key]);
      if (numericValue !== null) {
        return numericValue;
      }
    }
  }

  if (isRecord(payload.data)) {
    return getKnownTotalCountFromPayload(payload.data);
  }

  return null;
}

function toCsvCell(value: unknown): string {
  const normalizedValue = toStringValue(value) ?? '';
  const escapedValue = normalizedValue.replace(/"/g, '""');
  return /[",\n\r]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
}

function triggerCsvDownload(filename: string, lines: string[]): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function toReservationTypeLabel(value: unknown): string {
  const normalizedValue = (toStringValue(value) ?? '').trim().toLowerCase();
  if (!normalizedValue) {
    return '';
  }
  if (normalizedValue === 'rental' || normalizedValue === '대여' || normalizedValue === '대여중' || normalizedValue === 'in_use') {
    return '대여중';
  }
  if (normalizedValue === 'reservation' || normalizedValue === 'reserved' || normalizedValue === '예약' || normalizedValue === '예약중') {
    return '예약중';
  }
  if (
    normalizedValue === 'return'
    || normalizedValue === 'returned'
    || normalizedValue === '반납'
    || normalizedValue === '반납완료'
    || normalizedValue === '완료'
  ) {
    return '반납완료';
  }
  return toStringValue(value) ?? '';
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canPerformAction } = useAuthorization();
  const { refreshCompany } = useCompany();

  const isSuperAdmin = (user?.role ?? '').trim().toLowerCase() === 'super_admin';
  const canEditSettings = canPerformAction(ACTION_PERMISSIONS.settingsWrite);
  const canWriteAssets = canPerformAction(ACTION_PERMISSIONS.assetsWrite);
  const canManageMemberRoles = canPerformAction(ACTION_PERMISSIONS.settingsMembersWrite);
  const canUseBulkOcr = canAccessBulkOcr({ canEditSettings, canWriteAssets });
  const settingsCompanyId = useMemo(
    () => resolveSettingsCompanyScope(searchParams.get('companyId'), user?.companyId),
    [searchParams, user?.companyId],
  );
  const selectedCompanyId = settingsCompanyId;
  const [activeTab, setActiveTab] = useState<TabType>('bulk');
  const [companyOptions, setCompanyOptions] = useState<SettingsCompanyOption[]>([]);
  const [isCompanyOptionsLoading, setIsCompanyOptionsLoading] = useState(false);
  const [companyOptionsError, setCompanyOptionsError] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<UploadType>('vehicles');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkOcrAbortControllerRef = useRef<AbortController | null>(null);
  const [isBulkOcrProcessing, setIsBulkOcrProcessing] = useState(false);
  const [bulkOcrProgressMessage, setBulkOcrProgressMessage] = useState<string | null>(null);
  const [bulkOcrResults, setBulkOcrResults] = useState<BulkOcrResult[]>([]);
  const [bulkOcrSelectedFiles, setBulkOcrSelectedFiles] = useState<string[]>([]);

  const [companyForm, setCompanyForm] = useState<CompanyFormState>(DEFAULT_COMPANY_FORM_STATE);
  const [companyBaseline, setCompanyBaseline] = useState<CompanyFormState>(DEFAULT_COMPANY_FORM_STATE);
  const [companyUpdatedAt, setCompanyUpdatedAt] = useState<string | null>(null);
  const [companySchemaVersion, setCompanySchemaVersion] = useState(DEFAULT_SETTINGS_SCHEMA_VERSION);
  const [companyFieldErrors, setCompanyFieldErrors] = useState<FieldErrorMap<CompanyField>>({});
  const [companySaveError, setCompanySaveError] = useState<string | null>(null);
  const [companySaveSuccess, setCompanySaveSuccess] = useState<string | null>(null);
  const [companyRetryAction, setCompanyRetryAction] = useState<(() => void) | null>(null);
  const [isCompanySaving, setIsCompanySaving] = useState(false);

  const [geofences, setGeofences] = useState<SettingsGeofence[]>([]);
  const [isGeofenceEditorOpen, setIsGeofenceEditorOpen] = useState(false);
  const [geofenceEditorMode, setGeofenceEditorMode] = useState<'create' | 'edit'>('create');
  const [editingGeofenceId, setEditingGeofenceId] = useState<string | null>(null);
  const [geofenceForm, setGeofenceForm] = useState<GeofenceFormState>(DEFAULT_GEOFENCE_FORM_STATE);
  const [geofenceFieldErrors, setGeofenceFieldErrors] = useState<FieldErrorMap<GeofenceField>>({});
  const [geofenceSaveError, setGeofenceSaveError] = useState<string | null>(null);
  const [geofenceSaveSuccess, setGeofenceSaveSuccess] = useState<string | null>(null);
  const [geofenceRetryAction, setGeofenceRetryAction] = useState<(() => void) | null>(null);
  const [isGeofenceSaving, setIsGeofenceSaving] = useState(false);
  const [activeToggleTargetId, setActiveToggleTargetId] = useState<string | null>(null);
  const [deletingGeofenceId, setDeletingGeofenceId] = useState<string | null>(null);

  const [members, setMembers] = useState<SettingsMember[]>([]);
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, string>>({});
  const [memberFieldErrors, setMemberFieldErrors] = useState<Record<string, string>>({});
  const [memberSaveError, setMemberSaveError] = useState<string | null>(null);
  const [memberSaveSuccess, setMemberSaveSuccess] = useState<string | null>(null);
  const [memberRetryAction, setMemberRetryAction] = useState<(() => void) | null>(null);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isInvitationEditorOpen, setIsInvitationEditorOpen] = useState(false);
  const [invitationForm, setInvitationForm] = useState<InvitationFormState>(DEFAULT_INVITATION_FORM_STATE);
  const [invitationFieldErrors, setInvitationFieldErrors] = useState<FieldErrorMap<InvitationField>>({});
  const [invitationSaveError, setInvitationSaveError] = useState<string | null>(null);
  const [invitationSaveSuccess, setInvitationSaveSuccess] = useState<string | null>(null);
  const [invitationRetryAction, setInvitationRetryAction] = useState<(() => void) | null>(null);
  const [isInvitationSaving, setIsInvitationSaving] = useState(false);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [invitationStatusFilter, setInvitationStatusFilter] = useState<InvitationStatusFilter>(DEFAULT_INVITATION_STATUS_FILTER);
  const [currentVehicleCount, setCurrentVehicleCount] = useState<number | null>(null);
  const [currentReservationCount, setCurrentReservationCount] = useState<number | null>(null);
  const [activeCurrentDownloadType, setActiveCurrentDownloadType] = useState<CurrentDataType | null>(null);

  const selectedEditingGeofence = useMemo(
    () => geofences.find((item) => item.id === editingGeofenceId) ?? null,
    [editingGeofenceId, geofences],
  );
  const effectiveSettingsCompanyId = useMemo(
    () => settingsCompanyId ?? (isSuperAdmin ? companyOptions[0]?.companyId ?? null : null),
    [companyOptions, isSuperAdmin, settingsCompanyId],
  );
  const settingsScope = useMemo(() => ({
    selectedCompanyId: effectiveSettingsCompanyId,
  }), [effectiveSettingsCompanyId]);

  const updateSettingsCompanyScope = useCallback((companyId: string | null, replace = false) => {
    const normalizedCompanyId = normalizeTenantCompanyId(companyId);
    setSearchParams((previousParams) => {
      const nextParams = new URLSearchParams(previousParams);
      if (normalizedCompanyId) {
        nextParams.set('companyId', normalizedCompanyId);
      } else {
        nextParams.delete('companyId');
      }
      return nextParams;
    }, { replace });
  }, [setSearchParams]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setCompanyOptions([]);
      setCompanyOptionsError(null);
      setIsCompanyOptionsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsCompanyOptionsLoading(true);
    setCompanyOptionsError(null);

    listSettingsCompanies({ signal: controller.signal })
      .then((items) => {
        if (controller.signal.aborted) {
          return;
        }

        const normalizedItems = normalizeSettingsCompanyOptions(items);
        setCompanyOptions(normalizedItems);

        if (selectedCompanyId && !normalizedItems.some((item) => item.companyId === selectedCompanyId)) {
          updateSettingsCompanyScope(null, true);
          return;
        }

        if (!selectedCompanyId && normalizedItems.length > 0) {
          updateSettingsCompanyScope(normalizedItems[0].companyId, true);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setCompanyOptions([]);
        setCompanyOptionsError(
          error instanceof Error && error.message
            ? error.message
            : '?뚯궗 紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsCompanyOptionsLoading(false);
        }
      });

    return () => controller.abort();
  }, [isSuperAdmin, selectedCompanyId, updateSettingsCompanyScope]);

  useEffect(() => {
    if (isSuperAdmin && !effectiveSettingsCompanyId) {
      setCompanySaveError(null);
      setCompanySaveSuccess(null);
    }
  }, [effectiveSettingsCompanyId, isSuperAdmin]);

  const hydrateMembersOnly = useCallback(async () => {
    const membersPayload = await listSettingsMembers(undefined, {
      companyId: effectiveSettingsCompanyId ?? undefined,
    });
    setMembers(Array.isArray(membersPayload.items) ? membersPayload.items : []);
    setMemberRoleDrafts({});
    setMemberFieldErrors({});
  }, [effectiveSettingsCompanyId]);

  const hydrateInvitationsOnly = useCallback(async (statusFilter: InvitationStatusFilter = invitationStatusFilter) => {
    if (!canManageMemberRoles) {
      setInvitations([]);
      return;
    }

    try {
      const invitationStatusFilterQuery = toInvitationStatusQuery(statusFilter);
      const invitationsPayload = await listInvitations(invitationStatusFilterQuery, {
        companyId: effectiveSettingsCompanyId ?? undefined,
      });
      const invitationItems = Array.isArray(invitationsPayload.items) ? invitationsPayload.items : [];
      setInvitations(sortInvitations(invitationItems));
    } catch (error) {
      setInvitationSaveError(toErrorMessage(error, '珥덈? 紐⑸줉???ㅼ떆 遺덈윭?ㅼ? 紐삵뻽?듬땲??'));
    }
  }, [canManageMemberRoles, effectiveSettingsCompanyId, invitationStatusFilter]);

  const hydrateGeofencesOnly = useCallback(async () => {
    const geofencesPayload = await listSettingsGeofences({
      companyId: effectiveSettingsCompanyId ?? undefined,
    });
    setGeofences(Array.isArray(geofencesPayload.items) ? geofencesPayload.items : []);
  }, [effectiveSettingsCompanyId]);

  const refreshCurrentDataCounts = useCallback(async () => {
    try {
      const [assetsPayload, reservationsPayload] = await Promise.all([
        getAssetsList({ page: 1, size: 1 }),
        getReservationsList({ page: 1, size: 1 }),
      ]);

      const assetRows = getCollectionFromPayload(assetsPayload, ['assets', 'items', 'rows', 'list']) ?? [];
      const reservationRows = getCollectionFromPayload(reservationsPayload, ['reservations', 'items', 'rows', 'list']) ?? [];

      setCurrentVehicleCount(getTotalCountFromPayload(assetsPayload, assetRows.length));
      setCurrentReservationCount(getTotalCountFromPayload(reservationsPayload, reservationRows.length));
    } catch {
      setCurrentVehicleCount(null);
      setCurrentReservationCount(null);
    }
  }, []);

  const pollBulkOcrJobUntilTerminal = useCallback(async (jobId: string, signal: AbortSignal) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < BULK_OCR_POLL_TIMEOUT_MS) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const jobPayload = await getOcrExtractJob(jobId, { signal });
      if (jobPayload.status === 'queued' || jobPayload.status === 'running') {
        await waitForDuration(BULK_OCR_POLL_INTERVAL_MS, signal);
        continue;
      }

      return jobPayload;
    }

    throw new ApiError('TIMEOUT', 'OCR 泥섎━ ?쒓컙??珥덇낵?섏뿀?듬땲??', {
      status: 504,
    });
  }, []);

  const handleBulkOcrFileSelection = useCallback(async (files: File[]) => {
    if (!canUseBulkOcr) {
      toast.error('李⑤웾 ?먯궛 ?깅줉 沅뚰븳???놁뒿?덈떎.');
      return;
    }
    if (files.length === 0 || isBulkOcrProcessing) {
      return;
    }

    const companyId = normalizeTenantCompanyId(user?.companyId);
    if (!companyId) {
      setBulkOcrSelectedFiles(files.map((file) => file.name));
      setBulkOcrResults([
        {
          fileName: files[0].name,
          status: 'error',
          message: '?뚯궗 ?뺣낫媛 ?놁뼱 ?쇨큵 OCR ?낅줈?쒕? ?쒖옉?????놁뒿?덈떎. ?ㅼ떆 濡쒓렇?????쒕룄??二쇱꽭??',
        },
      ]);
      toast.error('?뚯궗 ?뺣낫媛 ?놁뼱 ?쇨큵 OCR ?낅줈?쒕? ?쒖옉?????놁뒿?덈떎.');
      return;
    }

    bulkOcrAbortControllerRef.current?.abort();
    const controller = new AbortController();
    bulkOcrAbortControllerRef.current = controller;

    setBulkOcrSelectedFiles(files.map((file) => file.name));
    setBulkOcrResults([]);
    setIsBulkOcrProcessing(true);
    setBulkOcrProgressMessage('0 / ' + files.length + ' 파일 준비 중');

    const nextResults: BulkOcrResult[] = [];
    let successCount = 0;

    try {
      for (const [index, file] of files.entries()) {
        if (controller.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        try {
          const resolvedContentType = resolveBulkOcrContentType(file);
          if (!resolvedContentType) {
            throw new ApiError('UNSUPPORTED_MEDIA_TYPE', '지원하지 않는 파일 형식입니다. PDF/JPG/PNG/WebP 파일을 사용해 주세요.', {
              status: 415,
            });
          }
          if (file.size > BULK_OCR_MAX_FILE_SIZE_BYTES) {
            throw new ApiError('PAYLOAD_TOO_LARGE', 'OCR 파일 크기 제한(25MB)을 초과했습니다.', {
              status: 413,
            });
          }

          setBulkOcrProgressMessage((index + 1) + ' / ' + files.length + ' 업로드 중 ' + file.name);
          const signedUpload = await signAssetUpload({
            fileName: file.name,
            contentType: resolvedContentType,
            fileSize: file.size,
            folder: 'company/' + companyId + '/docs',
          }, { signal: controller.signal });

          const uploadContentType = signedUpload.contentType?.trim() || resolvedContentType;
          await uploadFileToSignedUrl(
            signedUpload.uploadUrl,
            file,
            uploadContentType,
            { signal: controller.signal },
          );

          setBulkOcrProgressMessage((index + 1) + ' / ' + files.length + ' OCR 분석 중 ' + file.name);
          let jobPayload = await submitOcrExtractJob({
            docType: 'registrationDoc',
            objectName: signedUpload.objectName,
            sourceName: file.name,
            contentType: uploadContentType,
          }, { signal: controller.signal });

          if (jobPayload.status === 'queued' || jobPayload.status === 'running') {
            jobPayload = await pollBulkOcrJobUntilTerminal(jobPayload.jobId, controller.signal);
          }

          if (jobPayload.status === 'failed') {
            throw new ApiError(
              jobPayload.error?.type ?? 'SERVER_ERROR',
              jobPayload.error?.message ?? 'OCR 泥섎━???ㅽ뙣?덉뒿?덈떎.',
              {
                status: jobPayload.error?.httpStatus,
                payload: jobPayload,
              },
            );
          }

          const createPayload = toBulkOcrCreatePayload(jobPayload.extractedFields, companyId);
          if (!createPayload) {
            throw new ApiError('VALIDATION_ERROR', 'OCR 寃곌낵?먯꽌 李⑤웾踰덊샇? 李⑤?踰덊샇瑜??뺤씤?????놁뒿?덈떎.', {
              status: 400,
              payload: jobPayload,
            });
          }

          const createdAsset = await createAsset(createPayload, { signal: controller.signal });
          const createdRecord = isRecord(createdAsset)
            ? createdAsset
            : (isRecord(createdAsset) && isRecord(createdAsset.data) ? createdAsset.data : null);
          const assetId = toStringValue(createdRecord?.id) ?? createPayload.vin;
          nextResults.push({
            fileName: file.name,
            status: 'success',
            message: '李⑤웾 ?먯궛 ?깅줉 ?꾨즺',
            assetId,
          });
          successCount += 1;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
          }

          nextResults.push({
            fileName: file.name,
            status: 'error',
            message: toErrorMessage(error, '?쇨큵 OCR ?낅줈??泥섎━???ㅽ뙣?덉뒿?덈떎.'),
          });
        }

        setBulkOcrResults([...nextResults]);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        toast.error(toErrorMessage(error, '대량 OCR 업로드 처리에 실패했습니다.'));
      }
    } finally {
      if (bulkOcrAbortControllerRef.current === controller) {
        bulkOcrAbortControllerRef.current = null;
      }
      setIsBulkOcrProcessing(false);
      setBulkOcrProgressMessage(files.length > 0 ? (successCount + ' / ' + files.length + ' 처리 완료') : null);
      void refreshCurrentDataCounts();
      if (successCount > 0) {
        toast.success('대량 OCR 등록 완료: ' + successCount + '건 성공');
      }
    }
  }, [canUseBulkOcr, isBulkOcrProcessing, pollBulkOcrJobUntilTerminal, refreshCurrentDataCounts, user?.companyId]);

  const requestSettingsHydration = useCallback(async (signal: AbortSignal): Promise<SettingsHydrationPayload> => {
    const invitationStatusFilterQuery = toInvitationStatusQuery(invitationStatusFilter);
    const [companyPayload, geofencesPayload, membersPayload, invitationsResult] = await Promise.all([
      getSettingsCompany({ signal, companyId: effectiveSettingsCompanyId ?? undefined }),
      listSettingsGeofences({ signal, companyId: effectiveSettingsCompanyId ?? undefined }),
      listSettingsMembers(undefined, { signal, companyId: effectiveSettingsCompanyId ?? undefined }),
      canManageMemberRoles
        ? listInvitations(invitationStatusFilterQuery, { signal, companyId: effectiveSettingsCompanyId ?? undefined })
            .then((payload) => ({ payload, error: null as string | null }))
            .catch((error: unknown) => {
              if (error instanceof DOMException && error.name === 'AbortError') {
                throw error;
              }
              return {
                payload: { items: [] },
                error: toErrorMessage(error, '珥덈? 紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??'),
              };
            })
        : Promise.resolve({ payload: { items: [] }, error: null as string | null }),
    ]);

    return {
      company: companyPayload,
      geofences: Array.isArray(geofencesPayload.items) ? geofencesPayload.items : [],
      members: Array.isArray(membersPayload.items) ? membersPayload.items : [],
      invitations: Array.isArray(invitationsResult.payload.items)
        ? sortInvitations(invitationsResult.payload.items)
        : [],
      invitationLoadError: invitationsResult.error,
    };
  }, [canManageMemberRoles, effectiveSettingsCompanyId, invitationStatusFilter]);

  const handleSettingsHydrationSuccess = useCallback((payload: SettingsHydrationPayload) => {
    const nextCompanyForm = toCompanyForm(payload.company);
    setCompanyForm(nextCompanyForm);
    setCompanyBaseline(nextCompanyForm);
    setCompanyUpdatedAt(toStringValue(payload.company.updatedAt));
    setCompanySchemaVersion(toStringValue(payload.company.schemaVersion) ?? DEFAULT_SETTINGS_SCHEMA_VERSION);
    setCompanyFieldErrors({});
    setCompanySaveError(null);
    setCompanySaveSuccess(null);
    setCompanyRetryAction(null);

    setGeofences(payload.geofences);
    setIsGeofenceEditorOpen(false);
    setGeofenceEditorMode('create');
    setEditingGeofenceId(null);
    setGeofenceForm(DEFAULT_GEOFENCE_FORM_STATE);
    setGeofenceFieldErrors({});
    setGeofenceSaveError(null);
    setGeofenceSaveSuccess(null);
    setGeofenceRetryAction(null);

    setMembers(payload.members);
    setMemberRoleDrafts({});
    setMemberFieldErrors({});
    setMemberSaveError(null);
    setMemberSaveSuccess(null);
    setMemberRetryAction(null);

    setInvitations(payload.invitations);
    setIsInvitationEditorOpen(false);
    setInvitationForm(DEFAULT_INVITATION_FORM_STATE);
    setInvitationFieldErrors({});
    setInvitationSaveError(payload.invitationLoadError);
    setInvitationSaveSuccess(null);
    setInvitationRetryAction(null);
  }, []);

  const isSettingsHydrationEmpty = useCallback(() => false, []);

  const {
    isLoading: isSettingsLoading,
    error: settingsError,
    errorKind: settingsErrorKind,
    run: hydrateSettings,
  } = usePageEndpointState<SettingsHydrationPayload>({
    request: requestSettingsHydration,
    onSuccess: handleSettingsHydrationSuccess,
    isEmpty: isSettingsHydrationEmpty,
  });

  useEffect(() => {
    if (isSuperAdmin && !effectiveSettingsCompanyId) {
      handleSettingsHydrationSuccess(createEmptySettingsHydrationPayload());
      return;
    }
    void hydrateSettings();
  }, [effectiveSettingsCompanyId, handleSettingsHydrationSuccess, hydrateSettings, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && !effectiveSettingsCompanyId) {
      return;
    }
    void refreshCurrentDataCounts();
  }, [effectiveSettingsCompanyId, isSuperAdmin, refreshCurrentDataCounts]);

  useEffect(() => () => {
    bulkOcrAbortControllerRef.current?.abort();
  }, []);

  const handleSettingsRetry = useCallback(() => {
    if (isSuperAdmin && !effectiveSettingsCompanyId) {
      return;
    }
    void hydrateSettings();
  }, [effectiveSettingsCompanyId, hydrateSettings, isSuperAdmin]);

  const handleSettingsErrorAction = useCallback(() => {
    handlePageErrorAction(settingsErrorKind, navigate);
  }, [navigate, settingsErrorKind]);

  const isCompanyDirty = useMemo(() => (
    companyForm.name.trim() !== companyBaseline.name.trim()
    || companyForm.businessNumber.trim() !== companyBaseline.businessNumber.trim()
    || companyForm.phone.trim() !== companyBaseline.phone.trim()
    || companyForm.email.trim() !== companyBaseline.email.trim()
    || companyForm.address.trim() !== companyBaseline.address.trim()
  ), [companyBaseline, companyForm]);

  const isGeofenceEditorDirty = useMemo(() => {
    if (!isGeofenceEditorOpen) {
      return false;
    }

    if (geofenceEditorMode === 'create') {
      return (
        Boolean(geofenceForm.name.trim())
        || geofenceForm.shape !== DEFAULT_GEOFENCE_FORM_STATE.shape
        || Boolean(geofenceForm.lat.trim())
        || Boolean(geofenceForm.lng.trim())
        || Boolean(geofenceForm.radiusMeter.trim())
        || Boolean(geofenceForm.pointsText.trim())
        || geofenceForm.active !== DEFAULT_GEOFENCE_FORM_STATE.active
      );
    }

    if (!selectedEditingGeofence) {
      return false;
    }

    const baseline = toGeofenceForm(selectedEditingGeofence);
    return (
      geofenceForm.shape !== baseline.shape
      ||
      geofenceForm.lat.trim() !== baseline.lat.trim()
      || geofenceForm.lng.trim() !== baseline.lng.trim()
      || geofenceForm.radiusMeter.trim() !== baseline.radiusMeter.trim()
      || geofenceForm.pointsText.trim() !== baseline.pointsText.trim()
      || geofenceForm.active !== baseline.active
    );
  }, [geofenceEditorMode, geofenceForm, isGeofenceEditorOpen, selectedEditingGeofence]);

  const hasPendingMemberRoleChanges = useMemo(() => members.some((member) => {
    const draftValue = memberRoleDrafts[member.userId];
    return typeof draftValue === 'string' && draftValue !== member.role;
  }), [memberRoleDrafts, members]);

  const isInvitationEditorDirty = useMemo(() => (
    Boolean(invitationForm.email.trim())
    || invitationForm.role !== DEFAULT_INVITATION_FORM_STATE.role
  ), [invitationForm.email, invitationForm.role]);

  const isAnySaving = (
    isCompanySaving
    || isGeofenceSaving
    || activeToggleTargetId !== null
    || deletingGeofenceId !== null
    || savingMemberId !== null
    || isInvitationSaving
    || resendingInvitationId !== null
  );

  const hasUnsavedChanges = (
    isCompanyDirty
    || isGeofenceEditorDirty
    || hasPendingMemberRoleChanges
    || (isInvitationEditorOpen && isInvitationEditorDirty)
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'geofence' || tabParam === 'accounts') {
      setActiveTab(tabParam);
      return;
    }

    setActiveTab('bulk');
  }, [searchParams]);

  useEffect(() => {
    if ((!hasUnsavedChanges && !isAnySaving) || typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isAnySaving]);

  const handleTabChange = useCallback((nextTab: TabType) => {
    if (nextTab === activeTab) {
      return;
    }

    if (isAnySaving) {
      toast.info('???以묒뿉????쓣 ?대룞?????놁뒿?덈떎.');
      return;
    }

    if (hasUnsavedChanges && typeof window !== 'undefined') {
      const shouldLeave = window.confirm('??ν븯吏 ?딆? 蹂寃??ы빆???덉뒿?덈떎. ??쓣 ?대룞?섏떆寃좎뒿?덇퉴?');
      if (!shouldLeave) {
        return;
      }
    }

    setActiveTab(nextTab);
  }, [activeTab, hasUnsavedChanges, isAnySaving]);

  const toCompanyPatchPayload = useCallback((): SettingsCompanyUpdateRequest => {
    const payload: SettingsCompanyUpdateRequest = {};

    const nextName = companyForm.name.trim();
    const nextBusinessNumber = companyForm.businessNumber.trim();
    const nextPhone = companyForm.phone.trim();
    const nextEmail = companyForm.email.trim();
    const nextAddress = companyForm.address.trim();

    if (nextName !== companyBaseline.name.trim()) {
      payload.name = nextName;
    }
    if (nextBusinessNumber !== companyBaseline.businessNumber.trim()) {
      payload.businessNumber = nextBusinessNumber;
    }
    if (nextPhone !== companyBaseline.phone.trim()) {
      payload.phone = nextPhone;
    }
    if (nextEmail !== companyBaseline.email.trim()) {
      payload.email = nextEmail;
    }
    if (nextAddress !== companyBaseline.address.trim()) {
      payload.address = nextAddress;
    }

    if (Object.keys(payload).length > 0) {
      payload.schemaVersion = companySchemaVersion;
    }

    return payload;
  }, [companyBaseline, companyForm, companySchemaVersion]);

  const handleCompanySave = useCallback(async () => {
    if (!canEditSettings || isCompanySaving) {
      return;
    }

    const clientErrors: FieldErrorMap<CompanyField> = {};
    if (!companyForm.name.trim()) {
      clientErrors.name = '?뚯궗紐낆쓣 ?낅젰??二쇱꽭??';
    }
    if (companyForm.email.trim().length > 0 && !companyForm.email.includes('@')) {
      clientErrors.email = '?좏슚???대찓???뺤떇???낅젰??二쇱꽭??';
    }

    if (Object.keys(clientErrors).length > 0) {
      setCompanyFieldErrors(clientErrors);
      setCompanySaveError('?낅젰媛믪쓣 ?뺤씤??二쇱꽭??');
      setCompanySaveSuccess(null);
      setCompanyRetryAction(null);
      return;
    }

    const payload = toCompanyPatchPayload();
    if (Object.keys(payload).length === 0) {
      toast.info('蹂寃쎈맂 ?뚯궗 ?뺣낫媛 ?놁뒿?덈떎.');
      return;
    }

    setIsCompanySaving(true);
    setCompanyFieldErrors({});
    setCompanySaveError(null);
    setCompanySaveSuccess(null);
    setCompanyRetryAction(null);

    try {
      const updatedCompany = await putSettingsCompany(payload, {
        companyId: effectiveSettingsCompanyId ?? undefined,
      });
      const nextForm = toCompanyForm(updatedCompany);
      setCompanyForm(nextForm);
      setCompanyBaseline(nextForm);
      setCompanyUpdatedAt(toStringValue(updatedCompany.updatedAt));
      setCompanySchemaVersion(toStringValue(updatedCompany.schemaVersion) ?? companySchemaVersion);
      setCompanySaveSuccess('?뚯궗 ?ㅼ젙????λ릺?덉뒿?덈떎.');
      toast.success('?뚯궗 ?ㅼ젙????λ릺?덉뒿?덈떎.');
      void refreshCompany();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          const mappedErrors = mapFieldErrors<CompanyField>(toErrorFieldEntries(error), {
            name: 'name',
            company: 'name',
            businessNumber: 'businessNumber',
            bizRegNo: 'businessNumber',
            phone: 'phone',
            email: 'email',
            address: 'address',
          });
          if (Object.keys(mappedErrors).length > 0) {
            setCompanyFieldErrors(mappedErrors);
          }
          setCompanySaveError(error.message || '?낅젰媛믪쓣 ?뺤씤??二쇱꽭??');
          return;
        }
        if (error.status === 403) {
          setCompanySaveError('?뚯궗 ?ㅼ젙 ?섏젙 沅뚰븳???놁뒿?덈떎. 愿由ъ옄?먭쾶 沅뚰븳???붿껌??二쇱꽭??');
          return;
        }
        if (error.status === 409) {
          setCompanySaveError('?ㅻⅨ ?ъ슜?먯쓽 蹂寃쎌궗??낵 異⑸룎?덉뒿?덈떎. 理쒖떊 ?ㅼ젙???ㅼ떆 遺덈윭?듬땲??');
          setCompanyRetryAction(null);
          void hydrateSettings();
          return;
        }
        if (isRetryableMutationError(error)) {
          setCompanySaveError('?쇱떆?곸씤 ?ㅻ쪟濡???μ뿉 ?ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
          setCompanyRetryAction(() => () => {
            void handleCompanySave();
          });
          return;
        }
      }

      setCompanySaveError(toErrorMessage(error, '?뚯궗 ?ㅼ젙 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎.'));
    } finally {
      setIsCompanySaving(false);
    }
  }, [
    canEditSettings,
    companyForm,
    companySchemaVersion,
    hydrateSettings,
    isCompanySaving,
    refreshCompany,
    effectiveSettingsCompanyId,
    toCompanyPatchPayload,
  ]);

  const handleCompanyReset = useCallback(() => {
    if (isCompanySaving) {
      return;
    }
    setCompanyForm(companyBaseline);
    setCompanyFieldErrors({});
    setCompanySaveError(null);
    setCompanySaveSuccess(null);
    setCompanyRetryAction(null);
  }, [companyBaseline, isCompanySaving]);

  const openCreateGeofenceEditor = useCallback(() => {
    if (!canEditSettings) {
      return;
    }
    setGeofenceEditorMode('create');
    setEditingGeofenceId(null);
    setGeofenceForm(DEFAULT_GEOFENCE_FORM_STATE);
    setGeofenceFieldErrors({});
    setGeofenceSaveError(null);
    setGeofenceSaveSuccess(null);
    setGeofenceRetryAction(null);
    setIsGeofenceEditorOpen(true);
  }, [canEditSettings]);

  const openEditGeofenceEditor = useCallback((geofence: SettingsGeofence) => {
    if (!canEditSettings) {
      return;
    }
    setGeofenceEditorMode('edit');
    setEditingGeofenceId(geofence.id);
    setGeofenceForm(toGeofenceForm(geofence));
    setGeofenceFieldErrors({});
    setGeofenceSaveError(null);
    setGeofenceSaveSuccess(null);
    setGeofenceRetryAction(null);
    setIsGeofenceEditorOpen(true);
  }, [canEditSettings]);

  const closeGeofenceEditor = useCallback(() => {
    if (isGeofenceSaving) {
      return;
    }
    if (isGeofenceEditorDirty && typeof window !== 'undefined') {
      const shouldClose = window.confirm('??ν븯吏 ?딆? 吏?ㅽ렂??蹂寃??ы빆???덉뒿?덈떎. ?レ쑝?쒓쿋?듬땲源?');
      if (!shouldClose) {
        return;
      }
    }

    setIsGeofenceEditorOpen(false);
    setGeofenceEditorMode('create');
    setEditingGeofenceId(null);
    setGeofenceForm(DEFAULT_GEOFENCE_FORM_STATE);
    setGeofenceFieldErrors({});
    setGeofenceSaveError(null);
    setGeofenceRetryAction(null);
  }, [isGeofenceEditorDirty, isGeofenceSaving]);

  const handleGeofenceSave = useCallback(async () => {
    if (!canEditSettings || isGeofenceSaving) {
      return;
    }

    const fieldErrors: FieldErrorMap<GeofenceField> = {};
    const trimmedName = geofenceForm.name.trim();
    const latValue = toNumberValue(geofenceForm.lat.trim());
    const lngValue = toNumberValue(geofenceForm.lng.trim());
    const radiusValue = toNumberValue(geofenceForm.radiusMeter.trim());
    const parsedPolygon = geofenceForm.shape === 'polygon'
      ? parseGeofencePolygonPoints(geofenceForm.pointsText)
      : { points: [], error: null };
    if (geofenceForm.shape === 'polygon' && parsedPolygon.error) {
      fieldErrors.pointsText = parsedPolygon.error;
    }

    if (geofenceEditorMode === 'create' && !trimmedName) {
      fieldErrors.name = '吏?ㅽ렂???대쫫???낅젰??二쇱꽭??';
    }
    if (geofenceForm.shape !== 'polygon' && latValue === null) {
      fieldErrors.lat = '?꾨룄 媛믪쓣 ?낅젰??二쇱꽭??';
    }
    if (geofenceForm.shape !== 'polygon' && lngValue === null) {
      fieldErrors.lng = '寃쎈룄 媛믪쓣 ?낅젰??二쇱꽭??';
    }
    if (geofenceForm.shape !== 'polygon' && (radiusValue === null || !Number.isInteger(radiusValue) || radiusValue <= 0)) {
      fieldErrors.radiusMeter = '諛섍꼍? 1 ?댁긽???뺤닔(m)濡??낅젰??二쇱꽭??';
    }

    if (Object.keys(fieldErrors).length > 0) {
      setGeofenceFieldErrors(fieldErrors);
      setGeofenceSaveError('?낅젰媛믪쓣 ?뺤씤??二쇱꽭??');
      setGeofenceSaveSuccess(null);
      setGeofenceRetryAction(null);
      return;
    }

    if (geofenceForm.shape !== 'polygon' && (latValue === null || lngValue === null || radiusValue === null)) {
      return;
    }

    let mutationTask: Promise<SettingsGeofence>;
    if (geofenceEditorMode === 'create') {
      mutationTask = geofenceForm.shape === 'polygon'
        ? createSettingsGeofence({
          name: trimmedName,
          points: parsedPolygon.points,
          active: geofenceForm.active,
        }, {
          companyId: effectiveSettingsCompanyId ?? undefined,
        })
        : createSettingsGeofence({
          name: trimmedName,
          center: {
          lat: latValue!,
          lng: lngValue!,
          },
          radiusMeter: radiusValue!,
          active: geofenceForm.active,
        }, {
          companyId: effectiveSettingsCompanyId ?? undefined,
        });
    } else {
      if (!editingGeofenceId || !selectedEditingGeofence) {
        setGeofenceSaveError('?몄쭛 ??곸쓣 李얠쓣 ???놁뒿?덈떎. 紐⑸줉???덈줈怨좎묠??二쇱꽭??');
        return;
      }

      const payload: {
        center?: { lat: number; lng: number };
        radiusMeter?: number;
        points?: SettingsGeofencePoint[];
        active?: boolean;
      } = {};
      if (geofenceForm.shape === 'polygon' && !areGeofencePointsEqual(selectedEditingGeofence.points, parsedPolygon.points)) {
        payload.points = parsedPolygon.points;
      }

      if (
        geofenceForm.shape !== 'polygon'
        && (
          selectedEditingGeofence.center.lat !== latValue
          || selectedEditingGeofence.center.lng !== lngValue
        )
      ) {
        payload.center = {
          lat: latValue!,
          lng: lngValue!,
        };
      }
      if (geofenceForm.shape !== 'polygon' && selectedEditingGeofence.radiusMeter !== radiusValue) {
        payload.radiusMeter = radiusValue!;
      }
      if (selectedEditingGeofence.active !== geofenceForm.active) {
        payload.active = geofenceForm.active;
      }

      if (Object.keys(payload).length === 0) {
        toast.info('蹂寃쎈맂 吏?ㅽ렂???뺣낫媛 ?놁뒿?덈떎.');
        return;
      }

      mutationTask = updateSettingsGeofence(editingGeofenceId, payload, {
        companyId: effectiveSettingsCompanyId ?? undefined,
      });
    }

    setIsGeofenceSaving(true);
    setGeofenceFieldErrors({});
    setGeofenceSaveError(null);
    setGeofenceSaveSuccess(null);
    setGeofenceRetryAction(null);

    try {
      const savedGeofence = await mutationTask;
      setGeofences((prevItems) => {
        const existingIndex = prevItems.findIndex((item) => item.id === savedGeofence.id);
        if (existingIndex < 0) {
          return [...prevItems, savedGeofence];
        }

        const nextItems = [...prevItems];
        nextItems[existingIndex] = savedGeofence;
        return nextItems;
      });

      setGeofenceSaveSuccess(
        geofenceEditorMode === 'create'
          ? '吏?ㅽ렂?ㅺ? ?앹꽦?섏뿀?듬땲??'
          : '吏?ㅽ렂?ㅺ? ??λ릺?덉뒿?덈떎.',
      );
      toast.success(
        geofenceEditorMode === 'create'
          ? '吏?ㅽ렂?ㅺ? ?앹꽦?섏뿀?듬땲??'
          : '吏?ㅽ렂?ㅺ? ??λ릺?덉뒿?덈떎.',
      );

      setIsGeofenceEditorOpen(false);
      setGeofenceEditorMode('create');
      setEditingGeofenceId(null);
      setGeofenceForm(DEFAULT_GEOFENCE_FORM_STATE);
      setGeofenceFieldErrors({});
      setGeofenceRetryAction(null);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          const mappedErrors = mapFieldErrors<GeofenceField>(toErrorFieldEntries(error), {
            name: 'name',
            'center.lat': 'lat',
            lat: 'lat',
            'center.lng': 'lng',
            lng: 'lng',
            radiusMeter: 'radiusMeter',
            points: 'pointsText',
          });
          if (Object.keys(mappedErrors).length > 0) {
            setGeofenceFieldErrors(mappedErrors);
          }
          setGeofenceSaveError(error.message || '?낅젰媛믪쓣 ?뺤씤??二쇱꽭??');
          return;
        }
        if (error.status === 403) {
          setGeofenceSaveError('吏?ㅽ렂???섏젙 沅뚰븳???놁뒿?덈떎. 愿由ъ옄?먭쾶 沅뚰븳???붿껌??二쇱꽭??');
          return;
        }
        if (error.status === 409) {
          setGeofenceSaveError('?ㅻⅨ ?ъ슜??蹂寃쎌궗??낵 異⑸룎?덉뒿?덈떎. 理쒖떊 紐⑸줉???ㅼ떆 遺덈윭?듬땲??');
          setGeofenceRetryAction(null);
          void hydrateGeofencesOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setGeofenceSaveError('?쇱떆?곸씤 ?ㅻ쪟濡???μ뿉 ?ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
          setGeofenceRetryAction(() => () => {
            void handleGeofenceSave();
          });
          return;
        }
      }

      setGeofenceSaveError(toErrorMessage(error, '吏?ㅽ렂????μ뿉 ?ㅽ뙣?덉뒿?덈떎.'));
    } finally {
      setIsGeofenceSaving(false);
    }
  }, [
    canEditSettings,
    editingGeofenceId,
    geofenceEditorMode,
    geofenceForm,
    hydrateGeofencesOnly,
    isGeofenceSaving,
    effectiveSettingsCompanyId,
    selectedEditingGeofence,
  ]);

  const runGeofenceToggle = useCallback(async (geofenceId: string, nextActive: boolean) => {
    if (!canEditSettings) {
      return;
    }
    setActiveToggleTargetId(geofenceId);
    setGeofenceSaveError(null);
    setGeofenceSaveSuccess(null);
    setGeofenceRetryAction(null);

    try {
      const updated = await updateSettingsGeofence(geofenceId, { active: nextActive }, {
        companyId: effectiveSettingsCompanyId ?? undefined,
      });
      setGeofences((prevItems) => prevItems.map((item) => (
        item.id === geofenceId ? updated : item
      )));
      setGeofenceSaveSuccess('吏?ㅽ렂???쒖꽦 ?곹깭媛 ?낅뜲?댄듃?섏뿀?듬땲??');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setGeofenceSaveError('吏?ㅽ렂???쒖꽦 ?곹깭瑜?蹂寃쏀븷 沅뚰븳???놁뒿?덈떎.');
          return;
        }
        if (error.status === 409) {
          setGeofenceSaveError('異⑸룎??諛쒖깮??理쒖떊 吏?ㅽ렂??紐⑸줉???ㅼ떆 遺덈윭?듬땲??');
          void hydrateGeofencesOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setGeofenceSaveError('?쇱떆?곸씤 ?ㅻ쪟濡??쒖꽦 ?곹깭 蹂寃쎌뿉 ?ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
          setGeofenceRetryAction(() => () => {
            void runGeofenceToggle(geofenceId, nextActive);
          });
          return;
        }
      }
      setGeofenceSaveError(toErrorMessage(error, '吏?ㅽ렂???쒖꽦 ?곹깭瑜?蹂寃쏀븯吏 紐삵뻽?듬땲??'));
    } finally {
      setActiveToggleTargetId(null);
    }
  }, [canEditSettings, effectiveSettingsCompanyId, hydrateGeofencesOnly]);

  const handleGeofenceToggle = useCallback((geofence: SettingsGeofence) => {
    if (!canEditSettings || activeToggleTargetId !== null || isGeofenceSaving) {
      return;
    }
    void runGeofenceToggle(geofence.id, !geofence.active);
  }, [activeToggleTargetId, canEditSettings, isGeofenceSaving, runGeofenceToggle]);

  const runGeofenceDelete = useCallback(async (geofenceId: string) => {
    if (!canEditSettings) {
      return;
    }
    setDeletingGeofenceId(geofenceId);
    setGeofenceSaveError(null);
    setGeofenceSaveSuccess(null);
    setGeofenceRetryAction(null);

    try {
      await deleteSettingsGeofence(geofenceId, {
        companyId: effectiveSettingsCompanyId ?? undefined,
      });
      setGeofences((prevItems) => prevItems.filter((item) => item.id !== geofenceId));
      setGeofenceSaveSuccess('吏?ㅽ렂?ㅺ? ??젣?섏뿀?듬땲??');
      if (editingGeofenceId === geofenceId) {
        setIsGeofenceEditorOpen(false);
        setEditingGeofenceId(null);
        setGeofenceEditorMode('create');
        setGeofenceForm(DEFAULT_GEOFENCE_FORM_STATE);
      }
      toast.success('吏?ㅽ렂?ㅺ? ??젣?섏뿀?듬땲??');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setGeofenceSaveError('吏?ㅽ렂????젣 沅뚰븳???놁뒿?덈떎.');
          return;
        }
        if (error.status === 409) {
          setGeofenceSaveError('異⑸룎??諛쒖깮??理쒖떊 吏?ㅽ렂??紐⑸줉???ㅼ떆 遺덈윭?듬땲??');
          void hydrateGeofencesOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setGeofenceSaveError('?쇱떆?곸씤 ?ㅻ쪟濡???젣???ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
          setGeofenceRetryAction(() => () => {
            void runGeofenceDelete(geofenceId);
          });
          return;
        }
      }
      setGeofenceSaveError(toErrorMessage(error, '吏?ㅽ렂????젣???ㅽ뙣?덉뒿?덈떎.'));
    } finally {
      setDeletingGeofenceId(null);
    }
  }, [canEditSettings, editingGeofenceId, effectiveSettingsCompanyId, hydrateGeofencesOnly]);

  const handleGeofenceDelete = useCallback((geofenceId: string) => {
    if (!canEditSettings || deletingGeofenceId !== null || isGeofenceSaving) {
      return;
    }

    if (typeof window !== 'undefined') {
      const shouldDelete = window.confirm('?대떦 吏?ㅽ렂?ㅻ? ??젣?섏떆寃좎뒿?덇퉴?');
      if (!shouldDelete) {
        return;
      }
    }

    void runGeofenceDelete(geofenceId);
  }, [canEditSettings, deletingGeofenceId, isGeofenceSaving, runGeofenceDelete]);

  const handleMemberRoleChange = useCallback((memberId: string, role: 'admin' | 'member' | 'viewer') => {
    setMemberRoleDrafts((prevDrafts) => ({
      ...prevDrafts,
      [memberId]: role,
    }));
    setMemberFieldErrors((prevErrors) => {
      const nextErrors = { ...prevErrors };
      delete nextErrors[memberId];
      return nextErrors;
    });
    setMemberSaveError(null);
    setMemberSaveSuccess(null);
    setMemberRetryAction(null);
  }, []);

  const runMemberRoleSave = useCallback(async (memberId: string, role: 'admin' | 'member' | 'viewer') => {
    if (!canManageMemberRoles) {
      return;
    }

    setSavingMemberId(memberId);
    setMemberFieldErrors((prevErrors) => {
      const nextErrors = { ...prevErrors };
      delete nextErrors[memberId];
      return nextErrors;
    });
    setMemberSaveError(null);
    setMemberSaveSuccess(null);
    setMemberRetryAction(null);

    try {
      const updatedMember = await patchSettingsMemberRole(memberId, { role }, {
        companyId: effectiveSettingsCompanyId ?? undefined,
      });
      setMembers((prevMembers) => prevMembers.map((member) => (
        member.userId === memberId ? updatedMember : member
      )));
      setMemberRoleDrafts((prevDrafts) => {
        const nextDrafts = { ...prevDrafts };
        delete nextDrafts[memberId];
        return nextDrafts;
      });
      setMemberSaveSuccess('硫ㅻ쾭 沅뚰븳????λ릺?덉뒿?덈떎.');
      toast.success('硫ㅻ쾭 沅뚰븳????λ릺?덉뒿?덈떎.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          const mappedErrors = mapFieldErrors<MemberRoleField>(toErrorFieldEntries(error), {
            role: 'role',
          });
          const fieldMessage = mappedErrors.role ?? error.message ?? '?낅젰媛믪쓣 ?뺤씤??二쇱꽭??';
          setMemberFieldErrors((prevErrors) => ({
            ...prevErrors,
            [memberId]: fieldMessage,
          }));
          setMemberSaveError(fieldMessage);
          return;
        }
        if (error.status === 403) {
          setMemberSaveError('硫ㅻ쾭 沅뚰븳??蹂寃쏀븷 沅뚰븳???놁뒿?덈떎.');
          return;
        }
        if (error.status === 409) {
          setMemberSaveError('沅뚰븳 蹂寃?異⑸룎??諛쒖깮??理쒖떊 硫ㅻ쾭 紐⑸줉???ㅼ떆 遺덈윭?듬땲??');
          void hydrateMembersOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setMemberSaveError('?쇱떆?곸씤 ?ㅻ쪟濡?沅뚰븳 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
          setMemberRetryAction(() => () => {
            void runMemberRoleSave(memberId, role);
          });
          return;
        }
      }

      setMemberSaveError(toErrorMessage(error, '硫ㅻ쾭 沅뚰븳 ??μ뿉 ?ㅽ뙣?덉뒿?덈떎.'));
    } finally {
      setSavingMemberId(null);
    }
  }, [canManageMemberRoles, effectiveSettingsCompanyId, hydrateMembersOnly]);

  const handleMemberRoleSave = useCallback((memberId: string) => {
    const originalMember = members.find((member) => member.userId === memberId);
    if (!originalMember) {
      return;
    }

    const nextRoleValue = memberRoleDrafts[memberId] ?? originalMember.role;
    if (nextRoleValue !== 'admin' && nextRoleValue !== 'member') {
      setMemberFieldErrors((prevErrors) => ({
        ...prevErrors,
        [memberId]: 'role 媛믪? admin ?먮뒗 member留??덉슜?⑸땲??',
      }));
      return;
    }

    if (nextRoleValue === originalMember.role) {
      toast.info('蹂寃쎈맂 沅뚰븳???놁뒿?덈떎.');
      return;
    }

    void runMemberRoleSave(memberId, nextRoleValue);
  }, [memberRoleDrafts, members, runMemberRoleSave]);

  const handleMemberRoleReset = useCallback((memberId: string) => {
    setMemberRoleDrafts((prevDrafts) => {
      const nextDrafts = { ...prevDrafts };
      delete nextDrafts[memberId];
      return nextDrafts;
    });
    setMemberFieldErrors((prevErrors) => {
      const nextErrors = { ...prevErrors };
      delete nextErrors[memberId];
      return nextErrors;
    });
  }, []);

  const runMemberStatusSave = useCallback(async (memberId: string, status: 'approved' | 'rejected') => {
    if (!canManageMemberRoles) {
      return;
    }

    setSavingMemberId(memberId);
    setMemberFieldErrors((prevErrors) => {
      const nextErrors = { ...prevErrors };
      delete nextErrors[memberId];
      return nextErrors;
    });
    setMemberSaveError(null);
    setMemberSaveSuccess(null);
    setMemberRetryAction(null);

    try {
      const payload = status === 'approved'
        ? { status: 'approved' as const }
        : { status: 'rejected' as const };
      const updatedMember = await patchSettingsMemberStatus(memberId, payload, {
        companyId: effectiveSettingsCompanyId ?? undefined,
      });
      setMembers((prevMembers) => prevMembers.map((member) => (
        member.userId === memberId ? updatedMember : member
      )));
      setMemberRoleDrafts((prevDrafts) => {
        const nextDrafts = { ...prevDrafts };
        delete nextDrafts[memberId];
        return nextDrafts;
      });

      const successMessage = status === 'approved'
        ? '媛???湲?怨꾩젙???뱀씤?덉뒿?덈떎.'
        : '媛???湲?怨꾩젙??嫄곗젅?덉뒿?덈떎.';
      setMemberSaveSuccess(successMessage);
      toast.success(successMessage);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          const mappedErrors = mapFieldErrors<'status'>(toErrorFieldEntries(error), {
            status: 'status',
          });
          const fieldMessage = mappedErrors.status ?? error.message ?? '?낅젰媛믪쓣 ?뺤씤??二쇱꽭??';
          setMemberFieldErrors((prevErrors) => ({
            ...prevErrors,
            [memberId]: fieldMessage,
          }));
          setMemberSaveError(fieldMessage);
          return;
        }
        if (error.status === 403) {
          setMemberSaveError('媛???뱀씤 ?곹깭瑜?蹂寃쏀븷 沅뚰븳???놁뒿?덈떎.');
          return;
        }
        if (error.status === 404 || error.status === 409) {
          setMemberSaveError(error.message || '硫ㅻ쾭 ?곹깭媛 蹂寃쎈릺??理쒖떊 紐⑸줉???ㅼ떆 遺덈윭?듬땲??');
          void hydrateMembersOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setMemberSaveError('?쇱떆?곸씤 ?ㅻ쪟濡?媛???뱀씤 泥섎━???ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
          setMemberRetryAction(() => () => {
            void runMemberStatusSave(memberId, status);
          });
          return;
        }
      }

      setMemberSaveError(toErrorMessage(error, '硫ㅻ쾭 ?곹깭 蹂寃쎌뿉 ?ㅽ뙣?덉뒿?덈떎.'));
    } finally {
      setSavingMemberId(null);
    }
  }, [canManageMemberRoles, effectiveSettingsCompanyId, hydrateMembersOnly]);

  const openInvitationEditor = useCallback(() => {
    if (!canManageMemberRoles || isInvitationSaving || resendingInvitationId !== null) {
      return;
    }

    setIsInvitationEditorOpen(true);
    setInvitationForm(DEFAULT_INVITATION_FORM_STATE);
    setInvitationFieldErrors({});
    setInvitationSaveError(null);
    setInvitationSaveSuccess(null);
    setInvitationRetryAction(null);
  }, [canManageMemberRoles, isInvitationSaving, resendingInvitationId]);

  const closeInvitationEditor = useCallback(() => {
    if (isInvitationSaving) {
      return;
    }

    setIsInvitationEditorOpen(false);
    setInvitationForm(DEFAULT_INVITATION_FORM_STATE);
    setInvitationFieldErrors({});
  }, [isInvitationSaving]);

  const handleInvitationFieldChange = useCallback((field: InvitationField, value: string) => {
    setInvitationForm((prevState) => ({
      ...prevState,
      [field]: value,
    }));
    setInvitationFieldErrors((prevErrors) => ({
      ...prevErrors,
      [field]: undefined,
    }));
    setInvitationSaveError(null);
    setInvitationSaveSuccess(null);
    setInvitationRetryAction(null);
  }, []);

  const runInvitationCreate = useCallback(async (draft: InvitationFormState) => {
    if (!canManageMemberRoles) {
      return;
    }

    setIsInvitationSaving(true);
    setInvitationFieldErrors({});
    setInvitationSaveError(null);
    setInvitationSaveSuccess(null);
    setInvitationRetryAction(null);

    try {
      const createdInvitation = await createInvitation(
        buildInvitationCreatePayload(draft, effectiveSettingsCompanyId),
        {
          companyId: effectiveSettingsCompanyId ?? undefined,
        },
      );
      setInvitations((prevInvitations) => (
        invitationMatchesStatusFilter(createdInvitation, invitationStatusFilter)
          ? upsertPendingInvitation(prevInvitations, createdInvitation)
          : prevInvitations.filter((item) => item.id !== createdInvitation.id)
      ));
      setInvitationForm(DEFAULT_INVITATION_FORM_STATE);
      setIsInvitationEditorOpen(false);
      setInvitationSaveSuccess('珥덈? 硫붿씪??諛쒖넚?덉뒿?덈떎.');
      toast.success('珥덈? 硫붿씪??諛쒖넚?덉뒿?덈떎.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          const mappedErrors = mapFieldErrors<InvitationField>(toErrorFieldEntries(error), {
            email: 'email',
            role: 'role',
            companyId: 'companyId',
          });
          setInvitationFieldErrors(mappedErrors);
          setInvitationSaveError(error.message ?? '?낅젰媛믪쓣 ?뺤씤??二쇱꽭??');
          return;
        }
        if (error.status === 403) {
          setInvitationSaveError('珥덈? ?앹꽦 沅뚰븳???놁뒿?덈떎.');
          return;
        }
        if (error.status === 409) {
          setInvitationFieldErrors((prevErrors) => ({
            ...prevErrors,
            email: error.message || '?대? 媛?낅릺?덇굅??珥덈?媛 吏꾪뻾 以묒씤 ?ъ슜?먯엯?덈떎.',
          }));
          setInvitationSaveError(error.message || '?대? 媛?낅릺?덇굅??珥덈?媛 吏꾪뻾 以묒씤 ?ъ슜?먯엯?덈떎.');
          void hydrateInvitationsOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setInvitationSaveError('?쇱떆?곸씤 ?ㅻ쪟濡?珥덈? ?앹꽦???ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
          setInvitationRetryAction(() => () => {
            void runInvitationCreate(draft);
          });
          return;
        }
      }

      setInvitationSaveError(toErrorMessage(error, '珥덈? ?앹꽦???ㅽ뙣?덉뒿?덈떎.'));
    } finally {
      setIsInvitationSaving(false);
    }
  }, [canManageMemberRoles, effectiveSettingsCompanyId, hydrateInvitationsOnly, invitationStatusFilter]);

  const handleInvitationCreate = useCallback(() => {
    const validationErrors = validateInvitationDraft(invitationForm, {
      isSuperAdmin,
      companyId: effectiveSettingsCompanyId,
    });
    if (Object.keys(validationErrors).length > 0) {
      setInvitationFieldErrors(validationErrors);
      return;
    }

    void runInvitationCreate(invitationForm);
  }, [effectiveSettingsCompanyId, invitationForm, isSuperAdmin, runInvitationCreate]);

  const runInvitationResend = useCallback(async (invitationId: string) => {
    if (!canManageMemberRoles) {
      return;
    }

    setResendingInvitationId(invitationId);
    setInvitationSaveError(null);
    setInvitationSaveSuccess(null);
    setInvitationRetryAction(null);

    try {
      const resentInvitation = await resendInvitation(invitationId, {
        companyId: effectiveSettingsCompanyId ?? undefined,
      });
      setInvitations((prevInvitations) => (
        invitationMatchesStatusFilter(resentInvitation, invitationStatusFilter)
          ? upsertPendingInvitation(prevInvitations, resentInvitation)
          : prevInvitations.filter((item) => item.id !== resentInvitation.id)
      ));
      setInvitationSaveSuccess('珥덈?瑜??щ컻?≫뻽?듬땲??');
      toast.success('珥덈?瑜??щ컻?≫뻽?듬땲??');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setInvitationSaveError('珥덈? ?щ컻??沅뚰븳???놁뒿?덈떎.');
          return;
        }
        if (error.status === 404 || error.status === 409) {
          setInvitationSaveError(error.message || '珥덈? ?곹깭媛 蹂寃쎈릺??紐⑸줉???ㅼ떆 遺덈윭?듬땲??');
          void hydrateInvitationsOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setInvitationSaveError('?쇱떆?곸씤 ?ㅻ쪟濡?珥덈? ?щ컻?≪뿉 ?ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
          setInvitationRetryAction(() => () => {
            void runInvitationResend(invitationId);
          });
          return;
        }
      }

      setInvitationSaveError(toErrorMessage(error, '珥덈? ?щ컻?≪뿉 ?ㅽ뙣?덉뒿?덈떎.'));
    } finally {
      setResendingInvitationId(null);
    }
  }, [canManageMemberRoles, effectiveSettingsCompanyId, hydrateInvitationsOnly, invitationStatusFilter]);

  const handleInvitationResend = useCallback((invitationId: string) => {
    if (isInvitationSaving || resendingInvitationId !== null) {
      return;
    }
    void runInvitationResend(invitationId);
  }, [isInvitationSaving, resendingInvitationId, runInvitationResend]);

  // CSV ?쒗뵆由??ㅼ슫濡쒕뱶
  const downloadTemplate = (type: UploadType) => {
    let csv = '';
    let filename = '';

    if (type === 'vehicles') {
      csv = '李⑤웾踰덊샇,李⑥쥌,?곹깭,蹂댄뿕留뚮즺???뺢린寃?ъ씪,李⑤?踰덊샇,?곗떇,?뚯쑀??n';
      csv += '12媛3456,洹몃옖?,媛??2025-12-31,2025-06-30,KMHXX00XXXX000001,2023,?뚰꽣移?二?\n';
      csv += '34??678,?섎굹?,媛??2025-11-30,2025-05-31,KMHXX00XXXX000002,2022,?뚰꽣移?二?\n';
      filename = 'vehicle_template.csv';
    } else {
      csv = '?덉빟ID,李⑤웾踰덊샇,怨좉컼紐??쒖옉??醫낅즺???좏삎,?꾪솕踰덊샇,寃곗젣諛⑸쾿,湲덉븸,?좉툑\n';
      templateReservations.slice(0, 10).forEach((reservation) => {
        const reservationType = reservation.type === 'rental'
          ? '??ъ쨷'
          : reservation.type === 'reservation'
            ? '?덉빟'
            : '諛섎궔?꾨즺';
        csv += `${reservation.id},${reservation.vehicleNumber},${reservation.customer},${reservation.startDateFull},${reservation.endDateFull},${reservationType},${reservation.phone},${reservation.paymentMethod},${reservation.amount},${reservation.deposit}\n`;
      });
      filename = 'reservation_template.csv';
    }

    triggerCsvDownload(filename, csv.trimEnd().split('\n'));
  };

  const fetchAllCurrentDataRows = useCallback(async (type: CurrentDataType): Promise<{ rows: unknown[]; totalCount: number }> => {
    const allRows: unknown[] = [];
    let page = 1;
    let expectedTotalCount: number | null = null;
    const preferredKeys = type === 'vehicles'
      ? ['assets', 'items', 'rows', 'list']
      : ['reservations', 'items', 'rows', 'list'];

    while (true) {
      const payload = type === 'vehicles'
        ? await getAssetsList({ page, size: CURRENT_DATA_PAGE_SIZE })
        : await getReservationsList({ page, size: CURRENT_DATA_PAGE_SIZE });
      const rows = getCollectionFromPayload(payload, preferredKeys) ?? [];
      const knownTotalCount = getKnownTotalCountFromPayload(payload);

      if (knownTotalCount !== null) {
        expectedTotalCount = expectedTotalCount === null
          ? knownTotalCount
          : Math.max(expectedTotalCount, knownTotalCount);
      }
      if (rows.length === 0) {
        break;
      }

      allRows.push(...rows);
      if (
        (expectedTotalCount !== null && allRows.length >= expectedTotalCount)
        || rows.length < CURRENT_DATA_PAGE_SIZE
      ) {
        break;
      }

      page += 1;
    }

    return {
      rows: allRows,
      totalCount: Math.max(expectedTotalCount ?? allRows.length, allRows.length),
    };
  }, []);

  // ?꾩옱 ?곗씠???ㅼ슫濡쒕뱶
  const downloadCurrentData = useCallback(async (type: CurrentDataType) => {
    if (activeCurrentDownloadType) {
      return;
    }

    setActiveCurrentDownloadType(type);
    try {
      const { rows, totalCount } = await fetchAllCurrentDataRows(type);

      if (type === 'vehicles') {
        setCurrentVehicleCount(totalCount);
        const lines = [
          '차량번호,차종,상태,보험만료일,정기검사일,차대번호,연식,보유사',
          ...rows.map((row) => {
            const value = isRecord(row) ? row : {};
            const vehicleNumber = toStringValue(value.vehicleNumber)
              ?? toStringValue(value.plate)
              ?? toStringValue(value.plateNumber)
              ?? '';
            const model = toStringValue(value.model) ?? toStringValue(value.vehicleModel) ?? '';
            const status = toStringValue(value.status) ?? toStringValue(value.assetStatus) ?? toStringValue(value.contractStatus) ?? '';
            const insuranceExpiry = toStringValue(value.insuranceExpiry) ?? toStringValue(value.insuranceExpiryDate) ?? '';
            const nextInspection = toStringValue(value.nextInspection) ?? toStringValue(value.nextInspectionDate) ?? '';
            const vin = toStringValue(value.vin) ?? toStringValue(value.chassisNumber) ?? '';
            const year = toStringValue(value.year) ?? toStringValue(value.modelYear) ?? '';
            const owner = toStringValue(value.owner) ?? toStringValue(value.ownerName) ?? '';
            return [vehicleNumber, model, status, insuranceExpiry, nextInspection, vin, year, owner]
              .map((cell) => toCsvCell(cell))
              .join(',');
          }),
        ];

        triggerCsvDownload('vehicles_current.csv', lines);
      } else {
        setCurrentReservationCount(totalCount);
        const lines = [
          '예약ID,차량번호,고객명,시작일,종료일,유형,전화번호,결제방법,금액,보증금',
          ...rows.map((row) => {
            const value = isRecord(row) ? row : {};
            const reservationId = toStringValue(value.id) ?? toStringValue(value.reservationId) ?? toStringValue(value.rentalId) ?? '';
            const vehicleNumber = toStringValue(value.vehicleNumber)
              ?? toStringValue(value.plate)
              ?? toStringValue(value.plateNumber)
              ?? '';
            const customerName = toStringValue(value.customerName) ?? toStringValue(value.customer) ?? toStringValue(value.userName) ?? '';
            const startDate = toStringValue(value.startAt) ?? toStringValue(value.startDateFull) ?? toStringValue(value.startDate) ?? toStringValue(value.from) ?? '';
            const endDate = toStringValue(value.endAt) ?? toStringValue(value.endDateFull) ?? toStringValue(value.endDate) ?? toStringValue(value.to) ?? '';
            const reservationType = toReservationTypeLabel(value.type ?? value.contractStatus ?? value.status);
            const phone = toStringValue(value.phone) ?? toStringValue(value.customerPhone) ?? '';
            const paymentMethod = toStringValue(value.paymentMethod) ?? toStringValue(value.paymentType) ?? '';
            const amount = toStringValue(value.amount) ?? '';
            const deposit = toStringValue(value.deposit) ?? '';
            return [reservationId, vehicleNumber, customerName, startDate, endDate, reservationType, phone, paymentMethod, amount, deposit]
              .map((cell) => toCsvCell(cell))
              .join(',');
          }),
        ];

        triggerCsvDownload('reservations_current.csv', lines);
      }

      if (rows.length === 0) {
        toast.info('?ㅼ슫濡쒕뱶???꾩옱 ?곗씠?곌? ?놁뒿?덈떎. ?ㅻ뜑留??ы븿??CSV媛 ?앹꽦?섏뿀?듬땲??');
      }
    } catch (error) {
      toast.error(toErrorMessage(error, '?꾩옱 ?곗씠???ㅼ슫濡쒕뱶???ㅽ뙣?덉뒿?덈떎.'));
    } finally {
      setActiveCurrentDownloadType(null);
      void refreshCurrentDataCounts();
    }
  }, [activeCurrentDownloadType, fetchAllCurrentDataRows, refreshCurrentDataCounts]);

  // ?뚯씪 寃利?
  const validateVehicleData = (data: any[]): { valid: any[]; errors: string[] } => {
    const valid: any[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      const rowNum = index + 2;

      if (!row['李⑤웾踰덊샇']) {
        errors.push(`${rowNum}?? 李⑤웾踰덊샇媛 ?놁뒿?덈떎`);
        return;
      }
      if (!row['李⑥쥌']) {
        errors.push(`${rowNum}?? 李⑥쥌???놁뒿?덈떎`);
        return;
      }
      if (!['대여중', '예약', '예약중', '가용', '정비중'].includes(row['?곹깭'])) {
        errors.push(`${rowNum}행 상태는 '대여중', '예약', '가용', '정비중' 중 하나여야 합니다. ('예약중' 입력 허용)`);
        return;
      }

      valid.push({
        ...row,
        ['상태']: row['?곹깭'] === '예약중' ? '예약' : row['?곹깭'],
      });
    });

    return { valid, errors };
  };

  const validateReservationData = (data: any[]): { valid: any[]; errors: string[] } => {
    const valid: any[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      const rowNum = index + 2;

      if (!row['?덉빟ID']) {
        errors.push(`${rowNum}?? ?덉빟ID媛 ?놁뒿?덈떎`);
        return;
      }
      if (!row['李⑤웾踰덊샇']) {
        errors.push(`${rowNum}?? 李⑤웾踰덊샇媛 ?놁뒿?덈떎`);
        return;
      }
      if (!row['고객명']) {
        errors.push(`${rowNum}행 고객명이 없습니다`);
        return;
      }
      if (!['대여중', '예약', '예약중', '반납완료'].includes(row['?좏삎'])) {
        errors.push(`${rowNum}행 유형은 '대여중', '예약', '반납완료' 중 하나여야 합니다. ('예약중' 입력 허용)`);
        return;
      }

      valid.push({
        ...row,
        ['유형']: row['?좏삎'] === '예약중' ? '예약' : row['?좏삎'],
      });
    });

    return { valid, errors };
  };

  // ?뚯씪 ?낅줈??泥섎━
  const handleFileUpload = (file: File) => {
    if (!canEditSettings) {
      toast.error('?ㅼ젙 CSV 寃利?沅뚰븳???놁뒿?덈떎.');
      return;
    }

    if (!file.name.endsWith('.csv')) {
      alert('CSV ?뚯씪留??낅줈??媛?ν빀?덈떎');
      return;
    }

    Papa.parse(file, {
      header: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const data = results.data.filter((row: any) => Object.values(row).some((value) => value !== ''));

        if (data.length === 0) {
          alert('?좏슚???곗씠?곌? ?놁뒿?덈떎');
          return;
        }

        setPreviewData(data.slice(0, 5));

        const validation = uploadType === 'vehicles'
          ? validateVehicleData(data)
          : validateReservationData(data);

        setUploadResult({
          success: validation.errors.length === 0,
          total: data.length,
          valid: validation.valid.length,
          errors: validation.errors.slice(0, 10),
        });
      },
      error: (error) => {
        alert(`?뚯씪 ?뚯떛 ?ㅻ쪟: ${error.message}`);
      },
    });
  };

  // ?쒕옒洹몄븻?쒕∼
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (!canEditSettings) {
      return;
    }
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    if (!canEditSettings) {
      toast.error('?ㅼ젙 CSV 寃利?沅뚰븳???놁뒿?덈떎.');
      return;
    }

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditSettings) {
      toast.error('?ㅼ젙 CSV 寃利?沅뚰븳???놁뒿?덈떎.');
      event.target.value = '';
      return;
    }

    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleUploadClick = () => {
    if (!canEditSettings) {
      toast.error('?ㅼ젙 CSV 寃利?沅뚰븳???놁뒿?덈떎.');
      return;
    }

    if (uploadResult && uploadResult.valid > 0) {
      toast.info(CSV_VALIDATION_ONLY_NOTICE);
      setUploadResult(null);
      setPreviewData([]);
      fileInputRef.current?.click();
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <Layout title="설정">
      <PageStateBoundary
        isLoading={isSettingsLoading}
        error={settingsError}
        isEmpty={false}
        errorDescription="?ㅼ젙 ?곗씠?곕? 遺덈윭?ㅻ뒗 以?臾몄젣媛 諛쒖깮?덉뒿?덈떎."
        emptyTitle="?쒖떆???ㅼ젙 ?곗씠?곌? ?놁뒿?덈떎"
        emptyDescription="?좎떆 ???ㅼ떆 ?쒕룄?섍굅??愿由ъ옄?먭쾶 臾몄쓽??二쇱꽭??"
        onRetry={handleSettingsRetry}
        errorActionLabel={getPageErrorActionLabel(settingsErrorKind)}
        onErrorAction={handleSettingsErrorAction}
        emptyActionLabel="?ㅼ떆 遺덈윭?ㅺ린"
        onEmptyAction={handleSettingsRetry}
        className="m-6 min-h-[320px]"
      >
        <div className="p-6">
          <div className="mb-6 flex gap-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => handleTabChange('bulk')}
              className={`border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'bulk'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              대량 업로드/다운로드
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('geofence')}
              className={`border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'geofence'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              지오펜스
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('accounts')}
              className={`border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'accounts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              계정 관리
            </button>
          </div>

          {activeTab === 'bulk' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div className="text-sm text-blue-900">
                    <p className="mb-1 font-semibold">초기 데이터 설정 가이드</p>
                    <ul className="list-inside list-disc space-y-1 text-blue-800">
                      <li>CSV 템플릿을 다운로드하여 데이터를 입력하세요</li>
                      <li>차량 자산과 대여 예약을 한번에 등록할 수 있습니다</li>
                      <li>업로드 전 데이터 검증이 자동으로 수행됩니다</li>
                      <li>현재 데이터를 다운로드하여 참고할 수 있습니다</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-[#1e2939]">데이터 유형 선택</h2>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadType('vehicles');
                      setUploadResult(null);
                      setPreviewData([]);
                    }}
                    className={`rounded-lg border-2 p-4 transition-all ${
                      uploadType === 'vehicles'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <FileSpreadsheet className={`h-6 w-6 ${uploadType === 'vehicles' ? 'text-blue-600' : 'text-gray-400'}`} />
                      {uploadType === 'vehicles' && <CheckCircle className="h-5 w-5 text-blue-600" />}
                    </div>
                    <div className="text-left">
                      <div className={`mb-1 font-semibold ${uploadType === 'vehicles' ? 'text-blue-900' : 'text-gray-900'}`}>
                        차량 자산 (CSV)
                      </div>
                      <div className="text-sm text-gray-600">차량번호, 차종, 상태 등</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUploadType('reservations');
                      setUploadResult(null);
                      setPreviewData([]);
                    }}
                    className={`rounded-lg border-2 p-4 transition-all ${
                      uploadType === 'reservations'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <FileText className={`h-6 w-6 ${uploadType === 'reservations' ? 'text-blue-600' : 'text-gray-400'}`} />
                      {uploadType === 'reservations' && <CheckCircle className="h-5 w-5 text-blue-600" />}
                    </div>
                    <div className="text-left">
                      <div className={`mb-1 font-semibold ${uploadType === 'reservations' ? 'text-blue-900' : 'text-gray-900'}`}>
                        대여 예약 (CSV)
                      </div>
                      <div className="text-sm text-gray-600">예약ID, 고객명, 기간 등</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUploadType('ocr');
                      setUploadResult(null);
                      setPreviewData([]);
                    }}
                    className={`rounded-lg border-2 p-4 transition-all ${
                      uploadType === 'ocr'
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Upload className={`h-6 w-6 ${uploadType === 'ocr' ? 'text-green-600' : 'text-gray-400'}`} />
                      {uploadType === 'ocr' && <CheckCircle className="h-5 w-5 text-green-600" />}
                    </div>
                    <div className="text-left">
                      <div className={`mb-1 font-semibold ${uploadType === 'ocr' ? 'text-green-900' : 'text-gray-900'}`}>
                        자동차 등록증 (OCR)
                      </div>
                      <div className="text-sm text-gray-600">이미지 파일 대량 업로드</div>
                    </div>
                  </button>
                </div>
              </div>

              {uploadType === 'ocr' ? (
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="mb-1 text-base font-semibold text-[#1e2939]">자동차 등록증 OCR 대량 업로드</h2>
                      <p className="text-sm text-gray-600">여러 개의 차량등록증 이미지를 한번에 업로드하면 OCR로 자동 처리합니다.</p>
                    </div>
                  </div>

                  <div className="rounded-lg border-2 border-dashed border-green-300 bg-green-50 p-8">
                    <div className="text-center">
                      <Upload className="mx-auto mb-4 h-16 w-16 text-green-600" />
                      <h3 className="mb-2 text-lg font-semibold text-green-900">차량등록증 이미지 업로드</h3>
                      <p className="mb-4 text-sm text-gray-700">여러 개의 이미지를 한번에 선택하면 OCR과 차량 등록을 순차적으로 수행합니다.</p>
                      <label className="inline-block cursor-pointer rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700">
                        {isBulkOcrProcessing ? '처리 중..' : '이미지 파일 선택'}
                        <input
                          data-testid="settings-bulk-ocr-input"
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          className="hidden"
                          disabled={isBulkOcrProcessing}
                          onChange={(event) => {
                            const files = Array.from(event.target.files || []);
                            event.target.value = '';
                            void handleBulkOcrFileSelection(files);
                          }}
                        />
                      </label>
                      <p className="mt-4 text-xs text-gray-600">지원 형식: JPG, PNG, PDF | 최대 50개 파일까지 업로드 가능</p>
                    </div>
                  </div>

                  {(isBulkOcrProcessing || bulkOcrProgressMessage) && (
                    <div
                      data-testid="settings-bulk-ocr-progress"
                      className="mt-4 rounded-lg border border-green-200 bg-white px-4 py-3 text-sm text-green-900"
                    >
                      {bulkOcrProgressMessage ?? '대량 OCR 업로드를 처리하고 있습니다.'}
                    </div>
                  )}

                  {bulkOcrSelectedFiles.length > 0 && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
                      <div
                        data-testid="settings-bulk-ocr-result-summary"
                        className="flex items-center justify-between gap-2 text-sm font-medium text-gray-800"
                      >
                        <span>선택 파일 {bulkOcrSelectedFiles.length}건</span>
                        <span>
                          성공 {bulkOcrResults.filter((item) => item.status === 'success').length}건 / 실패 {bulkOcrResults.filter((item) => item.status === 'error').length}건
                        </span>
                      </div>
                      {bulkOcrResults.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {bulkOcrResults.map((result, index) => (
                            <li
                              key={`${result.fileName}-${index}`}
                              data-testid={`settings-bulk-ocr-result-${index}`}
                              className={`rounded-lg px-3 py-2 text-sm ${
                                result.status === 'success'
                                  ? 'bg-green-50 text-green-800'
                                  : 'bg-red-50 text-red-800'
                              }`}
                            >
                              <span className="font-semibold">{result.fileName}</span>
                              {': '}
                              <span>{result.message}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-blue-900">OCR 자동 추출 항목</h3>
                    <ul className="space-y-1 text-sm text-blue-800">
                      <li>차량번호, 차대번호, 차종, 연식</li>
                      <li>보유사명, 보험만료일</li>
                      <li>추출 완료 후 수정 및 확인 가능</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  {!canEditSettings && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      현재 계정은 설정 CSV 검증을 수행할 수 없어 템플릿 다운로드만 가능합니다.
                    </div>
                  )}
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[#1e2939]">{uploadType === 'vehicles' ? '차량 자산 업로드' : '대여 예약 업로드'}</h2>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => downloadTemplate(uploadType)}
                        className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200"
                      >
                        <Download className="h-4 w-4" />
                        템플릿 다운로드
                      </button>
                      <button
                        type="button"
                        onClick={handleUploadClick}
                        disabled={!canEditSettings}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadResult && uploadResult.valid > 0 ? '다른 파일 검증' : '파일 선택'}
                      </button>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    disabled={!canEditSettings}
                    className="hidden"
                  />

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={handleUploadClick}
                    className={`flex h-[300px] w-full items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                      !canEditSettings
                        ? 'cursor-not-allowed border-gray-200 bg-gray-100'
                        : isDragging
                        ? 'border-blue-500 bg-blue-50'
                        : uploadResult
                          ? uploadResult.success
                            ? 'border-green-300 bg-green-50'
                            : 'border-red-300 bg-red-50'
                          : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-center">
                      {uploadResult ? (
                        <>
                          {uploadResult.success ? (
                            <CheckCircle className="mx-auto mb-3 h-16 w-16 text-green-600" />
                          ) : (
                            <XCircle className="mx-auto mb-3 h-16 w-16 text-red-600" />
                          )}
                          <p className={`mb-2 font-semibold ${uploadResult.success ? 'text-green-900' : 'text-red-900'}`}>
                            {uploadResult.success ? '검증 완료 (업로드되지 않음)' : '검증 실패'}
                          </p>
                          <p className="mb-3 text-sm text-gray-600">
                            전체 {uploadResult.total}건 중 {uploadResult.valid}건 유효
                          </p>
                          {uploadResult.success && (
                            <p className="mb-3 text-sm text-amber-700">{CSV_VALIDATION_ONLY_NOTICE}</p>
                          )}
                          {uploadResult.errors.length > 0 && (
                            <div className="mx-auto max-w-md rounded-lg bg-white p-4 text-left">
                              <p className="mb-2 text-sm font-semibold text-red-900">오류 목록:</p>
                              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-red-800">
                                {uploadResult.errors.map((errorMessage, index) => (
                                  <li key={index}>- {errorMessage}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="mx-auto mb-3 h-16 w-16 text-gray-400" />
                          <p className="mb-1 font-medium text-gray-600">CSV 파일을 드래그하거나 클릭하여 업로드</p>
                          <p className="text-sm text-gray-500">최대 1,000건까지 한번에 업로드 가능</p>
                        </>
                      )}
                    </div>
                  </div>

                  {previewData.length > 0 && (
                    <div className="mt-4">
                      <h3 className="mb-2 text-sm font-semibold text-gray-700">미리보기 (최대 5건)</h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-sm">
                          <thead className="border-b border-gray-200 bg-gray-50">
                            <tr>
                              {Object.keys(previewData[0]).map((key) => (
                                <th key={key} className="px-4 py-2 text-left text-xs font-semibold text-gray-600">
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {previewData.map((row, rowIndex) => (
                              <tr key={rowIndex} className="hover:bg-gray-50">
                                {Object.values(row).map((cellValue: any, columnIndex) => (
                                  <td key={columnIndex} className="px-4 py-2 text-gray-700">
                                    {cellValue}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="mb-1 text-base font-semibold text-[#1e2939]">현재 데이터 다운로드</h2>
                    <p className="text-sm text-gray-600">현재 시스템에 등록된 데이터를 CSV로 다운로드할 수 있습니다</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => downloadCurrentData('vehicles')}
                    disabled={activeCurrentDownloadType !== null}
                    className={`rounded-lg border-2 border-gray-200 p-4 text-left transition-all ${
                      activeCurrentDownloadType !== null
                        ? 'cursor-not-allowed opacity-60'
                        : 'hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                      <div className="font-semibold text-gray-900">차량 자산 데이터</div>
                    </div>
                    <div className="text-sm text-gray-600">현재 {currentVehicleCount ?? '-'}대의 차량 정보</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadCurrentData('reservations')}
                    disabled={activeCurrentDownloadType !== null}
                    className={`rounded-lg border-2 border-gray-200 p-4 text-left transition-all ${
                      activeCurrentDownloadType !== null
                        ? 'cursor-not-allowed opacity-60'
                        : 'hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <FileText className="h-6 w-6 text-green-600" />
                      <div className="font-semibold text-gray-900">대여 예약 데이터</div>
                    </div>
                    <div className="text-sm text-gray-600">현재 {currentReservationCount ?? '-'}건의 예약 정보</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'geofence' && (
            <div className="space-y-6">
              {!canEditSettings && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  ?꾩옱 怨꾩젙? 吏?ㅽ렂?ㅻ? ?쎄린 ?꾩슜?쇰줈留?蹂????덉뒿?덈떎.
                </div>
              )}

              {(geofenceSaveError || geofenceSaveSuccess) && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    geofenceSaveError
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-green-200 bg-green-50 text-green-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>{geofenceSaveError ?? geofenceSaveSuccess}</p>
                    {geofenceSaveError && geofenceRetryAction && (
                      <button
                        type="button"
                        onClick={geofenceRetryAction}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        ?ㅼ떆 ?쒕룄
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#1e2939]">지오펜스 지도</h2>
                  <button
                    type="button"
                    onClick={openCreateGeofenceEditor}
                    disabled={!canEditSettings || isGeofenceSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    吏?ㅽ렂???앹꽦
                  </button>
                </div>

                <div className="flex h-[320px] w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-100">
                  <div className="text-center">
                    <MapPin className="mx-auto mb-3 h-16 w-16 text-gray-400" />
                    <p className="font-medium text-gray-600">吏???곸뿭</p>
                    <p className="mt-1 text-sm text-gray-500">지오펜스 위치가 여기에 표시됩니다.</p>
                  </div>
                </div>
              </div>

              {isGeofenceEditorOpen && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                  <h3 className="mb-4 text-base font-semibold text-blue-900">
                    {geofenceEditorMode === 'create' ? '吏?ㅽ렂???앹꽦' : `吏?ㅽ렂???몄쭛 (${selectedEditingGeofence?.name ?? '-'})`}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">?대쫫 *</label>
                      <input
                        type="text"
                        value={geofenceForm.name}
                        disabled={geofenceEditorMode === 'edit' || !canEditSettings || isGeofenceSaving}
                        onChange={(event) => {
                          setGeofenceForm((prevState) => ({ ...prevState, name: event.target.value }));
                          setGeofenceFieldErrors((prevErrors) => ({ ...prevErrors, name: undefined }));
                          setGeofenceSaveError(null);
                          setGeofenceSaveSuccess(null);
                          setGeofenceRetryAction(null);
                        }}
                        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                      />
                      {geofenceFieldErrors.name && <p className="mt-1 text-xs text-red-600">{geofenceFieldErrors.name}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <KakaoGeofenceInput
                        shape={geofenceForm.shape}
                        shapeLocked={geofenceEditorMode === 'edit'}
                        lat={geofenceForm.lat}
                        lng={geofenceForm.lng}
                        radiusMeter={geofenceForm.radiusMeter}
                        pointsText={geofenceForm.pointsText}
                        disabled={!canEditSettings || isGeofenceSaving}
                        errors={{
                          lat: geofenceFieldErrors.lat,
                          lng: geofenceFieldErrors.lng,
                          radiusMeter: geofenceFieldErrors.radiusMeter,
                          pointsText: geofenceFieldErrors.pointsText,
                        }}
                        onShapeChange={(shape) => {
                          setGeofenceForm((prevState) => ({ ...prevState, shape }));
                          setGeofenceFieldErrors((prevErrors) => ({
                            ...prevErrors,
                            lat: undefined,
                            lng: undefined,
                            radiusMeter: undefined,
                            pointsText: undefined,
                          }));
                          setGeofenceSaveError(null);
                          setGeofenceSaveSuccess(null);
                          setGeofenceRetryAction(null);
                        }}
                        onPointsTextChange={(value) => {
                          setGeofenceForm((prevState) => ({ ...prevState, pointsText: value }));
                          setGeofenceFieldErrors((prevErrors) => ({ ...prevErrors, pointsText: undefined }));
                          setGeofenceSaveError(null);
                          setGeofenceSaveSuccess(null);
                          setGeofenceRetryAction(null);
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">諛섍꼍 (m) *</label>
                      <input
                        type="number"
                        min={1}
                        value={geofenceForm.radiusMeter}
                        disabled={geofenceForm.shape === 'polygon' || !canEditSettings || isGeofenceSaving}
                        onChange={(event) => {
                          setGeofenceForm((prevState) => ({ ...prevState, radiusMeter: event.target.value }));
                          setGeofenceFieldErrors((prevErrors) => ({ ...prevErrors, radiusMeter: undefined }));
                          setGeofenceSaveError(null);
                          setGeofenceSaveSuccess(null);
                          setGeofenceRetryAction(null);
                        }}
                        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                      />
                      {geofenceFieldErrors.radiusMeter && (
                        <p className="mt-1 text-xs text-red-600">{geofenceFieldErrors.radiusMeter}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">?꾨룄 *</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={geofenceForm.lat}
                        disabled={geofenceForm.shape === 'polygon' || !canEditSettings || isGeofenceSaving}
                        onChange={(event) => {
                          setGeofenceForm((prevState) => ({ ...prevState, lat: event.target.value }));
                          setGeofenceFieldErrors((prevErrors) => ({ ...prevErrors, lat: undefined }));
                          setGeofenceSaveError(null);
                          setGeofenceSaveSuccess(null);
                          setGeofenceRetryAction(null);
                        }}
                        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                      />
                      {geofenceFieldErrors.lat && <p className="mt-1 text-xs text-red-600">{geofenceFieldErrors.lat}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">寃쎈룄 *</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={geofenceForm.lng}
                        disabled={geofenceForm.shape === 'polygon' || !canEditSettings || isGeofenceSaving}
                        onChange={(event) => {
                          setGeofenceForm((prevState) => ({ ...prevState, lng: event.target.value }));
                          setGeofenceFieldErrors((prevErrors) => ({ ...prevErrors, lng: undefined }));
                          setGeofenceSaveError(null);
                          setGeofenceSaveSuccess(null);
                          setGeofenceRetryAction(null);
                        }}
                        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                      />
                      {geofenceFieldErrors.lng && <p className="mt-1 text-xs text-red-600">{geofenceFieldErrors.lng}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="inline-flex items-center gap-2 text-sm text-blue-900">
                        <input
                          type="checkbox"
                          checked={geofenceForm.active}
                          disabled={!canEditSettings || isGeofenceSaving}
                          onChange={(event) => {
                            setGeofenceForm((prevState) => ({ ...prevState, active: event.target.checked }));
                            setGeofenceSaveError(null);
                            setGeofenceSaveSuccess(null);
                            setGeofenceRetryAction(null);
                          }}
                        />
                        ?쒖꽦 ?곹깭
                      </label>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeGeofenceEditor}
                      disabled={isGeofenceSaving}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      痍⑥냼
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleGeofenceSave();
                      }}
                      disabled={!canEditSettings || isGeofenceSaving}
                      className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGeofenceSaving ? '저장 중..' : '저장'}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-semibold text-[#1e2939]">吏?ㅽ렂??紐⑸줉</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">?대쫫</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">以묒떖 醫뚰몴</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">諛섍꼍</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">?쒖꽦 ?곹깭</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">?≪뀡</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {geofences.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                            ?깅줉??吏?ㅽ렂?ㅺ? ?놁뒿?덈떎.
                          </td>
                        </tr>
                      )}
                      {geofences.map((geofence) => (
                        <tr key={geofence.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                            {geofence.name}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                            {geofence.center.lat.toFixed(6)}, {geofence.center.lng.toFixed(6)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                            {geofence.points?.length ? `polygon ${geofence.points?.length}pts` : `${geofence.radiusMeter}m`}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <label className="relative inline-flex cursor-pointer items-center">
                              <input
                                type="checkbox"
                                checked={geofence.active}
                                onChange={() => handleGeofenceToggle(geofence)}
                                disabled={!canEditSettings || activeToggleTargetId === geofence.id || isGeofenceSaving}
                                className="peer sr-only"
                              />
                              <div className="peer h-6 w-11 rounded-full bg-gray-200 transition-all after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-60" />
                            </label>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
                            <button
                              type="button"
                              onClick={() => openEditGeofenceEditor(geofence)}
                              disabled={!canEditSettings || isGeofenceSaving || activeToggleTargetId !== null}
                              className="mr-3 font-medium text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              ?몄쭛
                            </button>
                            <button
                              type="button"
                              onClick={() => handleGeofenceDelete(geofence.id)}
                              disabled={!canEditSettings || deletingGeofenceId === geofence.id || isGeofenceSaving}
                              className="font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingGeofenceId === geofence.id ? '??젣 以?..' : '??젣'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-4">
              {!canManageMemberRoles && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  ?꾩옱 怨꾩젙? 硫ㅻ쾭 沅뚰븳???쎄린 ?꾩슜?쇰줈留?蹂????덉뒿?덈떎.
                </div>
              )}

              {(invitationSaveError || invitationSaveSuccess) && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    invitationSaveError
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-green-200 bg-green-50 text-green-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>{invitationSaveError ?? invitationSaveSuccess}</p>
                    {invitationSaveError && invitationRetryAction && (
                      <button
                        type="button"
                        onClick={invitationRetryAction}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        ?ㅼ떆 ?쒕룄
                      </button>
                    )}
                  </div>
                </div>
              )}

              {(memberSaveError || memberSaveSuccess) && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    memberSaveError
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-green-200 bg-green-50 text-green-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>{memberSaveError ?? memberSaveSuccess}</p>
                    {memberSaveError && memberRetryAction && (
                      <button
                        type="button"
                        onClick={memberRetryAction}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        ?ㅼ떆 ?쒕룄
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#1e2939]">?ъ슜??紐⑸줉</h2>
                    <p className="mt-1 text-sm text-gray-600">硫ㅻ쾭 沅뚰븳 蹂寃쎌? ???踰꾪듉???뚮윭???곸슜?⑸땲??</p>
                  </div>
                  <button
                    type="button"
                    onClick={openInvitationEditor}
                    disabled={!canManageMemberRoles || isInvitationSaving || resendingInvitationId !== null}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-600"
                  >
                    <Plus className="h-4 w-4" />
                    珥덈??섍린
                  </button>
                </div>

                {isInvitationEditorOpen && (
                  <div className="border-b border-blue-100 bg-blue-50 px-6 py-5">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                      <div>
                        <label htmlFor="settings-invitation-email" className="mb-1 block text-sm font-medium text-blue-900">
                          珥덈? ?대찓??
                        </label>
                        <input
                          id="settings-invitation-email"
                          type="email"
                          value={invitationForm.email}
                          onChange={(event) => handleInvitationFieldChange('email', event.target.value)}
                          disabled={isInvitationSaving}
                          placeholder="invitee@example.com"
                          className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                        />
                        {invitationFieldErrors.email && (
                          <p className="mt-1 text-xs text-red-600">{invitationFieldErrors.email}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="settings-invitation-role" className="mb-1 block text-sm font-medium text-blue-900">
                          권한
                        </label>
                        <select
                          id="settings-invitation-role"
                          value={invitationForm.role}
                          onChange={(event) => handleInvitationFieldChange('role', event.target.value)}
                          disabled={isInvitationSaving}
                          className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                        >
                          <option value="member">운영자</option>
                          <option value="viewer">조회자</option>
                          <option value="admin">관리자</option>
                          {isSuperAdmin && (
                            <option value="installer">설치 기사</option>
                          )}
                        </select>
                        {invitationFieldErrors.role && (
                          <p className="mt-1 text-xs text-red-600">{invitationFieldErrors.role}</p>
                        )}
                        {invitationFieldErrors.companyId && (
                          <p className="mt-1 text-xs text-red-600">{invitationFieldErrors.companyId}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={closeInvitationEditor}
                        disabled={isInvitationSaving}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleInvitationCreate}
                        disabled={!canManageMemberRoles || isInvitationSaving}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isInvitationSaving ? '발송 중..' : '초대 메일 발송'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">이름</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">이메일</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">권한</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">상태</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {members.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                            조회된 멤버가 없습니다.
                          </td>
                        </tr>
                      )}
                      {members.map((member) => {
                        const draftRole = memberRoleDrafts[member.userId] ?? member.role;
                        const normalizedDraftRole = draftRole === 'admin' || draftRole === 'viewer' ? draftRole : 'member';
                        const normalizedCurrentRole = member.role === 'admin' || member.role === 'viewer' ? member.role : 'member';
                        const isRoleDirty = normalizedDraftRole !== normalizedCurrentRole;
                        const isRowSaving = savingMemberId === member.userId;
                        const canEditRowRole = (
                          canManageMemberRoles
                          && member.status === 'approved'
                          && (member.role === 'admin' || member.role === 'member' || member.role === 'viewer')
                        );
                        const canReviewPendingMember = canReviewPendingMemberStatus(member, user?.role, canManageMemberRoles);

                        return (
                          <tr key={member.userId} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                              {member.name || '-'}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                              {member.email || member.userId}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              {canEditRowRole ? (
                                <select
                                  value={normalizedDraftRole}
                                  onChange={(event) => handleMemberRoleChange(member.userId, event.target.value as 'admin' | 'member' | 'viewer')}
                                  disabled={isRowSaving}
                                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <option value="admin">관리자</option>
                                  <option value="member">운영자</option>
                                  <option value="viewer">조회자</option>
                                </select>
                              ) : (
                                <span className={`rounded-full px-2 py-1 text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                                  {toRoleLabel(member.role)}
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${getMemberStatusBadgeColor(member.status)}`}>
                                {toMemberStatusLabel(member.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {canEditRowRole && isRoleDirty ? (
                                <div className="space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleMemberRoleSave(member.userId)}
                                    disabled={isRowSaving}
                                    className="font-medium text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isRowSaving ? '저장 중..' : '저장'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMemberRoleReset(member.userId)}
                                    disabled={isRowSaving}
                                    className="font-medium text-gray-600 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <span className={canReviewPendingMember ? 'hidden text-xs text-gray-400' : 'text-xs text-gray-400'}>
                                  {canEditRowRole ? '-' : '권한 변경 불가'}
                                </span>
                              )}
                              {canReviewPendingMember && (
                                <div className="space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void runMemberStatusSave(member.userId, 'approved');
                                    }}
                                    disabled={isRowSaving}
                                    className="font-medium text-green-600 hover:text-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isRowSaving ? '泥섎━ 以?..' : '?뱀씤'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void runMemberStatusSave(member.userId, 'rejected');
                                    }}
                                    disabled={isRowSaving}
                                    className="font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isRowSaving ? '泥섎━ 以?..' : '嫄곗젅'}
                                  </button>
                                </div>
                              )}
                              {memberFieldErrors[member.userId] && (
                                <p className="mt-1 text-xs text-red-600">{memberFieldErrors[member.userId]}</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">권한 설명</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><span className="font-medium">관리자(admin):</span> 멤버 권한과 운영 설정을 변경할 수 있습니다.</p>
                    <p><span className="font-medium">운영자(member):</span> 데이터 조회와 운영 기능을 사용할 수 있지만 설정 변경은 제한됩니다.</p>
                    <p><span className="font-medium">조회자(viewer):</span> 데이터 조회만 가능합니다.</p>
                    <p><span className="font-medium">상태:</span> approved(승인), pending(대기), rejected(거절), withdrawn(취소)</p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-semibold text-[#1e2939]">珥덈? ?대젰</h2>
                  <p className="mt-1 text-sm text-gray-600">?곹깭蹂?珥덈? ?대젰怨??섎씫 ?뺣낫瑜??④퍡 ?뺤씤?⑸땲??</p>
                </div>

                <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium text-gray-700">?곹깭</span>
                    <select
                      value={invitationStatusFilter}
                      onChange={(event) => {
                        setInvitationStatusFilter(event.target.value as InvitationStatusFilter);
                        void hydrateInvitationsOnly(event.target.value as InvitationStatusFilter);
                      }}
                      disabled={!canManageMemberRoles || isInvitationSaving || resendingInvitationId !== null}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                    >
                      <option value="pending">대기 중</option>
                      <option value="accepted">수락됨</option>
                      <option value="expired">만료됨</option>
                      <option value="revoked">취소됨</option>
                      <option value="all">전체</option>
                    </select>
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">이메일</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">권한</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">상태</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">초대 시각</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">만료 시각</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">수락 시각</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">수락 사용자</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">재발송</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invitations.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-6 py-10 text-center text-sm text-gray-500">
                            선택한 상태의 초대가 없습니다.
                          </td>
                        </tr>
                      )}
                      {invitations.map((invitation) => (
                        <tr key={invitation.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                            {invitation.email}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                            {toInvitationRoleLabel(invitation.role)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getInvitationStatusBadgeColor(invitation.status)}`}>
                              {toInvitationStatusLabel(invitation.status)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                            {formatUpdatedAt(invitation.invitedAt)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                            {formatUpdatedAt(invitation.expiresAt)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                            {invitation.acceptedAt ? formatUpdatedAt(invitation.acceptedAt) : '-'}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                            {invitation.acceptedUserId ?? '-'}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                            {invitation.resendCount}회
                            {invitation.resentAt ? ` / 최근 ${formatUpdatedAt(invitation.resentAt)}` : ''}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {invitation.status === 'pending' ? (
                              <button
                                type="button"
                                onClick={() => handleInvitationResend(invitation.id)}
                                disabled={!canManageMemberRoles || isInvitationSaving || resendingInvitationId === invitation.id}
                                className="font-medium text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {resendingInvitationId === invitation.id ? '재발송 중..' : '재발송'}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageStateBoundary>
    </Layout>
  );
}

