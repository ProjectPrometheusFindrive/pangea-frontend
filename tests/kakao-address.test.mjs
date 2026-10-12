import assert from 'node:assert/strict';
import test from 'node:test';
import { queryKakaoAddress } from '../src/services/kakaoAddress.js';

test('latest coordinates use x=longitude/y=latitude and prefer road address', () => {
  const calls = [];
  const services = { Status: { OK: 'OK' }, Geocoder: class {
    coord2Address(x, y, callback) { calls.push([x, y]); callback([{ road_address: { address_name: '도로명 주소' }, address: { address_name: '지번 주소' } }], 'OK'); }
  } };
  queryKakaoAddress(services, 127.09, 37.40, (name) => assert.equal(name, '도로명 주소'));
  assert.deepEqual(calls, [[127.09, 37.40]]);
});

test('jibun fallback, empty result and errors are explicit', () => {
  for (const [rows, status, expected] of [
    [[{ address: { address_name: '지번 주소' } }], 'OK', '지번 주소'],
    [[], 'OK', null], [[], 'ERROR', null],
  ]) {
    queryKakaoAddress({ Status: { OK: 'OK' }, Geocoder: class { coord2Address(x, y, cb) { cb(rows, status); } } }, 127, 37, (name) => assert.equal(name, expected));
  }
  queryKakaoAddress(undefined, 127, 37, (name) => assert.equal(name, null));
  queryKakaoAddress({ Geocoder: class { constructor() { throw new Error('SDK unavailable'); } } }, 127, 37, (name) => assert.equal(name, null));
});
