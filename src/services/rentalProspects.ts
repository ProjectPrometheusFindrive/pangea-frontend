import { apiClient } from './api';

export interface RentalProspect {
  id: string;
  name: string;
  officeType: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  totalVehicles: number | null;
  passengerVehicles: number | null;
  vans: number | null;
  electricPassengerVehicles: number | null;
  electricVans: number | null;
  referenceDate: string;
  provider: string;
  memo: string;
  excluded: boolean;
  updatedAt?: string;
}
export interface RentalProspectData {
  items: RentalProspect[];
  sourceUrl: string;
  fetchedAt: string;
  sourceName: string;
}
export const getRentalProspects = (signal?: AbortSignal) => apiClient.requestData<RentalProspectData>({
  path: '/api/v2/admin/rental-prospects', method: 'GET', signal,
});
export const updateRentalProspect = (id: string, body: { memo?: string; excluded?: boolean }) =>
  apiClient.requestData<Pick<RentalProspect, 'id' | 'memo' | 'excluded' | 'updatedAt'>>({
    path: `/api/v2/admin/rental-prospects/${encodeURIComponent(id)}`, method: 'PATCH', body,
  });
