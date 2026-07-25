# rfsignaldetectorapp.com

Static marketing + SEO site for the RF Signal Detector iOS app (App Store id 6757208480).

## How it works

- `src/` is the source: `layout.html` (shared shell), `pages/` (landing + tool), `articles/` (guide fragments with a `<!--meta {json} -->` header), `assets/` (CSS, JS, fonts, images).
- `node build.js` regenerates `public/` from `src/`: wraps fragments in the layout, injects JSON-LD schema (SoftwareApplication, Article, FAQPage, breadcrumbs), builds the guides hub, `sitemap.xml`, `robots.txt`, and compiles the IEEE OUI registry (`tools_data/oui.csv`) into `public/assets/oui.json` for the free MAC-lookup tool.
- `public/` is committed. Deploy = serve `public/` with nginx (see `Dockerfile`).

## Adding an article (the weekly loop)

1. Drop a new fragment in `src/articles/<slug>.html` following the existing meta format.
2. `node build.js`
3. Commit + push, then trigger the Coolify deploy.

## Refreshing the OUI database (quarterly is plenty)

curl -sL -o tools_data/oui.csv "https://standards-oui.ieee.org/oui/oui.csv" && node build.js
