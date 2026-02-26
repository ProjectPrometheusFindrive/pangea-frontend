import { apiClient } from './api';

export interface ActionRequiredListRequestOptions {
  page?: number;
  size?: number;
  status?: string;
  priority?: string;
  assignee?: string;
  signal?: AbortSignal;
}

export interface ActionRequiredDetailRequestOptions {
  signal?: AbortSignal;
}

export function getActionRequiredList(options: ActionRequiredListRequestOptions = {}): Promise<unknown> {
  const { page, size, status, priority, assignee, signal } = options;

  return apiClient.requestData<unknown>({
    path: '/api/v2/action-required',
    method: 'GET',
    query: {
      page,
      size,
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
    path: `/api/v2/action-required/${encodeURIComponent(actionId)}`,
    method: 'GET',
    signal: options.signal,
  });
}
