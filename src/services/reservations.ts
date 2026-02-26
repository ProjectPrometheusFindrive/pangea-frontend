import { apiClient } from './api';

export interface ReservationsRequestOptions {
  signal?: AbortSignal;
}

export interface GetReservationsListParams extends ReservationsRequestOptions {
  page: number;
  size: number;
  status?: string;
  contractStatus?: string;
  from?: string;
  to?: string;
}

export interface GetReservationDetailOptions extends ReservationsRequestOptions {}

function toContractStatus(statusValue?: string): string | undefined {
  if (!statusValue) {
    return undefined;
  }

  const normalized = statusValue.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'reservation' || normalized === '예약' || normalized === '예약중') {
    return '예약중';
  }
  if (normalized === 'rental' || normalized === '대여' || normalized === '대여중') {
    return '대여중';
  }
  if (normalized === 'return' || normalized === '반납' || normalized === '완료' || normalized === '반납완료') {
    return '완료';
  }

  return undefined;
}

export function getReservationsList({
  page,
  size,
  status,
  contractStatus,
  from,
  to,
  signal,
}: GetReservationsListParams): Promise<unknown> {
  const normalizedContractStatus = contractStatus ?? toContractStatus(status);

  return apiClient.requestData<unknown>({
    path: '/api/v2/reservations',
    method: 'GET',
    query: {
      page,
      size,
      pageSize: size,
      status,
      contractStatus: normalizedContractStatus,
      from,
      to,
    },
    signal,
  });
}

export function getReservationDetail(
  reservationId: string,
  options: GetReservationDetailOptions = {},
): Promise<unknown> {
  return apiClient.requestData<unknown>({
    path: `/api/v2/reservations/${encodeURIComponent(reservationId)}`,
    method: 'GET',
    signal: options.signal,
  });
}
