import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('../',import.meta.url);
const engineFile=new URL('pixel-engine.js',dir);
const source=await readFile(engineFile,'utf8');
const baseline=await readFile(new URL('before-ai/pixel-engine.js',dir),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
if(hash(source)!==hash(baseline))throw new Error('The approved source changed after the snapshot; review it before injecting sprites.');
const goku=(await readFile(new URL('goku-atlas.png',import.meta.url))).toString('base64');
const chichi=(await readFile(new URL('chichi-atlas.png',import.meta.url))).toString('base64');
const atlasCode=`  // Only the two character atlases are generated with image_gen from Buu's Fury references.
  // The PNGs are embedded so the standalone HTML still works completely offline.
  const characterAtlases={
    goku:'data:image/png;base64,${goku}',
    chichi:'data:image/png;base64,${chichi}',
  };
  const gokuImage=new Image(),chichiImage=new Image();
  gokuImage.src=characterAtlases.goku;chichiImage.src=characterAtlases.chichi;
  await Promise.all([gokuImage.decode(),chichiImage.decode()]);
  const directionRows={down:0,right:1,up:2,left:1};
  for(const direction of ['right','left','up','down'])for(let frame=0;frame<4;frame++){
    sprites.set(direction+frame,buffer(32,44,()=>{
      if(direction==='left'){pen.translate(32,0);pen.scale(-1,1);}
      pen.drawImage(gokuImage,frame*32,directionRows[direction]*44,32,44,0,0,32,44);
    }));
  }
  const chef=[];
  for(let frame=0;frame<4;frame++)chef.push(buffer(34,44,()=>{
    pen.drawImage(chichiImage,(frame%2)*34,Math.floor(frame/2)*44,34,44,0,0,34,44);
  }));
`;
const from=source.indexOf('  function drawGoku('),to=source.indexOf('  const route=',from);
if(from<0||to<0)throw new Error('Character block not found.');
let updated=source.slice(0,from)+atlasCode+source.slice(to);
updated=updated.replace('(() => {','(async () => {');
updated=updated.replace('// Original, hand-drawn pixel art in code. Buu\'s Fury is the visual reference.','// Approved scenery drawn in code; AI character atlases based on Buu\'s Fury.');
updated=updated.replace('// No ripped sprites, image files, fonts, libraries, textures or network calls.','// Character PNGs are embedded locally; no network calls or external libraries.');
updated=updated.replace("frame:Math.floor(t*10)%6", "frame:Math.floor(t*8)%4");
updated=updated.replace("chefFrame=Math.floor(t*4)%6", "chefFrame=Math.floor(t*4)%4");
updated=updated.replace('spriteFrames:sprites.size,staticPixels:',"spriteFrames:sprites.size,chefFrames:chef.length,spriteSource:'ai-buus-fury-reference',staticPixels:");
const htmlFile=new URL('index.html',dir);
const html=await readFile(htmlFile,'utf8');
const htmlBefore=await readFile(new URL('before-ai/index.html',dir),'utf8');
const shell=text=>text.replace(/  <script>[\s\S]*?<\/script>/,'<script></script>');
if(shell(html)!==shell(htmlBefore))throw new Error('The approved HTML/CSS changed after the snapshot.');
const newHtml=html.replace(/  <script>[\s\S]*?<\/script>/,`  <script>\n${updated}\n  </script>`);
await writeFile(engineFile,updated);await writeFile(htmlFile,newHtml);
await writeFile(new URL('character-change.json',import.meta.url),JSON.stringify({
  tool:'image_gen.imagegen (built-in)',
  originalEngineHash:hash(baseline),updatedEngineHash:hash(updated),
  approvedHtmlCssHash:hash(shell(htmlBefore)),updatedHtmlCssHash:hash(shell(newHtml)),
  htmlCssUnchanged:shell(newHtml)===shell(htmlBefore),
  atlases:{goku:'goku-atlas.png',chichi:'chichi-atlas.png'},
  runtime:'Embedded data URLs; no external image requests',
},null,2));
console.log('Only characters replaced. Approved HTML/CSS preserved byte for byte.');
