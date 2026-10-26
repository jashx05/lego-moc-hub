/* LEGO MOC Hub: self-contained, request-free WebGL2 renderer for common LDraw bricks.
   Geometry is generated in LDU with the LDraw datum on the UNDERSIDE of each part:
   body from 0 to +height, studs from -4 to 0.
   No AI, network requests, external JS, mesh approximation of unknown parts or frame polling.
*/
(function(){
'use strict';
const CATALOG={
 '3001':[4,2,24],'3002':[3,2,24],'3003':[2,2,24],'3004':[2,1,24],'3005':[1,1,24],
 '3008':[8,1,24],'3009':[6,1,24],'3010':[4,1,24],'6111':[10,1,24],
 '3020':[4,2,8],'3021':[3,2,8],'3022':[2,2,8],'3023':[2,1,8],'3024':[1,1,8],
 '3034':[8,2,8],'3035':[8,4,8],'3036':[8,6,8],'3460':[8,1,8],
 '3710':[4,1,8],'3666':[6,1,8],'3795':[6,2,8],
 '3068b':[2,2,8],'3069b':[2,1,8],'3070b':[1,1,8],
 '4073':[1,1,8],'3062':[1,1,24],'3062b':[1,1,24]
};
const ROUND=new Set(['3062','3062b','4073']);
const memo=new Map();let active=null;
function parseHex(hex){let h=hex.replace('#','');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]}
function getId(s){return s.replace(/.*[\\/]/,'').toLowerCase().replace(/\.dat$/,'')}
function findUnsupported(parts){return [...new Set(parts.map(p=>getId(p.id)).filter(id=>!CATALOG[id]))]}
function makeModel(parts,colorFn){
 const unsupported=findUnsupported(parts);if(unsupported.length)throw new Error('Catalogo locale non disponibile per: '+unsupported.slice(0,12).join(', ')+(unsupported.length>12?' …':'')+'. Per forme speciali usa Studio o il renderer LDraw ufficiale.');
 const buffer=[],partEnds=[],bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 let triCount=0;
 for(let i=0;i<parts.length;i++){
   const p=parts[i],id=getId(p.id),[nx,nz,h]=CATALOG[id];
   const r=p.rotation, col=parseHex(colorFn(p.color)[1]||'#b5b9c4');
   function pt(a,b,c){const x=p.x+r[0]*a+r[1]*b+r[2]*c,y=-(p.y+r[3]*a+r[4]*b+r[5]*c),z=p.z+r[6]*a+r[7]*b+r[8]*c;
     bounds.min[0]=Math.min(bounds.min[0],x);bounds.min[1]=Math.min(bounds.min[1],y);bounds.min[2]=Math.min(bounds.min[2],z);
     bounds.max[0]=Math.max(bounds.max[0],x);bounds.max[1]=Math.max(bounds.max[1],y);bounds.max[2]=Math.max(bounds.max[2],z);return [x,y,z]}
   function tri(a,b,c,sh){const rgb=col.map(n=>Math.max(0,Math.min(1,n*sh)));for(const v of [a,b,c])buffer.push(...v,...rgb,i);triCount++}
   function quad(a,b,c,d,sh){tri(a,b,c,sh);tri(a,c,d,sh)}
   function box(x0,y0,z0,x1,y1,z1){const p000=pt(x0,y0,z0),p100=pt(x1,y0,z0),p010=pt(x0,y1,z0),p110=pt(x1,y1,z0),p001=pt(x0,y0,z1),p101=pt(x1,y0,z1),p011=pt(x0,y1,z1),p111=pt(x1,y1,z1);
     quad(p000,p100,p101,p001,.93);quad(p010,p011,p111,p110,1.02);
     quad(p000,p010,p110,p100,.66);quad(p001,p101,p111,p011,.80);
     quad(p000,p001,p011,p010,.78);quad(p100,p110,p111,p101,.86);
   }
   function cylinder(cx,cz,rad,top,bottom,segments=16,shade=1){
      const topcenter=pt(cx,top,cz),botcenter=pt(cx,bottom,cz),rimT=[],rimB=[];
      for(let k=0;k<segments;k++){const a=k/segments*2*Math.PI;rimT.push(pt(cx+Math.cos(a)*rad,top,cz+Math.sin(a)*rad));rimB.push(pt(cx+Math.cos(a)*rad,bottom,cz+Math.sin(a)*rad))}
      for(let k=0;k<segments;k++){let k2=(k+1)%segments,lit=shade*(.75+.17*Math.sin((k+.5)*2*Math.PI/segments));tri(topcenter,rimT[k],rimT[k2],shade);quad(rimT[k],rimB[k],rimB[k2],rimT[k2],lit);tri(botcenter,rimB[k2],rimB[k],shade*.75)}
   }
   if(ROUND.has(id)){
      const height=id==='4073'?8:h;
      cylinder(0,0,10,0,height,24,.96);
      // 4073 (round plate 1x1) and 3062 (round brick 1x1) have a regular top stud.
      cylinder(0,0,6,-4,0,18,1.0);
   }else{
      const w=nx*20,d=nz*20;
      box(-w/2,0,-d/2,w/2,h,d/2);
      for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
         const cx=-w/2+10+20*ix,cz=-d/2+10+20*iz;
         cylinder(cx,cz,6,-4,0,12,1);
      }
   }
   partEnds.push(buffer.length/7);
 }
 return {v:new Float32Array(buffer),partEnds,bounds,triangleCount:triCount,unsupported:[]};
}
function compileShader(gl,type,code){let s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function createContext(canvas){let gl=canvas.getContext('webgl2',{alpha:false,antialias:true,depth:true,preserveDrawingBuffer:true,desynchronized:true});if(!gl)throw Error('WebGL2 non disponibile in questo browser.');
const vsrc=`#version 300 es
 precision highp float;
 layout(location=0) in vec3 aPosition;
 layout(location=1) in vec3 aColor;
 layout(location=2) in float aPartIndex;
 uniform vec3 uCenter;
 uniform vec2 uAngles;
 uniform vec2 uResolution;
 uniform float uFit;
 uniform float uVisible;
 uniform float uHighlightStart;
 uniform float uHighlight;
 out vec3 vColor;
 void main(){
    vec3 p=aPosition-uCenter;
    float cy=cos(uAngles.x),sy=sin(uAngles.x),cp=cos(uAngles.y),sp=sin(uAngles.y);
    vec3 t=vec3(p.x*cy-p.z*sy,p.y,p.x*sy+p.z*cy);
    vec3 a=vec3(t.x,t.y*cp-t.z*sp,t.y*sp+t.z*cp);
    float aspect=uResolution.x/max(1.0,uResolution.y);
    gl_Position=vec4(a.x*uFit/aspect,a.y*uFit,-a.z*uFit/3.0,1.0);
    vec3 base=aColor;
    if(uHighlight>0.5)base=aPartIndex+0.1>=uHighlightStart?vec3(.98,.74,.16):vec3(.48,.54,.63);
    vColor=base;
 }`;
const fsrc=`#version 300 es
 precision mediump float;
 in vec3 vColor;
 out vec4 fragColor;
 void main(){fragColor=vec4(vColor,1.0);}`;
const prog=gl.createProgram();gl.attachShader(prog,compileShader(gl,gl.VERTEX_SHADER,vsrc));gl.attachShader(prog,compileShader(gl,gl.FRAGMENT_SHADER,fsrc));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);
const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);const stride=7*4;
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);
 gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,3*4);
 gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,stride,6*4);
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
const uni={};for(let key of ['uCenter','uAngles','uResolution','uFit','uVisible','uHighlightStart','uHighlight'])uni[key]=gl.getUniformLocation(prog,key);
return {gl,prog,buf,uni,dispose(){gl.deleteBuffer(buf);gl.deleteProgram(prog)}};
}
function cpuView(parts,mount,colorFn,{visibleCount=parts.length,highlightStart=-1,mode='model'}={}){
 mount.innerHTML='<canvas class="fast-ldraw-canvas" aria-label="'+(mode==='paper'?'Illustrazione bidimensionale del passaggio':'Modello tridimensionale LEGO')+'" style="display:block;touch-action:none;width:100%;height:100%;min-height:310px"></canvas>'+(mode==='paper'?'':'<div class="caption">Clicca un mattoncino: contorno azzurro · Trascina per ruotare · Rotella per zoom</div>');
 if(mode==='model'){
   const pill=document.createElement('div');pill.className='brick-selection';pill.hidden=true;pill.setAttribute('role','status');pill.setAttribute('aria-live','polite');
   pill.style.cssText='position:absolute;right:12px;top:12px;background:#09253fe8;border:2px solid #00baff;color:#e9faff;border-radius:9px;padding:9px 12px;font-size:12px;pointer-events:none;box-shadow:0 4px 18px #10243c50';
   mount.appendChild(pill);
 }
 const canvas=mount.querySelector('canvas'),ctx=canvas.getContext('2d');
 const state={yaw:mode==='paper'?-.68:-.75,pitch:mode==='paper'?.69:.48,zoom:1,panX:0,panY:0,drag:false,lastX:0,lastY:0,selected:-1,moved:false,downX:0,downY:0};let disposed=false,pending=false,draws=0,lastDrawMs=0,pickBuffer=null,pickWidth=0,pickHeight=0,selectionStats={};
 const pts=[];const colors=[];
 // Cache exact LDraw-world coordinates for primitive bodies and stud caps.
 for(let ii=0;ii<parts.length;ii++){
    const p=parts[ii],id=getId(p.id),[nx,nz,h]=CATALOG[id],r=p.rotation,local=[];
    function pt(a,b,c){return [p.x+r[0]*a+r[1]*b+r[2]*c,-(p.y+r[3]*a+r[4]*b+r[5]*c),p.z+r[6]*a+r[7]*b+r[8]*c]}
    const base=colorFn(p.color)[1]||'#b4b9c4';
    if(ROUND.has(id)){
       let radius=10,top=[],bot=[];
       for(let j=0;j<18;j++){let a=j*Math.PI/9;top.push(pt(Math.cos(a)*radius,0,Math.sin(a)*radius));bot.push(pt(Math.cos(a)*radius,h,Math.sin(a)*radius))}
       local.push({v:top,sh:1.10,edge:true});for(let j=0;j<18;j++){let k=(j+1)%18;local.push({v:[top[j],bot[j],bot[k],top[k]],sh:.73+.16*Math.cos(j*Math.PI/9)})}
       let stud=[];for(let j=0;j<14;j++){let a=j*Math.PI*2/14;stud.push(pt(Math.cos(a)*6,-4,Math.sin(a)*6))}local.push({v:stud,sh:1.16,edge:true});
    }else{
       const w=nx*20,d=nz*20;
       let v=[];for(let k=0;k<8;k++)v.push(pt((k&1)?w/2:-w/2,(k&2)?h:0,(k&4)?d/2:-d/2));
       [[0,1,5,4,.93],[2,6,7,3,1.04],[0,2,3,1,.80],[4,5,7,6,.68],[0,4,6,2,.74],[1,3,7,5,.88]].forEach(t=>local.push({v:t.slice(0,4).map(j=>v[j]),sh:t[4],edge:true}));
       for(let x=0;x<nx;x++)for(let z=0;z<nz;z++){const cx=-w/2+10+20*x,cz=-d/2+10+20*z;let top=[],bottom=[];
         for(let j=0;j<12;j++){const a=j*Math.PI/6;top.push(pt(cx+6*Math.cos(a),-4,cz+6*Math.sin(a)));bottom.push(pt(cx+6*Math.cos(a),0,cz+6*Math.sin(a)))}
         local.push({v:top,sh:1.16,edge:true});
         for(let j=0;j<12;j++){let k=(j+1)%12;local.push({v:[top[j],bottom[j],bottom[k],top[k]],sh:.73+.22*Math.cos(j*Math.PI/6-.7),studSide:true})}
       }
    }
    local.forEach(v=>pts.push({...v,base,partIndex:ii}));
 }
 const verts=pts.flatMap(x=>x.v),bbox={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(const v of verts)for(let j=0;j<3;j++){bbox.min[j]=Math.min(bbox.min[j],v[j]);bbox.max[j]=Math.max(bbox.max[j],v[j])}
 function hex(h,s){const n=parseInt(h.slice(1),16);return 'rgb('+[n>>16&255,n>>8&255,n&255].map(x=>Math.round(Math.max(0,Math.min(255,x*s)))).join(',')+')'}
 function proj(v){const q=v.map((x,i)=>x-(bbox.min[i]+bbox.max[i])/2);const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw),cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
    const x=q[0]*cy-q[2]*sy,z=q[0]*sy+q[2]*cy;return [x,q[1]*cp-z*sp,q[1]*sp+z*cp]}
 function draw(){pending=false;if(disposed||!mount.isConnected)return;
    const start=performance.now(),W=Math.max(180,canvas.clientWidth),H=Math.max(180,canvas.clientHeight);
    const pr=mode==='paper' ? (parts.length>900?1.5:2) : (parts.length>700 ? (state.drag?1:1.35) : parts.length>350 ? (state.drag?1.1:1.5) : (state.drag?1.25:Math.min(2,Math.max(1.75,devicePixelRatio||1))));
    const rw=Math.round(W*pr),rh=Math.round(H*pr);
    if(canvas.width!==rw||canvas.height!==rh){canvas.width=rw;canvas.height=rh;}
    ctx.setTransform(pr,0,0,pr,0,0);ctx.fillStyle=mode==='paper'?'#d6ecfb':'#e4ecf6';ctx.fillRect(0,0,W,H);
    // Avoid enormous spread() arrays, both faster and safe for thousands of parts.
    const arr=[];let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
    for(let k=0;k<pts.length;k++){
      const q=pts[k];if(q.partIndex>=visibleCount)continue;
      let totalDepth=0;const v=[];
      for(let j=0;j<q.v.length;j++){
        const vj=proj(q.v[j]);v.push(vj);totalDepth+=vj[2];
        if(vj[0]<minx)minx=vj[0];if(vj[0]>maxx)maxx=vj[0];
        if(vj[1]<miny)miny=vj[1];if(vj[1]>maxy)maxy=vj[1];
      }
      arr.push({v,sh:q.sh,base:q.base,partIndex:q.partIndex,hi:highlightStart>=0&&q.partIndex>=highlightStart,edge:q.edge||false,depth:totalDepth/v.length});
    }
    if(!arr.length){draws++;return}
    const scale=Math.min((W-35)/Math.max(1,maxx-minx),(H-35)/Math.max(1,maxy-miny))*state.zoom,ox=W/2-(minx+maxx)/2*scale+state.panX,oy=H/2+(miny+maxy)/2*scale+state.panY;
    // True pixel-wise Z-buffer: prevents the painter algorithm from hiding columns
    // behind the floor or showing studs through walls. No Canvas/WebGL global sorting.
    const image=ctx.createImageData(rw,rh),pixels=image.data,depth=new Float32Array(rw*rh),hitIds=mode==='model'?new Uint32Array(rw*rh):null;
    depth.fill(-Infinity);
    for(let i=0;i<pixels.length;i+=4){pixels[i]=mode==='paper'?214:228;pixels[i+1]=mode==='paper'?236:236;pixels[i+2]=mode==='paper'?250:246;pixels[i+3]=255;}
    const xscale=pr,yscale=pr;
    function drawTri(a,b,c,rgb,partIndex){
       const ax=(ox+a[0]*scale)*xscale,ay=(oy-a[1]*scale)*yscale;
       const bx=(ox+b[0]*scale)*xscale,by=(oy-b[1]*scale)*yscale;
       const cx=(ox+c[0]*scale)*xscale,cy=(oy-c[1]*scale)*yscale;
       const xmin=Math.max(0,Math.floor(Math.min(ax,bx,cx)));
       const xmax=Math.min(rw-1,Math.ceil(Math.max(ax,bx,cx)));
       const ymin=Math.max(0,Math.floor(Math.min(ay,by,cy)));
       const ymax=Math.min(rh-1,Math.ceil(Math.max(ay,by,cy)));
       if(xmin>xmax||ymin>ymax)return;
       const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
       if(Math.abs(den)<.000001)return;
       const inv=1/den;
       for(let yy=ymin;yy<=ymax;yy++){
         const py=yy+.5,row=yy*rw;
         for(let xx=xmin;xx<=xmax;xx++){
           const px=xx+.5;
           const wa=((by-cy)*(px-cx)+(cx-bx)*(py-cy))*inv;
           if(wa<-.0001)continue;
           const wb=((cy-ay)*(px-cx)+(ax-cx)*(py-cy))*inv;
           if(wb<-.0001||wa+wb>1.0001)continue;
           const wc=1-wa-wb,z=wa*a[2]+wb*b[2]+wc*c[2],idx=row+xx;
           if(z>depth[idx]+.0001){depth[idx]=z;const k=idx*4;pixels[k]=rgb[0];pixels[k+1]=rgb[1];pixels[k+2]=rgb[2];if(hitIds)hitIds[idx]=partIndex+1;}
         }
       }
    }
    const outlines=[];
    for(const q of arr){
      const n=parseInt(q.base.slice(1),16),mul=q.sh;
      const rgb=[n>>16&255,n>>8&255,n&255].map(c=>Math.round(Math.max(0,Math.min(255,c*(mul*.95+.12)))));
      if(mode==='paper'&&q.hi){rgb[0]=Math.min(255,rgb[0]*1.02+5);rgb[1]=Math.min(255,rgb[1]*1.02+5);rgb[2]=Math.min(255,rgb[2]*1.02+5)}
      if(q.edge)outlines.push(q);
      for(let i=1;i<q.v.length-1;i++)drawTri(q.v[0],q.v[i],q.v[i+1],rgb,q.partIndex);
    }
    ctx.putImageData(image,0,0);
    // Crisp brick boundaries and circular stud rims: draw only screen-visible edges.
    // The z-buffer still resolves occlusion for every sampled edge pixel.
    function lineOnTop(a,b,highlight,selected){
      const ax=(ox+a[0]*scale)*pr,ay=(oy-a[1]*scale)*pr,bx=(ox+b[0]*scale)*pr,by=(oy-b[1]*scale)*pr;
      const len=Math.hypot(bx-ax,by-ay),segments=Math.max(1,Math.ceil(len*1.15));
      for(let j=0;j<=segments;j++){let t=j/segments,x=Math.round(ax+(bx-ax)*t),y=Math.round(ay+(by-ay)*t);if(x<1||x>=rw-1||y<1||y>=rh-1)continue;const idx=y*rw+x,z=a[2]+(b[2]-a[2])*t;if(z+Math.max(.12,1.4/scale)>=depth[idx]){const width=selected?Math.max(2,Math.ceil(pr*1.1)):(pr>=1.8?1:0);
             for(let oy=-width;oy<=width;oy++)for(let ox=-width;ox<=width;ox++){
                const px=x+ox,py=y+oy;if(px<0||px>=rw||py<0||py>=rh)continue;
                const pi=py*rw+px,zz=depth[pi];if(z+Math.max(.12,1.8/scale)<zz)continue;
                let k=4*pi;
                if(selected&&mode==='model'){pixels[k]=0;pixels[k+1]=186;pixels[k+2]=255;}
                else if(highlight&&mode==='paper'){pixels[k]=11;pixels[k+1]=151;pixels[k+2]=213;}
                else{const dark=(ox||oy)?.61:(mode==='paper'?.40:.39);pixels[k]=Math.round(pixels[k]*dark);pixels[k+1]=Math.round(pixels[k+1]*dark);pixels[k+2]=Math.round(pixels[k+2]*dark);}
             }}}
    }
    // General seam and stud outlines. Selection is handled *per visible pixel* below,
    // not by the subset of primitive edges tagged as outline edges: the latter missed
    // cylindrical brick bodies, highlighting just the top stud.
    for(const q of outlines){for(let i=0;i<q.v.length;i++)lineOnTop(q.v[i],q.v[(i+1)%q.v.length],q.hi,false);}
    // The picking buffer is also an exact visible-part mask from the z-buffer.
    // Trace the silhouette of ALL visible surfaces belonging to the selected part,
    // whether plate, cylinder, body, stud or a rotated brick. Occluded surfaces
    // deliberately remain hidden. This avoids hard-coded primitive top-edge logic.
    let selectedContourPixels=0,selectedVisiblePixels=0,selectedBounds=null;
    if(mode==='model'&&hitIds&&state.selected>=0){
      const key=state.selected+1;
      let minSelX=rw,minSelY=rh,maxSelX=-1,maxSelY=-1;
      for(let yy=0;yy<rh;yy++)for(let xx=0;xx<rw;xx++){
        const idx=yy*rw+xx;if(hitIds[idx]!==key)continue;
        selectedVisiblePixels++;
        if(xx<minSelX)minSelX=xx;if(xx>maxSelX)maxSelX=xx;
        if(yy<minSelY)minSelY=yy;if(yy>maxSelY)maxSelY=yy;
        // A part boundary includes contact with another part, not just background.
        const boundary=xx===0||xx===rw-1||yy===0||yy===rh-1||
          hitIds[idx-1]!==key||hitIds[idx+1]!==key||
          hitIds[idx-rw]!==key||hitIds[idx+rw]!==key;
        if(!boundary)continue;
        const radius=Math.max(1,Math.round(pr*1.2));
        for(let oy=-radius;oy<=radius;oy++)for(let ox=-radius;ox<=radius;ox++){
          if(ox*ox+oy*oy>radius*radius+1)continue;
          const sx=xx+ox,sy=yy+oy;if(sx<0||sy<0||sx>=rw||sy>=rh)continue;
          const k=(sy*rw+sx)*4;
          pixels[k]=0;pixels[k+1]=188;pixels[k+2]=255;pixels[k+3]=255;
          selectedContourPixels++;
        }
      }
      if(selectedVisiblePixels)selectedBounds={minX:minSelX,maxX:maxSelX,minY:minSelY,maxY:maxSelY};
    }
    ctx.putImageData(image,0,0);
    if(hitIds){pickBuffer=hitIds;pickWidth=rw;pickHeight=rh;selectionStats={selectedVisiblePixels,selectedContourPixels,selectedBounds};}
    draws++;lastDrawMs=+(performance.now()-start).toFixed(1);
 }
 function request(){if(!pending){pending=true;requestAnimationFrame(draw)}}
 function down(e){state.drag=true;state.moved=false;state.downX=e.clientX;state.downY=e.clientY;state.lastX=e.clientX;state.lastY=e.clientY;canvas.setPointerCapture(e.pointerId)}
 function move(e){if(!state.drag)return;if(Math.hypot(e.clientX-state.downX,e.clientY-state.downY)>5)state.moved=true;if(mode==='paper'){state.panX+=e.clientX-state.lastX;state.panY+=e.clientY-state.lastY}else{state.yaw+=(e.clientX-state.lastX)*.009;state.pitch=Math.max(-1.25,Math.min(1.25,state.pitch+(e.clientY-state.lastY)*.008))}state.lastX=e.clientX;state.lastY=e.clientY;request()}
 function up(e){
    const wasClick=!state.moved&&Math.hypot(e.clientX-state.downX,e.clientY-state.downY)<=5;
    state.drag=false;
    if(wasClick&&mode==='model'&&pickBuffer){
      const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)*pickWidth/r.width),y=Math.floor((e.clientY-r.top)*pickHeight/r.height);
      const index=(x>=0&&x<pickWidth&&y>=0&&y<pickHeight)?pickBuffer[y*pickWidth+x]-1:-1;
      state.selected=state.selected===index?-1:index;
      const info=mount.querySelector('.brick-selection');
      if(info){if(state.selected>=0){const p=parts[state.selected];info.hidden=false;info.textContent='◈ Pezzo '+(state.selected+1)+' / '+parts.length+' · '+p.id+' · colore '+p.color;}
        else {info.hidden=true;info.textContent='';}}
    }
    request();
  }
 function wheel(e){e.preventDefault();state.zoom=Math.max(.3,Math.min(3,state.zoom*(e.deltaY>0?.9:1.1)));request()}
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});
 const observer=new ResizeObserver(()=>{if(!disposed&&mount.isConnected)request()});observer.observe(mount);
 function dispose(){disposed=true;observer.disconnect()}
 active={dispose,mount,parts,zoom(factor){state.zoom=Math.max(.5,Math.min(4,state.zoom*factor));request()},reset(){state.zoom=1;state.panX=0;state.panY=0;request()},update(count,start){visibleCount=count;highlightStart=start;if(state.selected>=visibleCount)state.selected=-1;if(mode==='paper'){state.zoom=1;state.panX=0;state.panY=0}request()},metrics:()=>({backend:'Canvas2D',parts:Math.min(parts.length,visibleCount),drawCalls:draws,lastDrawMs,polygons:pts.length,selectedPart:state.selected,...selectionStats})};request();return active;
}

function view(parts,mount,colorFn,{visibleCount=parts.length,highlightStart=-1,mode='model'}={}){
 if(active&&active.mount===mount&&active.parts===parts){active.update(visibleCount,highlightStart);return active}
 if(active){active.dispose();active=null}
 if(!parts.length){mount.innerHTML='<div class="loader">Il file non contiene mattoncini validi.</div>';return}
 const codes=findUnsupported(parts);if(codes.length){mount.innerHTML='<div class="loader"><strong>Alcuni pezzi richiedono la libreria LDraw completa</strong><span>'+codes.slice(0,12).map(x=>x.replace(/[<>&"']/g,'')).join(', ')+'</span><span>Il viewer locale non inventa geometrie di pezzi speciali.</span></div>';return}
 // Canvas2D is the stable default. Some drivers create a valid WebGL2 context,
 // but silently produce an empty framebuffer. Until a GPU pixel-test confirms
 // non-empty frames on all supported drivers, prefer the verified CPU renderer.
 // Both full-model view and every STEP share this path.
 if(window.MOCHubRenderer !== 'experimental-webgl'){
   return cpuView(parts,mount,colorFn,{visibleCount,highlightStart,mode});
 }
 mount.innerHTML='<canvas class="fast-ldraw-canvas" aria-label="Vista LEGO 3D WebGL locale" style="display:block;touch-action:none;width:100%;height:100%;min-height:310px"></canvas><div class="caption">WebGL locale · Trascina per ruotare · Rotella zoom · Nessuna chiamata durante la visualizzazione</div>';
 const canvas=mount.querySelector('canvas');const state={yaw:-.75,pitch:.48,zoom:1,drag:false,lastX:0,lastY:0,dirty:true};let ctx;try{ctx=createContext(canvas)}catch(e){return cpuView(parts,mount,colorFn,{visibleCount,highlightStart})}
 // Cache geometry by the imported model array, reuse across all STEP instructions.
 let mesh=memo.get(parts);if(!mesh){mesh=makeModel(parts,colorFn);memo.set(parts,mesh);if(memo.size>5)memo.delete(memo.keys().next().value)}
 ctx.gl.bindBuffer(ctx.gl.ARRAY_BUFFER,ctx.buf);ctx.gl.bufferData(ctx.gl.ARRAY_BUFFER,mesh.v,ctx.gl.STATIC_DRAW);
 const center=mesh.bounds.min.map((x,i)=>(x+mesh.bounds.max[i])/2),size=mesh.bounds.min.map((x,i)=>mesh.bounds.max[i]-x);
 let scheduled=false,drawCalls=0,disposed=false;
 function projectedBounds(){const x=size[0]/2,y=size[1]/2,z=size[2]/2;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const a of [-x,x])for(const b of [-y,y])for(const c of [-z,z]){let v=a*Math.cos(state.yaw)-c*Math.sin(state.y),t=a*Math.sin(state.y)+c*Math.cos(state.y),h=b*Math.cos(state.pitch)-t*Math.sin(state.pitch);minX=Math.min(minX,v);maxX=Math.max(maxX,v);minY=Math.min(minY,h);maxY=Math.max(maxY,h)}
    let aspect=canvas.width/canvas.height;return Math.min(1.80/Math.max(1,maxY-minY),1.84*aspect/Math.max(1,maxX-minX))*state.zoom;
 }
 function draw(){scheduled=false;if(disposed||!mount.isConnected)return;const gl=ctx.gl;const pr=Math.min(1.5,devicePixelRatio||1),w=Math.max(200,canvas.clientWidth),h=Math.max(200,canvas.clientHeight);const rw=Math.round(w*pr),rh=Math.round(h*pr);if(canvas.width!==rw||canvas.height!==rh){canvas.width=rw;canvas.height=rh;gl.viewport(0,0,rw,rh)}
    gl.clearColor(.052,.085,.15,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(ctx.prog);
    gl.uniform3fv(ctx.uni.uCenter,center);gl.uniform2f(ctx.uni.uAngles,state.yaw,state.pitch);gl.uniform2f(ctx.uni.uResolution,rw,rh);gl.uniform1f(ctx.uni.uFit,projectedBounds());gl.uniform1f(ctx.uni.uVisible,Math.max(0,Math.min(visibleCount,parts.length)));
    gl.uniform1f(ctx.uni.uHighlightStart,highlightStart);gl.uniform1f(ctx.uni.uHighlight,highlightStart>=0?1:0);
    gl.drawArrays(gl.TRIANGLES,0,mesh.partEnds[Math.min(Math.max(1,visibleCount),mesh.partEnds.length)-1]);drawCalls++;
 }
 function request(){if(!scheduled){scheduled=true;requestAnimationFrame(draw)}}
 function pd(e){state.drag=true;state.lastX=e.clientX;state.lastY=e.clientY;canvas.setPointerCapture(e.pointerId)}
 function pm(e){if(!state.drag)return;state.yaw+=(e.clientX-state.lastX)*.009;state.pitch=Math.max(-1.25,Math.min(1.25,state.pitch+(e.clientY-state.lastY)*.008));state.lastX=e.clientX;state.lastY=e.clientY;request()}
 function pu(){state.drag=false}
 function wheel(e){e.preventDefault();state.zoom=Math.max(.35,Math.min(4,state.zoom*(e.deltaY>0?.90:1.10)));request()}
 canvas.addEventListener('pointerdown',pd);canvas.addEventListener('pointermove',pm);canvas.addEventListener('pointerup',pu);canvas.addEventListener('pointercancel',pu);canvas.addEventListener('wheel',wheel,{passive:false});
 const observer=new ResizeObserver(()=>{if(!disposed&&mount.isConnected)request()});observer.observe(mount);
 function dispose(){disposed=true;observer.disconnect();canvas.removeEventListener('pointerdown',pd);canvas.removeEventListener('pointermove',pm);canvas.removeEventListener('pointerup',pu);canvas.removeEventListener('wheel',wheel);ctx.dispose();ctx.gl.getExtension('WEBGL_lose_context')?.loseContext()}
 active={dispose,mount,parts,zoom(factor){state.zoom*=factor;request()},reset(){state.zoom=1;request()},update(count,start){visibleCount=count;highlightStart=start;request()},metrics(){return {backend:'WebGL2',drawCalls,triangles:mesh.triangleCount,vertices:mesh.v.length/7,parts:Math.min(visibleCount,parts.length)}}};request();return active;
}
window.MOCFast3D={view,makeModel,findUnsupported,catalog:CATALOG,zoom:f=>active?.zoom?.(f),reset:()=>active?.reset?.(),metrics:()=>active?.metrics()||null,stop:()=>{active?.dispose();active=null}};
})();
