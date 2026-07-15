import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import sharp from 'sharp';

function parseArgs(argv) {
  const options = { manifest: 'gallery/manifest.json', composeOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--manifest') options.manifest = argv[++i];
    else if (argv[i] === '--compose-only') options.composeOnly = true;
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  return options;
}

const commonOverlaySelectors = [
  '[class*="cookie" i]',
  '[id*="cookie" i]',
  '[class*="intercom" i]',
  '[id*="intercom" i]',
  '[class*="chat-widget" i]',
  'iframe[title*="chat" i]'
];

async function capture(manifest, root) {
  const { width, height, deviceScaleFactor = 1 } = manifest.viewport;
  const screenshotDirectory = path.join(root, 'assets', 'screenshots');
  await fs.rm(screenshotDirectory, { recursive: true, force: true });
  await fs.mkdir(screenshotDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor,
    colorScheme: 'light',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/135 Safari/537.36'
  });

  for (const entry of [...manifest.entries].sort((a, b) => a.rank - b.rank)) {
    const page = await context.newPage();
    console.error(`Capturing ${entry.rank}. ${entry.slug}: ${entry.url}`);
    try {
      await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: entry.timeoutMs || 20_000 });
      await page.waitForTimeout(entry.waitMs || manifest.capture.waitMs || 1_500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.addStyleTag({ content: `
        *, *::before, *::after {
          animation-delay: 0s !important;
          animation-duration: 0.001s !important;
          transition-delay: 0s !important;
          transition-duration: 0.001s !important;
          caret-color: transparent !important;
        }
        ${[...commonOverlaySelectors, ...(entry.hide || [])].join(', ')} { display: none !important; }
      ` });
      await page.evaluate(phrases => {
        for (const phrase of phrases) {
          const candidate = [...document.querySelectorAll('body *')]
            .filter(element => element.children.length === 0)
            .find(element => (element.textContent || '').includes(phrase));
          if (!candidate) continue;
          let target = candidate;
          for (let depth = 0; depth < 8 && target.parentElement; depth += 1) {
            if (getComputedStyle(target).position === 'fixed') break;
            target = target.parentElement;
          }
          target.remove();
        }
      }, entry.removeText || []);
      await page.waitForTimeout(100);
      const png = await page.screenshot({ type: 'png', fullPage: false });
      const output = path.join(screenshotDirectory, `${String(entry.rank).padStart(2, '0')}-${entry.slug}.webp`);
      await sharp(png)
        .resize(width, height, { fit: 'cover', position: 'top' })
        .webp({ quality: manifest.capture.quality || 78, effort: 6 })
        .toFile(output);
    } catch (error) {
      throw new Error(`Capture failed for ${entry.url}: ${error.message}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
}

async function compose(manifest, root) {
  const entries = [...manifest.entries].sort((a, b) =>
    (a.galleryPosition || a.rank) - (b.galleryPosition || b.rank));
  const config = manifest.gallery;
  const rows = Math.ceil(entries.length / config.columns);
  const width = config.columns * config.tileWidth + (config.columns - 1) * config.gap;
  const height = rows * config.tileHeight + (rows - 1) * config.gap;
  const composites = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const input = path.join(root, 'assets', 'screenshots', `${String(entry.rank).padStart(2, '0')}-${entry.slug}.webp`);
    const tile = await sharp(input)
      .resize(config.tileWidth, config.tileHeight, { fit: 'cover', position: 'top' })
      .toBuffer();
    composites.push({
      input: tile,
      left: (index % config.columns) * (config.tileWidth + config.gap),
      top: Math.floor(index / config.columns) * (config.tileHeight + config.gap)
    });
  }

  const output = path.resolve(root, config.output);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width, height, channels: 3, background: config.background || '#000000' } })
    .composite(composites)
    .webp({ quality: config.quality || 84, effort: 6 })
    .toFile(output);
  console.error(`Wrote ${output} (${width}×${height})`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(options.manifest);
  const root = path.resolve(path.dirname(manifestPath), '..');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (!options.composeOnly) await capture(manifest, root);
  await compose(manifest, root);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
