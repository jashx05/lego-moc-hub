(()=>{'use strict';
const get=id=>document.getElementById(id),enc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={user:null,setup:false,mode:'login',busy:false,cloud:null,gallery:null};
async function call(endpoint,{method='GET',json,headers={},body}={}){
 const h={...headers};if(method!=='GET')h['x-moc-request']='1';
 if(json!==undefined){h['Content-Type']='application/json';body=JSON.stringify(json)}
 const r=await fetch(endpoint,{method,headers:h,body,credentials:'same-origin',cache:'no-store'});
 let data;try{data=await r.json()}catch{data={error:'Risposta non valida'}}
 if(!r.ok)throw Error(data.error||`HTTP ${r.status}`);return data;
}
async function identity(){const me=await call('/api/auth?action=me');state.user=me.user;state.setup=me.setupRequired;return me}
function modal(html){let el=get('cloudModal');if(!el){el=document.createElement('div');el.id='cloudModal';document.body.append(el)}
 el.innerHTML=`<div class="moc-cloud-overlay"><div class="moc-cloud-panel" role="dialog" aria-modal="true" aria-label="Account LEGO MOC Hub"><button class="moc-cloud-close" id="cloudClose" aria-label="Chiudi">✕</button>${html}</div></div>`;
 get('cloudClose').onclick=()=>el.remove();el.querySelector('.moc-cloud-overlay').onclick=e=>{if(e.target===e.currentTarget)el.remove()};
}
function notice(s){const x=get('cloudNote');if(x)x.textContent=s;else window.MOCBridge?.notice(s)}
function loginHtml(){const registering=state.mode==='register'&&!state.setup,initial=state.setup;
 return `<div class="moc-cloud-title">☁ LEGO MOC Hub Community</div><p>${initial?'Attiva il primo account proprietario.':registering?'Crea il tuo account e pubblica i tuoi MOC nella galleria condivisa.':'Accedi per pubblicare i tuoi progetti e sincronizzarli tra dispositivi.'}</p>
 <form id="cloudForm"><label>Email <input id="cloudEmail" type="email" autocomplete="username" maxlength="254" required></label>
 <label>Password <input id="cloudPass" type="password" minlength="12" maxlength="256" autocomplete="${registering||initial?'new-password':'current-password'}" required></label>
 ${initial?'<label>Codice di attivazione iniziale <input id="cloudSetupCode" autocomplete="off" required></label>':''}
 <button class="btn main" type="submit">${initial?'Attiva account proprietario':registering?'Crea account':'Accedi'}</button><p id="cloudNote" role="status"></p></form>
 ${!initial?`<div class="moc-cloud-toolbar"><button class="btn tiny" id="cloudToggleMode">${registering?'Ho già un account: accedi':'Nuovo utente? Registrati'}</button></div>`:''}
 <small>I progetti nuovi sono pubblici. Soltanto l'amministratore può renderli privati. La password non viene conservata in chiaro; il recupero via email non è ancora disponibile.</small>`;
}
function showForm(){modal(loginHtml());get('cloudForm').onsubmit=submitLogin;const btn=get('cloudToggleMode');if(btn)btn.onclick=()=>{state.mode=state.mode==='register'?'login':'register';showForm()}}
async function show(){modal('<div class="moc-cloud-title">☁ Connessione…</div>');try{await identity();if(state.user){await refreshCloud();renderDashboard()}else showForm()}catch(e){modal(`<h2>Servizio momentaneamente non disponibile</h2><p>${enc(e.message)}</p>`)}}
async function submitLogin(e){e.preventDefault();if(state.busy)return;state.busy=true;
 try{const action=state.setup?'setup':state.mode==='register'?'register':'login';await call('/api/auth?action='+action,{method:'POST',json:{email:get('cloudEmail').value,password:get('cloudPass').value,setupCode:get('cloudSetupCode')?.value||''}});await identity();await refreshCloud();renderDashboard();await loadGallery()}
 catch(err){notice(err.message)}finally{state.busy=false}
}
async function refreshCloud(){state.cloud=await call('/api/projects')}
function dashboardHtml(){const p=state.cloud?.projects||[],admin=state.user?.role==='owner';
 return `<div class="moc-cloud-title">☁ Archivio cloud</div><p>Accesso: <b>${enc(state.user?.email)}</b> · ${admin?'Amministratore':'Membro'}</p>
 <div class="moc-cloud-status"><strong>${p.length}</strong> progetti ${admin?'complessivi':'del tuo account'} · Turso + Blob</div>
 <div class="moc-cloud-toolbar"><button class="btn main" id="cloudSyncAll">↑ Sincronizza i progetti locali</button><button class="btn" id="cloudReload">↻ Aggiorna</button><button class="btn" id="cloudLogout">Esci</button></div>
 <p id="cloudNote" role="status"></p><p class="moc-cloud-warning">I progetti importati sono <b>pubblici</b> per impostazione predefinita. ${admin?'Solo tu puoi cambiarne la visibilità, anche per i progetti degli amici.':'Soltanto l’amministratore può modificare la visibilità.'} Esegui backup ZIP periodici; i file oltre 4 MB restano locali.</p>
 <h3>Progetti cloud</h3><div class="moc-cloud-list">${p.length?p.map(project=>`<div class="moc-cloud-item"><div><b>${enc(project.title)}</b><small>${enc(project.author||'')} · ${enc(project.category)} · ${project.is_public?'Pubblico':'Privato'}</small></div>
 <div class="moc-cloud-toolbar">${admin?`<label class="moc-cloud-toggle">Pubblico <input type="checkbox" data-visibility="${enc(project.id)}" ${project.is_public?'checked':''} aria-label="Rendi pubblico ${enc(project.title)}"></label>`:''}<button class="btn tiny" data-cloud-import="${enc(project.id)}">↓ Apri sul dispositivo</button></div></div>`).join(''):'<p>Nessun progetto sincronizzato.</p>'}</div>`;
}
function renderDashboard(){modal(dashboardHtml());get('cloudSyncAll').onclick=syncAll;get('cloudReload').onclick=async()=>{try{await refreshCloud();renderDashboard();await loadGallery()}catch(e){notice(e.message)}};
 get('cloudLogout').onclick=async()=>{try{await call('/api/auth?action=logout',{method:'POST',json:{}});state.user=null;state.cloud=null;state.mode='login';showForm();await loadGallery()}catch(e){notice(e.message)}};
 document.querySelectorAll('[data-cloud-import]').forEach(b=>b.onclick=()=>restoreProject(b.dataset.cloudImport));
 document.querySelectorAll('[data-visibility]').forEach(x=>x.onchange=async()=>{const desired=x.checked;x.disabled=true;try{await call('/api/projects',{method:'PATCH',json:{projectId:x.dataset.visibility,isPublic:desired}});await refreshCloud();renderDashboard();await loadGallery();notice('Visibilità aggiornata: '+(desired?'pubblico':'privato'))}catch(e){x.checked=!desired;x.disabled=false;notice(e.message)}});
}
async function upload(p){const bridge=window.MOCBridge;if(!bridge)throw Error('Archivio locale non pronto');
 const remote=await call('/api/projects',{method:'POST',json:{id:p.id,title:p.title,description:p.description,category:p.category,status:p.status}});
 const md=await bridge.modelData(p).catch(()=>null),parts=md?bridge.partsTable(md.parts).map(({id,color,count})=>({id,color,qty:count})):[],steps=md?.steps?.map(s=>({count:s.length}))||[];
 const version=await call('/api/versions',{method:'POST',json:{projectId:remote.id,versionNumber:p.cloudVersionNumber||1,partsTotal:md?.parts?.length||0,stepsTotal:steps.length,parts,steps,label:'Versione importata dal browser'}});
 const errors=[];for(const f of p.files){if(f.data.byteLength>4*1024*1024){errors.push(f.name+' (oltre 4 MB)');continue}
  try{const r=await fetch('/api/upload?projectId='+encodeURIComponent(remote.id)+'&versionId='+encodeURIComponent(version.id),{method:'POST',credentials:'same-origin',headers:{'x-moc-request':'1','x-file-name':f.name,'Content-Type':f.mime||'application/octet-stream'},body:f.data});const j=await r.json();if(!r.ok)throw Error(j.error||`HTTP ${r.status}`)}catch(e){errors.push(f.name+': '+e.message)}
 }
 p.cloudVersionNumber=p.cloudVersionNumber||1;p.cloudSyncedAt=Date.now();p.cloudErrors=errors;await bridge.saveOne(p);return errors;
}
async function syncAll(){if(state.busy)return;state.busy=true;get('cloudSyncAll').disabled=true;let done=0,failed=0;
 try{const originals=await window.MOCBridge.loadAll();for(const p of originals){notice(`Invio ${done+failed+1}/${originals.length}: ${p.title}…`);try{const problems=await upload(p);if(problems.length)failed++;else done++}catch(e){failed++;notice(p.title+': '+e.message)}}await refreshCloud();renderDashboard();await loadGallery();notice(`Sincronizzazione: ${done} completati, ${failed} incompleti.`);await window.MOCBridge.refresh()}
 catch(e){notice(e.message)}finally{state.busy=false}
}
async function filesFor(project,gallery){const versions=(gallery.versions||[]).filter(v=>v.project_id===project.id).sort((a,b)=>b.version_number-a.version_number);const ver=versions[0];if(!ver)throw Error('Nessuna versione disponibile');
 const fs=(gallery.files||[]).filter(f=>f.project_id===project.id&&f.version_id===ver.id),downloaded=[];
 for(const f of fs){const r=await fetch('/api/files?id='+encodeURIComponent(f.id),{credentials:'same-origin'});if(!r.ok){let e=await r.json().catch(()=>({}));throw Error(e.error||'Download non riuscito')}
  downloaded.push({name:f.file_name,mime:f.mime_type,data:await r.arrayBuffer()});
 }
 if(!downloaded.length)throw Error('Questo progetto non ha ancora file scaricabili');return {ver,downloaded};
}
async function restoreProject(id){if(state.busy)return;state.busy=true;
 try{const p=state.cloud.projects.find(x=>x.id===id);if(!p)throw Error('Progetto non trovato');notice('Scaricamento '+p.title+'…');const {ver,downloaded}=await filesFor(p,state.cloud),bridge=window.MOCBridge;
  const md=await bridge.modelData({files:downloaded}).catch(()=>null);const borrowed=p.owner_id&&p.owner_id!==state.user?.id;
  const local={id:borrowed?'gallery-'+p.id:p.id,title:p.title,description:p.description,category:p.category,status:p.status,updated:Date.now(),files:downloaded,parts:md?.parts.length||0,stepCount:md?.steps.length||0,cover:'',cloudVersionNumber:ver.version_number,cloudSyncedAt:Date.now(),publicPreview:Boolean(borrowed)};
  if(borrowed){get('cloudModal')?.remove();await bridge.preview(local);return;}
  await bridge.saveOne(local);await bridge.refresh();renderDashboard();notice('Scaricato nel browser: '+p.title);
 }catch(e){notice(e.message)}finally{state.busy=false}
}
async function previewPublicProject(id){if(state.busy)return;state.busy=true;
 try{const p=state.gallery?.projects?.find(x=>x.id===id);if(!p)throw Error('Progetto pubblico non disponibile');const btn=get('publicOpen_'+id);if(btn)btn.textContent='Apertura…';
 const {downloaded}=await filesFor(p,state.gallery);const bridge=window.MOCBridge;
 const model={id:'gallery-'+p.id,title:p.title,description:`Autore: ${p.author||'Utente'} — ${p.description||''}`,category:p.category,status:p.status,updated:Date.now(),files:downloaded,parts:p.parts_total||0,cover:'',publicPreview:true};
 await bridge.preview(model);
 }catch(e){alert('Impossibile aprire il progetto: '+e.message)}finally{state.busy=false;const btn=get('publicOpen_'+id);if(btn)btn.textContent='Visualizza'}
}
function installGallery(){if(get('mocCommunityGallery'))return;const node=document.createElement('section');node.id='mocCommunityGallery';node.className='moc-community';
 node.innerHTML='<div class="moc-community-head"><div><h2>🌐 Galleria pubblica</h2><p>Progetti condivisi da tutti gli utenti LEGO MOC HUB</p></div><button class="btn tiny" id="reloadGallery">↻ Aggiorna</button></div><div id="mocGalleryCards" class="moc-community-grid">Caricamento progetti…</div>';
 const main=document.querySelector('main');if(main)main.appendChild(node);get('reloadGallery').onclick=loadGallery;
}
async function loadGallery(){installGallery();const root=get('mocGalleryCards');if(!root)return;
 try{const d=await call('/api/gallery');state.gallery=d;
 root.innerHTML=d.projects?.length?d.projects.map(p=>`<article class="moc-community-card"><div class="moc-community-icon">${{Architettura:'🏛',Personaggi:'♟',Veicoli:'🏎',Fantasy:'🐉'}[p.category]||'🧱'}</div><div><strong>${enc(p.title)}</strong><p>${enc(p.description||'Modello LEGO condiviso')}</p><small>di ${enc(p.author||'utente')} · ${Number(p.parts_total)||0} pezzi</small></div><button id="publicOpen_${enc(p.id)}" class="btn tiny" data-open-public="${enc(p.id)}">Visualizza</button></article>`).join(''):'<p class="moc-gallery-note">Nessun progetto pubblico. Gli amministratori possono pubblicare i progetti dalla sezione Account.</p>';
 root.querySelectorAll('[data-open-public]').forEach(b=>b.onclick=()=>previewPublicProject(b.dataset.openPublic));
 }catch(e){root.innerHTML='<p class="moc-gallery-note">Galleria non disponibile: '+enc(e.message)+'</p>'}
}
function queueUpload(p){if(!state.user){window.MOCBridge?.notice('Accedi per pubblicare sul cloud');return}
 upload(p).then(async errors=>{window.MOCBridge?.notice(errors.length?'Alcuni file non sincronizzati: '+errors.join(', '):'Progetto pubblicato: '+p.title);await loadGallery()}).catch(e=>window.MOCBridge?.notice('Importazione locale riuscita, ma upload non riuscito: '+e.message));
}
const css=document.createElement('style');css.textContent=`
.moc-cloud-overlay{position:fixed;inset:0;background:#020715e0;display:grid;place-items:center;z-index:90;padding:20px}.moc-cloud-panel{position:relative;background:#151f34;border:1px solid #3e5172;color:#f0f3fa;border-radius:20px;padding:26px;width:min(750px,100%);max-height:92dvh;overflow:auto;box-shadow:0 26px 80px #000a}.moc-cloud-title{font-size:23px;font-weight:800;margin:4px 0 12px}.moc-cloud-panel p{color:#b2c1d8;line-height:1.5;font-size:13px}.moc-cloud-panel form{display:grid;gap:15px;margin:18px 0}.moc-cloud-panel label{display:grid;gap:7px;font-size:13px;font-weight:700}.moc-cloud-panel input{width:100%;border:1px solid #445576;color:#f4f6fd;background:#0c1526;padding:12px;border-radius:9px}.moc-cloud-close{position:absolute;top:15px;right:16px;color:white;border:1px solid #405170;background:#243551;border-radius:9px;padding:8px 12px;cursor:pointer}.moc-cloud-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.moc-cloud-warning{background:#24344a;border-radius:10px;padding:12px}.moc-cloud-status{padding:17px;background:#0d182a;border:1px solid #334666;border-radius:12px}.moc-cloud-status strong{font-size:25px;margin-right:7px}.moc-cloud-list{display:grid;gap:9px}.moc-cloud-item{border:1px solid #36435e;border-radius:10px;padding:13px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.moc-cloud-item small{display:block;color:#9aabc5;margin-top:3px}.moc-cloud-panel #cloudNote{color:#a4d8fa;min-height:20px}.moc-cloud-panel .btn:disabled{opacity:.5}.moc-cloud-toggle{display:flex!important;align-items:center;gap:8px!important;white-space:nowrap}.moc-cloud-toggle input{width:18px!important;height:18px!important;accent-color:#8d9fff}.moc-community{margin-top:30px}.moc-community-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.moc-community-head h2{margin:0;font-size:21px}.moc-community-head p{color:#90a5c6;font-size:13px;margin:7px 0}.moc-community-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:15px}.moc-community-card{display:grid;grid-template-columns:54px minmax(0,1fr);gap:9px;background:#151f34;border:1px solid #2d3d59;border-radius:13px;padding:15px;align-items:start}.moc-community-card .btn{grid-column:1/-1}.moc-community-card p{font-size:12px;color:#abbad2;overflow-wrap:anywhere}.moc-community-card small{font-size:11px;color:#8fa1c1}.moc-community-icon{font-size:35px}.moc-gallery-note{color:#a8bad9;grid-column:1/-1}
`;document.head.append(css);
get('cloudHub')?.addEventListener('click',show);window.MOCHubCloud={show,queueUpload,isAuthenticated:()=>Boolean(state.user),refreshGallery:loadGallery};
identity().catch(()=>{}).finally(loadGallery);
})();
