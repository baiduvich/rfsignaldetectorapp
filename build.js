#!/usr/bin/env node
// Static site builder for rfsignaldetectorapp.com — zero dependencies.
// Usage: node build.js  → regenerates public/ from src/.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const PUB = path.join(__dirname, 'docs');
const SITE = 'https://rfsignaldetectorapp.com';
const APP_URL = 'https://apps.apple.com/app/rf-signal-detector/id6757208480';
const APP_NAME = 'RF Signal Detector';

const layout = fs.readFileSync(path.join(SRC, 'layout.html'), 'utf8');

function render(slots) {
  return layout.replace(/\{\{(\w+)\}\}/g, (_, k) => slots[k] ?? '');
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function write(rel, html) {
  const out = path.join(PUB, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log('wrote', rel);
}
function parseFragment(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error('no meta block in ' + file);
  const meta = JSON.parse(m[1]);
  const content = raw.slice(m.index + m[0].length).trim();
  return { meta, content };
}
function ld(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

// ---------- shared schema ----------
const orgSchema = {
  '@context': 'https://schema.org', '@type': 'Organization',
  name: APP_NAME, url: SITE, logo: SITE + '/assets/og.png',
};
const appSchema = {
  '@context': 'https://schema.org', '@type': 'SoftwareApplication',
  name: APP_NAME,
  operatingSystem: 'iOS',
  applicationCategory: 'UtilitiesApplication',
  description: 'Scan any room for hidden cameras, Bluetooth trackers, and unknown devices with your iPhone. Bluetooth scan, Wi-Fi network scan, infrared lens finder, and a guided sweep checklist.',
  url: SITE,
  installUrl: APP_URL,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free to download with free trial' },
};

// ---------- reset public ----------
fs.rmSync(PUB, { recursive: true, force: true });
fs.mkdirSync(PUB, { recursive: true });

// ---------- assets ----------
fs.cpSync(path.join(SRC, 'assets'), path.join(PUB, 'assets'), { recursive: true });
// don't ship the ttf (only used to render og.png at author time)
fs.rmSync(path.join(PUB, 'assets/fonts/spacegrotesk-bold.ttf'), { force: true });

// ---------- articles ----------
const articleDir = path.join(SRC, 'articles');
const articles = fs.readdirSync(articleDir).filter(f => f.endsWith('.html')).map(f => parseFragment(path.join(articleDir, f)));
articles.sort((a, b) => a.meta.h1.localeCompare(b.meta.h1));

const urls = []; // for sitemap

function articleCard(a) {
  return `<a class="card" href="/guides/${a.meta.slug}/"><h3>${esc(a.meta.h1)}</h3><p>${esc(a.meta.description)}</p><span class="card-more">Read the guide</span></a>`;
}

for (const a of articles) {
  const { meta, content } = a;
  const url = `${SITE}/guides/${meta.slug}/`;
  urls.push({ loc: url, pri: '0.8' });
  const related = articles.filter(x => x.meta.slug !== meta.slug).slice(0, 3);
  const faqSchema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: meta.faq.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  const artSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: meta.h1, description: meta.description,
    datePublished: meta.date, dateModified: meta.date,
    author: { '@type': 'Organization', name: APP_NAME, url: SITE },
    publisher: { '@type': 'Organization', name: APP_NAME, url: SITE },
    mainEntityOfPage: url, image: SITE + '/assets/og.png',
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: SITE + '/guides/' },
      { '@type': 'ListItem', position: 3, name: meta.h1, item: url },
    ],
  };
  const body = `
<article class="guide">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/guides/">Guides</a></nav>
  <h1>${esc(meta.h1)}</h1>
  <p class="byline">Updated <time datetime="${meta.date}">${new Date(meta.date + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time> · ${APP_NAME} team</p>
  ${content}
  <section class="related">
    <h2>Keep reading</h2>
    <div class="cards">${related.map(articleCard).join('')}</div>
  </section>
</article>`;
  write(`guides/${meta.slug}/index.html`, render({
    title: meta.title,
    description: esc(meta.description),
    canonical: url,
    ogtype: 'article',
    schema: ld(artSchema) + ld(faqSchema) + ld(crumbs),
    bodyclass: 'page-guide',
    content: body,
  }));
}

// ---------- guides index ----------
{
  const url = SITE + '/guides/';
  urls.push({ loc: url, pri: '0.7' });
  const body = `
<section class="hub">
  <h1>Guides to finding hidden cameras and trackers</h1>
  <p class="lead">Practical, honest walkthroughs. Every guide works even if you never install an app; the app just makes it faster.</p>
  <div class="cards">${articles.map(articleCard).join('')}</div>
</section>`;
  write('guides/index.html', render({
    title: 'Hidden camera and tracker detection guides',
    description: 'Step-by-step guides to finding hidden cameras, GPS trackers, AirTags, and listening devices in rentals, hotels, cars, and your home.',
    canonical: url, ogtype: 'website',
    schema: ld(orgSchema), bodyclass: 'page-hub', content: body,
  }));
}

// ---------- landing ----------
{
  const { meta, content } = parseFragment(path.join(SRC, 'pages', 'index.html'));
  urls.unshift({ loc: SITE + '/', pri: '1.0' });
  const websiteSchema = { '@context': 'https://schema.org', '@type': 'WebSite', name: APP_NAME, url: SITE };
  const faqSchema = meta.faq ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: meta.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  } : null;
  // inject guide cards into the landing where {{GUIDE_CARDS}} appears
  const withCards = content.replace('{{GUIDE_CARDS}}', articles.slice(0, 8).map(articleCard).join(''));
  write('index.html', render({
    title: meta.title, description: esc(meta.description),
    canonical: SITE + '/', ogtype: 'website',
    schema: ld(appSchema) + ld(orgSchema) + ld(websiteSchema) + (faqSchema ? ld(faqSchema) : ''),
    bodyclass: 'page-home', content: withCards,
  }));
}

// ---------- tool ----------
{
  const { meta, content } = parseFragment(path.join(SRC, 'pages', 'tool.html'));
  const url = SITE + '/tools/hidden-camera-device-checker/';
  urls.push({ loc: url, pri: '0.9' });
  const toolSchema = {
    '@context': 'https://schema.org', '@type': 'WebApplication',
    name: 'Hidden camera device checker', url,
    applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any',
    description: meta.description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  const faqSchema = meta.faq ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: meta.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  } : null;
  write('tools/hidden-camera-device-checker/index.html', render({
    title: meta.title, description: esc(meta.description),
    canonical: url, ogtype: 'website',
    schema: ld(toolSchema) + (faqSchema ? ld(faqSchema) : ''),
    bodyclass: 'page-tool', content,
  }));
}

// ---------- OUI database → oui.json ----------
{
  const csv = fs.readFileSync(path.join(__dirname, 'tools_data', 'oui.csv'), 'utf8');
  // Camera / surveillance vendors. Tier 1 = dedicated camera/surveillance brands.
  // Tier 2 = big vendors that make popular cameras among other products.
  const tier1 = [
    'hikvision', 'dahua', 'axis communications', 'vivotek', 'uniview', 'zhejiang uniview',
    'amcrest', 'foscam', 'reolink', 'lorex', 'swann', 'ezviz', 'annke', 'zosi',
    'hanwha techwin', 'samsung techwin', 'arlo', 'wyze', 'ring llc', 'ring, llc',
    'immedia semiconductor', 'eufy', 'yi technology', 'shanghai xiaoyi', 'kami vision',
    'gw security', 'night owl sp',
  ];
  const tier2 = [
    'google', 'nest labs', 'amazon technologies', 'tp-link', 'xiaomi', 'shenzhen baichuan',
    'tuya', 'espressif', 'anker innovations', 'vtech telecommunications', 'd-link', 'edimax',
    'sercomm', 'ubiquiti',
  ];
  const lines = csv.split('\n').slice(1);
  const db = {};
  for (const line of lines) {
    // CSV: Registry,Assignment,Organization Name,Address — org may be quoted with commas
    const m = line.match(/^MA-[LMS],([0-9A-F]{6,9}),("([^"]*)"|([^,]*)),/);
    if (!m) continue;
    const prefix = m[1].slice(0, 6);
    const org = (m[3] ?? m[4] ?? '').trim();
    if (!org) continue;
    const low = org.toLowerCase();
    let tier = 0;
    if (tier1.some(k => low.includes(k))) tier = 1;
    else if (tier2.some(k => low.includes(k))) tier = 2;
    // compress org name a little
    const name = org.replace(/\s+(co\.?,?\s*ltd\.?|ltd\.?|inc\.?|corp(oration)?\.?|gmbh|llc|s\.a\.|technologies co\.,ltd)\s*$/i, '').replace(/[,.]+$/, '').trim();
    db[prefix] = tier ? [name, tier] : [name];
  }
  fs.writeFileSync(path.join(PUB, 'assets', 'oui.json'), JSON.stringify(db));
  console.log('oui.json entries:', Object.keys(db).length);
}

// ---------- GitHub Pages: CNAME + .nojekyll (docs/ is wiped every build) ----------
fs.writeFileSync(path.join(PUB, 'CNAME'), 'rfsignaldetectorapp.com\n');
fs.writeFileSync(path.join(PUB, '.nojekyll'), '');

// ---------- robots, sitemap, 404 ----------
fs.writeFileSync(path.join(PUB, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(PUB, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority></url>`).join('\n') +
  `\n</urlset>\n`);
write('404.html', render({
  title: 'Page not found', description: 'That page does not exist.',
  canonical: SITE + '/404.html', ogtype: 'website', schema: '', bodyclass: 'page-404',
  content: `<section class="hub"><h1>Page not found</h1><p class="lead">That page does not exist. Try the <a href="/guides/">guides</a> or the <a href="/tools/hidden-camera-device-checker/">free device checker</a>.</p></section>`,
}));

console.log('build complete:', urls.length, 'pages in sitemap');
