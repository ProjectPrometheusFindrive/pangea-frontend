function normalizeRole(role) {
  if (typeof role !== 'string') {
    return '';
  }
  return role.trim().toLowerCase();
}

export function shouldRedirectToForbiddenForRoute({ hasRoutePermission, userRole }) {
  if (hasRoutePermission) {
    return false;
  }

  return normalizeRole(userRole) !== 'super_admin';
}
