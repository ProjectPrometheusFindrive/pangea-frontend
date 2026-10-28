import { constants } from 'node:zlib';

const [major, minor, patch] = process.versions.node.split('.').map(Number);
const supported = major === 22 && (minor > 23 || (minor === 23 && patch >= 4));
const hasBrotliFix = typeof constants.BROTLI_DECODER_ERROR_FORMAT_BLOCK_SWITCH === 'number';

if (!supported || !hasBrotliFix) {
  console.error(
    `Unsupported Node.js ${process.version}. Pangea requires patched Node.js >=22.23.4 <23 ` +
    '(CVE-2026-111497). Run: source ~/.nvm/nvm.sh && nvm install && nvm use',
  );
  process.exit(1);
}

console.log(`Node.js ${process.version}: Brotli security runtime check passed.`);
