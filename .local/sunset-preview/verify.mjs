import {chromium,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const base=new URL('./index.html',import.meta.url).href;
const browser=await chromium.launch();
const report={viewports:[],errors:[],requests:[],loop:{},controls:{},longRun:{}};
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',error=>report.errors.push(error.message));
page.on('request',request=>report.requests.push(request.url()));
const nativeImage=()=>page.evaluate(()=>document.getElementById('world').toDataURL());
const digest=image=>createHash('sha256').update(image).digest('hex');
try{
  await page.goto(base);
  await expect(page.getByRole('button',{name:'Pausar animação',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Pausar animação',exact:true}).click();
  const paused=await page.evaluate(()=>sunsetDiagnostics);
  await page.waitForTimeout(250);
  expect((await page.evaluate(()=>sunsetDiagnostics)).time).toBe(paused.time);
  expect((await page.evaluate(()=>sunsetDiagnostics)).pendingFrame).toBe(false);
  report.controls.pause=true;
  for(const seconds of [0,48,96]){
    await page.evaluate(seconds=>sunsetPreview.seek(seconds),seconds);
    report.loop[seconds]=digest(await nativeImage());
  }
  expect(report.loop[0]).toBe(report.loop[48]);expect(report.loop[0]).toBe(report.loop[96]);
  report.loop.identicalCycles=true;
  // Inspect the pixels on either side of the loop boundary.
  const before=await page.evaluate(()=>{sunsetPreview.seek(47.999);return Array.from(document.getElementById('world').getContext('2d').getImageData(0,0,240,160).data);});
  const after=await page.evaluate(()=>{sunsetPreview.seek(0);return Array.from(document.getElementById('world').getContext('2d').getImageData(0,0,240,160).data);});
  let changed=0;for(let i=0;i<before.length;i+=4)if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])changed++;
  report.loop.seamChangedPixels=changed;report.loop.seamChangeFraction=changed/(240*160);
  expect(report.loop.seamChangeFraction).toBeLessThan(.025);
  await page.evaluate(()=>sunsetPreview.seek(13));
  await page.getByRole('button',{name:'Recomeçar animação',exact:true}).click();
  expect((await page.evaluate(()=>sunsetDiagnostics)).time).toBe(0);report.controls.reset=true;
  await page.getByRole('button',{name:'Continuar animação',exact:true}).click();
  await page.waitForTimeout(250);expect((await page.evaluate(()=>sunsetDiagnostics)).time).toBeGreaterThan(0);report.controls.resume=true;
  await page.getByRole('button',{name:'Pausar animação',exact:true}).click();
  for(const [width,height] of [[320,480],[320,568],[360,640],[390,844],[430,932],[844,390],[1440,900],[1440,1000]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>sunsetPreview.seek(7.7));
    const size=await page.evaluate(()=>{
      const scene=document.querySelector('.scene').getBoundingClientRect(),controls=document.querySelector('.controls').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,scene:scene.toJSON(),controls:controls.toJSON(),smoothing:document.getElementById('world').getContext('2d').imageSmoothingEnabled,rendering:getComputedStyle(document.getElementById('world')).imageRendering};
    });
    expect(size.scrollWidth).toBeLessThanOrEqual(width);expect(size.scrollHeight).toBeLessThanOrEqual(height);
    expect(size.scene.top).toBeGreaterThanOrEqual(0);expect(size.scene.bottom).toBeLessThanOrEqual(height);
    expect(size.scene.height).toBeGreaterThan(100);expect(size.controls.bottom).toBeLessThanOrEqual(height);
    expect(size.smoothing).toBe(false);report.viewports.push(size);
    if(width===390||width===320||width===1440)await page.screenshot({path:new URL(`./verified-${width}x${height}.png`,import.meta.url).pathname.slice(1)});
  }
  // Offline opening verifies the deliverable has no external dependency.
  await context.setOffline(true);await page.reload();await page.evaluate(()=>sunsetPreview.pause());
  expect((await page.evaluate(()=>sunsetDiagnostics)).nativeWidth).toBe(240);report.offline=true;
  expect(report.requests.every(url=>url.startsWith('file:')||url.startsWith('data:'))).toBe(true);
  const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const reducedPage=await reduced.newPage();await reducedPage.goto(base);
  expect((await reducedPage.evaluate(()=>sunsetDiagnostics)).playing).toBe(false);report.reducedMotion=true;await reduced.close();
  console.log('Layout, controles, abertura offline, movimento reduzido e identidade de dois loops: OK.');
  // Let two complete real-time loops run while checking bounded state and errors.
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Continuar animação',exact:true}).click();
  await page.evaluate(()=>{
    window.frameAudit={samples:[],last:null};
    function observe(timestamp){const a=window.frameAudit;if(a.last!==null)a.samples.push(timestamp-a.last);a.last=timestamp;requestAnimationFrame(observe);}
    requestAnimationFrame(observe);
  });
  const initial=await page.evaluate(()=>sunsetDiagnostics);
  for(let i=0;i<4;i++){
    await page.waitForTimeout(25000);
    const state=await page.evaluate(()=>sunsetDiagnostics);
    expect(state.frames).toBeGreaterThan(initial.frames);expect(state.spriteFrames).toBe(initial.spriteFrames);expect(state.staticObjects).toBe(initial.staticObjects);expect(state.staticPixels).toBe(initial.staticPixels);expect(state.pendingFrame).toBe(true);
    console.log(`Execução contínua: ${Math.round(state.time)} s, ${state.frames} quadros, cache estável.`);
  }
  const final=await page.evaluate(()=>({state:sunsetDiagnostics,samples:frameAudit.samples}));
  expect(final.state.time).toBeGreaterThanOrEqual(96);expect(report.errors).toEqual([]);
  const sorted=final.samples.toSorted((a,b)=>a-b);
  report.longRun={seconds:final.state.time,frames:final.state.frames-initial.frames,medianFrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],maxFrameMs:Math.max(...sorted),cacheStable:true};
  await writeFile(new URL('./verification.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:true,seam:report.loop.seamChangeFraction,viewports:report.viewports.length,longRun:report.longRun}));
}finally{await browser.close();}
