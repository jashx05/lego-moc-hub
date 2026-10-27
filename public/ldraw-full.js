/* Accurate LDraw mode for models requiring slopes, curves, SNOT and non-rectangular parts.
 * Uses the Three.js LDrawLoader + official LDraw parts library, lazy loaded through a pinned CDN.
 * This module does NOT upload models to any third-party provider; only public .dat geometry is fetched.
 * LDraw shapes and color config: © LDraw authors, CC BY 4.0, https://ldraw.org.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { serializeModel } from './ldraw-utils.js';

// Files stay on our origin; the backend retrieves only allowlisted geometry from a fixed LDraw mirror.
const LIBRARY='/api/ldraw?path=';
const geometryCache=new WeakMap();
let current=null;

function info(mount,message){let e=mount.querySelector('.moc-ldraw-info');if(e)e.textContent=message;}
function clearObject(object) { object?.traverse(o=>{if(o.geometry && !o.userData?.sharedGeometry) o.geometry.dispose();}); }
function fail(mount,message){mount.innerHTML='<div class="loader"><strong>Impossibile completare il caricamento LDraw</strong><span></span><span>I modelli sono rimasti salvati. Il modello è salvo. Controlla il codice del pezzo e la risposta dell’archivio LDraw; riprova ad aprirlo.</span></div>';mount.querySelector('span').textContent=message;}
function parseAsync(loader,text){return new Promise((resolve,reject)=>loader.parse(text,resolve,reject));}
function addOutlineForSelection(root,index,scene) {
  const g=root.children[index];if(!g)return null;
  const mat=new THREE.LineBasicMaterial({color:0x00c4ff,depthTest:true,transparent:false});
  const meshes=[];g.updateWorldMatrix(true,true);
  g.traverse(o=>{if(!o.isMesh||!o.geometry)return;
    const edges=new THREE.EdgesGeometry(o.geometry,32);
    const overlay=new THREE.LineSegments(edges,mat);
    overlay.matrixAutoUpdate=false;overlay.matrix.copy(o.matrixWorld);
    overlay.renderOrder=5;scene.add(overlay);meshes.push(overlay);
  });
  return {dispose(){for(const m of meshes){scene.remove(m);m.geometry.dispose()}mat.dispose()}};
}
function pointOwner(intersection,root){let n=intersection.object;while(n&&n.parent!==root)n=n.parent;return n?.parent===root?root.children.indexOf(n):-1}

export async function showFullLDraw(parts,mount,colorFn,options={}) {
  if(current){current.dispose();current=null;}
  const visibleCount=Math.max(0,Math.min(parts.length,options.visibleCount??parts.length));
  let closed=false,renderer=null,controls=null,frame=0,ob=null,root=null,selection=null,resize=null;
  const mode=options.mode||'model';let selected=-1;
  mount.innerHTML='<div class="moc-ldraw-info" role="status" style="padding:7px 10px;background:#12233df2;color:#e9f2ff;border-radius:6px;font-size:12px">Caricamento geometrie LDraw originali…</div><div class="moc-ldraw-host" style="width:100%;height:100%;min-height:310px;position:relative"></div>';
  const target=mount.querySelector('.moc-ldraw-host');
  function disposal(){closed=true;if(current===state)current=null;cancelAnimationFrame(frame);ob?.disconnect();controls?.dispose();selection?.dispose();if(renderer){renderer.dispose();renderer.domElement.remove()}}
  const state={update(n,start){visible(n,start)},zoom(k){if(!controls)return;const delta=controls.object.position.clone().sub(controls.target).multiplyScalar(1/k);controls.object.position.copy(controls.target).add(delta);controls.update();draw();},reset(){if(!controls)return;controls.object.position.copy(initialPosition);controls.target.copy(guideFocus||center);controls.update();draw();},dispose:disposal,metrics:()=>({backend:'Three.js LDrawLoader',parts:visibleTotal,selectedPart:selected})};
  current=state;
  let visibleTotal=visibleCount,initialPosition,center,guideFocus,lastGuideSide='++';
  function draw(){if(!closed&&renderer)renderer.render(scene,camera)}
  function tick(){if(closed)return;controls?.update();draw();frame=requestAnimationFrame(tick)}
  let scene,camera;
  function visible(n,start=-1){visibleTotal=Math.max(0,Math.min(n,parts.length));if(!root)return;
    const idx=visibleTotal;const startAt=Math.max(0,start);
    for(let i=0;i<root.children.length;i++){
      const node=root.children[i];node.visible=i<idx;
      if(node.userData._originalMaterials){for(const [obj,orig] of node.userData._originalMaterials){obj.material=orig;}node.userData._originalMaterials=null;}
      if(mode==='paper'){
        const added=i<idx && start>=0 && i>=startAt;
        // LEGO-style: preserve each brick's actual color; emphasize only the
        // newly placed silhouette, with a contrasting outline for blue pieces.
        let closeToCyan=false;
        if(added)node.traverse(o=>{if(o.isMesh&&o.material){const m=Array.isArray(o.material)?o.material[0]:o.material;
          if(m?.color){const c=m.color;closeToCyan=closeToCyan||(c.b>c.r*1.3&&c.g>c.r*1.25);}}});
        node.traverse(o=>{if(!o.isLine&&!o.isLineSegments)return;
          for(const m of (Array.isArray(o.material)?o.material:[o.material])){
            if(!m)continue;m.transparent=true;m.opacity=added?0.90:0.23;
            if(m.color)m.color.setHex(added?(closeToCyan?0x124568:0x00a9e8):0x526176);
          }
        });
      }
    }
    if(selected>=idx){selection?.dispose();selection=null;selected=-1;}
    if(mode==='paper'&&camera&&controls&&idx>0){
      // Reframe each instruction from the side of its new assembly area.
      // Different steps therefore show different faces instead of a fixed view.
      const assembled=new THREE.Box3(),fresh=new THREE.Box3();
      for(let i=0;i<idx;i++)assembled.expandByObject(root.children[i]);
      for(let i=startAt;i<idx;i++)fresh.expandByObject(root.children[i]);
      if(fresh.isEmpty())fresh.copy(assembled);
      const base=assembled.getCenter(new THREE.Vector3()),target=fresh.getCenter(new THREE.Vector3());
      const extent=assembled.getSize(new THREE.Vector3()),span=Math.max(extent.x,extent.y,extent.z,20);
      const dx=target.x-base.x,dz=target.z-base.z;
      if(Math.abs(dx)>span*.10||Math.abs(dz)>span*.10)lastGuideSide=(dx<0?'-':'+')+(dz<0?'-':'+');
      guideFocus=base.clone().lerp(target,.22);
      const vx=lastGuideSide[0]==='-'?-1:1,vz=lastGuideSide[1]==='-'?-1:1;
      const eye=guideFocus.clone().add(new THREE.Vector3(vx*span*1.35,span*.95,vz*span*1.55));
      camera.position.copy(eye);controls.target.copy(guideFocus);controls.update();initialPosition=eye.clone();
    }
    draw();
  }
  try {
    if(typeof WebGL2RenderingContext==='undefined')throw new Error('WebGL2 non disponibile nel browser');
    const cached=geometryCache.get(parts);
    if(cached){root=cached;info(mount,'Geometrie LDraw dalla cache');}
    else {
      const loader=new LDrawLoader();loader.setPartsLibraryPath(LIBRARY);loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
      info(mount,'Caricamento palette e geometrie LDraw tramite il server (prima apertura più lenta)…');
      await loader.preloadMaterials(LIBRARY+'LDConfig.ldr');if(closed)return state;
      root=await parseAsync(loader,serializeModel(parts));if(closed)return state;
      // LDrawLoader omits missing parts instead of throwing. Do not present partial models as complete.
      if(root.children.length!==parts.length)throw new Error(`Sono stati caricati ${root.children.length} di ${parts.length} pezzi: verificare i codici non disponibili nella libreria.`);
      geometryCache.set(parts,root);
    }
    if(closed)return state;
    // Cloned container keeps the cached model intact across view switches.
    root=root.clone(true);
    // Keep geometry unchanged while softening the very dark per-brick LDraw seams.
    // Clone materials so the cached source and the instruction viewer remain untouched.
    root.traverse(o=>{
      if(!o.isLineSegments && !o.isLine)return;
      if(!o.material)return;
      // Keep selection outlines independent. Existing seams are barely visible in
      // the model view; instructions adapt line contrast to the step being built.
      const soften=m=>{const copy=m.clone();copy.transparent=true;copy.opacity=mode==='model'?0.12:0.23;return copy;};
      o.material=Array.isArray(o.material)?o.material.map(soften):soften(o.material);
    });
    root.scale.y=-1;
    scene=new THREE.Scene();scene.background=new THREE.Color(mode==='paper'?0xe5f2ff:0xe4ecf6);
    scene.add(root);
    const box=new THREE.Box3().setFromObject(root);center=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3());
    const radius=Math.max(size.length()/2,20),max=Math.max(size.x,size.y,size.z,20);
    const w=Math.max(220,target.clientWidth),h=Math.max(280,target.clientHeight);
    camera=new THREE.PerspectiveCamera(35,w/h,.1,Math.max(10000,max*30));
    initialPosition=center.clone().add(new THREE.Vector3(max*1.20,max*.77,max*1.50));camera.position.copy(initialPosition);camera.lookAt(center);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:mode==='paper'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.setSize(w,h);renderer.outputColorSpace=THREE.SRGBColorSpace;
    target.append(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff,1.5));const sunlight=new THREE.DirectionalLight(0xffffff,1.9);sunlight.position.set(200,450,300);scene.add(sunlight);
    controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(center);controls.enableDamping=mode!=='paper';controls.enableRotate=mode!=='paper';controls.enablePan=mode!=='paper';controls.enableZoom=mode!=='paper';controls.minDistance=max*.3;controls.maxDistance=max*8;controls.update();
    ob=new ResizeObserver(()=>{if(closed)return;const w=Math.max(220,target.clientWidth),h=Math.max(280,target.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);draw()});ob.observe(target);
    visible(visibleCount,options.highlightStart??-1);
    if(mode==='model'){
      const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),down={x:0,y:0};let moved=false;
      renderer.domElement.addEventListener('pointerdown',e=>{down.x=e.clientX;down.y=e.clientY;moved=false});
      renderer.domElement.addEventListener('pointermove',e=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)moved=true});
      renderer.domElement.addEventListener('pointerup',e=>{
        if(moved||!root)return;
        const r=renderer.domElement.getBoundingClientRect();pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
        raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObject(root,true).filter(x=>x.object.isMesh);
        const index=hits.length?pointOwner(hits[0],root):-1;
        selection?.dispose();selection=null;selected=selected===index?-1:index;
        if(selected>=0){selection=addOutlineForSelection(root,selected,scene);info(mount,`Pezzo ${selected+1}/${parts.length}: ${parts[selected].id} · colore ${parts[selected].color}`)}
        else info(mount,`LDraw completo: ${parts.length} pezzi, curve e slope reali.`);draw();
      });
    }
    info(mount,`LDraw completo: ${parts.length} pezzi · geometrie ufficiali${mode==='paper'?' · passo '+visibleCount:''}`);
    tick();
  } catch(err){if(!closed){console.error('[MOC Hub LDraw full]',err);disposal();fail(mount,String(err?.message||err))}}
  return state;
}
