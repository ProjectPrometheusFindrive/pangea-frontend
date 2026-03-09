const INVALID_COMPANY_IDS = new Set(['0000000000', '__global__', 'company-local', 'null', 'none']);

export const COMPANY_PROFILE_SETTINGS_PATH = '/settings?tab=company';
export const COMPANY_PROFILE_REQUIRED_MESSAGE = '회사 정보가 비어 있습니다. 설정 > 회사 정보에서 회사명을 먼저 저장한 뒤 다시 시도해 주세요.';

function normalizeText(value) {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function hasValidCompanyId(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }
  return !INVALID_COMPANY_IDS.has(normalized.toLowerCase());
}

export function getAssetCreateReadiness({ tenantCompanyId, company }) {
  if (!hasValidCompanyId(tenantCompanyId)) {
    return {
      isReady: false,
      message: COMPANY_PROFILE_REQUIRED_MESSAGE,
      settingsPath: COMPANY_PROFILE_SETTINGS_PATH,
    };
  }

  if (company == null) {
    return {
      isReady: true,
      message: null,
      settingsPath: null,
    };
  }

  const companyName = normalizeText(company?.name);
  const companyId = normalizeText(company?.id);
  if (!hasValidCompanyId(companyId) || !companyName) {
    return {
      isReady: false,
      message: COMPANY_PROFILE_REQUIRED_MESSAGE,
      settingsPath: COMPANY_PROFILE_SETTINGS_PATH,
    };
  }

  return {
    isReady: true,
    message: null,
    settingsPath: null,
  };
}
