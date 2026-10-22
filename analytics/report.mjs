import { pathToFileURL } from 'node:url';

export const scope = 'https://www.googleapis.com/auth/webmasters.readonly';
const blogFilter = { dimension: 'page', operator: 'includingRegex', expression: '^https://rollside\\.studio/blog/' };
const day = 86400000;
const iso = ms => new Date(ms).toISOString().slice(0, 10);
export function windows(now = new Date()) {
  const pt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const end = Date.parse(pt + 'T00:00:00Z') - 3 * day;
  return [{ startDate: iso(end - 27 * day), endDate: iso(end) }, { startDate: iso(end - 55 * day), endDate: iso(end - 28 * day) }];
}
export async function report({ request, now = new Date(), property = 'https://rollside.studio/' }) {
  if (!['https://rollside.studio/', 'sc-domain:rollside.studio'].includes(property)) throw new Error('Only the Rollside Search Console property is allowed.');
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
  const ranges = windows(now);
  const datasets = [['totals', [], 1], ['pages', ['page'], 500], ['queries', ['query'], 500], ['pageQueries', ['page', 'query'], 1000]];
  const result = { source: 'Google Search Console API', property, searchType: 'web', dateTimezone: 'America/Los_Angeles', dataState: 'final', generatedAt: now.toISOString(), privacy: 'Private cloud output. Never commit this report to the public repository.', limitations: ['Search clicks are not all website visits or conversions.', 'Query rows omit anonymised searches; top-row API limits mean query sums may differ from totals.', 'Recent posts and low counts are insufficient evidence of success or failure.'], periods: [] };
  for (const range of ranges) {
    const period = { ...range };
    for (const [name, dimensions, rowLimit] of datasets) {
      const response = await request({ url, method: 'POST', data: { ...range, type: 'web', dataState: 'final', dimensions, dimensionFilterGroups: [{ filters: [blogFilter] }], aggregationType: 'byPage', rowLimit }, timeout: 30000, retry: false });
      const rows = response.data.rows || [];
      if (!Array.isArray(rows) || rows.length > rowLimit || rows.some(row => !['clicks', 'impressions', 'ctr', 'position'].every(key => Number.isFinite(row[key]) && row[key] >= 0) || !Array.isArray(row.keys ?? []))) throw new Error('Invalid Search Console response.');
      period[name] = { rows, rowLimit, mayBeTruncated: rows.length === rowLimit && name !== 'totals' };
    }
    result.periods.push(period);
  }
  result.hasBlogData = result.periods.some(period => period.totals.rows.some(row => row.impressions > 0));
  return result;
}
async function main() {
  const request = async ({ url, data, timeout }) => {
    // Claude's cloud proxy attaches a short-lived Google token after the request
    // leaves the VM. No credential or Authorization header is present here.
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), redirect: 'error', signal: AbortSignal.timeout(timeout) });
    if (!response.ok) { const error = new Error('Google API request failed'); error.response = { status: response.status }; throw error; }
    return { data: await response.json() };
  };
  const output = await report({ request, property: process.env.GSC_PROPERTY || 'https://rollside.studio/' });
  console.log(JSON.stringify(output, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const status = Number(error?.response?.status);
    console.error(Number.isFinite(status) ? `Search Console request failed (HTTP ${status}). Check API enablement and read-only property access. No credentials or response body logged.` : 'Search Console unavailable. Check the cloud Google network secret, GSC_PROPERTY and Google network access. No credentials logged.');
    process.exitCode = 1;
  });
}
