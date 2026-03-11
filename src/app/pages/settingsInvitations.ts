import type { Invitation, InvitationCreateRequest, InvitationRole } from '../../services/invitations';

export interface InvitationDraft {
  email: string;
  role: InvitationRole;
}

export interface ValidateInvitationDraftOptions {
  isSuperAdmin?: boolean;
  companyId?: string | null;
}

export type InvitationDraftErrorField = keyof InvitationDraft | 'companyId';
export type InvitationDraftErrors = Partial<Record<InvitationDraftErrorField, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_COMPANY_IDS = new Set(['0000000000', '__global__', 'company-local', 'null', 'none']);
const BASE_INVITATION_ROLE_OPTIONS: Array<{ value: InvitationRole; label: string }> = [
  { value: 'member', label: '운영자' },
  { value: 'viewer', label: '조회자' },
  { value: 'admin', label: '관리자' },
];
const INSTALLER_INVITATION_ROLE_OPTION = { value: 'installer' as const, label: '장착 기사' };

function normalizeInvitationEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSettingsCompanyId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }
  return INVALID_COMPANY_IDS.has(normalizedValue.toLowerCase()) ? null : normalizedValue;
}

function invitationSortKey(invitation: Pick<Invitation, 'updatedAt' | 'invitedAt'>): number {
  const candidate = invitation.updatedAt || invitation.invitedAt;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getInvitationRoleOptions(isSuperAdmin: boolean): Array<{ value: InvitationRole; label: string }> {
  return isSuperAdmin
    ? [...BASE_INVITATION_ROLE_OPTIONS, INSTALLER_INVITATION_ROLE_OPTION]
    : BASE_INVITATION_ROLE_OPTIONS;
}

export function validateInvitationDraft(
  draft: InvitationDraft,
  options: ValidateInvitationDraftOptions = {},
): InvitationDraftErrors {
  const errors: InvitationDraftErrors = {};
  const email = normalizeInvitationEmail(draft.email);
  const resolvedCompanyId = normalizeSettingsCompanyId(options.companyId);

  if (!email) {
    errors.email = '초대 이메일을 입력해 주세요.';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = '올바른 이메일 형식이 아닙니다.';
  }

  if (draft.role === 'installer') {
    if (!options.isSuperAdmin) {
      errors.role = 'installer 초대는 super_admin만 생성할 수 있습니다.';
    } else if (!resolvedCompanyId) {
      errors.companyId = 'installer 초대는 회사 선택이 필요합니다.';
    }
  } else if (draft.role !== 'admin' && draft.role !== 'member' && draft.role !== 'viewer') {
    errors.role = '초대 권한은 admin, member 또는 viewer만 허용됩니다.';
  }

  return errors;
}

export function resolveSettingsCompanyScope(explicitCompanyId: unknown, authCompanyId: unknown): string | null {
  return normalizeSettingsCompanyId(explicitCompanyId) ?? normalizeSettingsCompanyId(authCompanyId);
}

export function buildInvitationCreatePayload(
  draft: InvitationDraft,
  companyId?: string | null,
): InvitationCreateRequest {
  const payload: InvitationCreateRequest = {
    email: normalizeInvitationEmail(draft.email),
    role: draft.role,
  };

  const resolvedCompanyId = normalizeSettingsCompanyId(companyId);
  if (resolvedCompanyId) {
    payload.companyId = resolvedCompanyId;
  }
  return payload;
}

export function upsertPendingInvitation(existing: Invitation[], next: Invitation): Invitation[] {
  return [next, ...existing.filter((item) => item.id !== next.id)]
    .sort((left, right) => invitationSortKey(right) - invitationSortKey(left));
}

export function toInvitationRoleLabel(role: string): string {
  return role === 'admin'
    ? '관리자'
    : role === 'member'
      ? '운영자'
      : role === 'viewer'
        ? '조회자'
      : role === 'installer'
        ? '장착 기사'
        : role || '-';
}

export function toInvitationStatusLabel(status: string): string {
  return status === 'pending'
    ? '대기 중'
    : status === 'accepted'
      ? '수락됨'
      : status === 'expired'
        ? '만료됨'
        : status === 'revoked'
          ? '취소됨'
          : status || '-';
}

export function getInvitationStatusBadgeColor(status: string): string {
  return status === 'pending'
    ? 'bg-amber-100 text-amber-800'
    : status === 'accepted'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'expired'
        ? 'bg-slate-100 text-slate-700'
        : 'bg-gray-100 text-gray-700';
}
