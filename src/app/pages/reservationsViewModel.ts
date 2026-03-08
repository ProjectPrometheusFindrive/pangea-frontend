import { getCollectionFromPayload } from '../hooks/usePageEndpointState';
import type { VehicleAsset } from '../types/assets';
import type { Reservation } from '../types/reservations';
import type { PaymentSyncTarget } from '../utils/paymentStatusSync';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeIssues(issueValue: unknown): string[] {
  if (!Array.isArray(issueValue)) {
    return [];
  }

  return issueValue
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }
      if (isRecord(entry)) {
        return toStringValue(entry.label) ?? toStringValue(entry.name) ?? toStringValue(entry.type) ?? '';
      }
      return '';
    })
    .filter((entry) => entry.length > 0);
}

function normalizeVehicleStatus(statusValue: string | null): VehicleAsset['status'] {
  if (statusValue === '대여중' || statusValue === '예약' || statusValue === '가용' || statusValue === '정비중') {
    return statusValue;
  }
  if (statusValue === 'reserved' || statusValue === '예약됨') {
    return '예약';
  }
  if (statusValue === 'rental' || statusValue === 'in_use') {
    return '대여중';
  }
  if (statusValue === 'maintenance' || statusValue === 'repair') {
    return '정비중';
  }
  return '가용';
}

function toVehicleStatusFromReservation(reservationType: Reservation['type']): VehicleAsset['status'] {
  if (reservationType === 'reservation') {
    return '예약';
  }
  if (reservationType === 'rental') {
    return '대여중';
  }
  return '가용';
}

function getReservationOverlayPriority(reservation: Reservation): number {
  if (reservation.type === 'rental') {
    return 300;
  }
  if (reservation.type === 'reservation') {
    return 200;
  }
  return 100;
}

function chooseDominantReservation(current: Reservation | null, next: Reservation): Reservation {
  if (!current) {
    return next;
  }

  const currentPriority = getReservationOverlayPriority(current);
  const nextPriority = getReservationOverlayPriority(next);
  if (nextPriority > currentPriority) {
    return next;
  }
  if (nextPriority < currentPriority) {
    return current;
  }

  if (next.startDate > current.startDate) {
    return next;
  }
  if (next.startDate < current.startDate) {
    return current;
  }

  if (next.endDate > current.endDate) {
    return next;
  }
  return current;
}

function toVehicleAssetRow(row: unknown): VehicleAsset | null {
  if (!isRecord(row)) {
    return null;
  }

  const vehicleNumber = toStringValue(row.vehicleNumber)
    ?? toStringValue(row.plateNumber)
    ?? toStringValue(row.plate);
  if (!vehicleNumber) {
    return null;
  }

  return {
    vehicleNumber,
    model: toStringValue(row.model) ?? toStringValue(row.vehicleModel) ?? '차종 미확인',
    status: normalizeVehicleStatus(
      toStringValue(row.status) ?? toStringValue(row.contractStatus) ?? toStringValue(row.assetStatus),
    ),
    issues: normalizeIssues(row.issues),
    insuranceExpiry: toStringValue(row.insuranceExpiry) ?? toStringValue(row.insuranceExpiryDate) ?? '-',
    nextInspection: toStringValue(row.nextInspection) ?? toStringValue(row.nextInspectionDate) ?? '-',
    vin: toStringValue(row.vin) ?? toStringValue(row.chassisNumber) ?? '-',
    year: toStringValue(row.year) ?? toStringValue(row.modelYear) ?? '-',
    owner: toStringValue(row.owner) ?? toStringValue(row.ownerName) ?? '-',
  };
}

export function createFallbackVehicleAsset(reservation: Reservation): VehicleAsset {
  return {
    vehicleNumber: reservation.vehicleNumber,
    model: '차종 미확인',
    status: toVehicleStatusFromReservation(reservation.type),
    issues: reservation.issues ?? [],
    insuranceExpiry: '-',
    nextInspection: '-',
    vin: '-',
    year: '-',
    owner: '-',
  };
}

function overlayReservationOnVehicle(baseAsset: VehicleAsset, reservation: Reservation): VehicleAsset {
  return {
    ...baseAsset,
    status: toVehicleStatusFromReservation(reservation.type),
    issues: reservation.issues && reservation.issues.length > 0 ? reservation.issues : baseAsset.issues,
  };
}

export function mergeVehicleRows(assetPayload: unknown, reservationRows: Reservation[]): VehicleAsset[] {
  const vehicleMap = new Map<string, VehicleAsset>();
  const dominantReservationByVehicle = new Map<string, Reservation>();
  const rows = getCollectionFromPayload(assetPayload, ['vehicleAssets', 'vehicles', 'assets']) ?? [];

  for (const row of rows) {
    const vehicleAsset = toVehicleAssetRow(row);
    if (!vehicleAsset) {
      continue;
    }
    vehicleMap.set(vehicleAsset.vehicleNumber, vehicleAsset);
  }

  for (const reservation of reservationRows) {
    const currentReservation = dominantReservationByVehicle.get(reservation.vehicleNumber) ?? null;
    dominantReservationByVehicle.set(
      reservation.vehicleNumber,
      chooseDominantReservation(currentReservation, reservation),
    );
  }

  for (const reservation of dominantReservationByVehicle.values()) {
    const existingVehicle = vehicleMap.get(reservation.vehicleNumber);
    if (existingVehicle) {
      vehicleMap.set(reservation.vehicleNumber, overlayReservationOnVehicle(existingVehicle, reservation));
      continue;
    }

    vehicleMap.set(reservation.vehicleNumber, createFallbackVehicleAsset(reservation));
  }

  return Array.from(vehicleMap.values());
}

export function buildPaymentSyncTargets(reservations: Reservation[]): PaymentSyncTarget[] {
  return reservations
    .map((reservation) => ({
      reservationId: reservation.id,
      fallbackStatus: reservation.paymentStatus,
    }));
}
