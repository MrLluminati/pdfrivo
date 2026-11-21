import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createOrganizedPdf } from './pdf-organizer.mjs';

GlobalWorkerOptions.workerSrc = workerURL;

const MAX_PAGES = 200;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const $ = id => document.getElementById(id);
const state = {
  sources: [], pages: [], selection: new Set(), nextSourceId: 1,
  nextPageId: 1, dragging: null, loading: false,
  generation: 0, thumbs: new Map(), pending: new Set(),
  queue: [], activeJobs: 0, observer: null, downloadURL: null
};

function notice(message, isError=false) {
  const status = $('organizer-status');
  status.textContent = message;
  status.className = 'organizer-status' + (isError?' error':'');
  status.hidden = !message;
}

function sync() {
  const count = state.pages.length, selected = state.selection.size;
  $('visual-count').textContent = count + ' page' + (count===1?'':'s');
  $('visual-selected').textContent = selected + ' selected';
  $('visual-files').textContent = state.sources.length + ' PDF'+(state.sources.length===1?'':'s');
  $('organizer-empty').hidden = count!==0;
  $('organizer-loaded').hidden = count===0;
  $('visual-rotate-selected').disabled = selected===0 || state.loading;
  $('visual-delete-selected').disabled = selected===0 || state.loading;
  $('visual-export-selected').disabled = selected===0 || state.loading;
  $('visual-export').disabled = count===0 || state.loading;
  $('visual-select-all').disabled = count===0 || state.loading;
  $('visual-clear-selection').disabled = selected===0 || state.loading;
  $('visual-reset').disabled = !state.sources.length || state.loading;
  $('visual-clear-files').disabled = !state.sources.length || state.loading;
  $('visual-add').disabled = state.loading;
  $('visual-file-input').disabled = state.loading;
  $('visual-export').textContent = state.loading ? 'Processing…' : 'Download organized PDF';
  $('visual-add').textContent = state.loading ? 'Loading PDFs…' : 'Add PDFs';
}

function updateSources() {
  const container = $('visual-source-list');
  container.replaceChildren();
  for (const source of state.sources) {
    const chip = document.createElement('span');
    chip.className = 'source-chip';
    chip.title = source.name;
    const icon = document.createElement('span');
    icon.textContent = '▤';
    const name = document.createElement('span');
    name.textContent = source.name;
    chip.append(icon,name);
    container.append(chip);
  }
}

function tidyThumbnailURLs() {
  for (const url of state.thumbs.values()) URL.revokeObjectURL(url);
  state.thumbs.clear();
  state.queue.length = 0;
  state.pending.clear();
}

function discardResult() {
  if (state.downloadURL) URL.revokeObjectURL(state.downloadURL);
  state.downloadURL = null;
  const result = $('organizer-result');
  result.hidden = true;
  result.replaceChildren();
}

async function clearAll() {
  ++state.generation;
  discardResult();
  tidyThumbnailURLs();
  state.selection.clear();
  state.pages = [];
  const old = state.sources;
  state.sources = [];
  updateSources();
  for (const item of old) {
    try { await item.pdf.destroy(); } catch { /* already released */ }
  }
  draw();
  notice('');
}

async function readPDF(file, staged) {
  if (!(/\.pdf$/i.test(file.name) || file.type==='application/pdf')) throw new Error('Please choose PDF documents.');
  if (file.size > MAX_FILE_BYTES) throw new Error('For visual mode, PDFs must be 50 MB or smaller.');
  const bytes = await file.arrayBuffer();
  // PDF.js may transfer its input buffer to the worker; keep an independent copy for pdf-lib exports.
  const pdf = await getDocument({
    data: new Uint8Array(bytes.slice(0)),
    isEvalSupported: false
  }).promise;
  if (pdf.numPages < 1) { await pdf.destroy(); throw new Error('The PDF has no pages.'); }
  if (staged + pdf.numPages > MAX_PAGES) {
    await pdf.destroy();
    throw new Error('Visual mode supports up to 200 pages per workspace. Use the individual PDF tools for larger documents.');
  }
  return { id: state.nextSourceId++, name: file.name, bytes, pdf, numPages: pdf.numPages };
}

async function addPDFs(fileList) {
  const incoming = Array.from(fileList||[]);
  if (!incoming.length || state.loading) return;
  state.loading = true; sync(); discardResult(); notice('Loading PDF pages and preparing previews…');
  const created = [];
  try {
    const totalBytes = state.sources.reduce((acc, s)=>acc+s.bytes.byteLength,0) +
      incoming.reduce((acc, f)=>acc+f.size,0);
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('This workspace supports up to 100 MB of source PDFs.');
    // Count all original source pages, including those temporarily removed from the workspace.
    // Reset must never restore more pages than the visual limit permits.
    let staged = state.sources.reduce((total, src) => total + src.numPages, 0);
    for (const file of incoming) {
      const doc = await readPDF(file,staged);
      created.push(doc);
      staged+=doc.numPages;
    }
    state.sources.push(...created);
    for (const src of created) {
      for (let i=0;i<src.numPages;i++) {
        state.pages.push({id:state.nextPageId++,sourceId:src.id,pageIndex:i,rotation:0});
      }
    }
    updateSources();
    draw();
    notice('PDFs loaded. Select, rotate, remove, or drag pages to arrange them.');
  } catch(error) {
    await Promise.allSettled(created.map(src=>src.pdf.destroy()));
    notice(error instanceof Error ? error.message : 'Unable to read the PDFs.',true);
  } finally { state.loading = false; sync(); }
}

function pageKey(item) { return item.sourceId+'-'+item.pageIndex; }

function setImage(key,url) {
  const frames=document.querySelectorAll('[data-preview-key]');
  frames.forEach(frame=>{
    if(frame.dataset.previewKey===key) {
      const img=frame.querySelector('img');
      if(!img)return;
      img.src=url;
      img.hidden=false;
      const loading=frame.querySelector('.thumbnail-loading');
      if(loading) loading.hidden=true;
    }
  });
}

function enqueueThumbnail(item) {
  const key=pageKey(item);
  if(state.thumbs.has(key)) { setImage(key,state.thumbs.get(key)); return; }
  if(state.pending.has(key))return;
  state.pending.add(key);
  state.queue.push({key,sourceId:item.sourceId,pageIndex:item.pageIndex,generation:state.generation});
  pump();
}

function pump() {
  while(state.activeJobs<2 && state.queue.length) {
    const job=state.queue.shift();
    state.activeJobs++;
    (async()=>{
      let page;
      try {
        const source=state.sources.find(s=>s.id===job.sourceId);
        if (!source || job.generation!==state.generation) return;
        page=await source.pdf.getPage(job.pageIndex+1);
        const initial=page.getViewport({scale:1});
        const scale=Math.min(172/initial.width,210/initial.height);
        const pixelRatio=Math.min(window.devicePixelRatio||1,2);
        const viewport=page.getViewport({scale:scale*pixelRatio});
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.ceil(viewport.width));
        canvas.height=Math.max(1,Math.ceil(viewport.height));
        const ctx=canvas.getContext('2d',{alpha:false});
        if(!ctx)throw new Error('Unable to render this page.');
        await page.render({canvasContext:ctx,viewport}).promise;
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Preview generation failed.')),'image/png'));
        canvas.width=0;canvas.height=0;
        if(job.generation!==state.generation)return;
        const url=URL.createObjectURL(blob);
        state.thumbs.set(job.key,url);
        setImage(job.key,url);
      } catch {
        document.querySelectorAll('[data-preview-key]').forEach(frame=>{
          if(frame.dataset.previewKey===job.key) {
            const label=frame.querySelector('.thumbnail-loading');
            if(label){label.textContent='Preview unavailable';label.hidden=false;}
          }
        });
      } finally {
        try{page?.cleanup();}catch{/* best effort */}
        state.pending.delete(job.key);
        state.activeJobs--;
        pump();
      }
    })();
  }
}

function observeThumbnails() {
  state.observer?.disconnect();
  if('IntersectionObserver' in window) {
    state.observer=new IntersectionObserver(entries=>{
      for(const entry of entries) {
        if(!entry.isIntersecting)continue;
        const pageId=Number(entry.target.dataset.pageId);
        const page=state.pages.find(p=>p.id===pageId);
        if(page)enqueueThumbnail(page);
        state.observer.unobserve(entry.target);
      }
    },{root:null,rootMargin:'350px'});
    document.querySelectorAll('.visual-preview').forEach(el=>state.observer.observe(el));
  } else {
    for(const page of state.pages)enqueueThumbnail(page);
  }
}

function draw() {
  sync();
  const grid=$('visual-grid');
  grid.replaceChildren();
  for(const [position,page] of state.pages.entries()) {
    const source=state.sources.find(s=>s.id===page.sourceId);
    if(!source)continue;
    const tile=document.createElement('article');
    tile.className='visual-tile'+(state.selection.has(page.id)?' selected':'');
    tile.draggable=true;
    tile.dataset.pageId=String(page.id);

    const top=document.createElement('div');top.className='visual-tile-top';
    const number=document.createElement('span');number.className='tile-index';number.textContent='#'+(position+1);
    const drag=document.createElement('span');drag.className='drag-hint';drag.textContent='⠿ Drag';drag.title='Drag to reorder';
    top.append(number,drag);

    const click=document.createElement('button');click.className='visual-preview';
    click.type='button';click.setAttribute('aria-pressed',state.selection.has(page.id)?'true':'false');
    click.setAttribute('aria-label','Select page '+(position+1)+' from '+source.name);
    click.dataset.pageId=String(page.id);
    const viewport=document.createElement('div');viewport.className='preview-frame';
    viewport.dataset.previewKey=pageKey(page);
    const img=document.createElement('img');img.alt='';img.hidden=true;img.loading='lazy';
    img.style.transform='rotate('+page.rotation+'deg)';
    const url=state.thumbs.get(pageKey(page));
    if(url){img.src=url;img.hidden=false;}
    const waiting=document.createElement('span');waiting.className='thumbnail-loading';
    waiting.textContent='Rendering…';waiting.hidden=Boolean(url);
    viewport.append(img,waiting);
    const selection=document.createElement('span');selection.className='selection-check';
    selection.textContent=state.selection.has(page.id)?'✓':'○';selection.setAttribute('aria-hidden','true');
    click.append(viewport,selection);
    click.addEventListener('click',()=>toggle(page.id));

    const meta=document.createElement('div');meta.className='visual-tile-meta';
    const filename=document.createElement('span');filename.textContent=source.name;filename.title=source.name;
    const label=document.createElement('strong');label.textContent='Page '+(page.pageIndex+1);
    meta.append(filename,label);

    const actions=document.createElement('div');actions.className='visual-tile-actions';
    function action(text,aria,callback,disabled=false) {
      const button=document.createElement('button');button.type='button';button.className='visual-tile-action';
      button.textContent=text;button.title=aria;button.setAttribute('aria-label',aria);
      button.disabled=disabled;button.addEventListener('click',callback);actions.append(button);
    }
    action('←','Move page '+(position+1)+' earlier',()=>move(page.id,-1),position===0);
    action('→','Move page '+(position+1)+' later',()=>move(page.id,1),position===state.pages.length-1);
    action('↻','Rotate page '+(position+1)+' clockwise',()=>rotate([page.id]));
    action('×','Remove page '+(position+1),()=>remove([page.id]));

    tile.append(top,click,meta,actions);
    tile.addEventListener('dragstart',event=>{
      if(state.loading){event.preventDefault();return;}
      state.dragging=page.id;
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('text/plain',String(page.id));
      tile.classList.add('dragging');
    });
    tile.addEventListener('dragover',event=>{
      if(state.dragging===null||state.dragging===page.id)return;
      event.preventDefault();event.dataTransfer.dropEffect='move';tile.classList.add('drag-target');
    });
    tile.addEventListener('dragleave',()=>tile.classList.remove('drag-target'));
    tile.addEventListener('drop',event=>{
      event.preventDefault();
      if(state.dragging!==null && state.dragging!==page.id)reorder(state.dragging,page.id);
      state.dragging=null;
    });
    tile.addEventListener('dragend',()=>{state.dragging=null;document.querySelectorAll('.visual-tile').forEach(el=>el.classList.remove('dragging','drag-target'));});
    grid.append(tile);
  }
  observeThumbnails();
}

function toggle(id) {
  if(state.selection.has(id)) state.selection.delete(id);else state.selection.add(id);
  draw();discardResult();
}
function reorder(fromId,toId) {
  const from=state.pages.findIndex(page=>page.id===fromId);
  const to=state.pages.findIndex(page=>page.id===toId);
  if(from<0||to<0||from===to)return;
  const [page]=state.pages.splice(from,1);
  state.pages.splice(to,0,page);
  discardResult();draw();notice('Page order updated.');
}
function move(id,delta) {
  const from=state.pages.findIndex(page=>page.id===id);
  const to=from+delta;
  if(from<0||to<0||to>=state.pages.length)return;
  [state.pages[from],state.pages[to]]=[state.pages[to],state.pages[from]];
  discardResult();draw();notice('Page moved.');
}
function rotate(ids) {
  const set=new Set(ids);
  state.pages.forEach(page=>{if(set.has(page.id))page.rotation=(page.rotation+90)%360;});
  discardResult();draw();notice('Page rotation updated.');
}
function remove(ids) {
  const set=new Set(ids);
  state.pages=state.pages.filter(page=>!set.has(page.id));
  ids.forEach(id=>state.selection.delete(id));
  discardResult();draw();
  notice('Selected pages removed from this workspace. Your original files were not changed.');
}
function reset() {
  state.pages=[];
  state.selection.clear();
  for(const source of state.sources) for(let pageIndex=0;pageIndex<source.numPages;pageIndex++)
    state.pages.push({id:state.nextPageId++,sourceId:source.id,pageIndex,rotation:0});
  discardResult();draw();notice('Restored the original page order and rotations.');
}

async function exportPDF(onlySelected=false) {
  const chosen=onlySelected?state.pages.filter(page=>state.selection.has(page.id)):state.pages;
  if(!chosen.length){notice('Select at least one page first.',true);return;}
  discardResult();
  state.loading=true;sync();notice('Creating your PDF locally…');
  try {
    const bytes=await createOrganizedPdf(state.sources,chosen);
    const name=onlySelected?'pdfrivo-selected-pages.pdf':'pdfrivo-organized.pdf';
    state.downloadURL=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    const result=$('organizer-result');
    const success=document.createElement('strong');
    success.textContent='Your PDF is ready';
    const desc=document.createElement('span');
    desc.textContent=chosen.length+' page'+(chosen.length===1?'':'s')+' · '+(bytes.byteLength/1024/1024).toFixed(2)+' MB';
    const link=document.createElement('a');
    link.href=state.downloadURL;link.download=name;link.className='button primary';link.textContent='Download '+name+' ↓';
    result.append(success,desc,link);
    result.hidden=false;
    notice('Export complete. Download and verify your PDF.');
    result.scrollIntoView({block:'nearest',behavior:'smooth'});
  } catch(error) {notice(error instanceof Error?error.message:'Failed to create PDF.',true);}
  finally {state.loading=false;sync();}
}

export function initOrganizer() {
  const input=$('visual-file-input');
  const drop=$('visual-dropzone');
  const add=$('visual-add');
  if(!input||!drop||!add)return;
  add.addEventListener('click',()=>input.click());
  drop.addEventListener('click',()=>input.click());
  drop.addEventListener('keydown',event=>{
    if(event.target===drop&&(event.key==='Enter'||event.key===' ')){event.preventDefault();input.click();}
  });
  drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('over');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
  drop.addEventListener('drop',event=>{
    event.preventDefault();drop.classList.remove('over');
    addPDFs(event.dataTransfer.files);
  });
  input.addEventListener('change',()=>{const files=Array.from(input.files||[]);input.value='';addPDFs(files);});
  $('visual-select-all').addEventListener('click',()=>{state.selection=new Set(state.pages.map(p=>p.id));draw();});
  $('visual-clear-selection').addEventListener('click',()=>{state.selection.clear();draw();});
  $('visual-rotate-selected').addEventListener('click',()=>rotate([...state.selection]));
  $('visual-delete-selected').addEventListener('click',()=>remove([...state.selection]));
  $('visual-reset').addEventListener('click',reset);
  $('visual-clear-files').addEventListener('click',()=>{clearAll();});
  $('visual-export').addEventListener('click',()=>exportPDF(false));
  $('visual-export-selected').addEventListener('click',()=>exportPDF(true));
  window.addEventListener('pagehide',()=>{
    ++state.generation;
    state.observer?.disconnect();
    tidyThumbnailURLs();
    discardResult();
    for(const src of state.sources){try{src.pdf.destroy();}catch{/* best effort */}}
  },{once:true});
  draw();
}
