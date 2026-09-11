#!/usr/bin/env node
// Compose exclusively from preserved public website screenshots; no network.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const manifestPath='gallery/dense-contact-sheet.json';
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const m=await read(manifestPath),entries=m.entries;
if(m.rowCounts.reduce((n,c)=>n+c,0)!==entries.length)throw new Error('Every entry must appear once in the row plan.');
if(new Set(entries.map(e=>new URL(e.url).hostname.replace(/^www\./,''))).size!==entries.length)throw new Error('Each montage example must have a distinct host.');
const reviews=[];
for(let i=0;i<entries.length;i++){const e=entries[i],buf=await sharp(e.file).extract(e.crop).resize(330,175,{fit:'contain',background:'#e9e6df'}).toBuffer();const label=String(`${i+1}. ${e.name}`).replace(/[<&]/g,'');const svg=Buffer.from(`<svg width="330" height="24"><rect width="330" height="24" fill="white"/><text x="5" y="17" font-size="14" font-family="Arial">${label}</text></svg>`);reviews.push({input:buf,left:(i%7)*336,top:Math.floor(i/7)*205+25},{input:svg,left:(i%7)*336,top:Math.floor(i/7)*205});}
await sharp({create:{width:2346,height:Math.ceil(entries.length/7)*205,channels:3,background:'#fff'}}).composite(reviews).webp({quality:88}).toFile(m.reviewOutput);
const layers=[];let top=0;
let rowIndex=0;for(let i=0;i<entries.length;){const count=m.rowCounts?.[rowIndex++]||7,row=entries.slice(i,i+count);i+=count;const sum=row.reduce((n,e)=>n+e.crop.width/e.crop.height,0),h=Math.round((m.width-m.gap*(row.length-1))/sum);let left=0;for(let k=0;k<row.length;k++){const e=row[k],w=k===row.length-1?m.width-left:Math.round(h*e.crop.width/e.crop.height);const b=await sharp(e.file).extract(e.crop).resize(w,h,{fit:'fill'}).toBuffer();layers.push({input:b,left,top});left+=w+m.gap;}top+=h+m.gap;}
const height=top-m.gap;await sharp({create:{width:m.width,height,channels:3,background:'#fdfcfa'}}).composite(layers).webp({quality:m.quality}).toFile(m.output);console.log(JSON.stringify({count:entries.length,width:m.width,height,output:m.output,review:m.reviewOutput}));
