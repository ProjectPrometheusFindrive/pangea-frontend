import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
const routeGuardPolicyModuleUrl = new URL('../src/app/components/requireAuthPolicy.js', import.meta.url);

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('SCRUM-299 exposes a shared super_admin role helper', () => {
  const authSource = readProjectFile('src/services/auth.ts');

  assert.match(authSource, /export function isSuperAdminRole\(role: string \| null \| undefined\): boolean/u);
  assert.match(authSource, /role\?\.trim\(\)\.toLowerCase\(\) === 'super_admin'/u);
});

test('SCRUM-299 route guard bypasses route permission denial for super_admin only', async () => {
  const { shouldRedirectToForbiddenForRoute } = await import(routeGuardPolicyModuleUrl.href);
  const requireAuthSource = readProjectFile('src/app/components/RequireAuth.tsx');

  assert.equal(shouldRedirectToForbiddenForRoute({ hasRoutePermission: false, userRole: 'super_admin' }), false);
  assert.equal(shouldRedirectToForbiddenForRoute({ hasRoutePermission: false, userRole: ' admin ' }), true);
  assert.equal(shouldRedirectToForbiddenForRoute({ hasRoutePermission: true, userRole: 'member' }), false);

  assert.match(requireAuthSource, /shouldRedirectToForbiddenForRoute\(\{/u);
  assert.match(requireAuthSource, /userRole:\s*user\?\.role/u);
  assert.match(requireAuthSource, /hasRoutePermission:\s*canAccessRoute\(routePermission\)/u);
  assert.match(requireAuthSource, /if \(allowedRoles && \(!viewRole \|\| !allowedRoles\.includes\(viewRole\)\)\) \{/u);
  assert.match(requireAuthSource, /return <Navigate to=\{ROUTE_FORBIDDEN_REDIRECT_PATH\} replace \/>;/u);
});
