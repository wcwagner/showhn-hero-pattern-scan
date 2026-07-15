import process from 'node:process';
import { chromium } from 'playwright';

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error('Usage: npm run inspect -- https://example.com [https://another.example]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

for (const url of urls) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForTimeout(700);
    const observation = await page.evaluate(() => {
      const clean = value => (value || '').replace(/\s+/g, ' ').trim();
      const heading = [...document.querySelectorAll('h1')]
        .find(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.top < 1000;
        });
      if (!heading) return { error: 'No visible H1', title: document.title };
      const style = getComputedStyle(heading);
      const rect = heading.getBoundingClientRect();
      return {
        title: document.title,
        hero: clean(heading.innerText),
        outerHTML: heading.outerHTML.slice(0, 2400),
        geometry: { top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
        computed: {
          fontSize: style.fontSize,
          fontStyle: style.fontStyle,
          fontWeight: style.fontWeight,
          fontFamily: style.fontFamily,
          color: style.color,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing
        },
        descendants: [...heading.querySelectorAll('span,em,i,strong,b')].map(element => {
          const child = getComputedStyle(element);
          return {
            text: clean(element.innerText),
            tag: element.tagName.toLowerCase(),
            className: String(element.className || ''),
            fontSize: child.fontSize,
            fontStyle: child.fontStyle,
            fontWeight: child.fontWeight,
            fontFamily: child.fontFamily,
            color: child.color,
            backgroundImage: child.backgroundImage,
            backgroundClip: child.backgroundClip || child.webkitBackgroundClip,
            textFillColor: child.webkitTextFillColor
          };
        }).filter(item => item.text)
      };
    });
    console.log(JSON.stringify({ url, finalUrl: page.url(), ...observation }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ url, error: String(error.message).slice(0, 240) }, null, 2));
  } finally {
    await page.close();
  }
}

await browser.close();
