import type { AuthViewRole } from '../services/auth';

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
  settingsWrite: 'action.settings.write',
  settingsMembersWrite: 'action.settings.members.write',
  deviceInstallationWrite: 'action.device-installation.write',
} as const;

export type AppRoutePermission = (typeof ROUTE_PERMISSIONS)[keyof typeof ROUTE_PERMISSIONS];
export type AppActionPermission = (typeof ACTION_PERMISSIONS)[keyof typeof ACTION_PERMISSIONS];
export type AppPermission = AppRoutePermission | AppActionPermission;

export type AuthorizationSource = 'api' | 'role-fallback' | 'deny-by-default';

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
  ACTION_PERMISSIONS.settingsWrite,
  ACTION_PERMISSIONS.settingsMembersWrite,
  ACTION_PERMISSIONS.deviceInstallationWrite,
];

const RENTAL_ROUTE_PERMISSIONS: AppRoutePermission[] = [
  ROUTE_PERMISSIONS.home,
  ROUTE_PERMISSIONS.actionRequired,
  ROUTE_PERMISSIONS.assets,
  ROUTE_PERMISSIONS.reservations,
  ROUTE_PERMISSIONS.revenue,
  ROUTE_PERMISSIONS.supportCenter,
  ROUTE_PERMISSIONS.settings,
];

const RENTAL_WRITE_PERMISSIONS: AppActionPermission[] = [
  ACTION_PERMISSIONS.assetsWrite,
  ACTION_PERMISSIONS.reservationsWrite,
  ACTION_PERMISSIONS.actionRequiredWrite,
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

function toNormalizedToken(rawToken: string): string {
  const trimmedToken = rawToken.trim().toLowerCase();
  if (!trimmedToken) {
    return '';
  }
  if (trimmedToken === '*') {
    return '*';
  }

  return trimmedToken
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
}

function tokenIncludes(normalizedToken: string, ...keywords: string[]): boolean {
  return keywords.some((keyword) => normalizedToken.includes(keyword));
}

function isReadLikeToken(normalizedToken: string): boolean {
  return tokenIncludes(
    normalizedToken,
    'read',
    'view',
    'list',
    'query',
    'access',
    'route',
    'menu',
    'all',
    'full',
  );
}

function isWriteLikeToken(normalizedToken: string): boolean {
  return tokenIncludes(
    normalizedToken,
    'write',
    'create',
    'update',
    'patch',
    'delete',
    'edit',
    'manage',
    'assign',
    'all',
    'full',
  );
}

function addRentalRoutePermission(
  normalizedToken: string,
  permission: AppRoutePermission,
  target: Set<AppPermission>,
): void {
  if (isReadLikeToken(normalizedToken) || isWriteLikeToken(normalizedToken)) {
    target.add(permission);
  }
}

function addPermissionMatchesFromToken(rawToken: string, target: Set<AppPermission>): void {
  const normalizedToken = toNormalizedToken(rawToken);
  if (!normalizedToken) {
    return;
  }

  if (KNOWN_APP_PERMISSIONS.includes(normalizedToken as AppPermission)) {
    target.add(normalizedToken as AppPermission);
    return;
  }

  if (
    normalizedToken === '*'
    || normalizedToken === 'admin'
    || normalizedToken === 'super.admin'
    || normalizedToken === 'superadmin'
    || normalizedToken === 'role.admin'
    || normalizedToken === 'role.super.admin'
  ) {
    for (const permission of KNOWN_APP_PERMISSIONS) {
      target.add(permission);
    }
    return;
  }

  if (tokenIncludes(normalizedToken, 'home', 'dashboard')) {
    addRentalRoutePermission(normalizedToken, ROUTE_PERMISSIONS.home, target);
  }

  if (tokenIncludes(normalizedToken, 'action.required', 'action.item', 'actionrequired', 'actionitems')) {
    addRentalRoutePermission(normalizedToken, ROUTE_PERMISSIONS.actionRequired, target);
    if (isWriteLikeToken(normalizedToken)) {
      target.add(ACTION_PERMISSIONS.actionRequiredWrite);
    }
  }

  if (tokenIncludes(normalizedToken, 'asset', 'vehicle')) {
    addRentalRoutePermission(normalizedToken, ROUTE_PERMISSIONS.assets, target);
    if (isWriteLikeToken(normalizedToken)) {
      target.add(ACTION_PERMISSIONS.assetsWrite);
    }
  }

  if (tokenIncludes(normalizedToken, 'reservation', 'rental', 'contract')) {
    addRentalRoutePermission(normalizedToken, ROUTE_PERMISSIONS.reservations, target);
    if (isWriteLikeToken(normalizedToken)) {
      target.add(ACTION_PERMISSIONS.reservationsWrite);
    }
  }

  if (tokenIncludes(normalizedToken, 'revenue', 'sales')) {
    addRentalRoutePermission(normalizedToken, ROUTE_PERMISSIONS.revenue, target);
  }

  if (tokenIncludes(normalizedToken, 'support.center', 'supportcenter', 'customer.center', 'help.desk', 'helpdesk')) {
    addRentalRoutePermission(normalizedToken, ROUTE_PERMISSIONS.supportCenter, target);
  }

  if (tokenIncludes(normalizedToken, 'setting', 'company', 'geofence', 'member')) {
    addRentalRoutePermission(normalizedToken, ROUTE_PERMISSIONS.settings, target);
    if (isWriteLikeToken(normalizedToken) && !tokenIncludes(normalizedToken, 'member.role', 'members.role')) {
      target.add(ACTION_PERMISSIONS.settingsWrite);
    }
    if (tokenIncludes(normalizedToken, 'member') && isWriteLikeToken(normalizedToken)) {
      target.add(ACTION_PERMISSIONS.settingsMembersWrite);
    }
  }

  if (tokenIncludes(normalizedToken, 'device.installation', 'device', 'installer', 'terminal')) {
    if (isReadLikeToken(normalizedToken) || isWriteLikeToken(normalizedToken)) {
      target.add(ROUTE_PERMISSIONS.deviceInstallation);
    }
    if (isWriteLikeToken(normalizedToken)) {
      target.add(ACTION_PERMISSIONS.deviceInstallationWrite);
    }
  }
}

function isPermissionContainerKey(normalizedKey: string): boolean {
  return PERMISSION_CONTAINER_KEYS.has(normalizedKey);
}

function collectPermissionTokens(
  value: unknown,
  output: string[] = [],
  path = '',
  permissionScope = false,
): string[] {
  if (typeof value === 'string') {
    if (permissionScope) {
      output.push(value);
    }
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPermissionTokens(item, output, path, permissionScope);
    }
    return output;
  }

  if (typeof value !== 'object' || value === null) {
    return output;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = toNormalizedToken(key);
    const nextPath = path ? `${path}.${normalizedKey}` : normalizedKey;
    const nextPermissionScope = permissionScope || isPermissionContainerKey(normalizedKey);

    if (typeof nestedValue === 'boolean') {
      if (nestedValue && nextPermissionScope) {
        output.push(nextPath);
      }
      continue;
    }

    if (typeof nestedValue === 'number') {
      if (nestedValue > 0 && nextPermissionScope) {
        output.push(nextPath);
      }
      continue;
    }

    if (typeof nestedValue === 'string') {
      if (nextPermissionScope) {
        output.push(nextPath);
        output.push(nestedValue);
      }
      continue;
    }

    collectPermissionTokens(nestedValue, output, nextPath, nextPermissionScope);
  }

  return output;
}

export function resolveViewRole(role: string | null | undefined): AuthViewRole | null {
  const normalizedRole = (role ?? '').trim().toLowerCase();
  if (normalizedRole === 'installer') {
    return 'device-installer';
  }
  if (normalizedRole === 'super_admin' || normalizedRole === 'admin' || normalizedRole === 'member') {
    return 'rental-business';
  }
  return null;
}

export function derivePermissionsFromRole(role: string | null | undefined): Set<AppPermission> {
  const permissions = new Set<AppPermission>();
  const normalizedRole = (role ?? '').trim().toLowerCase();

  if (normalizedRole === 'installer') {
    permissions.add(ROUTE_PERMISSIONS.deviceInstallation);
    permissions.add(ACTION_PERMISSIONS.deviceInstallationWrite);
    return permissions;
  }

  if (normalizedRole === 'super_admin' || normalizedRole === 'admin' || normalizedRole === 'member') {
    for (const routePermission of RENTAL_ROUTE_PERMISSIONS) {
      permissions.add(routePermission);
    }
    for (const writePermission of RENTAL_WRITE_PERMISSIONS) {
      permissions.add(writePermission);
    }
  }

  if (normalizedRole === 'super_admin' || normalizedRole === 'admin') {
    permissions.add(ACTION_PERMISSIONS.settingsWrite);
    permissions.add(ACTION_PERMISSIONS.settingsMembersWrite);
  }

  return permissions;
}

export function derivePermissionsFromApiPayload(payload: unknown): Set<AppPermission> {
  const permissions = new Set<AppPermission>();
  const permissionTokens = collectPermissionTokens(payload, [], '', Array.isArray(payload));

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
