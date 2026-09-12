# lyr-ai.github.io

Source for <https://lyr-ai.github.io> — notes on agent reliability, written
alongside [AgentSeism](https://github.com/lyr-ai/agentseism),
[TypedMem](https://github.com/lyr-ai/typedmem) and [LYR](https://github.com/lyr-ai/lyr).

Built by GitHub Pages' own Jekyll — no build step, no Actions. Push to `main`
and the site rebuilds.

## Writing a post

Add `_posts/YYYY-MM-DD-slug.md`:

```yaml
---
title: "Post title"
date: 2026-09-11
description: One sentence. This is what search results and link previews show.
image: /assets/img/hero.webp     # link-preview card, and the thumbnail on the home page
repo: lyr-ai/agentseism          # optional: renders a "code for this post" banner
series: Agent reliability        # optional: renders an eyebrow above the title
experiment: "02"                 # optional: numbers the post within the series
syndicated_to: https://medium.com/@ruxiz2005/...   # optional: a copy elsewhere
math: true                       # optional: loads KaTeX for $$ ... $$ blocks
---
```

`series` + `experiment` is what makes separate posts read as one research
program rather than as unrelated essays. Keep the series name stable.

## Math

Set `math: true` and write **display** math as `$$ ... $$` on its own lines.

Inline math needs **double** backslashes: `\\(t\\)`, not `\(t\)` and not
`$t$`. kramdown eats a single backslash as an escape and does not treat a single
`$` as math, so both of the wrong forms ship as visible junk in the rendered
page — and the source looks fine either way, so check the rendered text.

**Canonical lives here.** `jekyll-seo-tag` emits `<link rel="canonical">`
pointing at this site, so a syndicated copy should point back here rather than
the other way round. `syndicated_to` only renders a "also appears on" line; it
does not change the canonical.

## Local preview (optional)

```bash
bundle install
bundle exec jekyll serve
```
