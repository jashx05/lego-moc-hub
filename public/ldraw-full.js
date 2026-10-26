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

const LIBRARY='https://cdn.jsdelivr.net/gh/kulits/ldraw-parts@f3d0c2256398c28fbb682f4bb08c59eed81fd4f1/ldraw/';
const geometryCache=new WeakMap();
let current=null;

function info(mount,message){let e=mount.querySelector('.moc-ldraw-info');if(e)e.textContent=message;}
function clearObject(object) { object?.traverse(o=>{if(o.geometry && !o.userData?.sharedGeometry) o.geometry.dispose();}); }
function fail(mount,message){mount.innerHTML='<div class="loader"><strong>Impossibile completare il caricamento LDraw</strong><span></span><span>I modelli sono rimasti salvati. Verifica la connessione a jsDelivr e riprova a riaprire il progetto.</span></div>';mount.querySelector('span').textContent=message;}
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
  const state={update(n,start){visible(n,start)},zoom(k){if(!controls)return;const delta=controls.object.position.clone().sub(controls.target).multiplyScalar(1/k);controls.object.position.copy(controls.target).add(delta);controls.update();draw();},reset(){if(!controls)return;controls.object.position.copy(initialPosition);controls.target.copy(center);controls.update();draw();},dispose:disposal,metrics:()=>({backend:'Three.js LDrawLoader',parts:visibleTotal,selectedPart:selected})};
  current=state;
  let visibleTotal=visibleCount,initialPosition,center;
  function draw(){if(!closed&&renderer)renderer.render(scene,camera)}
  function tick(){if(closed)return;controls?.update();draw();frame=requestAnimationFrame(tick)}
  let scene,camera;
  function visible(n,start=-1){visibleTotal=Math.max(0,Math.min(n,parts.length));if(!root)return;
    const idx=visibleTotal;const startAt=Math.max(0,start);
    for(let i=0;i<root.children.length;i++){
      const node=root.children[i];node.visible=i<idx;
      if(node.userData._originalMaterials){for(const [obj,orig] of node.userData._originalMaterials){obj.material=orig;}node.userData._originalMaterials=null;}
      if(i<idx && start>=0 && i>=startAt && mode==='paper'){
        const arr=[];node.traverse(o=>{if(o.isMesh){const orig=o.material;const swap=Array.isArray(orig)?orig.map(v=>v.clone()):orig.clone();
          for(const m of (Array.isArray(swap)?swap:[swap])) {if(m.color)m.color.setHex(0xf9a428);if(m.emissive)m.emissive.setHex(0x301a00)}o.material=swap;arr.push([o,orig]);}});
        node.userData._originalMaterials=arr;
      }
    }
    if(selected>=idx){selection?.dispose();selection=null;selected=-1;}
    draw();
  }
  try {
    if(typeof WebGL2RenderingContext==='undefined')throw new Error('WebGL2 non disponibile nel browser');
    const cached=geometryCache.get(parts);
    if(cached){root=cached;info(mount,'Geometrie LDraw dalla cache');}
    else {
      const loader=new LDrawLoader();loader.setPartsLibraryPath(LIBRARY);loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
      info(mount,'Caricamento palette e geometrie da LDraw.org (prima apertura più lenta)…');
      await loader.preloadMaterials(LIBRARY+'LDConfig.ldr');if(closed)return state;
      root=await parseAsync(loader,serializeModel(parts));if(closed)return state;
      // LDrawLoader omits missing parts instead of throwing. Do not present partial models as complete.
      if(root.children.length!==parts.length)throw new Error(`Sono stati caricati ${root.children.length} di ${parts.length} pezzi: verificare i codici non disponibili nella libreria.`);
      geometryCache.set(parts,root);
    }
    if(closed)return state;
    // Cloned container keeps the cached model intact across view switches.
    root=root.clone(true);
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
    scene.add(new THREE.AmbientLight(0xffffff,2.0));const sunlight=new THREE.DirectionalLight(0xffffff,2.4);sunlight.position.set(200,450,300);scene.add(sunlight);
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
