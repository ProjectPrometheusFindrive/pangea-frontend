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
  { value: 'member', label: '\uC6B4\uC601\uC790' },
  { value: 'viewer', label: '\uC870\uD68C\uC790' },
  { value: 'admin', label: '\uAD00\uB9AC\uC790' },
];
const INSTALLER_INVITATION_ROLE_OPTION = { value: 'installer' as const, label: '\uC7A5\uCC29 \uAE30\uC0AC' };

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
    errors.email = '\uCD08\uB300 \uC774\uBA54\uC77C\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = '\uC62C\uBC14\uB978 \uC774\uBA54\uC77C \uD615\uC2DD\uC774 \uC544\uB2D9\uB2C8\uB2E4.';
  }

  if (draft.role === 'installer') {
    if (!options.isSuperAdmin) {
      errors.role = 'installer \uCD08\uB300\uB294 super_admin\uB9CC \uC0DD\uC131\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
    } else if (!resolvedCompanyId) {
      errors.companyId = 'installer \uCD08\uB300\uB294 \uD68C\uC0AC \uC120\uD0DD\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.';
    }
  } else if (draft.role !== 'admin' && draft.role !== 'member' && draft.role !== 'viewer') {
    errors.role = '\uCD08\uB300 \uAD8C\uD55C\uC740 admin, member \uB610\uB294 viewer\uB9CC \uD5C8\uC6A9\uB429\uB2C8\uB2E4.';
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
    ? '\uAD00\uB9AC\uC790'
    : role === 'member'
      ? '\uC6B4\uC601\uC790'
      : role === 'viewer'
        ? '\uC870\uD68C\uC790'
      : role === 'installer'
        ? '\uC7A5\uCC29 \uAE30\uC0AC'
        : role || '-';
}

export function toInvitationStatusLabel(status: string): string {
  return status === 'pending'
    ? '\uB300\uAE30 \uC911'
    : status === 'accepted'
      ? '\uC218\uB77D\uB428'
      : status === 'expired'
        ? '\uB9CC\uB8CC\uB428'
        : status === 'revoked'
          ? '\uCDE8\uC18C\uB428'
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
