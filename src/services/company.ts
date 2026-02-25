import { apiClient } from './api';

export interface Company {
  id: string;
  name: string;
  businessNumber: string;
  contactName: string;
  contactPhone: string;
  address: string;
  timezone?: string;
  currency?: string;
}

export type CompanyUpdateRequest = Partial<Omit<Company, 'id'>>;

export function getCompany(): Promise<Company> {
  return apiClient.requestData<Company>({
    path: '/api/v2/company',
    method: 'GET',
  });
}

export function patchCompany(payload: CompanyUpdateRequest): Promise<Company> {
  return apiClient.requestData<Company>({
    path: '/api/v2/company',
    method: 'PATCH',
    body: payload,
  });
}
