const origin = 'https://rollside.studio';
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${months[m - 1]} ${y}`; };
function href(url) {
  if (url.startsWith(origin + '/')) url = url.slice(origin.length);
  if (url.startsWith('//') || !/^(\/|#|https:\/\/|mailto:)/.test(url)) throw new Error('Unsupported blog link: ' + url);
  return esc(url);
}
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => `<a href="${href(url.replaceAll('&amp;', '&'))}">${text}</a>`);
const sectionId = heading => heading.toLowerCase().replace(/^\d+\.\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function convert(markdown) {
  const lines = markdown.split('\n'), lead = [], sections = [];
  let title, out = lead;
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('# ')) { title = line.slice(2).trim(); i++; continue; }
    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim(), id = sectionId(heading);
      if (sections.some(s => s.id === id)) throw new Error('Duplicate blog section: ' + id);
      sections.push({ id, heading, blocks: [] }); out = sections.at(-1).blocks; i++; continue;
    }
    if (line.startsWith('```')) {
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      if (i === lines.length) throw new Error('Unclosed code block');
      out.push(`<pre class="script-layout"><code>${esc(code.join('\n'))}</code></pre>`); i++; continue;
    }
    if (line.startsWith('>')) {
      const quote = [];
      for (; i < lines.length && lines[i].startsWith('>'); i++) quote.push(lines[i].replace(/^> ?/, ''));
      const paragraphs = quote.join('\n').split(/\n\s*\n/).map(p => `<p>${inline(p.replace(/\n/g, ' '))}</p>`);
      out.push(`<blockquote class="script-sample">${paragraphs.join('')}</blockquote>`); continue;
    }
    const list = /^- /.test(line) ? ['ul', /^- /] : /^\d+\. /.test(line) ? ['ol', /^\d+\. /] : null;
    if (list) {
      const items = [];
      for (; i < lines.length && list[1].test(lines[i]); i++) items.push(`<li>${inline(lines[i].replace(list[1], ''))}</li>`);
      out.push(`<${list[0]}>${items.join('')}</${list[0]}>`); continue;
    }
    const paragraph = [];
    for (; i < lines.length && lines[i].trim() && !/^(#|>|```|- |\d+\. )/.test(lines[i]); i++) paragraph.push(lines[i].trim());
    if (!paragraph.length) throw new Error("Unsupported Markdown line: " + lines[i]);
    const text = paragraph.join(' '), cta = text.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/), label = text.match(/^\*\*([^*]+)\*\*$/);
    if (cta) out.push(`<p class="article-cta"><a class="button coral-button" href="${href(cta[2])}">${esc(cta[1])} <span aria-hidden="true">→</span></a></p>`);
    else if (label) out.push(`<p class="sample-label"><strong>${esc(label[1])}</strong></p>`);
    else out.push(`<p>${inline(text)}</p>`);
  }
  return { title, lead: lead.join(''), sections };
}

export function parseArticle(source, slug) {
  source = source.replace(/\r\n/g, '\n');
  if (source.length > 40000 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) throw new Error("Invalid article source or slug");
  const parts = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!parts) throw new Error('Missing frontmatter: ' + slug);
  const meta = {};
  for (const line of parts[1].split('\n')) {
    const field = line.match(/^([a-z_]+):\s*(".*")$/);
    if (!field) throw new Error(`Invalid frontmatter in ${slug}: ${line}`);
    meta[field[1]] = JSON.parse(field[2]);
  }
  for (const key of ['title', 'slug', 'date', 'meta_title', 'meta_description', 'excerpt']) if (!meta[key]) throw new Error(`Missing ${key} in ${slug}`);
  if (meta.slug !== slug || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error('Invalid slug or date: ' + slug);
  if (meta.title.length > 180 || meta.meta_title.length > 60 || meta.meta_description.length > 160 || meta.excerpt.length > 500) throw new Error('Invalid metadata lengths');
  if (new Date(meta.date + 'T00:00:00Z').toISOString().slice(0,10) !== meta.date) throw new Error('Invalid article date');
  if (!meta.primary_keyword || meta.primary_keyword.length > 150) throw new Error('Missing primary keyword');
  const body = convert(parts[2]);
  if (body.title !== meta.title) throw new Error('Heading does not match title: ' + slug);
  const words = parts[2].replace(/[#>*`\-[\]()]/g, ' ').split(/\s+/).filter(Boolean).length;
  return { ...meta, ...body, path: `/blog/${slug}/`, minutes: Math.max(1, Math.round(words / 200)), modified: meta.modified || meta.date };
}


const meta = post => `<time datetime="${post.date}">${longDate(post.date)}</time><span aria-hidden="true">·</span>${post.minutes} min read`;
const card = (post, heading) => `<article class="post-card"><p class="post-meta">${meta(post)}</p><${heading}><a href="${post.path}">${esc(post.title)}</a></${heading}><p>${esc(post.excerpt)}</p><span class="post-more" aria-hidden="true">Read article →</span></article>`;

// Returns the page between the shared header and footer.
export function blogMain(page, breadcrumbs, blogPosts) {
  if (page.blog === 'index') return `<main id="main" class="wrap document blog-index"><nav class="breadcrumbs" aria-label="Breadcrumb">${breadcrumbs}</nav><header class="document-heading"><p class="eyebrow"><span class="dot"></span>Rollside blog</p><h1>Notes for<br>your next take.</h1><p class="document-intro">Practical guides to writing a script, reading from a teleprompter and setting up to film yourself.</p></header><ol class="post-list">${blogPosts.map(post => `<li>${card(post, 'h2')}</li>`).join('')}</ol><p class="blog-support">Looking for help with a Rollside app? <a class="link" href="/support/">Visit Support →</a></p></main>`;
  const post = page.post, related = blogPosts.filter(p => p !== post);
  const toc = post.sections.map(s => `<a href="#${s.id}">${esc(s.heading)}</a>`).join('');
  const sections = post.sections.map(s => `<section id="${s.id}"><h2>${esc(s.heading)}</h2>${s.blocks.join('')}</section>`).join('');
  return `<main id="main" class="wrap document blog-article"><nav class="breadcrumbs" aria-label="Breadcrumb">${breadcrumbs}</nav><article class="blog-post"><header class="document-heading"><p class="eyebrow"><span class="dot"></span><a href="/blog/">Rollside blog</a></p><h1>${esc(post.title)}</h1><p class="article-byline">By Rollside<span aria-hidden="true">·</span>Published ${meta(post)}</p></header><div class="document-layout"><div class="document-body article-body"><div class="article-lead">${post.lead}</div>${sections}</div><aside class="document-toc" aria-label="On this page"><p>ON THIS PAGE</p>${toc}<a href="/blog/">All articles →</a></aside></div></article><section class="related-posts" aria-labelledby="related-heading"><h2 id="related-heading">Keep reading</h2><div class="post-list">${related.map(p => card(p, 'h3')).join('')}</div></section></main>`;
}

// Structured data nodes added to each blog page's graph.
export function blogGraph(page, org, webpage, blogPosts) {
  const author = { '@type': 'Organization', '@id': org['@id'], name: org.name, url: org.url };
  const posting = post => ({ '@type': 'BlogPosting', '@id': origin + post.path + '#article', url: origin + post.path, headline: post.title, description: post.meta_description, datePublished: post.date, dateModified: post.modified, image: origin + '/assets/rollside-social.jpg', author, publisher: { '@id': org['@id'] }, inLanguage: 'en-GB', isPartOf: { '@id': origin + '/blog/#blog' } });
  if (page.blog === 'index') {
    const blog = { '@type': 'Blog', '@id': origin + '/blog/#blog', name: 'Rollside Blog', url: origin + '/blog/', description: page.description, publisher: { '@id': org['@id'] }, inLanguage: 'en-GB', blogPost: blogPosts.map(p => ({ '@id': origin + p.path + '#article' })) };
    webpage.mainEntity = { '@id': blog['@id'] };
    return [blog, ...blogPosts.map(posting)];
  }
  const article = { ...posting(page.post), mainEntityOfPage: { '@id': webpage['@id'] } };
  webpage.mainEntity = { '@id': article['@id'] };
  webpage.datePublished = page.published;
  return [article];
}
