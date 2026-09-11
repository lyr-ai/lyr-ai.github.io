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
repo: lyr-ai/agentseism          # optional: renders a "code for this post" banner
syndicated_to: https://medium.com/@ruxiz2005/...   # optional: a copy elsewhere
---
```

**Canonical lives here.** `jekyll-seo-tag` emits `<link rel="canonical">`
pointing at this site, so a syndicated copy should point back here rather than
the other way round. `syndicated_to` only renders a "also appears on" line; it
does not change the canonical.

## Local preview (optional)

```bash
bundle install
bundle exec jekyll serve
```
