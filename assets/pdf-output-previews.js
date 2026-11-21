import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { processPdf } from './pdf.js';
import { previewEligibility, previewPageNumbers } from './output-preview-rules.mjs';

GlobalWorkerOptions.workerSrc = workerURL;

/**
 * Renders a small, accurate sample of the processed output PDF.
 * Used for page numbers, watermark and images-to-PDF. Every operation is local.
 * This runs separately from the main processing button and never downloads or
 * changes selected files. On large batches, previews are skipped for performance.
 */
export function createPdfOutputPreviews(toolId, root) {
  if (!root || !['number-pdf','watermark-pdf','images-to-pdf'].includes(toolId)) {
    return {setFiles(){},dispose(){}};
  }
  const grid=root.querySelector('#pdf-output-grid');
  const status=root.querySelector('#pdf-output-status');
  const summary=root.querySelector('#pdf-output-summary');
  const refreshButton=root.querySelector('#pdf-output-refresh');
  const fields=Array.from(document.querySelectorAll('.fields input,.fields select'));
  let files=[], generation=0, timer=null, running=false, disposed=false;
  let previewPdf=null, viewerPage=1, viewerZoom=1, viewerToken=0, viewerTask=null, viewerFocus=null;
  const isStale=token=>disposed||token!==generation;

  // Native dialog lets users inspect a PDF at a readable size without
  // navigating away or uploading any file. The PDF remains in browser memory.
  const dialog=document.createElement('dialog');
  dialog.className='pdf-enlarge-dialog';
  dialog.setAttribute('aria-label','Enlarged PDF page preview');
  dialog.innerHTML=
    '<div class="pdf-enlarge-shell"><div class="pdf-enlarge-toolbar">'+
    '<div class="pdf-enlarge-title"><strong>Page preview</strong><span id="pdf-enlarge-position"></span></div>'+
    '<div class="pdf-enlarge-controls">'+
    '<button type="button" data-zoom="-1" aria-label="Zoom out">−</button>'+
    '<span id="pdf-enlarge-zoom" aria-live="polite">100%</span>'+
    '<button type="button" data-zoom="1" aria-label="Zoom in">+</button>'+
    '<button type="button" class="pdf-enlarge-close" aria-label="Close enlarged preview">Close ×</button>'+
    '</div></div>'+
    '<div class="pdf-enlarge-scroll"><canvas id="pdf-enlarge-canvas" aria-label="Enlarged PDF page"></canvas>'+
    '<p id="pdf-enlarge-message" role="status"></p></div>'+
    '<div class="pdf-enlarge-footer">'+
    '<button type="button" id="pdf-enlarge-prev">← Previous</button>'+
    '<span>Scroll to inspect the page · Use ← → to change pages</span>'+
    '<button type="button" id="pdf-enlarge-next">Next →</button>'+
    '</div></div>';
  document.body.append(dialog);
  let largeCanvas=dialog.querySelector('#pdf-enlarge-canvas');
  const largeMessage=dialog.querySelector('#pdf-enlarge-message');
  const positionLabel=dialog.querySelector('#pdf-enlarge-position');
  const zoomLabel=dialog.querySelector('#pdf-enlarge-zoom');
  const previous=dialog.querySelector('#pdf-enlarge-prev');
  const next=dialog.querySelector('#pdf-enlarge-next');
  const zoomLevels=[0.75,1,1.25,1.5,2];

  async function renderEnlargedPage(){
    if(!previewPdf||!dialog.open)return;
    ++viewerToken;
    const token=viewerToken;
    if(viewerTask){viewerTask.cancel();viewerTask=null;}
    positionLabel.textContent='Page '+viewerPage+' of '+previewPdf.numPages;
    zoomLabel.textContent=Math.round(viewerZoom*100)+'%';
    previous.disabled=viewerPage<=1;
    next.disabled=viewerPage>=previewPdf.numPages;
    const zoomIndex=zoomLevels.indexOf(viewerZoom);
    dialog.querySelector('[data-zoom="-1"]').disabled=zoomIndex<=0;
    dialog.querySelector('[data-zoom="1"]').disabled=zoomIndex===zoomLevels.length-1;
    largeMessage.textContent='Rendering page…';
    // Use a fresh canvas for every navigation/zoom request. A cancelled PDF.js
    // render may still be settling, and two renders must never share a canvas.
    const replacement=largeCanvas.cloneNode(false);
    largeCanvas.replaceWith(replacement);
    largeCanvas=replacement;
    let page=null, task=null;
    try{
      page=await previewPdf.getPage(viewerPage);
      if(token!==viewerToken||!dialog.open)return;
      const natural=page.getViewport({scale:1});
      const scale=Math.min(780/natural.width,1050/natural.height)*viewerZoom;
      const density=Math.min(window.devicePixelRatio||1,1.5);
      const viewport=page.getViewport({scale:scale*density});
      largeCanvas.width=Math.max(1,Math.ceil(viewport.width));
      largeCanvas.height=Math.max(1,Math.ceil(viewport.height));
      largeCanvas.style.width=Math.ceil(viewport.width/density)+'px';
      largeCanvas.style.height=Math.ceil(viewport.height/density)+'px';
      const ctx=largeCanvas.getContext('2d',{alpha:false});
      if(!ctx)throw new Error('Canvas preview is unavailable.');
      task=page.render({canvasContext:ctx,viewport});
      viewerTask=task;
      await task.promise;
      if(token===viewerToken&&dialog.open)largeMessage.textContent='';
    }catch(error){
      if(token===viewerToken&&dialog.open&&error?.name!=='RenderingCancelledException')
        largeMessage.textContent='Could not render this page. Try a different zoom level.';
    }finally{
      if(viewerTask===task)viewerTask=null;
      if(token===viewerToken){try{page?.cleanup();}catch{/* best effort */}}
    }
  }
  function openEnlarged(pageNumber,button){
    if(!previewPdf||disposed)return;
    viewerFocus=button;
    viewerPage=pageNumber;
    viewerZoom=1;
    dialog.showModal();
    renderEnlargedPage();
  }
  function closeEnlarged(){
    if(dialog.open)dialog.close();
  }
  dialog.querySelector('.pdf-enlarge-close').addEventListener('click',closeEnlarged);
  dialog.addEventListener('click',event=>{if(event.target===dialog)closeEnlarged();});
  dialog.addEventListener('close',()=>{
    ++viewerToken;
    viewerTask?.cancel();viewerTask=null;
    viewerFocus?.focus();viewerFocus=null;
  });
  previous.addEventListener('click',()=>{if(viewerPage>1){viewerPage--;renderEnlargedPage();}});
  next.addEventListener('click',()=>{if(previewPdf&&viewerPage<previewPdf.numPages){viewerPage++;renderEnlargedPage();}});
  dialog.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{
    const index=zoomLevels.indexOf(viewerZoom)+Number(button.dataset.zoom);
    if(index>=0&&index<zoomLevels.length){viewerZoom=zoomLevels[index];renderEnlargedPage();}
  }));
  dialog.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'&&viewerPage>1){event.preventDefault();viewerPage--;renderEnlargedPage();}
    if(event.key==='ArrowRight'&&previewPdf&&viewerPage<previewPdf.numPages){event.preventDefault();viewerPage++;renderEnlargedPage();}
  });
  function setStatus(text,error=false) {
    status.textContent=text;
    status.classList.toggle('error',error);
    status.hidden=!text;
  }
  function values() {
    return Object.fromEntries(fields.map(el=>[el.name,el.type==='checkbox'?el.checked:el.value]));
  }
  function addCard(pageNumber) {
    const card=document.createElement('button');
    card.type='button';
    card.className='output-preview-card';
    card.setAttribute('aria-label','Enlarge output page '+pageNumber);
    card.addEventListener('click',()=>openEnlarged(pageNumber,card));
    const frame=document.createElement('div');frame.className='output-preview-paper';
    const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Output page '+pageNumber);
    frame.append(canvas);
    const name=document.createElement('span');name.className='output-preview-label';name.textContent='Page '+pageNumber;
    const hint=document.createElement('span');
    hint.className='output-preview-enlarge';
    hint.textContent='⤢ View larger';
    card.append(frame,name,hint);
    grid.append(card);
    return canvas;
  }
  function schedule(delay=420) {
    ++generation;
    closeEnlarged();
    if(previewPdf){
      const old=previewPdf;previewPdf=null;
      Promise.resolve(old.destroy()).catch(()=>{});
    }
    if(timer!==null){clearTimeout(timer);timer=null;}
    grid.replaceChildren();
    if(!files.length) {
      root.classList.add('hidden');summary.textContent='';setStatus('');return;
    }
    root.classList.remove('hidden');
    summary.textContent='Preparing an actual PDF sample locally (up to six pages).';
    setStatus('Updating preview…');
    const token=generation;
    timer=setTimeout(()=>{timer=null;generate(token);},delay);
  }
  async function generate(token) {
    if(isStale(token))return;
    if(running)return; // The current run will schedule the newest generation on completion.
    const eligibility=previewEligibility(files);
    if(!eligibility.eligible){
      setStatus(eligibility.reason, true);
      summary.textContent='Preview skipped to protect browser performance.';
      return;
    }
    running=true;
    let pdf=null;
    try {
      setStatus('Rendering output pages in your browser…');
      const result=await processPdf(toolId,files,values());
      if(isStale(token))return;
      if(result.blob.size>48*1024*1024){
        setStatus('Output is too large to preview. You can still use the Process button.',true);
        summary.textContent='Preview unavailable for this output size.';
        return;
      }
      const loading=getDocument({
        data:new Uint8Array(await result.blob.arrayBuffer()),
        isEvalSupported:false
      });
      pdf=await loading.promise;
      if(isStale(token))return;
      const numbers=previewPageNumbers(pdf.numPages);
      for(const number of numbers) {
        if(isStale(token))return;
        const page=await pdf.getPage(number);
        if(isStale(token)){page.cleanup();return;}
        const natural=page.getViewport({scale:1});
        const deviceRatio=Math.min(window.devicePixelRatio||1,1.5);
        const scale=Math.min(300/natural.width,390/natural.height)*deviceRatio;
        const viewport=page.getViewport({scale});
        const canvas=addCard(number);
        canvas.width=Math.max(1,Math.ceil(viewport.width));
        canvas.height=Math.max(1,Math.ceil(viewport.height));
        const ctx=canvas.getContext('2d',{alpha:false});
        if(!ctx)throw new Error('Canvas preview is unavailable in this browser.');
        await page.render({canvasContext:ctx,viewport}).promise;
        page.cleanup();
      }
      if(isStale(token))return;
      summary.textContent=pdf.numPages+' page'+(pdf.numPages===1?'':'s')+' in the output. '+
        (pdf.numPages>numbers.length?'Showing the first '+numbers.length+' pages.':'Showing all pages.');
      // Keep the locally generated PDF available for the on-demand enlarged viewer.
      // On option changes or page exit, the old PDF and its worker are destroyed.
      previewPdf=pdf;
      pdf=null;
      setStatus('Preview updated. Click any page to inspect it at a larger size.');
    } catch(error) {
      if(isStale(token))return;
      grid.replaceChildren();
      setStatus('Preview unavailable: '+(error instanceof Error?error.message:'The selected files could not be previewed.')+' Processing remains available.',true);
      summary.textContent='Check your options and source files, then refresh the preview.';
    } finally {
      if(pdf) {
        try{await pdf.destroy();}catch{/* browser worker cleanup is best effort */}
      }
      running=false;
      if(!disposed&&generation!==token&&files.length) schedule(0);
    }
  }
  function setFiles(next) {
    files=Array.from(next||[]);
    schedule(100);
  }
  for(const el of fields){
    el.addEventListener('input',()=>schedule());
    el.addEventListener('change',()=>schedule());
  }
  refreshButton.addEventListener('click',()=>schedule(0));
  function dispose(){
    disposed=true;
    generation++;
    closeEnlarged();
    if(previewPdf){Promise.resolve(previewPdf.destroy()).catch(()=>{});previewPdf=null;}
    if(timer!==null)clearTimeout(timer);
    files=[];
    grid.replaceChildren();
    dialog.remove();
  }
  window.addEventListener('pagehide',dispose,{once:true});
  return {setFiles,dispose};
}
