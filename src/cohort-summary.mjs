import fs from 'node:fs/promises';
const files=process.argv.slice(2);
const reports=files.length?files:['results/yc-spring-2026-2026-09-11.json','results/yc-winter-2026-2026-09-11.json'];
const batches=[];const ids=new Set(),websites=new Set();
for(const file of reports){const report=JSON.parse(await fs.readFile(file,'utf8'));
  for(const c of report.results){if(ids.has(String(c.objectID)))throw new Error(`Duplicate company ${c.objectID}`);ids.add(String(c.objectID));
    try{const u=new URL(c.website);websites.add(u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,''));}catch{}}
  batches.push({batch:report.metadata.batch,report:file,detector:report.metadata.detector.version,...report.summary.fullBatch,
    records:report.results.map(c=>({id:c.objectID,name:c.name,yc_url:c.yc_url,website:c.website,status:c.status,category:c.classification.category}))});
}
const keys=['companies','observed','matched','italicPhrase','highlightedPhrase','noMatch','missingData'];
const totals=Object.fromEntries(keys.map(key=>[key,batches.reduce((sum,b)=>sum+b[key],0)]));
const summary={generatedAt:new Date().toISOString(),scope:'All currently public company records in the two stated YC batches; no AI-name or industry filter.',
  interpretation:'Matches are deterministic visual candidates, not visually validated totals or AI-authorship labels. Both batches were rendered on the observation date, not their launch dates.',
  uniqueCompanyRecords:ids.size,uniqueWebsiteURLs:websites.size,totals,batches};
await fs.writeFile('results/yc-two-batch-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({uniqueCompanyRecords:ids.size,uniqueWebsiteURLs:websites.size,totals},null,2));
