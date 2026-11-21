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
  const isStale=token=>disposed||token!==generation;
  function setStatus(text,error=false) {
    status.textContent=text;
    status.classList.toggle('error',error);
    status.hidden=!text;
  }
  function values() {
    return Object.fromEntries(fields.map(el=>[el.name,el.type==='checkbox'?el.checked:el.value]));
  }
  function addCard(pageNumber) {
    const card=document.createElement('div');
    card.className='output-preview-card';
    const frame=document.createElement('div');frame.className='output-preview-paper';
    const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Output page '+pageNumber);
    frame.append(canvas);
    const name=document.createElement('span');name.className='output-preview-label';name.textContent='Page '+pageNumber;
    card.append(frame,name);
    grid.append(card);
    return canvas;
  }
  function schedule(delay=420) {
    ++generation;
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
        const scale=Math.min(158/natural.width,200/natural.height)*deviceRatio;
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
      setStatus('Preview updated. The final PDF is created when you click Process.');
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
    if(timer!==null)clearTimeout(timer);
    files=[];
    grid.replaceChildren();
  }
  window.addEventListener('pagehide',dispose,{once:true});
  return {setFiles,dispose};
}
