import { apiClient } from './api';

export interface Company {
  id: string;
  name: string;
  businessNumber: string;
  contactName?: string;
  contactPhone?: string;
  address: string;
  timezone?: string;
  currency?: string;
}

export type CompanyUpdateRequest = Partial<Omit<Company, 'id'>>;

interface SettingsCompanyPayload {
  companyId?: string;
  id?: string;
  name?: string;
  businessNumber?: string;
  bizRegNo?: string;
  phone?: string;
  contactPhone?: string;
  contactName?: string;
  address?: string;
  timezone?: string;
  currency?: string;
}

function toCompany(payload: SettingsCompanyPayload): Company {
  return {
    id: String(payload.companyId ?? payload.id ?? '').trim() || 'company-local',
    name: String(payload.name ?? '').trim(),
    businessNumber: String(payload.businessNumber ?? payload.bizRegNo ?? '').trim(),
    contactName: String(payload.contactName ?? '').trim() || undefined,
    contactPhone: String(payload.phone ?? payload.contactPhone ?? '').trim() || undefined,
    address: String(payload.address ?? '').trim(),
    timezone: String(payload.timezone ?? '').trim() || undefined,
    currency: String(payload.currency ?? '').trim() || undefined,
  };
}

function toSettingsCompanyUpdatePayload(payload: CompanyUpdateRequest): Record<string, unknown> {
  const nextPayload: Record<string, unknown> = {};

  if ('name' in payload) {
    nextPayload.name = payload.name;
  }
  if ('businessNumber' in payload) {
    nextPayload.businessNumber = payload.businessNumber;
  }
  if ('contactPhone' in payload) {
    nextPayload.phone = payload.contactPhone;
  }
  if ('address' in payload) {
    nextPayload.address = payload.address;
  }

  return nextPayload;
}

export function getCompany(): Promise<Company> {
  return apiClient.requestData<SettingsCompanyPayload>({
    path: '/api/v2/settings/company',
    method: 'GET',
  }).then((payload) => toCompany(payload));
}

export function patchCompany(payload: CompanyUpdateRequest): Promise<Company> {
  return apiClient.requestData<SettingsCompanyPayload>({
    path: '/api/v2/settings/company',
    method: 'PUT',
    body: toSettingsCompanyUpdatePayload(payload),
  }).then((updatedPayload) => toCompany(updatedPayload));
}
