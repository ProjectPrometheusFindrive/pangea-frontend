const INVALID_DASHBOARD_COMPANY_IDS = new Set(['0000000000', '__global__', 'company-local', 'null', 'none']);

export interface DashboardCompanyOption {
  companyId: string;
  name: string;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function normalizeDashboardCompanyId(value: unknown): string | null {
  const companyId = toNonEmptyString(value);
  if (!companyId) {
    return null;
  }
  return INVALID_DASHBOARD_COMPANY_IDS.has(companyId.toLowerCase()) ? null : companyId;
}

export function shouldShowDashboardCompanySelector(role: unknown): boolean {
  return toNonEmptyString(role)?.toLowerCase() === 'super_admin';
}

export function resolveDashboardCompanyScope(
  explicitCompanyId: unknown,
  authCompanyId: unknown,
  role: unknown,
): string | null {
  if (shouldShowDashboardCompanySelector(role)) {
    return normalizeDashboardCompanyId(explicitCompanyId);
  }
  return normalizeDashboardCompanyId(authCompanyId);
}

export function updateDashboardSearchParams(
  params: URLSearchParams,
  updates: {
    preset?: string | null;
    granularity?: string | null;
    companyId?: string | null;
  },
): URLSearchParams {
  const nextParams = new URLSearchParams(params);

  if ('preset' in updates) {
    const preset = toNonEmptyString(updates.preset);
    if (preset) {
      nextParams.set('preset', preset);
    } else {
      nextParams.delete('preset');
    }
  }

  if ('granularity' in updates) {
    const granularity = toNonEmptyString(updates.granularity);
    if (granularity) {
      nextParams.set('granularity', granularity);
    } else {
      nextParams.delete('granularity');
    }
  }

  if ('companyId' in updates) {
    const companyId = normalizeDashboardCompanyId(updates.companyId);
    if (companyId) {
      nextParams.set('companyId', companyId);
    } else {
      nextParams.delete('companyId');
    }
  }

  return nextParams;
}

export function normalizeDashboardCompanyOptions(items: DashboardCompanyOption[]): DashboardCompanyOption[] {
  const optionsByCompanyId = new Map<string, DashboardCompanyOption>();

  for (const item of items) {
    const companyId = normalizeDashboardCompanyId(item.companyId);
    if (!companyId) {
      continue;
    }
    const name = toNonEmptyString(item.name) ?? companyId;
    optionsByCompanyId.set(companyId, {
      companyId,
      name,
    });
  }

  return Array.from(optionsByCompanyId.values()).sort((left, right) => {
    const leftLabel = `${left.name}\u0000${left.companyId}`.toLowerCase();
    const rightLabel = `${right.name}\u0000${right.companyId}`.toLowerCase();
    return leftLabel.localeCompare(rightLabel);
  });
}
