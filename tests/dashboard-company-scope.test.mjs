import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('dashboard company scope helpers normalize sentinel ids and preserve other query state', async () => {
  const moduleUrl = pathToFileURL(path.join(projectRoot, 'src/app/pages/dashboardCompanyScope.ts')).href;
  const module = await import(moduleUrl);

  assert.equal(module.normalizeDashboardCompanyId('C9'), 'C9');
  assert.equal(module.normalizeDashboardCompanyId('0000000000'), null);
  assert.equal(module.normalizeDashboardCompanyId('company-local'), null);

  assert.equal(module.resolveDashboardCompanyScope(null, 'C1', 'super_admin'), null);
  assert.equal(module.resolveDashboardCompanyScope('C2', 'C1', 'super_admin'), 'C2');
  assert.equal(module.resolveDashboardCompanyScope('C2', 'C1', 'admin'), 'C1');
  assert.equal(module.shouldShowDashboardCompanySelector('super_admin'), true);
  assert.equal(module.shouldShowDashboardCompanySelector('member'), false);

  const withCompany = module.updateDashboardSearchParams(
    new URLSearchParams('preset=last30Days&granularity=week'),
    { companyId: 'C9' },
  );
  assert.equal(withCompany.get('preset'), 'last30Days');
  assert.equal(withCompany.get('granularity'), 'week');
  assert.equal(withCompany.get('companyId'), 'C9');

  const aggregate = module.updateDashboardSearchParams(withCompany, { companyId: null });
  assert.equal(aggregate.get('preset'), 'last30Days');
  assert.equal(aggregate.get('granularity'), 'week');
  assert.equal(aggregate.has('companyId'), false);
});

test('dashboard services and pages wire company scope through settings companies and URL state', async () => {
  const [settingsSource, homeServiceSource, revenueServiceSource, homePageSource, revenuePageSource] = await Promise.all([
    readFile(path.join(projectRoot, 'src/services/settings.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/services/home.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/services/revenue.ts'), 'utf8'),
    readFile(path.join(projectRoot, 'src/app/pages/Home.tsx'), 'utf8'),
    readFile(path.join(projectRoot, 'src/app/pages/Revenue.tsx'), 'utf8'),
  ]);

  assert.match(settingsSource, /listSettingsCompanies/);
  assert.match(settingsSource, /path:\s*'\/api\/v2\/settings\/companies'/);

  assert.match(homeServiceSource, /companyId\?: string/);
  assert.match(homeServiceSource, /query:\s*\{[\s\S]*companyId,\s*[\s\S]*\}/u);
  assert.doesNotMatch(homeServiceSource, /tenantId:\s*tenantId/u);

  assert.match(revenueServiceSource, /companyId\?: string/);
  assert.match(revenueServiceSource, /query:\s*\{[\s\S]*companyId,\s*[\s\S]*\}/u);

  assert.match(homePageSource, /useSearchParams/u);
  assert.match(homePageSource, /listSettingsCompanies/u);
  assert.match(homePageSource, /resolveDashboardCompanyScope/u);
  assert.match(homePageSource, /getHomeSummary\(\{[\s\S]*companyId:\s*filters\.companyId\s*\?\?\s*undefined/u);

  assert.match(revenuePageSource, /useSearchParams/u);
  assert.match(revenuePageSource, /listSettingsCompanies/u);
  assert.match(revenuePageSource, /resolveDashboardCompanyScope/u);
  assert.match(revenuePageSource, /getRevenueSummary\(\{[\s\S]*companyId:\s*filters\.companyId\s*\?\?\s*undefined/u);
  assert.match(revenuePageSource, /getRevenueTrend\(\{[\s\S]*companyId:\s*filters\.companyId\s*\?\?\s*undefined/u);
});
