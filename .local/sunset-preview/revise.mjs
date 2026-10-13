import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('./index.html', import.meta.url);
let html = await readFile(file, 'utf8');
function replaceFunction(start, end, replacement) {
  const from = html.indexOf(`    function ${start}(`);
  const to = html.indexOf(`    function ${end}(`, from);
  if (from < 0 || to < 0) throw new Error(`Missing function: ${start}/${end}`);
  html = html.slice(0, from) + replacement + '\n' + html.slice(to);
}
replaceFunction('house', 'tree', `    function house() {
      // Anime reference: white capsule dome, blue horizontal glass, red 福,
      // wooden wings, and the short ventilation tower. Sculpted from code.
      const annex=[];
      function wing(x,y,w,d,h) {
        block(annex,x,y,.57,w,d,.18,'#8f795d');
        block(annex,x,y,.75,w,d,h,'#e5d7b7');
        for(let a=0;a<w;a+=.26) {
          block(annex,x+a,y+d-.09,.86,.075,.10,h-.11,'#897455');
          block(annex,x+a,y+d-.095,.78+h,.075,.10,.13,'#78644f');
        }
        for(let a=0;a<d;a+=.27)block(annex,x+w-.1,y+a,.86,.10,.075,h-.11,'#897455');
        block(annex,x-.12,y-.12,.75+h,w+.24,d+.24,.14,'#746e55');
        for(let level=0;level<7;level++) {
          const inset=level*.145;
          for(let a=0;a<w+.30;a+=.35)for(let b=0;b<d+.30-inset*2;b+=.33)
            block(annex,x-.15+a,y-.15+inset+b,.88+h+level*.17,Math.min(.35,w+.3-a),Math.min(.33,d+.3-inset*2-b),.17,random(a*45+b*68+level)>.5?'#788b77':'#8c9c80',true);
        }
        block(annex,x+.29,y+.24,h+1.50,.37,.39,.52,'#c5cfbb');
        block(annex,x+.25,y+.20,h+2.02,.45,.47,.09,'#e4dbc0');
        block(annex,x+.33,y+.26,h+2.11,.055,.055,.22,'#98b0a9');
        block(annex,x+.49,y+.43,h+2.11,.055,.055,.22,'#98b0a9');
      }
      wing(-3.72,-2.60,2.15,2.2,1.95);
      wing(.92,-3.00,2.90,2.15,1.70);
      blocks(annex);
      drawFace(-3.36,-.394,1.35,.85,.94,'#6b6554');
      drawFace(-3.28,-.39,1.43,.69,.77,'#6094a3');
      drawFace(-2.96,-.384,1.43,.055,.77,'#586b64');
      drawFace(-3.28,-.384,1.80,.69,.055,'#586b64');
      drawFace(3.826,-2.62,.8,1.42,1.68,'#87735a','x');
      for(let y=-2.54;y<-1.2;y+=.21)drawFace(3.832,y,.87,.033,1.52,'#c0a279','x');
      drawFace(3.84,-2.60,1.25,1.4,.055,'#74634f','x');
      drawFace(3.84,-2.60,2.04,1.4,.055,'#74634f','x');
      const dome=[],cx=-.48,cy=-.55,r=2.17,step=.22;
      // Each voxel column has a continuous height, avoiding floating roof pieces.
      for(let x=-r;x<r;x+=step)for(let y=-r;y<r;y+=step) {
        const dist=((x+step/2)/r)**2+((y+step/2)/r)**2;
        if(dist>1)continue;
        const h=.90+Math.floor(2.70*Math.sqrt(1-dist)/.16)*.16;
        const light=(x-y)/r;
        block(dome,cx+x,cy+y,.75,step,step,h,light<-.7?'#b9d1d0':light>.7?'#f4ebd1':'#e2e5d1');
      }
      blocks(dome);
      // Broad blue panoramic window and a white stepped entrance arch.
      drawFace(-1.84,1.235,1.76,1.48,.60,'#455e77');
      drawFace(-1.76,1.244,1.84,1.32,.43,'#5b99b3');
      drawFace(-1.71,1.251,1.86,.29,.37,'#7eb6c4');
      drawFace(-1.31,1.251,1.86,.05,.37,'#aac9ce');
      drawFace(-.83,1.251,1.86,.045,.37,'#aac9ce');
      cube(-1.88,1.22,1.70,1.56,.13,.08,'#eff0db');
      const entry=[];
      block(entry,.16,1.06,.60,1.06,.77,.20,'#b9b89b');
      block(entry,.23,1.13,.8,.91,.48,1.60,'#b2cfce');
      block(entry,.33,1.21,2.40,.71,.40,.19,'#d8e5d8');
      block(entry,.44,1.23,2.59,.49,.35,.16,'#eef0dc');
      blocks(entry);
      drawFace(.38,1.62,.83,.61,1.48,'#856b49');
      drawFace(.45,1.629,.86,.47,1.42,'#b89b60');
      for(let x=.48;x<.90;x+=.145)drawFace(x,1.638,.87,.018,1.34,'#7d704d');
      drawFace(.41,1.64,1.48,.55,.055,'#78674e');
      drawFace(.84,1.65,1.46,.06,.08,'#ede5ba');
      // Painted lucky symbols in stepped red diamond borders.
      function luck(x,y,z,side) {
        const points=side==='y'?[project(x,y,z),project(x+.44,y,z+.44),project(x+.88,y,z),project(x+.44,y,z-.44)]:[project(x,y,z),project(x,y+.44,z+.44),project(x,y+.88,z),project(x,y+.44,z-.44)];
        ctxWorld.strokeStyle='#b95643';ctxWorld.lineWidth=2.4;ctxWorld.beginPath();ctxWorld.moveTo(...points[0]);for(let i=1;i<4;i++)ctxWorld.lineTo(...points[i]);ctxWorld.closePath();ctxWorld.stroke();
        surfaceText('福',side==='y'?x+.44:x,side==='y'?y:y+.44,z-.13,27,'#b34d3d',side);
      }
      luck(-1.48,.97,3.02,'y');luck(1.36,-.96,2.91,'x');
      cube(-.81,-.90,4.24,.64,.65,.25,'#779fa9');
      cube(-.85,-.94,4.49,.72,.73,.34,'#dbe4d5');
      cube(-.89,-.98,4.83,.80,.81,.10,'#ece7d2');
      for(let x=-.77;x<-.20;x+=.13)drawFace(x,-.202,4.56,.045,.18,'#668b9a');
      // Iconic red letterbox at the end of the garden path.
      cube(-2.43,2.21,.54,.12,.12,.83,'#8f724a');
      cube(-2.65,2.10,1.37,.53,.32,.27,'#bf5b47');
      cube(-2.59,2.13,1.64,.41,.26,.075,'#d27551');
      drawFace(-2.53,2.425,1.48,.28,.035,'#7d4138');
      drawFace(-2.43,2.43,1.33,.12,.11,'#e1bca1');
    }
`);
replaceFunction('goku','steam',`    // Characters are drawn as articulated block illustrations. A single connected
    // hair silhouette prevents the exposed scalp of the first voxel prototype.
    function brick(x,y,w,h,color,depth=5) {
      const c=ctxWorld;
      polygon([[x,y],[x+depth,y-depth*.46],[x+w+depth,y-depth*.46],[x+w,y]],tint(color,.14));
      polygon([[x+w,y],[x+w+depth,y-depth*.46],[x+w+depth,y+h-depth*.46],[x+w,y+h]],tint(color,-.24));
      c.fillStyle=color;c.fillRect(x,y,w,h);
    }
    function outlined(points,color,line='#3c3437',size=1.35) {
      polygon(points,color);ctxWorld.strokeStyle=line;ctxWorld.lineWidth=size;ctxWorld.lineJoin='miter';ctxWorld.stroke();
    }
    function segment(a,b,w,color) {
      const c=ctxWorld,angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
      c.save();c.translate(a[0],a[1]);c.rotate(angle-Math.PI/2);brick(-w/2,0,w,Math.hypot(b[0]-a[0],b[1]-a[1]),color,3);c.restore();
    }
    function walkState(t) {
      const local=mod(t,24),right=local<12;
      const legTime=right?local:local-12;
      const moving=legTime<10;
      const u=Math.min(legTime/10,1);
      const distance=u*u*(3-2*u);
      const x=right?-2.05+3.15*distance:1.10-3.15*distance;
      const turn=moving?(right?1:-1):(right?Math.cos((legTime-10)*Math.PI/2):-Math.cos((legTime-10)*Math.PI/2));
      const gait=distance*10;
      const intensity=moving?Math.min(1,legTime*3,(10-legTime)*3):0;
      return {x,y:3.64,moving,turn,gait,intensity};
    }
    function goku(t) {
      const state=walkState(t),p=project(state.x,state.y,.60),c=ctxWorld;
      const gait=state.gait*TAU,swing=Math.sin(gait)*state.intensity;
      shadow(state.x-.48,state.y-.22,.56,1.13,.61,.13);
      c.save();c.translate(p[0],p[1]);c.scale(state.turn,.96);
      const bob=-Math.abs(Math.sin(gait))*1.8*state.intensity;
      c.translate(0,bob);
      const orange='#f08035',darkOrange='#cf6030',blue='#284d86',skin='#f5bb83';
      function leg(offset,phase,far) {
        const u=mod(state.gait+phase,1);
        const footX=offset+((u<.60?8-u/.6*16:-8+16*(.5-.5*Math.cos((u-.6)/.4*Math.PI))))*state.intensity;
        const footY=-Math.sin(Math.max(0,(u-.6)/.4)*Math.PI)*9*state.intensity;
        const hip=[offset,-51],knee=[offset+(footX-offset)*.42+Math.max(0,-footY)*.38,-27+footY*.3],ankle=[footX,footY-7];
        segment(hip,knee,17,far?darkOrange:orange);segment(knee,ankle,15,far?darkOrange:orange);
        brick(footX-7,footY-14,15,14,blue,4);brick(footX-7,footY-3,23,6,blue,4);
        brick(footX-6,footY-12,13,2,'#c96153',2);brick(footX+2,footY-11,2,9,'#d89a65',1);
      }
      leg(-10,.5,true);
      const shoulderFar=[-18,-91],elbowFar=[-26-swing*9,-70],handFar=[-25-swing*13,-48];
      segment(shoulderFar,elbowFar,15,'#d99a6c');segment(elbowFar,handFar,12,'#d99a6c');
      brick(handFar[0]-7,handFar[1]-8,14,8,blue,3);brick(handFar[0]-6,handFar[1],12,12,'#e6aa79',3);
      leg(10,0,false);
      // Broad gi shoulders, blue undershirt, neckline, sash and fabric folds.
      outlined([[-23,-99],[21,-99],[27,-85],[19,-55],[-18,-55],[-27,-85]],orange);
      polygon([[-17,-100],[15,-100],[4,-77]],blue);
      polygon([[-7,-103],[9,-103],[9,-91],[2,-85],[-7,-92]],skin);
      polygon([[-20,-98],[-9,-93],[0,-75],[-9,-79]],'#ffad55');
      polygon([[17,-97],[7,-89],[1,-76],[12,-82]],darkOrange);
      brick(-20,-58,40,9,blue,3);
      polygon([[9,-51],[18,-49],[21,-29],[14,-32]],blue);
      polygon([[-16,-72],[-13,-60],[-8,-61]],darkOrange);
      polygon([[13,-72],[8,-60],[14,-60]],darkOrange);
      const badge=[[-17,-84],[-13,-89],[-5,-89],[-1,-85],[-1,-78],[-5,-74],[-13,-74],[-17,-78]];
      outlined(badge,'#f7e9cc','#5b4836',.8);
      c.fillStyle='#3e3735';c.font='bold 11px Arial,sans-serif';c.textAlign='center';c.fillText('悟',-9,-78);
      const shoulder=[20,-90],elbow=[27+swing*8,-69],hand=[24+swing*13,-45];
      segment(shoulder,elbow,18,skin);segment(elbow,hand,14,skin);
      brick(hand[0]-8,hand[1]-8,16,9,blue,3);brick(hand[0]-7,hand[1]+1,14,12,skin,3);
      polygon([[23,-84],[27,-78],[24,-68],[20,-74]],'#d99568');
      // Head: solid black crown, six large connected spikes and long bangs.
      outlined([[-19,-135],[17,-135],[23,-125],[24,-111],[30,-106],[23,-102],[20,-93],[7,-88],[-11,-93],[-20,-106]],skin);
      polygon([[-19,-124],[-11,-123],[-11,-95],[-20,-106]],'#d6986f');
      brick(-25,-116,9,15,skin,3);brick(-23,-113,4,8,'#c78c67',1);
      const hair=[[-25,-113],[-33,-115],[-29,-127],[-48,-128],[-39,-135],[-28,-139],[-48,-147],[-35,-149],[-21,-145],[-30,-165],[-20,-164],[-10,-154],[-5,-175],[3,-166],[10,-153],[20,-165],[26,-154],[27,-144],[42,-151],[39,-139],[49,-133],[35,-128],[32,-116],[24,-117],[19,-127],[13,-117],[8,-127],[0,-120],[-6,-130],[-17,-123],[-21,-111]];
      polygon(hair.map(([x,y])=>[x+4,y-3]),'#30343c');outlined(hair,'#171d27','#171b24',1.0);
      polygon([[-28,-139],[-17,-143],[-9,-139],[-15,-136]],'#34404b');
      polygon([[2,-157],[8,-150],[14,-143],[5,-147]],'#34404b');
      // Profile eyes and brows follow the facing direction when he turns.
      polygon([[4,-113],[13,-116],[15,-112],[6,-109]],'#fff3dc');
      polygon([[18,-112],[23,-113],[24,-109],[19,-107]],'#fff3dc');
      c.fillStyle='#25232b';c.fillRect(10,-114,3,5);c.fillRect(21,-112,2.5,4);
      polygon([[2,-116],[13,-120],[15,-117],[4,-113]],'#25232b');
      polygon([[18,-116],[24,-116],[24,-113],[18,-113]],'#25232b');
      c.strokeStyle='#91593e';c.lineWidth=1.1;c.beginPath();c.moveTo(14,-99);c.lineTo(21,-100);c.lineTo(24,-102);c.stroke();
      c.restore();
    }
    function chichi(t) {
      const x=1.08,y=1.08,p=project(x,y,.58),c=ctxWorld,stir=Math.sin(t*TAU/3);
      shadow(x-.36,y-.13,.54,.91,.60,.12);
      c.save();c.translate(p[0],p[1]);c.scale(.94,.94);
      const purple='#765496',skin='#f2bc8e';
      brick(-17,-11,13,13,'#a74752',4);brick(5,-11,14,13,'#a74752',4);
      outlined([[-18,-81],[18,-81],[22,-51],[27,-13],[-25,-13],[-19,-47]],purple);
      polygon([[-21,-45],[-13,-37],[-13,-15],[-24,-15]],'#5c4380');
      polygon([[10,-45],[16,-39],[23,-15],[16,-15]],'#9b78b6');
      brick(-19,-57,39,7,'#f1c764',4);
      // Orange shoulder scarf and small apron leave the purple qipao readable.
      outlined([[-25,-91],[-13,-101],[10,-101],[25,-92],[22,-82],[8,-85],[-1,-75],[-15,-86],[-25,-82]],'#edb95b','#9c794f',.8);
      polygon([[-3,-83],[11,-83],[16,-28],[-13,-28],[-8,-77]],'#f2e5c7');
      brick(-2,-79,13,9,'#f8eed7',2);
      segment([-20,-85],[-26,-63],12,purple);segment([-26,-63],[-24,-44],10,skin);
      brick(-30,-49,11,6,'#bb6c75',2);brick(-29,-44,10,10,skin,2);
      brick(-6,-108,17,10,skin,3);
      // Full cap, thick bangs, side locks and a prominent bun.
      brick(-13,-144,26,18,'#191d28',7);
      brick(-16,-138,32,12,'#202530',5);
      brick(-14,-127,29,4,'#ba697c',2);
      outlined([[-19,-124],[15,-125],[23,-115],[23,-101],[28,-98],[21,-91],[8,-86],[-8,-90],[-18,-102]],skin);
      const cap=[[-23,-107],[-26,-114],[-23,-127],[-17,-133],[4,-134],[18,-130],[25,-121],[26,-106],[19,-100],[17,-115],[12,-109],[9,-119],[4,-112],[0,-120],[-6,-112],[-11,-119],[-16,-111],[-18,-99],[-23,-101]];
      polygon(cap.map(([x,y])=>[x+4,y-3]),'#30343e');outlined(cap,'#1b202b','#1b202b',1);
      polygon([[-17,-128],[-8,-131],[6,-129],[14,-125],[-1,-126]],'#37414b');
      brick(-21,-104,6,20,'#202530',3);brick(17,-105,5,14,'#202530',3);
      brick(-15,-93,4,5,'#d46568',1);brick(19,-96,4,5,'#d46568',1);
      polygon([[1,-107],[10,-110],[12,-106],[3,-104]],'#fff2dc');
      polygon([[16,-107],[21,-108],[22,-104],[17,-103]],'#fff2dc');
      c.fillStyle='#24252e';c.fillRect(7,-109,3,5);c.fillRect(19,-107,2,4);
      polygon([[0,-111],[10,-114],[11,-111],[1,-108]],'#24252e');
      c.strokeStyle='#aa6465';c.lineWidth=1;c.beginPath();c.moveTo(10,-94);c.lineTo(17,-95);c.stroke();
      const hand=[35+stir*3,-54+Math.cos(t*TAU/3)*2];
      segment([19,-84],[27,-65],13,purple);segment([27,-65],hand,10,skin);
      brick(hand[0]-5,hand[1]-4,11,6,'#ba6679',2);brick(hand[0]-4,hand[1]+2,9,9,skin,2);
      c.strokeStyle='#895e3d';c.lineWidth=3;c.beginPath();c.moveTo(hand[0]+3,hand[1]-12);c.lineTo(hand[0]+1,hand[1]+24);c.stroke();
      c.fillStyle='#bd9361';c.fillRect(hand[0]-2,hand[1]+20,7,6);
      c.restore();
    }
`);
// Better framing for taller, clearly readable characters.
html=html.replace("objects.push({depth:2.3+1.64*Math.sin(t*TAU/24),draw:()=>goku(t)});", "objects.push({depth:walkState(t).x+walkState(t).y+.65,draw:()=>goku(t)});");
html=html.replace("objects.push({depth:2.45,draw:()=>chichi(t)});", "objects.push({depth:2.90,draw:()=>chichi(t)});");
html=html.replace("buildSprite(house,-.78);", "buildSprite(house,.35);");
html=html.replace("'#789458':'#86a063'", "'#52885b':'#629767'");
html=html.replace("'#aac374':'#99b16b'", "'#81af70':'#73a669'");
html=html.replace("bank?(n>.5?'#d9b77d':'#e9ca8e')", "bank?(n>.5?'#aaa27e':'#b7ac86')");
// Replace anonymous low hills with Paozu's distinctive high, wooded karst towers.
const marker='      // The water fills the horizon, without constraining the island in a box.';
html=html.replace(marker,`      // Tall, flat-topped limestone towers, inspired by Mount Paozu's silhouette.
      const peaks=[[.04,.78,1],[.16,1.28,.75],[.27,.98,.55],[.80,1.24,.85],[.92,.95,.7]];
      for(let i=0;i<peaks.length;i++) {
        const [fx,high,wide]=peaks[i],x=fx*width,w=wide*75*scale,h=high*190*scale,base=horizon+16*scale;
        const pts=[[x-w,base],[x-w,base-h*.35],[x-w*.73,base-h*.35],[x-w*.73,base-h*.73],[x-w*.42,base-h*.73],[x-w*.42,base-h],[x+w*.27,base-h],[x+w*.27,base-h*.83],[x+w*.64,base-h*.83],[x+w*.64,base-h*.40],[x+w,base-h*.40],[x+w,base]];
        polygon(pts,i%2?'#80978b':'#91a298',ctx);
        polygon([[x-w*.42,base-h],[x+w*.27,base-h],[x+w*.27,base-h*.89],[x-w*.42,base-h*.89]],'#a8b59b',ctx);
        ctx.fillStyle='#bcb39b35';ctx.fillRect(x-w*.34,base-h*.78,w*.19,h*.68);
      }
${marker}`);
// Sparse bamboo stands instead of a generic suburban garden.
html=html.replace('      blocks(plants);',`      blocks(plants);
      for(const [x,y,h] of [[-4.12,-2.0,2.4],[-3.89,-2.4,2.85],[3.54,-2.5,2.55],[3.87,-2.42,2.15]]) {
        for(let z=.53;z<h;z+=.44){cube(x,y,z,.085,.085,.42,'#668d63');cube(x-.018,y-.018,z+.36,.12,.12,.045,'#a7b877');}
        for(let z=1.1;z<h;z+=.52){cube(x-.28,y,z,.3,.08,.055,'#648d65');cube(x,y-.04,z+.10,.30,.09,.055,'#87a76b');}
      }`);
// Fix cooked food visibility: foreground objects remain ahead of the chef.
html=html.replace("ctxWorld.globalAlpha=Math.sin(p*Math.PI)*.44", "ctxWorld.globalAlpha=Math.sin(p*Math.PI)*.50");
await writeFile(file,html);
console.log('Casa, personagens e caminhada redesenhados.');
