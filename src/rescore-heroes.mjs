import fs from 'node:fs/promises';
import {DETECTOR,classifyHero} from './hero-detector.mjs';
const file=process.argv[2];if(!file)throw new Error('Usage: node src/rescore-heroes.mjs results/report.json');
const report=JSON.parse(await fs.readFile(file,'utf8'));
report.metadata.originalDetector ||= report.metadata.detector;
report.metadata.detector=DETECTOR;report.metadata.reclassifiedAt=new Date().toISOString();
for(const r of report.results)r.classification=classifyHero(r.hero);
const summary=rows=>({companies:rows.length,observed:rows.filter(r=>r.status==='observed').length,matched:rows.filter(r=>r.classification.matched).length,
italicPhrase:rows.filter(r=>r.classification.category==='italic-phrase').length,highlightedPhrase:rows.filter(r=>r.classification.category==='highlighted-phrase').length,
noMatch:rows.filter(r=>r.classification.category==='no-match').length,missingData:rows.filter(r=>r.classification.category==='missing-data').length});
report.summary={fullBatch:summary(report.results),directoryAIQuery:summary(report.results.filter(r=>r.matches_ai_query)),literalAIInName:summary(report.results.filter(r=>r.literal_ai_in_name))};
await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
