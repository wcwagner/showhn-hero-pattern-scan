import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { DETECTOR, classifyHero, extractHero } from './hero-detector.mjs';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key)+1] : fallback;
const input = option('--input','results/yc-spring-2026-cohort.json');
const output = option('--output','results/yc-spring-2026-2026-09-11.json');
const directory = option('--screenshots','assets/yc-spring-2026-screenshots');
const concurrency = Number(option('--concurrency',4));
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Concurrency must be 1–8.');
const corpus = JSON.parse(await fs.readFile(input,'utf8'));
const items = corpus.items;
const viewport = { width:1440,height:900 };
await fs.mkdir(directory,{recursive:true});
const browser = await chromium.launch({headless:true});
const results = [];
let cursor = 0;
const startedAt = new Date().toISOString();
async function inspect(company) {
  const base = { ...company, observedAt:new Date().toISOString() };
  let url;
  try {url=new URL(company.website);if(!/^https?:$/.test(url.protocol))throw new Error('Invalid website protocol');}
  catch {return {...base,status:'missing-website',classification:classifyHero(null)};}
  const context=await browser.newContext({viewport,deviceScaleFactor:1,colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  await page.route('**/*',r=>r.request().resourceType()==='media'?r.abort():r.continue());
  try {
    const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:15000});
    await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2000))]));
    await page.waitForTimeout(1200);
    const title=await page.title();
    if(response?.status()>=400||/^(Just a moment|Access denied|Attention Required|Page not found)/i.test(title)) {
      return {...base,status:'blocked-or-http-error',httpStatus:response?.status(),title,finalUrl:page.url(),classification:classifyHero(null)};
    }
    const hero=await page.evaluate(extractHero);
    const classification=classifyHero(hero);
    const screenshot=path.join(directory,`${company.objectID || company.id}.webp`);
    let screenshotError;
    try { await sharp(await page.screenshot({type:'png',fullPage:false,timeout:10000})).webp({quality:76,effort:4}).toFile(screenshot); }
    catch(error){screenshotError=String(error.message).slice(0,200);}
    return {...base,status:hero?'observed':'no-hero',httpStatus:response?.status(),title,finalUrl:page.url(),hero,classification,
      ...(screenshotError?{screenshotError}:{screenshot})};
  } catch(error) {
    return {...base,status:'navigation-error',error:String(error.message).slice(0,300),classification:classifyHero(null)};
  } finally {await context.close();}
}
async function worker(){while(cursor<items.length){const i=cursor++;results.push(await inspect(items[i]));if(results.length%20===0)console.error(`YC rendered ${results.length}/${items.length}`);}}
await Promise.all(Array.from({length:concurrency},worker));await browser.close();
results.sort((a,b)=>a.name.localeCompare(b.name));
const summarize=rows=>({companies:rows.length,observed:rows.filter(r=>r.status==='observed').length,
  matched:rows.filter(r=>r.classification.matched).length,italicPhrase:rows.filter(r=>r.classification.category==='italic-phrase').length,
  highlightedPhrase:rows.filter(r=>r.classification.category==='highlighted-phrase').length,
  noMatch:rows.filter(r=>r.classification.category==='no-match').length,missingData:rows.filter(r=>r.classification.category==='missing-data').length});
const report={metadata:{startedAt,finishedAt:new Date().toISOString(),cohortFile:input,cohortSource:corpus.source,batch:corpus.batch,
  detector:DETECTOR,viewport,rendering:{blockedResources:['media'],fontWaitLimitMs:2000,settleMs:1200,concurrency},
  purpose:'Visual-pattern candidate finding. No inference of AI authorship. Search match is YC directory query scope, not an AI-industry label.'},
  summary:{fullBatch:summarize(results),directoryAIQuery:summarize(results.filter(r=>r.matches_ai_query)),literalAIInName:summarize(results.filter(r=>r.literal_ai_in_name))},results};
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.error(JSON.stringify(report.summary,null,2));console.error(`Wrote ${output}`);
