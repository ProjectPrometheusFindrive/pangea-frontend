import type { Invitation, InvitationCreateRequest, InvitationRole } from '../../services/invitations';

export interface InvitationDraft {
  email: string;
  role: InvitationRole;
}

export type InvitationDraftErrors = Partial<Record<keyof InvitationDraft, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_COMPANY_IDS = new Set(['0000000000', '__global__', 'company-local', 'null', 'none']);

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

export function validateInvitationDraft(draft: InvitationDraft): InvitationDraftErrors {
  const errors: InvitationDraftErrors = {};
  const email = normalizeInvitationEmail(draft.email);

  if (!email) {
    errors.email = '초대 이메일을 입력해 주세요.';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = '올바른 이메일 형식이 아닙니다.';
  }

  if (draft.role !== 'admin' && draft.role !== 'member') {
    errors.role = '초대 권한은 admin 또는 member만 허용됩니다.';
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
  return role === 'admin' ? '관리자' : role === 'member' ? '운영자' : role || '-';
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
