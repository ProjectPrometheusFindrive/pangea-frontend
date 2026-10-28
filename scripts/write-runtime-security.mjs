import './check-node-runtime.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:zlib';

let gitCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null;
if (!gitCommit) {
  try {
    gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // Exported source archives may have no Git metadata.
  }
}

const report = {
  schemaVersion: 1,
  cve: 'CVE-2026-111497',
  node: process.version,
  brotli: process.versions.brotli,
  brotliBlockSwitchFix: typeof constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH === 'number',
  gitCommit,
  builtAt: new Date().toISOString(),
};
mkdirSync('dist/.well-known', { recursive: true });
writeFileSync('dist/.well-known/runtime-security.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Runtime verification written for Node.js ${process.version}.`);
