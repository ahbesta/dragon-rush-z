import {chromium,expect} from '@playwright/test';
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const browser=await chromium.launch();
const errors=[];
const context=await browser.newContext({viewport:{width:390,height:844}});
const before=await context.newPage(),after=await context.newPage();
after.on('pageerror',error=>errors.push(error.message));
const report={htmlCssUnchanged:false,sceneryComparisons:[],alpha:[],errors};
try{
  await before.goto(new URL('before-ai/index.html',root).href);
  await after.goto(new URL('index.html',root).href);
  await after.waitForFunction(()=>window.sunsetDiagnostics?.spriteSource==='ai-buus-fury-reference');
  const oldHtml=await readFile(new URL('before-ai/index.html',root),'utf8');
  const newHtml=await readFile(new URL('index.html',root),'utf8');
  const shell=html=>html.replace(/  <script>[\s\S]*?<\/script>/,'<script></script>');
  expect(shell(newHtml)).toBe(shell(oldHtml));report.htmlCssUnchanged=true;
  for(const t of [0,.125,6.1,12.3,18.7,24.1,30.2,36.8,42.4,47.999]){
    const grab=page=>page.evaluate(t=>{
      sunsetPreview.pause();sunsetPreview.seek(t);
      return {pixels:Array.from(document.getElementById('world').getContext('2d').getImageData(0,0,240,160).data),goku:sunsetDiagnostics.goku};
    },t);
    const [a,b]=await Promise.all([grab(before),grab(after)]);
    expect(a.goku.x).toBe(b.goku.x);expect(a.goku.y).toBe(b.goku.y);
    let inside=0,outside=0;
    for(let y=0;y<160;y++)for(let x=0;x<240;x++){
      const i=(y*240+x)*4;
      if(a.pixels[i]===b.pixels[i]&&a.pixels[i+1]===b.pixels[i+1]&&a.pixels[i+2]===b.pixels[i+2])continue;
      const character=(x>=a.goku.x-16&&x<a.goku.x+16&&y>=a.goku.y-42&&y<a.goku.y+2)||(x>=149&&x<183&&y>=74&&y<118);
      if(character)inside++;else outside++;
    }
    expect(outside).toBe(0);report.sceneryComparisons.push({time:t,changedCharacterPixels:inside,changedSceneryPixels:outside});
  }
  for(const name of ['goku','chichi']){
    const file=new URL(name+'-atlas.png',import.meta.url);
    const {data,info}=await sharp(await readFile(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const alphaValues=new Set();let transparent=0;
    for(let i=3;i<data.length;i+=4){alphaValues.add(data[i]);if(data[i]===0)transparent++;}
    expect([...alphaValues].sort((a,b)=>a-b)).toEqual([0,255]);expect(transparent/data.length*4).toBeGreaterThan(.5);
    report.alpha.push({name,width:info.width,height:info.height,alphaValues:[...alphaValues],transparentFraction:transparent/(info.width*info.height)});
  }
  const manifest=JSON.parse(await readFile(new URL('atlas-manifest.json',import.meta.url),'utf8'));
  for(const atlas of manifest)for(const frame of atlas.frames){
    expect(frame.x).toBeGreaterThanOrEqual(0);expect(frame.y).toBeGreaterThanOrEqual(0);
    expect(frame.x+frame.w).toBeLessThanOrEqual(atlas.tileWidth);expect(frame.y+frame.h).toBeLessThanOrEqual(atlas.tileHeight);
  }
  expect(errors).toEqual([]);
  await writeFile(new URL('preservation-report.json',import.meta.url),JSON.stringify(report,null,2));
  console.log('10 instantes comparados: nenhum pixel alterado fora dos personagens. HTML/CSS idênticos; transparência e recortes válidos.');
}finally{await browser.close();}
