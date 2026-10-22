import test from 'node:test';
import assert from 'node:assert/strict';
import { windows, report, batchRequest, batchResponse } from './report.mjs';
test('uses non-overlapping 28-day windows in Google reporting timezone, excluding recent days', () => {
  assert.deepEqual(windows(new Date('2026-10-22T00:30:00Z')), [{ startDate: '2026-09-21', endDate: '2026-10-18' }, { startDate: '2026-08-24', endDate: '2026-09-20' }]);
});
test('bounds all eight reads to Rollside blog, final web data and separate totals', async () => {
  const calls = [];
  const result = await report({ request: async options => { calls.push(options); return { data: { rows: [{ keys: [], clicks: 2, impressions: 10, ctr: .2, position: 9 }] } }; } });
  assert.equal(calls.length, 8);
  for (const call of calls) {
    assert.match(call.url, /sites\/https%3A%2F%2Frollside.studio%2F\/searchAnalytics\/query$/);
    assert.equal(call.data.dataState, 'final'); assert.equal(call.data.type, 'web');
    assert.ok(call.data.rowLimit <= 1000); assert.equal(call.retry, false);
    assert.equal(call.data.dimensionFilterGroups[0].filters[0].expression, '^https://rollside\\.studio/blog/');
  }
  assert.equal(result.hasBlogData, true);
  assert.equal(result.periods[0].totals.rows[0].clicks, 2);
});
test('zero rows are insufficient data, not an invented performance measurement', async () => {
  const result = await report({ request: async () => ({ data: {} }) });
  assert.equal(result.hasBlogData, false);
});
test('rejects other properties and malformed API metrics', async () => {
  await assert.rejects(report({ property: 'sc-domain:soma-meditation.com' }), /Only the Rollside/);
  await assert.rejects(report({ request: async () => ({ data: { rows: [{ clicks: 'secret' }] } }) }), /Invalid/);
});
test('uses the official batch endpoint with only a Rollside Search Analytics read', () => {
  const batch = batchRequest('https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Frollside.studio%2F/searchAnalytics/query', { rowLimit: 1 });
  assert.equal(batch.url, 'https://searchconsole.googleapis.com/batch');
  assert.match(batch.body, /POST \/webmasters\/v3\/sites\/https%3A%2F%2Frollside.studio%2F\/searchAnalytics\/query HTTP\/1.1/);
  assert.doesNotMatch(batch.body, /Authorization|Bearer/);
  assert.throws(() => batchRequest('https://example.com/', {}));
});
test('checks nested HTTP status instead of mistaking outer HTTP 200 for success', () => {
  const fixture = status => `--reply\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 ${status} Response\r\nContent-Type: application/json\r\n\r\n{}\r\n--reply--\r\n`;
  assert.deepEqual(batchResponse(fixture(200), 'multipart/mixed; boundary=reply'), { data: {} });
  assert.throws(() => batchResponse(fixture(403), 'multipart/mixed; boundary=reply'), error => error.response.status === 403);
  assert.throws(() => batchResponse('{}', 'application/json'));
});
