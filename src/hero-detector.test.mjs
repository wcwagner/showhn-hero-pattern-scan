import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {classifyHero,extractHero} from './hero-detector.mjs';
const run=(text,overrides={})=>({text,size:64,italic:false,color:'rgb(0, 0, 0)',family:'serif',weight:400,gradient:false,...overrides});
const hero=runs=>({text:runs.map(r=>r.text).join(' '),size:64,runs});
test('contrasting phrase does not require terminal punctuation',()=>assert.equal(classifyHero(hero([run('Ask'),run('better',{italic:true}),run('questions')])).category,'italic-phrase'));
test('whole heading italic has no internal contrast',()=>assert.equal(classifyHero(hero([run('Ask better',{italic:true}),run('questions',{italic:true})])).matched,false));
test('tiny italic subtitle is not a hero accent',()=>assert.equal(classifyHero(hero([run('Build excellent products'),run('Coming soon',{size:16,italic:true})])).matched,false));
test('near-identical RGB shades do not constitute accent',()=>assert.equal(classifyHero(hero([run('Build excellent'),run('products',{color:'rgb(1, 1, 1)'})])).matched,false));
test('clear color difference constitutes accent',()=>assert.equal(classifyHero(hero([run('Build excellent'),run('products',{color:'rgb(200, 20, 100)'})])).matched,true));
test('letter-by-letter styled spans form one accented phrase',()=>assert.equal(classifyHero(hero([run('Ask'),...[...'better'].map(x=>run(x,{italic:true})),run('questions')])).matched,true));
test('weight-only accent is recorded',()=>assert.equal(classifyHero(hero([run('Build excellent'),run('products',{weight:800})])).flags.weight,true));
test('missing hero is separate from no match',()=>assert.equal(classifyHero(null).category,'missing-data'));
test('DOM extraction chooses dominant H2 over small logo H1 and respects hidden ancestors',async()=>{
  const browser=await chromium.launch({headless:true});
  try {const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.setContent('<h1 style="font-size:16px">Acme</h1><h2 style="font-size:64px">Build <em>better</em> products</h2><div style="opacity:0"><h2 style="font-size:90px">Hidden big heading</h2></div>');
    const h=await page.evaluate(extractHero);assert.equal(h.tag,'h2');assert.equal(h.text,'Build better products');assert.equal(classifyHero(h).category,'italic-phrase');
  } finally {await browser.close();}
});
