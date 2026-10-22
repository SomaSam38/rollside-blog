# Rollside blog

Public article content for https://rollside.studio/blog/. This repository intentionally contains no application code, payment configuration, credentials or private project evidence.

Claude's cloud scheduled task adds one original article a week, runs `npm test` and `npm run build`, then commits the article and generated `feed.json` to `main`. The Rollside website reads this public feed; no Mac, local Claude process or local disk is involved in publication.

The three initial posts are preserved from 22 October 2026. Future articles live in `articles/<slug>.md`. All frontmatter values must be quoted JSON strings. Required fields: title, slug, date (YYYY-MM-DD), primary_keyword, meta_title (max 60 characters), meta_description (max 160), excerpt. The H1 must equal the title. Markdown supports H2 sections, paragraphs, bold, links, flat lists, block quotes and fenced code examples. HTML is escaped.

`scripts/publish.mjs` validates content and generates `feed.json`. Only the owner-authorised cloud task should push to main. Do not change validation scripts as part of routine article publishing. No packages need installing; use Node 22 or newer.

## Editorial requirements

Write for solo creators, in direct, practical UK English. Give useful original examples; vary the structure and sentence rhythm naturally. Avoid generic AI openings, formulaic summaries, keyword stuffing, em dashes and hype. Do not invent lived experience, customers, tests, testimonials, search volume or statistics. Do not claim human authorship or guaranteed detector/SEO results.

Before every article, read the current blog and public Rollside product/support pages. Find a distinct search intent and primary keyword, using bounded web research. Check all current feature and release claims. At initial setup Prompter is live; Camera and Studio are in development, but recheck rather than repeating stale status. Record research and keyword reasoning in the commit message or cloud session, not in the public article. Include a light truthful product CTA and useful internal links.

Publish at most one new article per Lisbon calendar week, with no backlog dumping. Check `main` and the live site before retrying uncertain publication. If the week's article already exists, stop without writing another. Run a separate editorial review and correct issues before tests/build. Push only a new article plus the generated feed, preserve existing articles, and never rewrite history. After pushing `HEAD:main`, verify the article and canonical metadata at https://rollside.studio/blog/<slug>/. Allow up to five minutes for upstream caches. A push alone is not proof of publication. Report blockers honestly.
