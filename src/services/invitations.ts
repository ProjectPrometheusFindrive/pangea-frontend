import { apiClient } from './api';

export interface InvitationRequestOptions {
  signal?: AbortSignal;
}

export type InvitationRole = 'admin' | 'member';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked' | string;

export interface Invitation {
  id: string;
  email: string;
  role: InvitationRole | string;
  companyId: string;
  companyName?: string | null;
  status: InvitationStatus;
  invitedBy?: string | null;
  invitedAt: string;
  updatedAt?: string | null;
  expiresAt: string;
  resentAt?: string | null;
  resendCount: number;
  acceptedAt?: string | null;
  acceptedUserId?: string | null;
}

export interface InvitationListData {
  items: Invitation[];
}

export interface InvitationCreateRequest {
  email: string;
  role: InvitationRole;
  companyId?: string;
}

export interface InvitationAcceptRequest {
  password: string;
  name: string;
  phone: string;
  position: string;
}

export interface InvitationAcceptData {
  userId: string;
  name?: string;
  createdAt?: string;
}

export function listInvitations(
  status?: 'pending' | 'accepted' | 'expired' | 'revoked',
  options: InvitationRequestOptions = {},
): Promise<InvitationListData> {
  return apiClient.requestData<InvitationListData>({
    path: '/api/v2/invitations',
    method: 'GET',
    query: { status },
    signal: options.signal,
  });
}

export function createInvitation(
  payload: InvitationCreateRequest,
  options: InvitationRequestOptions = {},
): Promise<Invitation> {
  return apiClient.requestData<Invitation>({
    path: '/api/v2/invitations',
    method: 'POST',
    body: payload,
    signal: options.signal,
  });
}

export function resendInvitation(
  invitationId: string,
  options: InvitationRequestOptions = {},
): Promise<Invitation> {
  return apiClient.requestData<Invitation>({
    path: `/api/v2/invitations/${encodeURIComponent(invitationId)}/resend`,
    method: 'POST',
    signal: options.signal,
  });
}

export function postAcceptInvitation(
  invitationToken: string,
  payload: InvitationAcceptRequest,
): Promise<InvitationAcceptData> {
  return apiClient.requestData<InvitationAcceptData>({
    path: `/api/v2/invitations/${encodeURIComponent(invitationToken)}/accept`,
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
}
