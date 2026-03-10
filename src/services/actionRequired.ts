import { apiClient } from './api';

export interface ActionRequiredListRequestOptions {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  assignee?: string;
  signal?: AbortSignal;
}

export interface ActionRequiredDetailRequestOptions {
  signal?: AbortSignal;
}

export interface ActionRequiredStatusPatchOptions {
  status: string;
  memo?: string | null;
  signal?: AbortSignal;
}

export interface ActionRequiredMemoPatchOptions {
  memo: string;
  signal?: AbortSignal;
}

export function getActionRequiredList(options: ActionRequiredListRequestOptions = {}): Promise<unknown> {
  const { page, pageSize, status, priority, assignee, signal } = options;

  return apiClient.requestData<unknown>({
    path: '/api/v2/action-items',
    method: 'GET',
    query: {
      page,
      pageSize,
      status,
      priority,
      assignee,
    },
    signal,
  });
}

export function getActionRequiredDetail(
  actionId: string,
  options: ActionRequiredDetailRequestOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/action-items/${encodeURIComponent(actionId)}`,
    method: 'GET',
    signal: options.signal,
  });
}

function requestStatusPatch(
  path: string,
  status: string,
  memo: string | null | undefined,
  signal?: AbortSignal,
): Promise<unknown> {
  const body: Record<string, unknown> = { status };
  if (memo !== undefined) {
    body.memo = memo;
  }

  return apiClient.requestData<unknown>({
    path,
    method: 'PATCH',
    body,
    signal,
  });
}

function requestMemoPatch(path: string, method: 'PATCH' | 'POST', memo: string, signal?: AbortSignal): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path,
    method,
    body: { memo },
    signal,
  });
}

export async function patchActionRequiredStatus(
  actionId: string,
  options: ActionRequiredStatusPatchOptions,
): Promise<unknown> {
  const encodedActionId = encodeURIComponent(actionId);
  return requestStatusPatch(`/api/v2/action-items/${encodedActionId}/status`, options.status, options.memo, options.signal);
}

export async function patchActionRequiredMemo(
  actionId: string,
  options: ActionRequiredMemoPatchOptions,
): Promise<unknown> {
  const encodedActionId = encodeURIComponent(actionId);
  return requestMemoPatch(`/api/v2/action-items/${encodedActionId}/memos`, 'POST', options.memo, options.signal);
}
