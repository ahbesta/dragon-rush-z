import {readFile,writeFile} from 'node:fs/promises';
const target=new URL('./index.html',import.meta.url);
const previous=await readFile(target,'utf8');
await writeFile(new URL('./index-voxel.html',import.meta.url),previous);
const engine=await readFile(new URL('./pixel-engine.js',import.meta.url),'utf8');
let html=previous.replace(/  <script>[\s\S]*?<\/script>/,`  <script>\n${engine}\n  </script>`);
html=html.replace('Mundo isométrico feito de blocos ao pôr do sol.','Cena em pixel art 2D, inspirada em Buu’s Fury, ao pôr do sol.');
html=html.replace('Feito de blocos. E de bons momentos.','PIXEL ART · UMA TARDE NO MONTE PAOZU');
html=html.replace('PRÉVIA LOCAL · 100% CÓDIGO','PRÉVIA LOCAL · 100% CÓDIGO');
html=html.replace('    :root {',`    .page { justify-content:center; }
    .scene { flex:0 1 auto !important; aspect-ratio:3/2; max-height:calc(100svh - 230px); background:#151d29 !important; }
    canvas { image-rendering:pixelated; image-rendering:crisp-edges; object-fit:contain; }
    .scene-tag, .corner, .scene::after { display:none; }
    .scene:fullscreen { max-height:none; aspect-ratio:auto; }
    @media (max-height:570px) { .scene { max-height:calc(100svh - 155px); } }
    @media (orientation:landscape) and (max-height:500px) { .scene { max-height:calc(100svh - 60px); } }
    :root {`);
await writeFile(target,html);
console.log('Prévia convertida para pixel art nativa de 240 × 160.');
