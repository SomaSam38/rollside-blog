import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {parseArticle} from './blog-core.mjs';

const names = (await fs.readdir('articles')).filter(n => n.endsWith('.md')).sort();
assert.ok(names.length >= 3 && names.length <= 250, 'Unexpected article count');
const articles = [], posts = [], keywords = new Set(), weeks = new Set();
const seeded = new Set(['how-to-write-a-teleprompter-script','how-to-read-a-teleprompter-naturally','talking-head-video-setup']);
function week(date) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 3 - (d.getUTCDay() + 6) % 7);
  return `${d.getUTCFullYear()}-${Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(),0,1))) / 604800000)}`;
}
for (const name of names) {
  const slug = name.slice(0,-3), source = await fs.readFile('articles/' + name, 'utf8');
  const post = parseArticle(source,slug);
  assert.ok(post.sections.length >= 3, 'Article needs useful sections: ' + slug);
  assert.ok(post.date <= new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()), 'Future publication date');
  const keyword = post.primary_keyword.toLowerCase();
  assert.ok(!keywords.has(keyword), 'Duplicate primary keyword'); keywords.add(keyword);
  if (!seeded.has(slug)) {
    const words = source.split(/\n---\n/)[1].split(/\s+/).length;
    assert.ok(words >= 650 && words <= 1400, 'New article must be 650–1,400 words');
    assert.ok(!source.includes('—'), 'Use UK punctuation without em dashes');
    assert.ok(!weeks.has(week(post.date)), 'At most one new article per calendar week'); weeks.add(week(post.date));
  }
  for (const link of source.matchAll(/\]\(([^)]+)\)/g)) {
    const value = link[1];
    assert.ok(!value.startsWith('//') && /^(https:\/\/|\/(?!\/)|#|mailto:)/.test(value), 'Unsafe link');
  }
  articles.push({slug,source}); posts.push(post);
}
for (const post of posts) for (const link of (post.lead + post.sections.map(s=>s.blocks.join('')).join('')).matchAll(/href="(\/blog\/[^"#?]*)"/g)) {
  assert.ok(link[1] === '/blog/' || posts.some(p=>p.path === link[1]), 'Unknown related article: ' + link[1]);
}
if (!process.argv.includes('--check')) {
  const feed = JSON.stringify({version:1,articles},null,2) + '\n';
  assert.ok(Buffer.byteLength(feed) <= 2000000, 'Content feed too large');
  await fs.writeFile('feed.json',feed);
}
console.log(`Validated ${posts.length} articles; metadata, links, dates and weekly limits passed.`);
