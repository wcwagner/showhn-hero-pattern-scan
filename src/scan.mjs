import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const DAY_SECONDS = 86_400;
const SKIP_HOSTS = /(^|\.)(github\.com|gitlab\.com|bitbucket\.org|youtube\.com|youtu\.be|x\.com|twitter\.com|apps\.apple\.com|play\.google\.com|pypi\.org|npmjs\.com|crates\.io|huggingface\.co|arxiv\.org|substack\.com|medium\.com|dev\.to|news\.ycombinator\.com)$/i;

function parseArgs(argv) {
  const options = { source: 'showhn', concurrency: 8, timeout: 12_000, top: 100, limit: Infinity };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const value = argv[++i];
    if (value === undefined) throw new Error(`Missing value for ${key}`);
    if (key === '--source') options.source = value.toLowerCase();
    else if (key === '--start') options.start = value;
    else if (key === '--end') options.end = value;
    else if (key === '--output') options.output = value;
    else if (key === '--concurrency') options.concurrency = Number(value);
    else if (key === '--timeout') options.timeout = Number(value);
    else if (key === '--top') options.top = Number(value);
    else if (key === '--limit') options.limit = Number(value);
    else throw new Error(`Unknown option: ${key}`);
  }

  if (!options.end) options.end = new Date().toISOString().slice(0, 10);
  if (!options.start) {
    const d = new Date(`${options.end}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    options.start = d.toISOString().slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.start) || !/^\d{4}-\d{2}-\d{2}$/.test(options.end)) {
    throw new Error('Dates must use YYYY-MM-DD.');
  }
  if (epoch(options.start) >= epoch(options.end)) throw new Error('--start must precede --end.');
  if (!['showhn', 'uneed'].includes(options.source)) {
    throw new Error('--source must be showhn or uneed.');
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 32) {
    throw new Error('--concurrency must be an integer from 1 to 32.');
  }
  for (const key of ['timeout', 'top', 'limit']) {
    if (key === 'limit' && options[key] === Infinity) continue;
    if (!Number.isSafeInteger(options[key]) || options[key] < 1) {
      throw new Error(`--${key} must be a positive integer.`);
    }
  }
  return options;
}

function epoch(date) {
  const value = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(value)) throw new Error(`Invalid date: ${date}`);
  return Math.floor(value / 1000);
}

async function getJSON(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function fetchShowHNCorpus(start, end) {
  const firstEpoch = epoch(start);
  const endEpoch = epoch(end);
  if (firstEpoch >= endEpoch) throw new Error('--start must precede --end.');
  const hits = [];

  // Daily windows avoid Algolia's 1,000-result pagination ceiling.
  for (let low = firstEpoch; low < endEpoch; low += DAY_SECONDS) {
    const high = Math.min(low + DAY_SECONDS, endEpoch);
    const base = 'https://hn.algolia.com/api/v1/search_by_date?tags=show_hn' +
      `&numericFilters=created_at_i%3E%3D${low}%2Ccreated_at_i%3C${high}&hitsPerPage=100`;
    const first = await getJSON(`${base}&page=0`);
    hits.push(...first.hits);
    for (let page = 1; page < first.nbPages; page += 1) {
      const next = await getJSON(`${base}&page=${page}`);
      hits.push(...next.hits);
    }
  }

  return [...new Map(hits.map(hit => [hit.objectID, hit])).values()]
    .filter(hit => /^Show HN:/i.test(hit.title || ''));
}

function dateRange(start, end) {
  const dates = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (cursor < stop) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function fetchUneedCorpus(start, end) {
  const dates = dateRange(start, end);
  const daily = [];
  for (const date of dates) {
    const url = new URL('https://www.uneed.best/api/tools/get-ladder');
    url.search = new URLSearchParams({ type: 'daily', date });
    const products = await getJSON(url);
    daily.push(products.map(product => ({
      objectID: `uneed-${product.id}-${date}`,
      created_at: date,
      title: `Uneed: ${product.name}`,
      url: product.url,
      source: {
        name: 'uneed',
        listingUrl: `https://www.uneed.best/tool/${product.slug}`,
        description: product.description || ''
      }
    })));
  }
  return daily.flat();
}

async function fetchCorpus(source, start, end) {
  if (source === 'uneed') return fetchUneedCorpus(start, end);
  return fetchShowHNCorpus(start, end);
}

function eligible(hit) {
  try {
    const url = new URL(hit.url);
    return /^https?:$/.test(url.protocol) && !SKIP_HOSTS.test(url.hostname);
  } catch {
    return false;
  }
}

function dedupe(hits) {
  return [...new Map(hits.map(hit => {
    const url = new URL(hit.url);
    url.hash = '';
    url.search = '';
    const key = `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, '')}`;
    return [key, hit];
  })).values()];
}

async function inspectPage(browser, hit, timeout) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/135 Safari/537.36'
  });
  const page = await context.newPage();
  await page.route('**/*', route => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'media' || type === 'font') route.abort();
    else route.continue();
  });

  try {
    await page.goto(hit.url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(500);
    const hero = await page.evaluate(() => {
      const clean = value => (value || '').replace(/\s+/g, ' ').trim();
      const visible = element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 100 && rect.height > 20 && rect.top < 1000 && rect.bottom > 0 &&
          style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
      };
      const headings = [...document.querySelectorAll('h1')].filter(visible);
      if (!headings.length) return null;
      headings.sort((a, b) => {
        const size = parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize);
        return size || a.getBoundingClientRect().top - b.getBoundingClientRect().top;
      });

      const heading = headings[0];
      const rect = heading.getBoundingClientRect();
      const style = getComputedStyle(heading);
      const text = clean(heading.innerText);
      const baseFamily = style.fontFamily.slice(0, 120);
      const descendants = [...heading.querySelectorAll('span,em,i,strong,b')]
        .filter(element => visible(element) && clean(element.innerText) && clean(element.innerText) !== text)
        .map(element => {
          const child = getComputedStyle(element);
          const family = child.fontFamily.slice(0, 120);
          const className = String(element.className || '').slice(0, 180);
          const gradient = child.backgroundImage !== 'none' &&
            ((child.backgroundClip || child.webkitBackgroundClip) === 'text' || child.webkitTextFillColor === 'rgba(0, 0, 0, 0)');
          return {
            text: clean(element.innerText).slice(0, 100),
            tag: element.tagName.toLowerCase(),
            className,
            italic: child.fontStyle !== 'normal',
            color: child.color,
            colorDiff: child.color !== style.color,
            family,
            familyDiff: family !== baseFamily,
            backgroundImage: child.backgroundImage,
            backgroundClip: child.backgroundClip || child.webkitBackgroundClip,
            textFillColor: child.webkitTextFillColor,
            gradient
          };
        })
        .filter(child => child.italic || child.colorDiff || child.familyDiff || child.gradient ||
          /italic|gradient|accent|highlight/i.test(child.className));

      const eyebrow = [...document.querySelectorAll('p,div,span')]
        .filter(element => {
          if (!visible(element) || element.contains(heading) || heading.contains(element)) return false;
          const candidate = element.getBoundingClientRect();
          const candidateText = clean(element.innerText);
          return candidate.bottom <= rect.top + 10 && candidate.bottom >= rect.top - 180 &&
            candidateText.length > 2 && candidateText.length < 90;
        })
        .map(element => clean(element.innerText))
        .sort((a, b) => a.length - b.length)[0] || '';

      const html = document.documentElement.innerHTML;
      return {
        text: text.slice(0, 280),
        outerHTML: heading.outerHTML.slice(0, 1600),
        size: Math.round(parseFloat(style.fontSize)),
        weight: style.fontWeight,
        family: baseFamily,
        color: style.color,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        top: Math.round(rect.top),
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        descendants: descendants.slice(0, 12),
        eyebrow: eyebrow.slice(0, 120),
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        frameworkHints: {
          next: Boolean(document.querySelector('#__next')),
          astro: /data-astro-cid/.test(html),
          framer: /framer/i.test(html),
          webflow: /webflow/i.test(html),
          viteLikeAssets: Boolean(document.querySelector('script[src*="/assets/"]'))
        }
      };
    });

    if (!hero) return { id: hit.objectID, title: hit.title, url: hit.url, source: hit.source, status: 'no-h1' };
    const italic = hero.descendants.some(child => child.italic);
    const accent = hero.descendants.some(child => child.colorDiff);
    const gradient = hero.descendants.some(child => child.gradient);
    const mixed = hero.descendants.some(child => child.familyDiff);
    const flags = {
      big: hero.size >= 52,
      huge: hero.size >= 68,
      sentence: /\s/.test(hero.text) && hero.text.length >= 18 && hero.text.length <= 220,
      period: /\.$/.test(hero.text),
      italic,
      accent,
      gradient,
      mixed,
      special: italic || accent || gradient || mixed
    };
    const score = (flags.big ? 2 : 0) + (flags.huge ? 1 : 0) + (flags.sentence ? 1 : 0) +
      (/[.!?]$/.test(hero.text) ? 1 : 0) + (flags.period ? 1 : 0) +
      (hero.descendants.length ? 2 : 0) + (italic ? 2 : 0) + (accent ? 2 : 0) +
      (gradient ? 2 : 0) + (mixed ? 1 : 0) + (hero.eyebrow ? 1 : 0);

    return {
      id: hit.objectID,
      createdAt: hit.created_at,
      title: hit.title,
      url: hit.url,
      source: hit.source,
      finalUrl: page.url(),
      status: 'ok',
      score,
      strictSignature: flags.big && flags.sentence && flags.period && flags.special,
      flags,
      hero
    };
  } catch (error) {
    return { id: hit.objectID, title: hit.title, url: hit.url, source: hit.source, status: 'error', error: String(error.message).slice(0, 240) };
  } finally {
    await context.close();
  }
}

function summarize(source, corpus, eligibleHits, uniquePages, results) {
  const rendered = results.filter(result => result.status === 'ok');
  const count = predicate => rendered.filter(predicate).length;
  return {
    source,
    submissions: corpus.length,
    ...(source === 'showhn' ? { showHNSubmissions: corpus.length } : {}),
    eligibleLandingPageSubmissions: eligibleHits.length,
    uniqueLandingPages: uniquePages.length,
    inspectedLandingPages: results.length,
    renderedWithH1: rendered.length,
    errors: results.filter(result => result.status === 'error').length,
    noH1: results.filter(result => result.status === 'no-h1').length,
    prevalence: {
      bigSentence: count(x => x.flags.big && x.flags.sentence),
      bigSentencePeriod: count(x => x.flags.big && x.flags.sentence && x.flags.period),
      bigSentenceSpecial: count(x => x.flags.big && x.flags.sentence && x.flags.special),
      strictSignature: count(x => x.strictSignature),
      strictItalic: count(x => x.flags.big && x.flags.sentence && x.flags.period && x.flags.italic),
      strictGradient: count(x => x.flags.big && x.flags.sentence && x.flags.period && x.flags.gradient),
      strictAccent: count(x => x.flags.big && x.flags.sentence && x.flags.period && x.flags.accent),
      score12Plus: count(x => x.score >= 12),
      score10Plus: count(x => x.score >= 10)
    }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const corpus = await fetchCorpus(options.source, options.start, options.end);
  const eligibleHits = corpus.filter(eligible);
  const uniquePages = dedupe(eligibleHits);
  const queuedPages = [...uniquePages]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || String(a.objectID).localeCompare(String(b.objectID)))
    .slice(0, options.limit);
  console.error(`${options.source}: ${corpus.length}; landing links: ${eligibleHits.length}; unique pages: ${uniquePages.length}; queued: ${queuedPages.length}`);

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= queuedPages.length) return;
      results.push(await inspectPage(browser, queuedPages[index], options.timeout));
      if (results.length % 25 === 0) console.error(`Rendered ${results.length}/${queuedPages.length}`);
    }
  }
  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));
  await browser.close();

  const ranked = results.filter(result => result.status === 'ok').sort((a, b) => b.score - a.score);
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: options.source,
      selection: { order: 'newest-first', limit: Number.isFinite(options.limit) ? options.limit : null, limited: queuedPages.length < uniquePages.length },
      renderer: { blockedResources: ['image', 'media', 'font'], settleMs: 500, timeoutMs: options.timeout },
      range: { start: options.start, endExclusive: options.end },
      viewport: { width: 1440, height: 1000 },
      thresholds: { largePixels: 52, hugePixels: 68, sentenceCharacters: [18, 220] },
      exclusions: String(SKIP_HOSTS)
    },
    summary: summarize(options.source, corpus, eligibleHits, uniquePages, results),
    top: ranked.slice(0, options.top),
    results
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) {
    const destination = path.resolve(options.output);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, json);
    console.error(`Wrote ${destination}`);
  } else {
    process.stdout.write(json);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
