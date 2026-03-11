import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('logout redirect uses in-app history navigation instead of forcing a document reload', () => {
  const source = readProjectFile('src/app/context/AuthContext.tsx');

  assert.match(source, /window\.history\.(pushState|replaceState)/u);
  assert.match(source, /PopStateEvent\('popstate'\)/u);
  assert.doesNotMatch(source, /window\.location\.assign/u);
});

test('auth service exposes a role-aware default landing path helper', () => {
  const source = readProjectFile('src/services/auth.ts');

  assert.match(source, /export function resolveDefaultLandingPath/u);
  assert.match(source, /viewRole === 'device-installer'/u);
  assert.match(source, /return '\/device-installation'/u);
});

test('login page uses the role-aware default landing path helper for root redirects', () => {
  const source = readProjectFile('src/app/pages/Login.tsx');

  assert.match(source, /resolveDefaultLandingPath/u);
  assert.match(source, /storedReturnUrl/u);
  assert.match(source, /storedReturnUrl !== '\/'/u);
  assert.match(source, /Navigate to=\{resolvedAuthenticatedPath\}/u);
});

test('forbidden page uses the role-aware default landing path helper for the CTA', () => {
  const source = readProjectFile('src/app/pages/Forbidden.tsx');

  assert.match(source, /resolveDefaultLandingPath/u);
  assert.match(source, /to=\{resolveDefaultLandingPath\(viewRole\)\}/u);
});

test('SCRUM-284 defines a shared role-aware default landing path helper', () => {
  const source = readProjectFile('src/services/auth.ts');

  assert.match(source, /export function resolveDefaultLandingPath\(viewRole: AuthViewRole \| null \| undefined\): string/u);
  assert.match(source, /viewRole === 'device-installer'/u);
  assert.match(source, /return '\/device-installation'/u);
  assert.match(source, /return '\/'/u);
});

test('SCRUM-284 login and forbidden page reuse the role-aware default landing path', () => {
  const loginSource = readProjectFile('src/app/pages/Login.tsx');
  const forbiddenSource = readProjectFile('src/app/pages/Forbidden.tsx');

  assert.match(loginSource, /viewRole/u);
  assert.match(loginSource, /resolveDefaultLandingPath\(viewRole\)/u);
  assert.match(loginSource, /storedReturnUrl && storedReturnUrl !== '\/'/u);
  assert.match(loginSource, /resolvePostLoginPath\(storedReturnUrl, authenticatedUser\?\.role\)/u);

  assert.match(forbiddenSource, /useAuth\(\)/u);
  assert.match(forbiddenSource, /resolveDefaultLandingPath\(viewRole\)/u);
  assert.match(forbiddenSource, /to=\{resolveDefaultLandingPath\(viewRole\)\}/u);
});

test('SCRUM-284 resolves post-login landing from the authenticated user instead of stale pre-login viewRole', () => {
  const loginSource = readProjectFile('src/app/pages/Login.tsx');
  const authContextSource = readProjectFile('src/app/context/AuthContext.tsx');

  assert.match(authContextSource, /login: \(payload: AuthLoginPayload\) => Promise<AuthUser \| null>;/u);
  assert.match(loginSource, /const authenticatedUser = await login\(payload\);/u);
  assert.match(loginSource, /const postLoginViewRole = toViewRole\(authenticatedUserRole\);/u);
  assert.match(loginSource, /return resolveDefaultLandingPath\(postLoginViewRole \?\? viewRole\);/u);
});
