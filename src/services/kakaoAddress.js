// Kakao takes longitude (x), latitude (y). No vehicle identity is sent.
export function queryKakaoAddress(services, longitude, latitude, onResult) {
  try {
    if (!services?.Geocoder || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      onResult(null);
      return;
    }
    new services.Geocoder().coord2Address(longitude, latitude, (rows, status) => {
      const result = status === services.Status.OK ? rows?.[0] : null;
      const name = result?.road_address?.address_name || result?.address?.address_name;
      onResult(typeof name === 'string' && name.trim() ? name : null);
    });
  } catch {
    onResult(null);
  }
}
