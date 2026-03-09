export const ACTION_REQUIRED_ROUTE = '/action-required';
export const NOTIFICATIONS_ROUTE = '/notifications';

function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

function toText(value) {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : '';
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

function toNavigationPath(value) {
  const normalizedValue = toText(value);

  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.startsWith('/')) {
    return normalizedValue;
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` || '';
  } catch {
    return '';
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalizedValue = toText(value);
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return '';
}

function toReservationPath(searchValue) {
  return `/reservations?search=${encodeURIComponent(searchValue)}`;
}

function toAssetPath(searchValue) {
  return `/assets?search=${encodeURIComponent(searchValue)}`;
}

function buildFallbackPath(payload) {
  const metadata = isRecord(payload.metadata) ? payload.metadata : {};
  const entityType = firstNonEmpty(
    payload.entityType,
    payload.resourceType,
    payload.targetType,
    metadata.entityType,
    metadata.resourceType,
    metadata.targetType,
  ).toLowerCase();

  const reservationSearch = firstNonEmpty(
    payload.reservationId,
    payload.rentalId,
    metadata.reservationId,
    metadata.rentalId,
  );
  if (reservationSearch) {
    return toReservationPath(reservationSearch);
  }

  const vehicleSearch = firstNonEmpty(
    payload.vehicleNumber,
    payload.plateNumber,
    payload.plate,
    payload.vin,
    metadata.vehicleNumber,
    metadata.plateNumber,
    metadata.plate,
    metadata.vin,
  );

  if (entityType.includes('asset') || entityType.includes('vehicle')) {
    return toAssetPath(vehicleSearch || firstNonEmpty(payload.assetId, metadata.assetId));
  }

  if (vehicleSearch) {
    return toReservationPath(vehicleSearch);
  }

  const assetSearch = firstNonEmpty(
    payload.assetId,
    metadata.assetId,
  );
  if (assetSearch) {
    return toAssetPath(assetSearch);
  }

  return ACTION_REQUIRED_ROUTE;
}

export function resolveNotificationPath(payload) {
  if (!isRecord(payload)) {
    return ACTION_REQUIRED_ROUTE;
  }

  const explicitPath = toNavigationPath(
    payload.path
      ?? payload.route
      ?? payload.link
      ?? payload.linkUrl
      ?? payload.url
      ?? payload.actionUrl
      ?? payload.deepLink,
  );

  if (explicitPath) {
    return explicitPath;
  }

  return buildFallbackPath(payload);
}
