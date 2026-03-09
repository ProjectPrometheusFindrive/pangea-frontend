import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const projectRoot = path.resolve(import.meta.dirname, '..');

function extractFunctionSource(source, functionName) {
  const declaration = `function ${functionName}(`;
  const startIndex = source.indexOf(declaration);
  assert.notEqual(startIndex, -1, `${functionName} was not found`);

  const bodyStartIndex = source.indexOf('{', startIndex);
  assert.notEqual(bodyStartIndex, -1, `${functionName} body start was not found`);

  let depth = 0;
  for (let index = bodyStartIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error(`${functionName} body end was not found`);
}

function loadToCompany() {
  const source = fs.readFileSync(path.join(projectRoot, 'src/services/company.ts'), 'utf8');
  const functionSource = extractFunctionSource(source, 'toCompany').replace(
    /function toCompany\(payload: SettingsCompanyPayload\): Company \{/u,
    'function toCompany(payload) {',
  );

  const context = {
    module: { exports: {} },
  };

  vm.runInNewContext(`${functionSource}\nmodule.exports = { toCompany };`, context);
  return context.module.exports.toCompany;
}

test('toCompany keeps a valid id field when companyId is omitted', () => {
  const toCompany = loadToCompany();

  const company = toCompany({
    id: 'company-001',
    name: 'Pangea Mobility',
    businessNumber: '123-45-67890',
    address: 'Seoul',
  });

  assert.equal(company.id, 'company-001');
  assert.equal(company.name, 'Pangea Mobility');
  assert.equal(company.businessNumber, '123-45-67890');
  assert.equal(company.address, 'Seoul');
});
