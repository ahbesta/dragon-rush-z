(() => {
  'use strict';
  // Original, hand-drawn pixel art in code. Buu's Fury is the visual reference.
  // No ripped sprites, image files, fonts, libraries, textures or network calls.
  const W=240,H=160,LOOP=48,TAU=Math.PI*2;
  const canvas=document.getElementById('world');
  canvas.width=W;canvas.height=H;
  const screen=canvas.getContext('2d',{alpha:false});
  if(!screen)return;
  screen.imageSmoothingEnabled=false;
  let pen=screen,elapsed=0,lastTime=null,raf=null,frames=0;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let playing=!motion.matches;
  const objects=[],sprites=new Map();
  const colors={ink:'#272436',hair:'#151a29',hairLight:'#30364b',skin:'#f6c394',skinShadow:'#cc8557',skinLight:'#ffe0a6',orange:'#ed772a',orangeDark:'#b94a24',orangeLight:'#ffab40',blue:'#2d4a94',blueLight:'#4a75bc',purple:'#7d559b',purpleLight:'#a982bd'};
  const mod=(n,m)=>((n%m)+m)%m;
  const rand=n=>{const s=Math.sin(n*71.93+13.67)*43758.5453;return s-Math.floor(s);};
  function rect(x,y,w,h,color){pen.fillStyle=color;pen.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function poly(points,color){
    // Integer scanlines, never antialiased canvas paths: every edge is a pixel.
    const low=Math.ceil(Math.min(...points.map(p=>p[1]))),high=Math.ceil(Math.max(...points.map(p=>p[1])));
    for(let y=low;y<high;y++){
      const cuts=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length];
        if((a[1]<=y+.5&&b[1]>y+.5)||(b[1]<=y+.5&&a[1]>y+.5))cuts.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      cuts.sort((a,b)=>a-b);
      for(let i=0;i<cuts.length;i+=2){const x=Math.ceil(cuts[i]);rect(x,y,Math.ceil(cuts[i+1])-x,1,color);}
    }
  }
  function ellipse(x,y,rx,ry,color){
    for(let row=-Math.ceil(ry);row<=Math.ceil(ry);row++){
      const p=(row+.5)/ry;if(Math.abs(p)>1)continue;
      const half=Math.round(Math.sqrt(1-p*p)*rx);rect(x-half,y+row,half*2,1,color);
    }
  }
  function pixels(rows,x,y,palette){
    rows.forEach((row,j)=>{for(let i=0;i<row.length;i++){const c=palette[row[i]];if(c)rect(x+i,y+j,1,1,c);}});
  }
  function buffer(w,h,draw){
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const previous=pen;pen=c.getContext('2d');pen.imageSmoothingEnabled=false;draw();pen=previous;return c;
  }
  function object(x,y,w,h,depth,draw){objects.push({x,y,depth,image:buffer(w,h,draw)});}
  const grass=['#6b8b43','#73964a','#7ba04e','#829d4d','#94aa56'];
  function tuft(x,y,light=false){rect(x,y,1,2,'#45633a');rect(x+2,y-1,1,3,light?'#bfd174':'#a1b862');rect(x+4,y,1,2,'#466a3c');rect(x+1,y+2,3,1,'#557842');}
  const ground=buffer(W,H,()=>{
    // An RPG tile map, with a grassy riverbank rather than a floating diorama.
    rect(0,45,219,84,grass[1]);
    for(let ty=48;ty<130;ty+=8)for(let tx=0;tx<220;tx+=8){
      const seed=tx*13+ty*27;
      for(let i=0;i<8;i++){const x=tx+Math.floor(rand(seed+i)*8),y=ty+Math.floor(rand(seed+i+60)*8);rect(x,y,1+(i%2),1,grass[Math.floor(rand(seed+i+80)*grass.length)]);}
      if(rand(seed)>.64)tuft(tx+2,ty+2);
    }
    // Path, hand-placed stepping stones and warm pixel dithering.
    poly([[49,108],[69,105],[117,104],[132,110],[177,111],[190,118],[182,127],[62,126],[43,119]],'#b7a36a');
    poly([[63,109],[121,108],[137,116],[176,116],[179,123],[62,122],[50,118]],'#cfb783');
    for(let i=0;i<130;i++){
      const x=50+Math.floor(rand(i+881)*130),y=110+Math.floor(rand(i+256)*15);
      if(x<170||y>115)rect(x,y,1,1,i%3?'#a38a5b':'#e8c991');
    }
    for(const [x,y] of [[106,108],[106,114],[99,117],[91,116]]){rect(x,y,7,3,'#87765e');rect(x,y-1,6,3,'#d2c5a0');rect(x+1,y-1,4,1,'#f0d9af');}
    // Grass overhang and textured, fractured stone bank.
    for(let x=0;x<221;x+=8){
      const edge=127+Math.floor(rand(x+347)*3);
      rect(x,edge,8,12,'#594d43');rect(x,edge+1,8,3,'#a88e67');
      poly([[x,edge+3],[x+3,edge+1],[x+7,edge+4],[x+5,edge+10],[x+1,edge+9]],'#8d775a');
      poly([[x+1,edge+3],[x+4,edge+2],[x+6,edge+4],[x+4,edge+7]],'#bc9f72');
      rect(x+6,edge+6,1,4,'#5a5547');rect(x+1,edge+10,5,1,'#736850');
      rect(x,edge-2,8,3,'#4c6e38');rect(x,edge-3,7,2,'#a3b760');
      rect(x+2,edge,3,1,'#749344');
    }
    // Right creek bank, a smaller path leading into the bamboo.
    for(let y=47;y<127;y+=6){const x=216+Math.round(Math.sin(y*.18)*2);rect(x,y,4,6,'#41594b');rect(x-1,y,2,4,'#b7a77a');rect(x-4,y,3,3,'#8aa65c');}
    poly([[181,62],[188,63],[188,111],[193,119],[185,123],[181,111]],'#b0a06f');
    // Long evening shadows.
    poly([[78,98],[130,96],[105,116],[46,115]],'#54763e');
    poly([[173,89],[187,92],[170,105],[151,103]],'#54763e');
    // Flower patches and meadow details.
    for(let i=0;i<35;i++){
      const x=Math.floor(rand(i+210)*214),y=77+Math.floor(rand(i+811)*48);
      if(x>44&&x<194&&y<123)continue;
      rect(x,y,1,3,'#406839');rect(x-1,y-1,3,1,i%3?'#e6c777':'#d18fa0');rect(x,y-2,1,3,i%3?'#ffe4a5':'#f1bbab');
    }
    // Vegetables next to Chi-Chi's kitchen.
    rect(188,108,20,14,'#665b3c');rect(188,108,20,1,'#b3a776');
    for(let i=0;i<3;i++)for(let j=0;j<2;j++){
      const x=191+i*6,y=111+j*5;rect(x-2,y,5,2,'#355538');rect(x-1,y-1,3,3,'#648348');rect(x,y-2,2,3,'#a0b266');
      if(i===2){rect(x,y+1,1,2,'#db7d3d');rect(x-1,y,3,1,'#f4a547');}
    }
  });
  function tree(x,y,size=1){
    const w=Math.ceil(42*size),h=Math.ceil(57*size);
    object(x-w/2,y-h,w,h,y,()=>{
      pen.save();pen.scale(size,size);
      ellipse(21,52,18,4,'#42673a');
      poly([[17,28],[25,28],[27,47],[34,53],[25,53],[20,50],[14,53],[7,53],[14,46]],'#443e37');
      poly([[18,29],[23,29],[24,45],[29,51],[24,51],[20,47],[16,51],[11,51],[17,44]],'#8d6b4c');
      rect(18,33,2,12,'#b49468');rect(23,37,1,10,'#624e3f');
      pixels(['.aaa.','abbba','ab.ba','abbba','.aaa.'],17,39,{a:'#5e4c3e',b:'#a17c55'});
      const clusters=[[12,15,11,10],[25,13,12,11],[21,7,11,7],[8,25,8,11],[20,25,13,12],[33,25,8,10],[16,35,10,8],[28,33,11,9]];
      for(let i=0;i<clusters.length;i++){
        const [cx,cy,rx,ry]=clusters[i];ellipse(cx,cy,rx,ry,'#293e32');ellipse(cx,cy-1,rx-1,ry-1,'#466442');ellipse(cx-1,cy-2,rx-2,ry-2,'#648443');
        for(let j=0;j<18;j++){
          const a=Math.floor(cx-rx+2+rand(i*33+j+650)*(rx*2-4)),b=Math.floor(cy-ry+2+rand(i*57+j+432)*(ry*2-4));
          if(((a-cx)/(rx-2))**2+((b-cy)/(ry-2))**2>1)continue;
          rect(a,b,2,1,j%3?'#8ca64f':'#a8ba67');rect(a+1,b+1,1,2,'#486f3c');
        }
      }
      // Serrated leaf silhouettes and isolated light pixels, like GBA tile art.
      for(const [a,b] of [[3,25],[6,18],[13,5],[26,4],[36,21],[33,38],[17,41]]){rect(a,b,2,3,'#486943');rect(a,b,1,1,'#adbe6f');}
      pen.restore();
    });
  }
  tree(26,108,1.08);tree(218,94,.94);tree(43,67,.66);tree(199,62,.65);
  function bamboo(x,y){
    object(x,y-29,15,31,y,()=>{
      for(let i=0;i<3;i++){
        const a=3+i*4,top=i===1?0:5;rect(a,top,2,29-top,'#466440');rect(a,top,1,29-top,'#a0ae62');
        for(let b=top+4;b<27;b+=5)rect(a-1,b,3,1,'#d1c889');
        for(let b=top+8;b<25;b+=7){poly([[a,b],[a-5,b-3],[a-3,b+1]],'#507946');poly([[a+1,b+1],[a+6,b-1],[a+5,b+2]],'#89a65c');}
      }
    });
  }
  bamboo(3,74);bamboo(199,89);
  function roof(x,y,w,h){
    poly([[x,y+h],[x+5,y+7],[x+w/2,y],[x+w-4,y+7],[x+w,y+h]],'#3b4445');
    poly([[x+2,y+h-2],[x+7,y+8],[x+w/2,y+2],[x+w-6,y+8],[x+w-2,y+h-2]],'#7e8970');
    for(let row=6;row<h-1;row+=4){const inset=Math.max(2,(h-row)*.56);rect(x+inset,y+row,w-inset*2,1,'#546655');rect(x+inset,y+row-1,w-inset*2,1,'#abb291');for(let a=x+inset+((row/4)%2)*3;a<x+w-inset;a+=6)rect(a,y+row-3,1,3,'#626e5d');}
    rect(x+2,y+h-1,w-4,2,'#3d514a');
  }
  object(59,47,129,60,107,()=>{
    // Recognizable anime cottage, translated into a GBA-style pixel map asset.
    // Wooden wings, a capsule dome, a panoramic window, and the red 福 signs.
    rect(4,26,33,31,'#4c443b');rect(6,27,29,29,'#c5baa0');
    for(let x=8;x<35;x+=4){rect(x,28,1,27,'#81745b');rect(x+1,28,1,27,'#e1cb9e');}
    rect(4,52,33,3,'#75674f');roof(0,3,44,28);
    rect(15,15,9,8,'#534e42');rect(16,16,7,6,'#577e91');rect(19,16,1,6,'#b8c5bc');
    rect(8,34,14,12,'#645847');rect(9,35,12,10,'#3d5f78');rect(10,36,4,8,'#638d9b');rect(15,35,1,10,'#acb9ac');rect(9,40,12,1,'#afbaa5');
    rect(5,33,3,14,'#95764e');rect(22,33,3,14,'#95764e');
    rect(75,30,48,28,'#494539');rect(77,30,44,26,'#d6c3a0');
    for(let x=79;x<121;x+=4){rect(x,30,1,26,'#877455');rect(x+1,30,1,26,'#e8d2aa');}
    rect(74,51,51,3,'#927a58');roof(69,9,60,24);
    rect(99,36,15,13,'#5c5142');rect(101,38,11,9,'#4c7183');rect(102,39,4,7,'#7b9fac');rect(106,38,1,9,'#c0c8b6');rect(101,42,11,1,'#c0c8b6');
    rect(96,36,4,13,'#9b805e');rect(114,36,4,13,'#9b805e');
    rect(6,5,5,8,'#9ba99b');rect(5,4,7,2,'#e3dcc3');rect(7,6,1,6,'#d5c8a7');
    rect(101,13,5,8,'#a8b39e');rect(100,12,7,2,'#eee1ba');
    // Dome scanlines use a small, deliberate shading palette.
    const cx=59,top=10,r=31;
    for(let row=0;row<47;row++){
      const half=row<31?Math.round(Math.sqrt(Math.max(0,r*r-(r-row-.5)**2))):r;
      rect(cx-half,top+row,half*2,1,'#555f5c');
      rect(cx-half+1,top+row,Math.max(0,half*2-2),1,'#c9cdb2');
      const left=cx-half+2,span=Math.max(0,half*2-4);
      rect(left,top+row,Math.round(span*.24),1,'#91a9a3');rect(left+Math.round(span*.24),top+row,Math.round(span*.17),1,'#b3c5b5');
      rect(left+Math.round(span*.41),top+row,Math.round(span*.43),1,'#e3dfbf');rect(left+Math.round(span*.84),top+row,Math.round(span*.16),1,'#f7e9c7');
    }
    rect(29,55,60,2,'#8c9b89');rect(31,57,57,1,'#485949');
    for(let i=0;i<45;i++){const x=32+Math.floor(rand(i+417)*53),y=18+Math.floor(rand(i+621)*33);if(((x-59)/28)**2+((y-39)/28)**2<1&&x<53)rect(x,y,1,1,i%2?'#bacbb4':'#b1c1ab');}
    // Blue panoramic glass with exact pixel highlights and dark framing.
    rect(35,35,27,10,'#546878');rect(36,36,25,8,'#385c82');rect(37,37,23,5,'#5489ab');rect(38,37,3,5,'#89b6c1');rect(46,37,1,5,'#a8c9c7');rect(55,37,1,5,'#a8c9c7');rect(35,44,28,2,'#e3dec0');
    rect(69,39,15,18,'#506574');rect(68,39,2,18,'#d5dfc7');rect(84,40,2,17,'#f8e8bf');rect(70,36,13,3,'#e7e4c6');rect(72,34,9,2,'#f1e5c2');
    rect(71,40,11,17,'#725a3f');rect(72,40,9,16,'#b99559');rect(73,40,2,15,'#d9b473');rect(76,40,1,16,'#7f6a46');rect(79,40,1,16,'#8f754c');rect(71,48,11,1,'#62523e');rect(79,47,1,2,'#f5d49a');
    rect(68,57,18,2,'#a89b78');rect(67,59,20,1,'#d3c49c');
    // Ventilator cap and the characteristic lucky symbols, all hand-pixelled.
    rect(54,4,10,9,'#5d8797');rect(53,3,12,3,'#dddcc0');rect(53,2,12,1,'#f8e9c9');for(let x=55;x<63;x+=2)rect(x,7,1,4,'#34586e');
    const glyph=['.rr.r..','rrr.rrr','.r..r.r','rrr.rrr','r.r.rrr','.r..r.r','.r..rrr'];
    poly([[37,23],[43,17],[50,23],[43,30]],'#b65e48');poly([[39,23],[43,19],[48,23],[43,28]],'#e0dac0');pixels(glyph,40,20,{r:'#ae4e3d'});
    poly([[70,24],[76,18],[83,24],[76,31]],'#bd6048');poly([[72,24],[76,20],[81,24],[76,29]],'#eee0ba');pixels(glyph,73,21,{r:'#b14d39'});
  });
  // Wooden fence and classic red mailbox.
  object(180,93,29,13,106,()=>{rect(0,4,29,2,'#c5b180');rect(0,9,29,2,'#917856');for(let x=2;x<29;x+=7){rect(x,1,2,12,'#6c6049');rect(x,1,1,11,'#e6cb93');rect(x,0,2,1,'#f1d4a1');}});
  object(60,102,9,13,115,()=>{rect(3,5,2,8,'#765942');rect(3,5,1,7,'#c19a61');rect(0,1,8,5,'#622e32');rect(1,0,6,1,'#ba5f45');rect(1,1,6,3,'#c5714e');rect(1,4,6,1,'#8d3d37');rect(5,2,2,1,'#edaa71');});
  // Bridge over the creek. Planks and posts use the same map perspective.
  object(208,118,32,18,137,()=>{rect(0,5,32,10,'#293f48');rect(0,3,32,10,'#a4885e');for(let x=2;x<32;x+=4){rect(x,3,1,10,'#68543f');rect(x+1,3,2,1,'#d2b379');}rect(0,2,32,1,'#e1c38e');rect(0,12,32,2,'#665541');for(const x of [2,28]){rect(x,0,2,18,'#685240');rect(x,0,1,17,'#d0ad70');}rect(2,0,28,1,'#d3b57e');rect(2,17,28,1,'#77664b');});
  object(170,104,15,14,118,()=>{
    rect(2,5,11,9,'#514b46');rect(3,6,9,7,'#bba68a');rect(4,8,7,4,'#463936');rect(6,9,3,2,'#e87635');rect(7,9,1,1,'#ffd578');
    rect(0,4,15,2,'#e0c9a1');rect(1,6,13,1,'#82705b');
    rect(2,0,11,4,'#293c47');rect(3,0,9,3,'#597878');rect(4,1,7,1,'#bf8456');rect(0,1,3,1,'#8eaaa0');rect(12,1,3,1,'#8eaaa0');
  });
  object(185,96,13,11,107,()=>{rect(1,2,11,4,'#c8a16d');rect(1,6,2,5,'#665240');rect(10,6,2,5,'#665240');rect(2,1,10,1,'#edcd91');rect(3,0,4,2,'#e2dbc0');rect(4,0,2,1,'#d7a66b');rect(9,0,2,2,'#547e88');});
  const cloud=buffer(39,17,()=>{
    ellipse(12,10,11,6,'#a77d36');ellipse(24,10,10,5,'#a77d36');ellipse(18,6,9,6,'#a77d36');
    ellipse(12,9,10,5,'#efb83e');ellipse(24,9,9,4,'#efb83e');ellipse(18,5,8,5,'#f8ce57');ellipse(11,7,6,3,'#ffe787');ellipse(24,7,5,2,'#ffdc72');
    rect(6,11,21,1,'#d9a43b');rect(11,13,14,1,'#f5cd5f');
    rect(31,9,5,3,'#ebbb4c');rect(35,6,3,5,'#f6cc65');rect(33,4,4,2,'#ffdd78');rect(31,5,2,2,'#eab64b');rect(33,6,2,1,'#bc8f38');
  });
  function drawGoku(direction,frame){
    const C=colors;
    const gait=[0,1,2,0,-1,-2][frame],lift=[0,0,1,0,0,1][frame];
    if(direction==='left'){pen.scale(-1,1);}
    const vertical=direction==='up'||direction==='down';
    // Foot separation and opposing arms use six distinct poses.
    const far=vertical?-3:-3-gait,near=vertical?3:2+gait;
    rect(far-2,-8-lift,4,7,C.ink);rect(far-1,-8-lift,3,5,C.orangeDark);rect(far-2,-3-lift,5,3,C.blue);rect(far-1,-3-lift,4,1,C.blueLight);
    rect(near-2,-8+lift,4,8,C.ink);rect(near-1,-8+lift,3,5,C.orange);rect(near-2,-2+lift,6,3,C.blue);rect(near-1,-2+lift,4,1,C.blueLight);rect(near+2,-1+lift,2,1,'#bc6462');
    const bob=frame===1||frame===4?-1:0;pen.translate(0,bob);
    rect(-8,-17-gait,4,8,C.ink);rect(-7,-16-gait,3,5,C.skinShadow);rect(-7,-11-gait,3,2,C.blue);rect(-7,-9-gait,3,2,C.skin);
    rect(-6,-20,12,12,C.ink);rect(-5,-19,10,10,C.orange);rect(-5,-18,3,8,C.orangeLight);rect(3,-17,2,8,C.orangeDark);
    rect(-2,-20,5,4,C.blue);rect(-1,-20,3,2,C.skin);rect(-5,-10,10,2,C.blue);rect(-4,-10,8,1,C.blueLight);
    rect(4,-8,2,4,C.blue);rect(5,-5,2,2,C.blue);
    if(direction==='up'){rect(-3,-16,6,5,'#f5e0b4');pixels(['.kk.','k.k.','.kk.'], -2,-15,{k:'#4b3b37'});}
    else{rect(-4,-17,4,4,'#f7e3b9');rect(-3,-16,2,2,'#543f35');rect(-3,-16,1,1,'#f9eac8');}
    rect(5,-16+gait,4,8,C.ink);rect(6,-15+gait,2,5,C.skin);rect(6,-10+gait,3,2,C.blue);rect(6,-8+gait,3,2,C.skin);rect(5,-16+gait,3,1,C.orangeLight);
    // Large contiguous black silhouette, matched to Buu's Fury proportions.
    const hair=[[-8,-22],[-10,-24],[-8,-27],[-13,-28],[-9,-30],[-12,-32],[-6,-31],[-8,-35],[-3,-33],[-1,-37],[3,-33],[6,-35],[7,-30],[12,-32],[10,-28],[13,-27],[8,-24],[8,-21],[3,-22],[-1,-24],[-5,-21]];
    poly(hair,C.hair);rect(-6,-30,4,1,C.hairLight);rect(-1,-33,2,2,C.hairLight);rect(5,-29,3,1,C.hairLight);
    if(direction!=='up'){
      if(vertical){
        poly([[-6,-25],[6,-25],[7,-21],[5,-17],[-4,-17],[-7,-21]],C.skinShadow);rect(-5,-24,10,5,C.skin);rect(-4,-24,8,2,C.skinLight);
        rect(-4,-22,3,2,'#fff0d0');rect(2,-22,3,2,'#fff0d0');rect(-2,-22,1,2,C.ink);rect(3,-22,1,2,C.ink);rect(-4,-23,3,1,C.hair);rect(2,-23,3,1,C.hair);rect(-1,-18,3,1,'#885540');
        poly([[-7,-26],[-3,-27],[-1,-24],[1,-27],[4,-24],[6,-26],[7,-23],[5,-23],[3,-25],[1,-23],[-1,-25],[-4,-23],[-6,-22]],C.hair);
      }else{
        poly([[-5,-26],[5,-26],[7,-23],[7,-22],[10,-21],[7,-19],[5,-17],[-2,-17],[-6,-20]],C.skinShadow);
        poly([[-3,-26],[5,-26],[7,-23],[7,-22],[9,-21],[6,-20],[5,-18],[0,-18],[-3,-20]],C.skin);
        rect(-3,-25,6,2,C.skinLight);rect(3,-23,3,2,'#fff0d4');rect(5,-23,1,2,C.hair);rect(2,-24,4,1,C.hair);rect(6,-22,1,1,C.hair);rect(4,-19,3,1,'#91533b');
        rect(-7,-22,3,3,C.skin);rect(-6,-21,1,1,C.skinShadow);
        poly([[-7,-27],[-2,-29],[5,-27],[8,-26],[7,-23],[4,-26],[2,-23],[0,-26],[-3,-24],[-5,-26],[-7,-21]],C.hair);
      }
    }else{rect(-5,-22,10,4,C.hair);rect(-1,-22,4,1,C.hairLight);rect(-5,-19,2,2,C.skinShadow);rect(5,-19,2,2,C.skinShadow);}
  }
  for(const direction of ['right','left','up','down'])for(let frame=0;frame<6;frame++){
    sprites.set(direction+frame,buffer(32,44,()=>{pen.translate(16,42);drawGoku(direction,frame);}));
  }
  function drawChichi(frame){
    const C=colors,stir=[0,1,2,1,0,-1][frame];
    rect(-5,-2,4,3,'#763946');rect(3,-2,4,3,'#763946');rect(-4,-2,3,1,'#d16a67');rect(4,-2,3,1,'#d16a67');
    poly([[-5,-20],[5,-20],[6,-12],[8,-2],[-7,-2],[-5,-12]],C.ink);
    poly([[-4,-19],[4,-19],[5,-11],[6,-3],[-5,-3],[-4,-11]],C.purple);rect(3,-14,2,9,C.purpleLight);rect(-4,-14,2,9,'#5e3f7d');
    rect(-5,-13,11,2,'#f2c46c');rect(-2,-16,6,12,'#f0dfb7');rect(-1,-15,4,9,'#fff0cf');
    rect(-7,-18,3,8,C.purple);rect(-7,-12,2,4,C.skin);rect(-7,-9,3,1,'#ba686c');
    poly([[-7,-21],[-3,-24],[3,-24],[8,-20],[6,-17],[2,-19],[0,-16],[-4,-19],[-7,-17]],'#e8aa50');rect(-1,-23,4,3,C.skin);
    poly([[-6,-29],[4,-29],[7,-25],[7,-23],[9,-22],[6,-20],[2,-18],[-4,-20],[-6,-24]],C.skinShadow);
    rect(-4,-28,9,7,C.skin);rect(-3,-28,7,2,C.skinLight);
    rect(2,-25,3,2,'#fff0d6');rect(4,-25,1,2,C.hair);rect(1,-26,4,1,C.hair);rect(6,-24,1,1,C.hair);rect(3,-21,3,1,'#a1554e');
    // Bun, headband, full crown and heavy fringe, not separated hair blocks.
    poly([[-3,-36],[2,-36],[5,-34],[5,-31],[-4,-31],[-6,-33]],C.hair);rect(-3,-35,4,1,C.hairLight);rect(-4,-31,8,1,'#e2b362');
    poly([[-6,-23],[-8,-28],[-6,-31],[-2,-32],[3,-31],[7,-28],[7,-24],[5,-25],[4,-28],[2,-25],[0,-28],[-2,-25],[-4,-27],[-5,-22]],C.hair);
    rect(-5,-30,5,1,C.hairLight);rect(-7,-26,2,7,C.hair);rect(-5,-21,1,4,'#c96163');rect(6,-22,1,3,'#c96163');
    rect(6,-19,3,5,C.purple);rect(8,-16,3,3,C.skin);rect(10,-15+stir,4,2,C.skin);rect(11,-15+stir,1,1,'#f9d8a0');
    rect(14+stir,-18,1,14,'#6f4e3b');rect(13+stir,-6,3,2,'#bfa071');
  }
  const chef=[];for(let f=0;f<6;f++)chef.push(buffer(34,44,()=>{pen.translate(11,42);drawChichi(f);}));
  const route=[[49,123],[175,123],[188,111],[186,61],[57,61],[48,97],[49,123]];
  const lengths=[];let total=0;
  for(let i=1;i<route.length;i++){const length=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);lengths.push(length);total+=length;}
  function walking(t){
    let distance=mod(t/LOOP,1)*total;
    for(let i=0;i<lengths.length;i++){
      if(distance<=lengths[i]){
        const a=route[i],b=route[i+1],u=distance/lengths[i],dx=b[0]-a[0],dy=b[1]-a[1];
        const direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
        return {x:Math.round(a[0]+dx*u),y:Math.round(a[1]+dy*u),direction,frame:Math.floor(t*10)%6};
      }distance-=lengths[i];
    }return {x:49,y:123,direction:'right',frame:0};
  }
  function sky(t){
    const bands=['#59567d','#716487','#8e7692','#b18496','#cc9796','#e6ac90','#efbd94','#efc99e'];
    bands.forEach((c,i)=>rect(0,i*6,W,6,c));
    ellipse(169,23,22,17,'#e8ad8a');ellipse(169,23,17,14,'#f6c597');ellipse(169,23,12,12,'#ffe5ac');
    rect(155,28,28,1,'#f5bf8f');rect(155,31,28,1,'#eeb58a');rect(155,34,28,1,'#db9f85');
    const mountains=[[0,46,15,31],[21,46,17,25],[45,46,15,20],[194,47,14,32],[214,47,18,25]];
    for(let i=0;i<mountains.length;i++){
      const [x,y,w,h]=mountains[i];poly([[x-w/2,y],[x-w/2,y-h*.3],[x-w*.35,y-h*.3],[x-w*.35,y-h*.7],[x-w*.2,y-h*.7],[x-w*.2,y-h],[x+w*.2,y-h],[x+w*.2,y-h*.75],[x+w*.35,y-h*.75],[x+w*.35,y-h*.35],[x+w/2,y-h*.35],[x+w/2,y]],i%2?'#857b8d':'#a08b94');rect(x-w*.2,y-h,w*.4,2,'#bba5a0');rect(x-w*.12,y-h*.66,2,h*.6,'#b19a9e');
    }
    poly([[0,47],[0,38],[8,38],[8,36],[19,36],[19,40],[31,40],[31,37],[39,37],[39,40],[59,40],[59,38],[75,38],[75,40],[99,40],[99,41],[134,41],[134,38],[148,38],[148,42],[163,42],[163,39],[183,39],[183,36],[205,36],[205,39],[225,39],[225,36],[240,36],[240,50],[0,50]],'#58685a');
    for(let i=0;i<65;i++){const x=Math.floor(rand(i+201)*240),y=39+Math.floor(rand(i+129)*6);rect(x,y,2,1,'#7d8263');}
    // Slowly drifting clouds, fully offscreen when their cycle wraps.
    for(let i=0;i<4;i++){
      const x=Math.floor(-52+mod(t/LOOP+i*.251,1)*344),y=6+(i%3)*5;
      ellipse(x+13,y+4,12,3,'#bc95a0');ellipse(x+23,y+3,11,3,'#bc95a0');ellipse(x+17,y,8,3,'#e7b9ac');ellipse(x+6,y+2,7,2,'#e7b9ac');ellipse(x+29,y+2,9,2,'#e7b9ac');rect(x+2,y+2,35,1,'#f3c7b3');
    }
    for(let i=0;i<3;i++){const x=Math.floor(265-mod(t/LOOP+i*.026,1)*300),y=29+i*2,wing=Math.floor(t*4)%2;rect(x,y,1,1,'#53516c');rect(x-2,y-wing,2,1,'#53516c');rect(x+1,y-wing,2,1,'#53516c');}
  }
  function water(t){
    rect(0,45,W,115,'#527d8d');
    for(let y=45;y<H;y+=3)rect(0,y,W,3,y>139?['#476e88','#4f7d95','#568499'][Math.floor((y-140)/3)%3]:'#5e8796');
    const frame=Math.floor(t*8)%32;
    for(let i=0;i<105;i++){
      const x=Math.floor(rand(i+300)*240),y=47+Math.floor(rand(i+600)*113),offset=(frame+i)%16;
      rect(mod(x+Math.floor(offset/4),240),y,2+Math.floor(rand(i+400)*6),1,i%4===0?'#87b2b1':'#659ba7');
      if(i%5===0)rect(x+1,y+1,3,1,'#395f78');
    }
    for(let i=0;i<14;i++){const y=47+i*8,x=162+Math.round(Math.sin(t*TAU/6+i)*2),w=4+i%4*3;rect(x-w/2,y,w,1,i%2?'#d4b699':'#aaac9b');}
    // Lily pads stay anchored while their reflections oscillate.
    for(const [x,y] of [[30,151],[193,151],[232,101]]){ellipse(x,y,4,2,'#345c50');rect(x-2,y-1,5,1,'#7c9b68');rect(x+1,y,2,1,'#527e82');rect(x-2,y+3+(Math.floor(t*4)%2),5,1,'#68949b');}
  }
  function smoke(t){
    for(let i=0;i<4;i++){
      const p=mod(t/6+i/4,1),x=65+Math.round(Math.sin(p*TAU+i)*2),y=50-Math.floor(p*14);
      pen.globalAlpha=Math.sin(p*Math.PI)*.5;rect(x,y,3+Math.floor(p*3),2,'#f0d6bb');rect(x+2,y-1,3,1,'#f0d6bb');
    }pen.globalAlpha=1;
    for(let i=0;i<3;i++){
      const p=mod(t/3+i/3,1),x=175+Math.round(Math.sin(p*TAU)*2),y=103-Math.floor(p*11);
      pen.globalAlpha=Math.sin(p*Math.PI)*.8;rect(x,y,3,1,'#f8e0b8');rect(x-1,y-1,2,1,'#f8e0b8');
    }pen.globalAlpha=1;
  }
  function draw(){
    const t=mod(elapsed,LOOP);pen=screen;screen.setTransform(1,0,0,1,0,0);screen.globalAlpha=1;
    sky(t);water(t);screen.drawImage(ground,0,0);
    const walk=walking(t),chefFrame=Math.floor(t*4)%6;
    ellipse(walk.x,walk.y+1,7,2,'#667246');ellipse(160,117,7,2,'#526d3e');ellipse(194,99,13,2,'#597442');
    const layers=objects.map(o=>({depth:o.depth,draw:()=>screen.drawImage(o.image,Math.round(o.x),Math.round(o.y))}));
    layers.push({depth:98,draw:()=>screen.drawImage(cloud,176,80+Math.round(Math.sin(t*TAU/6)))});
    layers.push({depth:116,draw:()=>screen.drawImage(chef[chefFrame],149,74)});
    layers.push({depth:walk.y,draw:()=>screen.drawImage(sprites.get(walk.direction+walk.frame),walk.x-16,walk.y-42)});
    layers.sort((a,b)=>a.depth-b.depth);for(const layer of layers)layer.draw();
    smoke(t);
    // Sparse twilight fireflies: single pixels, not blur filters.
    for(let i=0;i<8;i++){
      if(Math.sin(t*TAU/6+i*1.7)>.65){const x=10+Math.floor(rand(i+189)*210)+Math.round(Math.sin(t*TAU/12+i)),y=89+Math.floor(rand(i+456)*39);rect(x,y,1,1,'#ffdb81');}
    }
    frames++;
  }
  function tick(timestamp){
    raf=null;if(!playing||document.hidden){lastTime=null;return;}
    if(lastTime!==null)elapsed+=Math.min((timestamp-lastTime)/1000,.08);
    lastTime=timestamp;draw();raf=requestAnimationFrame(tick);
  }
  function schedule(){if(raf===null&&playing&&!document.hidden)raf=requestAnimationFrame(tick);}
  function controls(){
    document.getElementById('play-label').textContent=playing?'Pausar':'Continuar';
    document.getElementById('play').setAttribute('aria-label',playing?'Pausar animação':'Continuar animação');
    document.getElementById('play-icon').innerHTML=playing?'<path d="M4 3h3v10H4zm5 0h3v10H9z"/>':'<path d="m5 3 8 5-8 5z"/>';
  }
  function setPlaying(value){
    playing=value;lastTime=null;if(!playing&&raf!==null){cancelAnimationFrame(raf);raf=null;}controls();schedule();
    document.getElementById('status').textContent=playing?'Animação em movimento.':'Animação pausada.';
  }
  document.getElementById('play').addEventListener('click',()=>setPlaying(!playing));
  document.getElementById('reset').addEventListener('click',()=>{elapsed=0;lastTime=null;draw();document.getElementById('status').textContent='A tarde recomeçou.';});
  const scene=document.querySelector('.scene');
  document.getElementById('fullscreen').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else if(scene.requestFullscreen)await scene.requestFullscreen();}
    catch{document.getElementById('status').textContent='A tela cheia não está disponível neste navegador.';}
  });
  if(!scene.requestFullscreen)document.getElementById('fullscreen').hidden=true;
  document.addEventListener('fullscreenchange',()=>document.getElementById('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Sair da tela cheia':'Abrir cena em tela cheia'));
  document.addEventListener('visibilitychange',()=>{lastTime=null;if(document.hidden&&raf!==null){cancelAnimationFrame(raf);raf=null;}else schedule();});
  motion.addEventListener('change',event=>setPlaying(!event.matches));
  Object.defineProperty(window,'sunsetDiagnostics',{get:()=>({time:elapsed,loopTime:mod(elapsed,LOOP),loopSeconds:LOOP,playing,frames,pendingFrame:raf!==null,nativeWidth:W,nativeHeight:H,staticObjects:objects.length,spriteFrames:sprites.size,staticPixels:W*H+objects.reduce((n,o)=>n+o.image.width*o.image.height,0),goku:walking(mod(elapsed,LOOP))})});
  window.sunsetPreview={seek(seconds){elapsed=seconds;lastTime=null;draw();},pause(){setPlaying(false);}};
  controls();draw();schedule();
})();
