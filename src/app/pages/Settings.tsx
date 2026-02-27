import { Layout } from '../components/Layout';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
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
import { useCompany } from '../context/CompanyContext';
import { ACTION_PERMISSIONS } from '../authorization';
import { getAssetsList } from '../../services/assets';
import { getReservationsList } from '../../services/reservations';
import {
  getSettingsCompany,
  putSettingsCompany,
  listSettingsGeofences,
  createSettingsGeofence,
  updateSettingsGeofence,
  deleteSettingsGeofence,
  listSettingsMembers,
  patchSettingsMemberRole,
  type SettingsCompanyProfile,
  type SettingsCompanyUpdateRequest,
  type SettingsGeofence,
  type SettingsMember,
} from '../../services/settings';

type TabType = 'bulk' | 'company' | 'geofence' | 'accounts';
type UploadType = 'vehicles' | 'reservations' | 'ocr';
type CurrentDataType = Extract<UploadType, 'vehicles' | 'reservations'>;
type CompanyField = 'name' | 'businessNumber' | 'phone' | 'email' | 'address';
type GeofenceField = 'name' | 'lat' | 'lng' | 'radiusMeter';
type MemberRoleField = 'role';
type FieldErrorMap<TField extends string> = Partial<Record<TField, string>>;

interface UploadResult {
  success: boolean;
  total: number;
  valid: number;
  errors: string[];
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
  lat: string;
  lng: string;
  radiusMeter: string;
  active: boolean;
}

interface SettingsHydrationPayload {
  company: SettingsCompanyProfile;
  geofences: SettingsGeofence[];
  members: SettingsMember[];
}

const DEFAULT_SETTINGS_SCHEMA_VERSION = 'v1';
const CURRENT_DATA_COUNT_KEYS = ['total', 'totalCount', 'count', 'size', 'itemsCount', 'totalElements'];
const CURRENT_DATA_PAGE_SIZE = 200;

const DEFAULT_COMPANY_FORM_STATE: CompanyFormState = {
  name: '',
  businessNumber: '',
  phone: '',
  email: '',
  address: '',
};

const DEFAULT_GEOFENCE_FORM_STATE: GeofenceFormState = {
  name: '',
  lat: '',
  lng: '',
  radiusMeter: '',
  active: true,
};

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
  return {
    name: geofence.name,
    lat: String(geofence.center.lat),
    lng: String(geofence.center.lng),
    radiusMeter: String(geofence.radiusMeter),
    active: geofence.active,
  };
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
  return role || '미지정';
}

function toMemberStatusLabel(status: string): string {
  switch (status) {
    case 'approved':
      return '활성';
    case 'pending':
      return '승인 대기';
    case 'rejected':
      return '승인 거절';
    case 'withdrawn':
      return '탈퇴';
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
    return '예약';
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
  const navigate = useNavigate();
  const { canPerformAction } = useAuthorization();
  const { refreshCompany } = useCompany();

  const canEditSettings = canPerformAction(ACTION_PERMISSIONS.settingsWrite);
  const canManageMemberRoles = canPerformAction(ACTION_PERMISSIONS.settingsMembersWrite);

  const [activeTab, setActiveTab] = useState<TabType>('bulk');
  const [uploadType, setUploadType] = useState<UploadType>('vehicles');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [currentVehicleCount, setCurrentVehicleCount] = useState<number | null>(null);
  const [currentReservationCount, setCurrentReservationCount] = useState<number | null>(null);
  const [activeCurrentDownloadType, setActiveCurrentDownloadType] = useState<CurrentDataType | null>(null);

  const selectedEditingGeofence = useMemo(
    () => geofences.find((item) => item.id === editingGeofenceId) ?? null,
    [editingGeofenceId, geofences],
  );

  const hydrateMembersOnly = useCallback(async () => {
    const membersPayload = await listSettingsMembers();
    setMembers(Array.isArray(membersPayload.items) ? membersPayload.items : []);
    setMemberRoleDrafts({});
    setMemberFieldErrors({});
  }, []);

  const hydrateGeofencesOnly = useCallback(async () => {
    const geofencesPayload = await listSettingsGeofences();
    setGeofences(Array.isArray(geofencesPayload.items) ? geofencesPayload.items : []);
  }, []);

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

  const {
    isLoading: isSettingsLoading,
    error: settingsError,
    errorKind: settingsErrorKind,
    run: hydrateSettings,
  } = usePageEndpointState<SettingsHydrationPayload>({
    request: async (signal) => {
      const [companyPayload, geofencesPayload, membersPayload] = await Promise.all([
        getSettingsCompany({ signal }),
        listSettingsGeofences({ signal }),
        listSettingsMembers(undefined, { signal }),
      ]);

      return {
        company: companyPayload,
        geofences: Array.isArray(geofencesPayload.items) ? geofencesPayload.items : [],
        members: Array.isArray(membersPayload.items) ? membersPayload.items : [],
      };
    },
    onSuccess: (payload) => {
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
    },
    isEmpty: () => false,
  });

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    void refreshCurrentDataCounts();
  }, [refreshCurrentDataCounts]);

  const handleSettingsRetry = useCallback(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

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
        || Boolean(geofenceForm.lat.trim())
        || Boolean(geofenceForm.lng.trim())
        || Boolean(geofenceForm.radiusMeter.trim())
        || geofenceForm.active !== DEFAULT_GEOFENCE_FORM_STATE.active
      );
    }

    if (!selectedEditingGeofence) {
      return false;
    }

    const baseline = toGeofenceForm(selectedEditingGeofence);
    return (
      geofenceForm.lat.trim() !== baseline.lat.trim()
      || geofenceForm.lng.trim() !== baseline.lng.trim()
      || geofenceForm.radiusMeter.trim() !== baseline.radiusMeter.trim()
      || geofenceForm.active !== baseline.active
    );
  }, [geofenceEditorMode, geofenceForm, isGeofenceEditorOpen, selectedEditingGeofence]);

  const hasPendingMemberRoleChanges = useMemo(() => members.some((member) => {
    const draftValue = memberRoleDrafts[member.userId];
    return typeof draftValue === 'string' && draftValue !== member.role;
  }), [memberRoleDrafts, members]);

  const isAnySaving = (
    isCompanySaving
    || isGeofenceSaving
    || activeToggleTargetId !== null
    || deletingGeofenceId !== null
    || savingMemberId !== null
  );

  const hasUnsavedChanges = (
    isCompanyDirty
    || isGeofenceEditorDirty
    || hasPendingMemberRoleChanges
  );

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
      toast.info('저장 중에는 탭을 이동할 수 없습니다.');
      return;
    }

    if (hasUnsavedChanges && typeof window !== 'undefined') {
      const shouldLeave = window.confirm('저장하지 않은 변경 사항이 있습니다. 탭을 이동하시겠습니까?');
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
      clientErrors.name = '회사명을 입력해 주세요.';
    }
    if (companyForm.email.trim().length > 0 && !companyForm.email.includes('@')) {
      clientErrors.email = '유효한 이메일 형식을 입력해 주세요.';
    }

    if (Object.keys(clientErrors).length > 0) {
      setCompanyFieldErrors(clientErrors);
      setCompanySaveError('입력값을 확인해 주세요.');
      setCompanySaveSuccess(null);
      setCompanyRetryAction(null);
      return;
    }

    const payload = toCompanyPatchPayload();
    if (Object.keys(payload).length === 0) {
      toast.info('변경된 회사 정보가 없습니다.');
      return;
    }

    setIsCompanySaving(true);
    setCompanyFieldErrors({});
    setCompanySaveError(null);
    setCompanySaveSuccess(null);
    setCompanyRetryAction(null);

    try {
      const updatedCompany = await putSettingsCompany(payload);
      const nextForm = toCompanyForm(updatedCompany);
      setCompanyForm(nextForm);
      setCompanyBaseline(nextForm);
      setCompanyUpdatedAt(toStringValue(updatedCompany.updatedAt));
      setCompanySchemaVersion(toStringValue(updatedCompany.schemaVersion) ?? companySchemaVersion);
      setCompanySaveSuccess('회사 설정이 저장되었습니다.');
      toast.success('회사 설정이 저장되었습니다.');
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
          setCompanySaveError(error.message || '입력값을 확인해 주세요.');
          return;
        }
        if (error.status === 403) {
          setCompanySaveError('회사 설정 수정 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 409) {
          setCompanySaveError('다른 사용자의 변경사항과 충돌했습니다. 최신 설정을 다시 불러옵니다.');
          setCompanyRetryAction(null);
          void hydrateSettings();
          return;
        }
        if (isRetryableMutationError(error)) {
          setCompanySaveError('일시적인 오류로 저장에 실패했습니다. 다시 시도해 주세요.');
          setCompanyRetryAction(() => () => {
            void handleCompanySave();
          });
          return;
        }
      }

      setCompanySaveError(toErrorMessage(error, '회사 설정 저장에 실패했습니다.'));
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
      const shouldClose = window.confirm('저장하지 않은 지오펜스 변경 사항이 있습니다. 닫으시겠습니까?');
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

    if (geofenceEditorMode === 'create' && !trimmedName) {
      fieldErrors.name = '지오펜스 이름을 입력해 주세요.';
    }
    if (latValue === null) {
      fieldErrors.lat = '위도 값을 입력해 주세요.';
    }
    if (lngValue === null) {
      fieldErrors.lng = '경도 값을 입력해 주세요.';
    }
    if (radiusValue === null || !Number.isInteger(radiusValue) || radiusValue <= 0) {
      fieldErrors.radiusMeter = '반경은 1 이상의 정수(m)로 입력해 주세요.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      setGeofenceFieldErrors(fieldErrors);
      setGeofenceSaveError('입력값을 확인해 주세요.');
      setGeofenceSaveSuccess(null);
      setGeofenceRetryAction(null);
      return;
    }

    if (latValue === null || lngValue === null || radiusValue === null) {
      return;
    }

    let mutationTask: Promise<SettingsGeofence>;
    if (geofenceEditorMode === 'create') {
      mutationTask = createSettingsGeofence({
        name: trimmedName,
        center: {
          lat: latValue,
          lng: lngValue,
        },
        radiusMeter: radiusValue,
        active: geofenceForm.active,
      });
    } else {
      if (!editingGeofenceId || !selectedEditingGeofence) {
        setGeofenceSaveError('편집 대상을 찾을 수 없습니다. 목록을 새로고침해 주세요.');
        return;
      }

      const payload: {
        center?: { lat: number; lng: number };
        radiusMeter?: number;
        active?: boolean;
      } = {};

      if (
        selectedEditingGeofence.center.lat !== latValue
        || selectedEditingGeofence.center.lng !== lngValue
      ) {
        payload.center = {
          lat: latValue,
          lng: lngValue,
        };
      }
      if (selectedEditingGeofence.radiusMeter !== radiusValue) {
        payload.radiusMeter = radiusValue;
      }
      if (selectedEditingGeofence.active !== geofenceForm.active) {
        payload.active = geofenceForm.active;
      }

      if (Object.keys(payload).length === 0) {
        toast.info('변경된 지오펜스 정보가 없습니다.');
        return;
      }

      mutationTask = updateSettingsGeofence(editingGeofenceId, payload);
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
          ? '지오펜스가 생성되었습니다.'
          : '지오펜스가 저장되었습니다.',
      );
      toast.success(
        geofenceEditorMode === 'create'
          ? '지오펜스가 생성되었습니다.'
          : '지오펜스가 저장되었습니다.',
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
          });
          if (Object.keys(mappedErrors).length > 0) {
            setGeofenceFieldErrors(mappedErrors);
          }
          setGeofenceSaveError(error.message || '입력값을 확인해 주세요.');
          return;
        }
        if (error.status === 403) {
          setGeofenceSaveError('지오펜스 수정 권한이 없습니다. 관리자에게 권한을 요청해 주세요.');
          return;
        }
        if (error.status === 409) {
          setGeofenceSaveError('다른 사용자 변경사항과 충돌했습니다. 최신 목록을 다시 불러옵니다.');
          setGeofenceRetryAction(null);
          void hydrateGeofencesOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setGeofenceSaveError('일시적인 오류로 저장에 실패했습니다. 다시 시도해 주세요.');
          setGeofenceRetryAction(() => () => {
            void handleGeofenceSave();
          });
          return;
        }
      }

      setGeofenceSaveError(toErrorMessage(error, '지오펜스 저장에 실패했습니다.'));
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
      const updated = await updateSettingsGeofence(geofenceId, { active: nextActive });
      setGeofences((prevItems) => prevItems.map((item) => (
        item.id === geofenceId ? updated : item
      )));
      setGeofenceSaveSuccess('지오펜스 활성 상태가 업데이트되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setGeofenceSaveError('지오펜스 활성 상태를 변경할 권한이 없습니다.');
          return;
        }
        if (error.status === 409) {
          setGeofenceSaveError('충돌이 발생해 최신 지오펜스 목록을 다시 불러옵니다.');
          void hydrateGeofencesOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setGeofenceSaveError('일시적인 오류로 활성 상태 변경에 실패했습니다. 다시 시도해 주세요.');
          setGeofenceRetryAction(() => () => {
            void runGeofenceToggle(geofenceId, nextActive);
          });
          return;
        }
      }
      setGeofenceSaveError(toErrorMessage(error, '지오펜스 활성 상태를 변경하지 못했습니다.'));
    } finally {
      setActiveToggleTargetId(null);
    }
  }, [canEditSettings, hydrateGeofencesOnly]);

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
      await deleteSettingsGeofence(geofenceId);
      setGeofences((prevItems) => prevItems.filter((item) => item.id !== geofenceId));
      setGeofenceSaveSuccess('지오펜스가 삭제되었습니다.');
      if (editingGeofenceId === geofenceId) {
        setIsGeofenceEditorOpen(false);
        setEditingGeofenceId(null);
        setGeofenceEditorMode('create');
        setGeofenceForm(DEFAULT_GEOFENCE_FORM_STATE);
      }
      toast.success('지오펜스가 삭제되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          setGeofenceSaveError('지오펜스 삭제 권한이 없습니다.');
          return;
        }
        if (error.status === 409) {
          setGeofenceSaveError('충돌이 발생해 최신 지오펜스 목록을 다시 불러옵니다.');
          void hydrateGeofencesOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setGeofenceSaveError('일시적인 오류로 삭제에 실패했습니다. 다시 시도해 주세요.');
          setGeofenceRetryAction(() => () => {
            void runGeofenceDelete(geofenceId);
          });
          return;
        }
      }
      setGeofenceSaveError(toErrorMessage(error, '지오펜스 삭제에 실패했습니다.'));
    } finally {
      setDeletingGeofenceId(null);
    }
  }, [canEditSettings, editingGeofenceId, hydrateGeofencesOnly]);

  const handleGeofenceDelete = useCallback((geofenceId: string) => {
    if (!canEditSettings || deletingGeofenceId !== null || isGeofenceSaving) {
      return;
    }

    if (typeof window !== 'undefined') {
      const shouldDelete = window.confirm('해당 지오펜스를 삭제하시겠습니까?');
      if (!shouldDelete) {
        return;
      }
    }

    void runGeofenceDelete(geofenceId);
  }, [canEditSettings, deletingGeofenceId, isGeofenceSaving, runGeofenceDelete]);

  const handleMemberRoleChange = useCallback((memberId: string, role: 'admin' | 'member') => {
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

  const runMemberRoleSave = useCallback(async (memberId: string, role: 'admin' | 'member') => {
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
      const updatedMember = await patchSettingsMemberRole(memberId, { role });
      setMembers((prevMembers) => prevMembers.map((member) => (
        member.userId === memberId ? updatedMember : member
      )));
      setMemberRoleDrafts((prevDrafts) => {
        const nextDrafts = { ...prevDrafts };
        delete nextDrafts[memberId];
        return nextDrafts;
      });
      setMemberSaveSuccess('멤버 권한이 저장되었습니다.');
      toast.success('멤버 권한이 저장되었습니다.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          const mappedErrors = mapFieldErrors<MemberRoleField>(toErrorFieldEntries(error), {
            role: 'role',
          });
          const fieldMessage = mappedErrors.role ?? error.message ?? '입력값을 확인해 주세요.';
          setMemberFieldErrors((prevErrors) => ({
            ...prevErrors,
            [memberId]: fieldMessage,
          }));
          setMemberSaveError(fieldMessage);
          return;
        }
        if (error.status === 403) {
          setMemberSaveError('멤버 권한을 변경할 권한이 없습니다.');
          return;
        }
        if (error.status === 409) {
          setMemberSaveError('권한 변경 충돌이 발생해 최신 멤버 목록을 다시 불러옵니다.');
          void hydrateMembersOnly();
          return;
        }
        if (isRetryableMutationError(error)) {
          setMemberSaveError('일시적인 오류로 권한 저장에 실패했습니다. 다시 시도해 주세요.');
          setMemberRetryAction(() => () => {
            void runMemberRoleSave(memberId, role);
          });
          return;
        }
      }

      setMemberSaveError(toErrorMessage(error, '멤버 권한 저장에 실패했습니다.'));
    } finally {
      setSavingMemberId(null);
    }
  }, [canManageMemberRoles, hydrateMembersOnly]);

  const handleMemberRoleSave = useCallback((memberId: string) => {
    const originalMember = members.find((member) => member.userId === memberId);
    if (!originalMember) {
      return;
    }

    const nextRoleValue = memberRoleDrafts[memberId] ?? originalMember.role;
    if (nextRoleValue !== 'admin' && nextRoleValue !== 'member') {
      setMemberFieldErrors((prevErrors) => ({
        ...prevErrors,
        [memberId]: 'role 값은 admin 또는 member만 허용됩니다.',
      }));
      return;
    }

    if (nextRoleValue === originalMember.role) {
      toast.info('변경된 권한이 없습니다.');
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

  // CSV 템플릿 다운로드
  const downloadTemplate = (type: UploadType) => {
    let csv = '';
    let filename = '';

    if (type === 'vehicles') {
      csv = '차량번호,차종,상태,보험만료일,정기검사일,차대번호,연식,소유자\n';
      csv += '12가3456,그랜저,가용,2025-12-31,2025-06-30,KMHXX00XXXX000001,2023,렌터카(주)\n';
      csv += '34나5678,쏘나타,가용,2025-11-30,2025-05-31,KMHXX00XXXX000002,2022,렌터카(주)\n';
      filename = 'vehicle_template.csv';
    } else {
      csv = '예약ID,차량번호,고객명,시작일,종료일,유형,전화번호,결제방법,금액,선금\n';
      templateReservations.slice(0, 10).forEach((reservation) => {
        const reservationType = reservation.type === 'rental'
          ? '대여중'
          : reservation.type === 'reservation'
            ? '예약'
            : '반납완료';
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

  // 현재 데이터 다운로드
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
          '차량번호,차종,상태,보험만료일,정기검사일,차대번호,연식,소유자',
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
        toast.info('다운로드할 현재 데이터가 없습니다. 헤더만 포함된 CSV가 생성되었습니다.');
      }
    } catch (error) {
      toast.error(toErrorMessage(error, '현재 데이터 다운로드에 실패했습니다.'));
    } finally {
      setActiveCurrentDownloadType(null);
      void refreshCurrentDataCounts();
    }
  }, [activeCurrentDownloadType, fetchAllCurrentDataRows, refreshCurrentDataCounts]);

  // 파일 검증
  const validateVehicleData = (data: any[]): { valid: any[]; errors: string[] } => {
    const valid: any[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      const rowNum = index + 2;

      if (!row['차량번호']) {
        errors.push(`${rowNum}행: 차량번호가 없습니다`);
        return;
      }
      if (!row['차종']) {
        errors.push(`${rowNum}행: 차종이 없습니다`);
        return;
      }
      if (!['대여중', '예약', '예약됨', '가용', '정비중'].includes(row['상태'])) {
        errors.push(`${rowNum}행: 상태는 '대여중', '예약', '가용', '정비중' 중 하나여야 합니다 (호환값 '예약됨' 허용)`);
        return;
      }

      valid.push({
        ...row,
        상태: row['상태'] === '예약됨' ? '예약' : row['상태'],
      });
    });

    return { valid, errors };
  };

  const validateReservationData = (data: any[]): { valid: any[]; errors: string[] } => {
    const valid: any[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      const rowNum = index + 2;

      if (!row['예약ID']) {
        errors.push(`${rowNum}행: 예약ID가 없습니다`);
        return;
      }
      if (!row['차량번호']) {
        errors.push(`${rowNum}행: 차량번호가 없습니다`);
        return;
      }
      if (!row['고객명']) {
        errors.push(`${rowNum}행: 고객명이 없습니다`);
        return;
      }
      if (!['대여중', '예약', '예약됨', '반납완료'].includes(row['유형'])) {
        errors.push(`${rowNum}행: 유형은 '대여중', '예약', '반납완료' 중 하나여야 합니다 (호환값 '예약됨' 허용)`);
        return;
      }

      valid.push({
        ...row,
        유형: row['유형'] === '예약됨' ? '예약' : row['유형'],
      });
    });

    return { valid, errors };
  };

  // 파일 업로드 처리
  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('CSV 파일만 업로드 가능합니다');
      return;
    }

    Papa.parse(file, {
      header: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const data = results.data.filter((row: any) => Object.values(row).some((value) => value !== ''));

        if (data.length === 0) {
          alert('유효한 데이터가 없습니다');
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
        alert(`파일 파싱 오류: ${error.message}`);
      },
    });
  };

  // 드래그앤드롭
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleUploadClick = () => {
    if (uploadResult && uploadResult.valid > 0) {
      alert(`${uploadResult.valid}건의 데이터가 업로드되었습니다!`);
      setUploadResult(null);
      setPreviewData([]);
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
        errorDescription="설정 데이터를 불러오는 중 문제가 발생했습니다."
        emptyTitle="표시할 설정 데이터가 없습니다"
        emptyDescription="잠시 후 다시 시도하거나 관리자에게 문의해 주세요."
        onRetry={handleSettingsRetry}
        errorActionLabel={getPageErrorActionLabel(settingsErrorKind)}
        onErrorAction={handleSettingsErrorAction}
        emptyActionLabel="다시 불러오기"
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
              onClick={() => handleTabChange('company')}
              className={`border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'company'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              회사 정보
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
                      <p className="text-sm text-gray-600">여러 개의 차량등록증 이미지를 한번에 업로드하면 OCR로 자동 처리됩니다</p>
                    </div>
                  </div>

                  <div className="rounded-lg border-2 border-dashed border-green-300 bg-green-50 p-8">
                    <div className="text-center">
                      <Upload className="mx-auto mb-4 h-16 w-16 text-green-600" />
                      <h3 className="mb-2 text-lg font-semibold text-green-900">차량등록증 이미지 업로드</h3>
                      <p className="mb-4 text-sm text-gray-700">여러 개의 이미지를 한번에 선택하거나 드래그하여 업로드하세요</p>
                      <label className="inline-block cursor-pointer rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700">
                        이미지 파일 선택
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(event) => {
                            const files = Array.from(event.target.files || []);
                            if (files.length > 0) {
                              alert(`${files.length}개의 파일이 선택되었습니다.\nOCR 처리를 시작합니다...`);
                              setTimeout(() => {
                                alert(`${files.length}개 차량 정보가 자동 추출되어 등록되었습니다!`);
                              }, 2000);
                            }
                          }}
                        />
                      </label>
                      <p className="mt-4 text-xs text-gray-600">지원 형식: JPG, PNG, PDF | 최대 50개 파일까지 업로드 가능</p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-blue-900">OCR 자동 추출 항목</h3>
                    <ul className="space-y-1 text-sm text-blue-800">
                      <li>• 차량번호, 차대번호, 차종, 연식</li>
                      <li>• 소유자명, 보험만료일</li>
                      <li>• 추출 완료 후 수정 및 확인 가능</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[#1e2939]">{uploadType === 'vehicles' ? '차량 자산' : '대여 예약'} 업로드</h2>
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
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadResult && uploadResult.valid > 0 ? '데이터 업로드' : '파일 선택'}
                      </button>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex h-[300px] w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                      isDragging
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
                            {uploadResult.success ? '검증 성공!' : '검증 실패'}
                          </p>
                          <p className="mb-3 text-sm text-gray-600">전체 {uploadResult.total}건 중 {uploadResult.valid}건 유효</p>
                          {uploadResult.errors.length > 0 && (
                            <div className="mx-auto max-w-md rounded-lg bg-white p-4 text-left">
                              <p className="mb-2 text-sm font-semibold text-red-900">오류 목록:</p>
                              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-red-800">
                                {uploadResult.errors.map((errorMessage, index) => (
                                  <li key={index}>• {errorMessage}</li>
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

          {activeTab === 'company' && (
            <div className="space-y-6">
              {!canEditSettings && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  현재 계정은 회사 설정을 읽기 전용으로만 볼 수 있습니다.
                </div>
              )}

              {(companySaveError || companySaveSuccess) && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    companySaveError
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-green-200 bg-green-50 text-green-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>{companySaveError ?? companySaveSuccess}</p>
                    {companySaveError && companyRetryAction && (
                      <button
                        type="button"
                        onClick={companyRetryAction}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        다시 시도
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#1e2939]">회사 프로필</h2>
                    <p className="mt-1 text-sm text-gray-600">회사 기본 정보를 수정하면 즉시 운영 설정에 반영됩니다.</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>스키마 버전: {companySchemaVersion}</p>
                    <p>마지막 저장: {formatUpdatedAt(companyUpdatedAt)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">회사명 *</label>
                    <input
                      type="text"
                      value={companyForm.name}
                      disabled={!canEditSettings || isCompanySaving}
                      onChange={(event) => {
                        setCompanyForm((prevState) => ({ ...prevState, name: event.target.value }));
                        setCompanyFieldErrors((prevErrors) => ({ ...prevErrors, name: undefined }));
                        setCompanySaveError(null);
                        setCompanySaveSuccess(null);
                        setCompanyRetryAction(null);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                    />
                    {companyFieldErrors.name && <p className="mt-1 text-xs text-red-600">{companyFieldErrors.name}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">사업자등록번호</label>
                    <input
                      type="text"
                      value={companyForm.businessNumber}
                      disabled={!canEditSettings || isCompanySaving}
                      onChange={(event) => {
                        setCompanyForm((prevState) => ({ ...prevState, businessNumber: event.target.value }));
                        setCompanyFieldErrors((prevErrors) => ({ ...prevErrors, businessNumber: undefined }));
                        setCompanySaveError(null);
                        setCompanySaveSuccess(null);
                        setCompanyRetryAction(null);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                    />
                    {companyFieldErrors.businessNumber && (
                      <p className="mt-1 text-xs text-red-600">{companyFieldErrors.businessNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">대표 연락처</label>
                    <input
                      type="text"
                      value={companyForm.phone}
                      disabled={!canEditSettings || isCompanySaving}
                      onChange={(event) => {
                        setCompanyForm((prevState) => ({ ...prevState, phone: event.target.value }));
                        setCompanyFieldErrors((prevErrors) => ({ ...prevErrors, phone: undefined }));
                        setCompanySaveError(null);
                        setCompanySaveSuccess(null);
                        setCompanyRetryAction(null);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                    />
                    {companyFieldErrors.phone && <p className="mt-1 text-xs text-red-600">{companyFieldErrors.phone}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">대표 이메일</label>
                    <input
                      type="email"
                      value={companyForm.email}
                      disabled={!canEditSettings || isCompanySaving}
                      onChange={(event) => {
                        setCompanyForm((prevState) => ({ ...prevState, email: event.target.value }));
                        setCompanyFieldErrors((prevErrors) => ({ ...prevErrors, email: undefined }));
                        setCompanySaveError(null);
                        setCompanySaveSuccess(null);
                        setCompanyRetryAction(null);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                    />
                    {companyFieldErrors.email && <p className="mt-1 text-xs text-red-600">{companyFieldErrors.email}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700">주소</label>
                    <input
                      type="text"
                      value={companyForm.address}
                      disabled={!canEditSettings || isCompanySaving}
                      onChange={(event) => {
                        setCompanyForm((prevState) => ({ ...prevState, address: event.target.value }));
                        setCompanyFieldErrors((prevErrors) => ({ ...prevErrors, address: undefined }));
                        setCompanySaveError(null);
                        setCompanySaveSuccess(null);
                        setCompanyRetryAction(null);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                    />
                    {companyFieldErrors.address && <p className="mt-1 text-xs text-red-600">{companyFieldErrors.address}</p>}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCompanyReset}
                    disabled={isCompanySaving || !isCompanyDirty}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    변경 취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCompanySave();
                    }}
                    disabled={!canEditSettings || isCompanySaving || !isCompanyDirty}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCompanySaving ? '저장 중...' : '회사 설정 저장'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'geofence' && (
            <div className="space-y-6">
              {!canEditSettings && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  현재 계정은 지오펜스를 읽기 전용으로만 볼 수 있습니다.
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
                        다시 시도
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
                    지오펜스 생성
                  </button>
                </div>

                <div className="flex h-[320px] w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-100">
                  <div className="text-center">
                    <MapPin className="mx-auto mb-3 h-16 w-16 text-gray-400" />
                    <p className="font-medium text-gray-600">지도 영역</p>
                    <p className="mt-1 text-sm text-gray-500">지오펜스 위치가 여기에 표시됩니다</p>
                  </div>
                </div>
              </div>

              {isGeofenceEditorOpen && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                  <h3 className="mb-4 text-base font-semibold text-blue-900">
                    {geofenceEditorMode === 'create' ? '지오펜스 생성' : `지오펜스 편집 (${selectedEditingGeofence?.name ?? '-'})`}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">이름 *</label>
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
                    <div>
                      <label className="mb-1 block text-sm font-medium text-blue-900">반경 (m) *</label>
                      <input
                        type="number"
                        min={1}
                        value={geofenceForm.radiusMeter}
                        disabled={!canEditSettings || isGeofenceSaving}
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
                      <label className="mb-1 block text-sm font-medium text-blue-900">위도 *</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={geofenceForm.lat}
                        disabled={!canEditSettings || isGeofenceSaving}
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
                      <label className="mb-1 block text-sm font-medium text-blue-900">경도 *</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={geofenceForm.lng}
                        disabled={!canEditSettings || isGeofenceSaving}
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
                        활성 상태
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
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleGeofenceSave();
                      }}
                      disabled={!canEditSettings || isGeofenceSaving}
                      className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isGeofenceSaving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-semibold text-[#1e2939]">지오펜스 목록</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">이름</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">중심 좌표</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">반경</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">활성 상태</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {geofences.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                            등록된 지오펜스가 없습니다.
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
                            {geofence.radiusMeter}m
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
                              편집
                            </button>
                            <button
                              type="button"
                              onClick={() => handleGeofenceDelete(geofence.id)}
                              disabled={!canEditSettings || deletingGeofenceId === geofence.id || isGeofenceSaving}
                              className="font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingGeofenceId === geofence.id ? '삭제 중...' : '삭제'}
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
                  현재 계정은 멤버 권한을 읽기 전용으로만 볼 수 있습니다.
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
                        다시 시도
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#1e2939]">사용자 목록</h2>
                    <p className="mt-1 text-sm text-gray-600">멤버 권한 변경은 저장 버튼을 눌러야 적용됩니다.</p>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-600"
                    title="초대 기능은 별도 티켓에서 구현 예정입니다."
                  >
                    <Plus className="h-4 w-4" />
                    초대하기
                  </button>
                </div>

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
                        const normalizedDraftRole = draftRole === 'admin' ? 'admin' : 'member';
                        const normalizedCurrentRole = member.role === 'admin' ? 'admin' : 'member';
                        const isRoleDirty = normalizedDraftRole !== normalizedCurrentRole;
                        const isRowSaving = savingMemberId === member.userId;
                        const canEditRowRole = (
                          canManageMemberRoles
                          && member.status === 'approved'
                          && (member.role === 'admin' || member.role === 'member')
                        );

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
                                  onChange={(event) => handleMemberRoleChange(member.userId, event.target.value as 'admin' | 'member')}
                                  disabled={isRowSaving}
                                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <option value="admin">관리자</option>
                                  <option value="member">운영자</option>
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
                                    {isRowSaving ? '저장 중...' : '저장'}
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
                                <span className="text-xs text-gray-400">
                                  {canEditRowRole ? '-' : '권한 변경 불가'}
                                </span>
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
                    <p><span className="font-medium">관리자(admin):</span> 멤버 권한 및 운영 설정 변경 가능</p>
                    <p><span className="font-medium">운영자(member):</span> 데이터 조회/운영 기능 사용, 설정 변경 제한</p>
                    <p><span className="font-medium">상태:</span> approved(활성), pending(승인 대기), rejected(거절), withdrawn(탈퇴)</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageStateBoundary>
    </Layout>
  );
}
