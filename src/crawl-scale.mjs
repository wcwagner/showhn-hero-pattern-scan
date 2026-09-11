#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(await readFile(resolve(root,'results/yc-two-batch-summary.json'),'utf8'));
const W=1440,H=760;
const pieces=[`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#f5f3ed"/><g font-family="Helvetica,Arial,sans-serif" fill="#242424"><text x="56" y="84" font-size="58" font-weight="700">${data.uniqueCompanyRecords} companies. Two YC batches.</text><text x="58" y="133" font-size="27">Every publicly listed company · no name or industry filter</text>`];
const mark=(x,y,type,size=19)=>type==='candidate'?`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#242424"/>`:type==='no-match'?`<rect x="${x+.8}" y="${y+.8}" width="${size-1.6}" height="${size-1.6}" fill="none" stroke="#a3a29d" stroke-width="1.6"/>`:`<path d="M${x+3},${y+3}l${size-6},${size-6}m0,-${size-6}l-${size-6},${size-6}" fill="none" stroke="#a3a29d" stroke-width="1.6"/>`;
let markCount=0;
for(const [i,b] of [...data.batches].reverse().entries()){
 const x=58+i*710,y=263;
 pieces.push(`<text x="${x}" y="214" font-size="31" font-weight="700">${b.batch}</text><text x="${x}" y="247" font-size="23">${b.companies} companies · ${b.matched} candidates</text>`);
 // Preserve alphabetical source order: every record receives exactly one mark.
 for(const [j,r] of b.records.entries()){
  const type=r.status!=='observed'?'missing':r.category==='no-match'?'no-match':'candidate';
  pieces.push(mark(x+(j%20)*30,y+Math.floor(j/20)*30,type));markCount++;
 }
}
if(markCount!==data.uniqueCompanyRecords)throw new Error('Company count mismatch');
const legend=[['candidate',`${data.totals.matched} candidates`,58],['no-match',`${data.totals.noMatch} no match`,530],['missing',`${data.totals.missingData} unclassified`,990]];
for(const [type,label,x] of legend)pieces.push(mark(x,603,type,23),`<text x="${x+37}" y="624" font-size="27">${label}</text>`);
pieces.push(`<text x="58" y="687" font-size="23">One mark per company. Candidates are heuristic matches, not confirmed slopmarks.</text><text x="58" y="723" font-size="23">Unclassified includes blocked pages and missing heroes. Observed 11 September 2026.</text></g></svg>`);
const svg=pieces.join('\n');
await writeFile(resolve(root,'assets/yc-two-batch-scale.svg'),svg);
await sharp(Buffer.from(svg)).webp({quality:90}).toFile(resolve(root,'assets/yc-two-batch-scale.webp'));
console.log(`${markCount} company marks; ${data.totals.matched} candidates; ${data.totals.missingData} unclassified`);
