import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
const specs=[
  {name:'goku',cols:4,rows:3,w:32,h:44,characterHeight:35,anchorX:16,anchorY:42},
  {name:'chichi',cols:2,rows:2,w:34,h:44,characterHeight:35,anchorX:11,anchorY:42},
];
const report=[];
for(const spec of specs){
  const source=fileURLToPath(new URL(spec.name+'-generated.png',root));
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const cells=[];
  for(let row=0;row<spec.rows;row++)for(let col=0;col<spec.cols;col++){
    const x0=Math.round(col*info.width/spec.cols),x1=Math.round((col+1)*info.width/spec.cols);
    const y0=Math.round(row*info.height/spec.rows),y1=Math.round((row+1)*info.height/spec.rows);
    let left=x1,top=y1,right=x0,bottom=y0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      if(data[(y*info.width+x)*4+3]<128)continue;
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    }
    if(right<left||bottom<top)throw new Error('Empty sprite cell: '+spec.name+row+col);
    const points=[];
    // Anchor the torso rather than the hand/spoon, so pose changes cannot shift it.
    const from=top+Math.floor((bottom-top)*(spec.name==='goku'?.53:.72));
    const to=top+Math.floor((bottom-top)*(spec.name==='goku'?.68:.90));
    for(let y=from;y<to;y++)for(let x=left;x<=right;x++){
      const offset=(y*info.width+x)*4,r=data[offset],g=data[offset+1],b=data[offset+2];
      const target=spec.name==='goku'?(r>150&&g>50&&g<185&&b<110&&r>g*1.25):(b>110&&b>r*1.20&&r<140&&g<180);
      if(data[offset+3]>=128&&target)points.push(x);
    }
    points.sort((a,b)=>a-b);
    const center=points.length?points[Math.floor(points.length/2)]:(left+right)/2;
    cells.push({row,col,left,top,right,bottom,center,height:bottom-top+1});
  }
  const meanHeight=cells.reduce((n,c)=>n+c.height,0)/cells.length;
  const scale=spec.characterHeight/meanHeight;
  const atlasW=spec.w*spec.cols,atlasH=spec.h*spec.rows;
  const atlas=Buffer.alloc(atlasW*atlasH*4);
  const frameReport=[];
  for(const c of cells){
    const sourceW=c.right-c.left+1,sourceH=c.height;
    const destW=Math.max(1,Math.round(sourceW*scale)),destH=Math.max(1,Math.round(sourceH*scale));
    const resized=await sharp(source).extract({left:c.left,top:c.top,width:sourceW,height:sourceH}).resize(destW,destH,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
    const x=spec.anchorX-Math.round((c.center-c.left)*scale),y=spec.anchorY-destH;
    let clipped=0,opaque=0;
    for(let sy=0;sy<destH;sy++)for(let sx=0;sx<destW;sx++){
      const from=(sy*destW+sx)*4;if(resized[from+3]<128)continue;
      const dx=x+sx,dy=y+sy;
      if(dx<0||dx>=spec.w||dy<0||dy>=spec.h){clipped++;continue;}
      const to=((c.row*spec.h+dy)*atlasW+c.col*spec.w+dx)*4;
      atlas[to]=resized[from];atlas[to+1]=resized[from+1];atlas[to+2]=resized[from+2];atlas[to+3]=255;opaque++;
    }
    if(clipped)throw new Error('Sprite would be clipped: '+spec.name+JSON.stringify({cell:c,clipped,x,y,destW,destH}));
    frameReport.push({row:c.row,col:c.col,x,y,w:destW,h:destH,opaquePixels:opaque});
  }
  const target=fileURLToPath(new URL(spec.name+'-atlas.png',root));
  await sharp(atlas,{raw:{width:atlasW,height:atlasH,channels:4}}).png({palette:true,colours:32,dither:0}).toFile(target);
  await sharp(target).flatten({background:'#c5c9ae'}).resize(atlasW*6,atlasH*6,{kernel:'nearest'}).png().toFile(fileURLToPath(new URL(spec.name+'-atlas-inspection.png',root)));
  report.push({name:spec.name,generatedWidth:info.width,generatedHeight:info.height,cols:spec.cols,rows:spec.rows,atlasW,atlasH,tileWidth:spec.w,tileHeight:spec.h,characterHeight:spec.characterHeight,frames:frameReport});
}
await writeFile(new URL('atlas-manifest.json',root),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
