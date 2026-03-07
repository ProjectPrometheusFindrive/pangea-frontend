export const ROUTE_PERMISSIONS = {
  home: 'route.home',
  actionRequired: 'route.action-required',
  assets: 'route.assets',
  reservations: 'route.reservations',
  revenue: 'route.revenue',
  supportCenter: 'route.support-center',
  settings: 'route.settings',
  deviceInstallation: 'route.device-installation',
} as const;

export const ACTION_PERMISSIONS = {
  assetsWrite: 'action.assets.write',
  reservationsWrite: 'action.reservations.write',
  actionRequiredWrite: 'action.action-required.write',
  revenueWrite: 'action.revenue.write',
  paymentsWrite: 'action.payments.write',
  supportManage: 'action.support.manage',
  settingsWrite: 'action.settings.write',
  settingsMembersWrite: 'action.settings.members.write',
  deviceInstallationWrite: 'action.device-installation.write',
} as const;

export type AppRoutePermission = (typeof ROUTE_PERMISSIONS)[keyof typeof ROUTE_PERMISSIONS];
export type AppActionPermission = (typeof ACTION_PERMISSIONS)[keyof typeof ACTION_PERMISSIONS];
export type AppPermission = AppRoutePermission | AppActionPermission;

export type AuthorizationSource = 'api' | 'deny-by-default';

export const KNOWN_APP_PERMISSIONS: AppPermission[] = [
  ROUTE_PERMISSIONS.home,
  ROUTE_PERMISSIONS.actionRequired,
  ROUTE_PERMISSIONS.assets,
  ROUTE_PERMISSIONS.reservations,
  ROUTE_PERMISSIONS.revenue,
  ROUTE_PERMISSIONS.supportCenter,
  ROUTE_PERMISSIONS.settings,
  ROUTE_PERMISSIONS.deviceInstallation,
  ACTION_PERMISSIONS.assetsWrite,
  ACTION_PERMISSIONS.reservationsWrite,
  ACTION_PERMISSIONS.actionRequiredWrite,
  ACTION_PERMISSIONS.revenueWrite,
  ACTION_PERMISSIONS.paymentsWrite,
  ACTION_PERMISSIONS.supportManage,
  ACTION_PERMISSIONS.settingsWrite,
  ACTION_PERMISSIONS.settingsMembersWrite,
  ACTION_PERMISSIONS.deviceInstallationWrite,
];

const PERMISSION_CONTAINER_KEYS = new Set([
  'permission',
  'permissions',
  'scope',
  'scopes',
  'authority',
  'authorities',
  'route',
  'routes',
  'action',
  'actions',
]);

const KNOWN_PERMISSION_SET = new Set<AppPermission>(KNOWN_APP_PERMISSIONS);

function toPermissionToken(rawToken: string): string {
  return rawToken.trim();
}

function toContainerKey(rawKey: string): string {
  return rawKey.trim().toLowerCase();
}

function addPermissionMatchesFromToken(rawToken: string, target: Set<AppPermission>): void {
  const token = toPermissionToken(rawToken);
  if (!token) {
    return;
  }

  if (token === '*') {
    for (const permission of KNOWN_APP_PERMISSIONS) {
      target.add(permission);
    }
    return;
  }

  if (KNOWN_PERMISSION_SET.has(token as AppPermission)) {
    target.add(token as AppPermission);
  }
}

function isPermissionContainerKey(normalizedKey: string): boolean {
  return PERMISSION_CONTAINER_KEYS.has(normalizedKey);
}

function collectPermissionTokens(
  value: unknown,
  output: string[] = [],
  permissionScope = false,
): string[] {
  if (typeof value === 'string') {
    if (permissionScope) {
      output.push(value);
    }
    return output;
  }

  if (Array.isArray(value)) {
    const nextPermissionScope = permissionScope || value.every((item) => typeof item === 'string');
    for (const item of value) {
      collectPermissionTokens(item, output, nextPermissionScope);
    }
    return output;
  }

  if (typeof value !== 'object' || value === null) {
    return output;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPermissionScope = permissionScope || isPermissionContainerKey(toContainerKey(key));

    if (!nextPermissionScope) {
      collectPermissionTokens(nestedValue, output, false);
      continue;
    }

    if (typeof nestedValue === 'boolean') {
      if (nestedValue) {
        output.push(key);
      }
      continue;
    }

    if (typeof nestedValue === 'number') {
      if (nestedValue > 0) {
        output.push(key);
      }
      continue;
    }

    if (typeof nestedValue === 'string') {
      output.push(nestedValue);
      continue;
    }

    collectPermissionTokens(nestedValue, output, true);
  }

  return output;
}

export function derivePermissionsFromApiPayload(payload: unknown): Set<AppPermission> {
  const permissions = new Set<AppPermission>();
  const permissionTokens = collectPermissionTokens(payload);

  for (const token of permissionTokens) {
    addPermissionMatchesFromToken(token, permissions);
  }

  return permissions;
}

export function permissionSetToArray(permissions: Iterable<AppPermission>): AppPermission[] {
  return Array.from(new Set(permissions));
}

export function hasPermission(
  permissions: ReadonlySet<AppPermission>,
  permission: AppPermission,
): boolean {
  return permissions.has(permission);
}

export function resolveRoutePermissionForPath(pathname: string): AppRoutePermission | null {
  if (pathname === '/') {
    return ROUTE_PERMISSIONS.home;
  }
  if (pathname.startsWith('/action-required')) {
    return ROUTE_PERMISSIONS.actionRequired;
  }
  if (pathname.startsWith('/support-center')) {
    return ROUTE_PERMISSIONS.supportCenter;
  }
  if (pathname.startsWith('/assets')) {
    return ROUTE_PERMISSIONS.assets;
  }
  if (pathname.startsWith('/reservations')) {
    return ROUTE_PERMISSIONS.reservations;
  }
  if (pathname.startsWith('/revenue')) {
    return ROUTE_PERMISSIONS.revenue;
  }
  if (pathname.startsWith('/settings')) {
    return ROUTE_PERMISSIONS.settings;
  }
  if (pathname.startsWith('/device-installation')) {
    return ROUTE_PERMISSIONS.deviceInstallation;
  }
  return null;
}
