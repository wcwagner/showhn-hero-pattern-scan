import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
const args=process.argv.slice(2),opt=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const reportPath=opt('--report','results/yc-spring-2026-2026-09-11.json');
const selection=opt('--selection','matched');
const out=opt('--output',`assets/yc-spring-2026-${selection}`);
const manifestPath=opt('--manifest',`gallery/yc-${selection}-selection.json`);
const auditCount=Number(opt('--count',24));
if(!Number.isSafeInteger(auditCount)||auditCount<1||auditCount>100)throw new Error('--count must be 1–100');
const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
let entries=report.results;
if(selection==='audit') entries=[...entries].sort((a,b)=>{
  const hash=x=>crypto.createHash('sha256').update(x.yc_url).digest('hex');return hash(a).localeCompare(hash(b));
}).slice(0,auditCount);
else if(selection==='matched') entries=entries.filter(x=>x.classification.matched);
else if(selection==='italic') entries=entries.filter(x=>x.classification.category==='italic-phrase');
else throw new Error('selection must be audit, matched, or italic');
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tileWidth=480,tileHeight=330,columns=4,pageSize=24;
for(let offset=0;offset<entries.length;offset+=pageSize){
  const page=entries.slice(offset,offset+pageSize),height=Math.ceil(page.length/columns)*tileHeight,composite=[];
  for(let i=0;i<page.length;i++){
    const e=page[i],left=(i%columns)*tileWidth,top=Math.floor(i/columns)*tileHeight;
    if(e.screenshot){try{composite.push({input:await sharp(e.screenshot).resize(480,300).toBuffer(),left,top:top+30});}catch{}}
    const label=`${offset+i+1}. ${e.name} (${e.objectID})`;
    composite.push({input:Buffer.from(`<svg width="480" height="30"><rect width="480" height="30" fill="#fff"/><text x="8" y="21" font-size="15" font-family="sans-serif" fill="#111">${escape(label)}</text></svg>`),left,top});
  }
  const file=`${out}-${Math.floor(offset/pageSize)+1}.webp`;await fs.mkdir(path.dirname(file),{recursive:true});
  await sharp({create:{width:columns*tileWidth,height,channels:3,background:'#ddd'}}).composite(composite).webp({quality:84}).toFile(file);console.log(file);
}
await fs.mkdir(path.dirname(manifestPath),{recursive:true});
await fs.writeFile(manifestPath,JSON.stringify({report:reportPath,selection,
  rule:selection==='audit'?`First ${auditCount} company-profile URLs ordered by SHA-256, independent of model/classifier output. Missing-data rows remain in sample.`:`All ${selection} deterministic classifications; not visually verified labels.`,
  entries:entries.map((e,i)=>({index:i+1,name:e.name,id:e.objectID,yc_url:e.yc_url,website:e.website,screenshot:e.screenshot||null}))},null,2)+'\n');
