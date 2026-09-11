#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Only crop preserved screenshots. No network, reflow, or generated imagery.
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest=JSON.parse(await readFile(resolve(root, process.argv[2] || 'gallery/post-contact-sheet.json'),'utf8'));
const {width,height,gap,rows,entries,background,quality,output}=manifest;
if(rows.reduce((n,r)=>n+r.count,0)!==entries.length)throw new Error('Each entry must appear exactly once');
const layers=[];let index=0,top=0;
for(const row of rows){
  const tileWidth=Math.floor((width-gap*(row.count-1))/row.count);
  for(let col=0;col<row.count;col++){
    const entry=entries[index++];
    const cropped=await sharp(resolve(root,entry.file)).extract(entry.crop).toBuffer();
    const pixel=await sharp(cropped).extract({left:0,top:0,width:1,height:1}).removeAlpha().raw().toBuffer();
    const tileBackground={r:pixel[0],g:pixel[1],b:pixel[2]};
    const input=await sharp(cropped).resize(tileWidth,row.height,{fit:entry.fit || 'cover',background:tileBackground}).toBuffer();
    layers.push({input,left:col*(tileWidth+gap),top});
  }
  top+=row.height+gap;
}
if(top-gap!==height)throw new Error('Manifest height does not match rows');
await sharp({create:{width,height,channels:3,background}}).composite(layers).webp({quality}).toFile(resolve(root,output));
console.log(`${output}: ${entries.length} examples, ${width}×${height}`);
