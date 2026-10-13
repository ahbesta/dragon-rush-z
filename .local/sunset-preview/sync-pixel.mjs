import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('./index.html',import.meta.url);
const engine=await readFile(new URL('./pixel-engine.js',import.meta.url),'utf8');
const html=(await readFile(file,'utf8')).replace(/  <script>[\s\S]*?<\/script>/,`  <script>\n${engine}\n  </script>`);
await writeFile(file,html);
console.log('HTML autossuficiente atualizado.');
