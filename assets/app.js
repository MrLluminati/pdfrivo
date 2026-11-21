import { TOOLS, TOOL_MAP } from './catalog.js';
import { processPdf } from './pdf.js';
import { processImage, getImageSize } from './images.js';
import './style.css';

const app=document.querySelector('#app');
const page=document.body.dataset.page||'home';
const path=id=>'/tools/'+id+'/';
const icon=(name)=>({layers:'▣',scissors:'✂',rotate:'↻',trash:'⌫',hash:'#',stamp:'◈','file-plus':'▤',maximize:'⤢',minimize:'◩',refresh:'⇄',crop:'⌗',organize:'▦'}[name]||'◇');
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filesize=bytes=>bytes<1024*1024?(bytes/1024).toFixed(1)+' KB':(bytes/1048576).toFixed(2)+' MB';

function frame(content) {
  app.innerHTML='<a class="skip" href="#main">Skip to content</a>'+
    '<header class="site-header"><div class="container header-inner">'+
    '<a class="brand" href="/" aria-label="PDFRivo home"><span class="brand-icon">P</span><span>PDF<span class="brand-accent">Rivo</span></span></a>'+
    '<nav class="nav" aria-label="Main navigation"><a href="/tools/organize-pdf/">PDF Organizer</a><a href="/#pdf-tools">PDF Tools</a><a href="/#image-tools">Image Tools</a><a href="/#why-pdfrivo">Why PDFRivo</a></nav>'+
    '<span class="privacy-pill">● Files stay on your device</span></div></header>'+
    '<main id="main">'+content+'</main>'+
    '<footer class="footer"><div class="container footer-inner"><div><b>PDFRivo</b><p>Free PDF, image & online tools. Built for practical everyday work.</p></div>'+
    '<div class="footer-links"><a href="/privacy/">Privacy</a><a href="https://github.com/MrLluminati/pdfrivo" target="_blank" rel="noopener noreferrer">GitHub</a></div></div></footer>';
}
function card(tool) {
  return '<a class="tool-card" href="'+path(tool.id)+'"><span class="tool-symbol '+(tool.category==='Image tools'?'purple':'')+'">'+icon(tool.icon)+'</span>'+
  '<span class="tool-meta">'+escapeHTML(tool.category)+(tool.featured?' · Featured':tool.popular?' · Popular':'')+'</span><strong>'+escapeHTML(tool.name)+'</strong>'+
  '<p>'+escapeHTML(tool.description)+'</p><span class="card-arrow" aria-hidden="true">↗</span></a>';
}
function home() {
  frame('<section class="hero"><div class="container">'+
    '<div class="eyebrow">Free PDF & image tools · No sign-up</div>'+
    '<h1>Make files easier.<br><span>Get more done.</span></h1>'+
    '<p>Merge, split, organize, resize and convert files in seconds. No account, no watermarks, and supported files are processed in your browser.</p>'+
    '<label class="visually-hidden" for="tool-search">Search available tools</label>'+
    '<div class="search-box"><span aria-hidden="true">⌕</span><input id="tool-search" type="search" placeholder="Search tools (e.g. merge PDF, resize image)…" autocomplete="off"><span class="search-help">Search tools</span></div>'+
    '<div class="hero-actions"><a href="/tools/organize-pdf/" class="button primary">Open PDF Organizer ↗</a><span>Arrange, rotate and remove pages with thumbnails</span></div>'+
    '<div class="hero-trust"><span>✓ Free to use</span><span>✓ No watermarks</span><span>✓ Local file processing</span></div></div></section>'+
    '<section class="container tools-section" id="tools"><div class="section-header"><div><h2>All the tools you need</h2><p>Choose a tool below and work directly in your browser.</p></div><span class="tool-count" id="tool-count">'+TOOLS.length+' tools</span></div>'+
    '<div class="filter-group" role="group" aria-label="Filter tools"><button class="filter active" data-filter="all" type="button">All tools</button><button class="filter" data-filter="PDF tools" type="button">PDF tools</button><button class="filter" data-filter="Image tools" type="button">Image tools</button></div>'+
    '<div class="tool-grid" id="tool-grid">'+TOOLS.map(card).join('')+'</div><p id="no-results" class="empty hidden">No matching tool found. Try a different search.</p></section>'+
    '<section class="container benefits" id="why-pdfrivo"><div class="section-header"><div><h2>Simple, fast and privacy-first</h2><p>Designed around what matters when you work with files.</p></div></div>'+
    '<div class="benefit-grid"><article><div class="benefit-icon">🔒</div><h3>Private by design</h3><p>Supported operations happen in your browser. The files you select are not uploaded to PDFRivo for processing.</p></article>'+
    '<article><div class="benefit-icon">⚡</div><h3>No unnecessary steps</h3><p>Open a tool, choose your files, make a change and download the result. No account required.</p></article>'+
    '<article><div class="benefit-icon">♾</div><h3>No artificial daily quotas</h3><p>Use the available tools freely. Very large files can still be limited by your device and browser memory.</p></article></div></section>'+
    '<section class="container note-banner"><div><h2>We’re building PDFRivo in public.</h2><p>More PDF, image and online utilities are planned. See the roadmap and contribute feedback on GitHub.</p></div><a class="button secondary" href="https://github.com/MrLluminati/pdfrivo" target="_blank" rel="noopener noreferrer">View the project ↗</a></section>');
  let filter='all';
  const search=document.querySelector('#tool-search');
  function update() {
    const query=search.value.trim().toLowerCase();
    const shown=TOOLS.filter(t=>(filter==='all'||t.category===filter)&&(t.name+' '+t.description+' '+t.category).toLowerCase().includes(query));
    document.querySelector('#tool-grid').innerHTML=shown.map(card).join('');
    document.querySelector('#tool-count').textContent=shown.length+' tool'+(shown.length===1?'':'s');
    document.querySelector('#no-results').classList.toggle('hidden',shown.length!==0);
  }
  // Main navigation targets category filters, rather than nonexistent anchor elements.
  function syncCategoryFromHash() {
    const category=location.hash==='#pdf-tools'?'PDF tools':location.hash==='#image-tools'?'Image tools':null;
    if(!category) return;
    filter=category;
    search.value='';
    document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===category));
    update();
    requestAnimationFrame(()=>document.querySelector('#tools').scrollIntoView({block:'start'}));
  }
  window.addEventListener('hashchange',syncCategoryFromHash);
  syncCategoryFromHash();
  search.addEventListener('input',update);
  document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{
    filter=btn.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===btn));
    update();
  }));
}
function renderField(field) {
  const id='field-'+field.id;
  if(field.kind==='checkbox') return '<div class="field checkbox-field"><label for="'+id+'"><input id="'+id+'" name="'+field.id+'" type="checkbox" '+(field.value?'checked':'')+'> '+escapeHTML(field.label)+'</label></div>';
  const control=field.kind==='select'
    ? '<select id="'+id+'" name="'+field.id+'">'+field.options.map(o=>'<option value="'+escapeHTML(o[0])+'" '+(o[0]===field.value?'selected':'')+'>'+escapeHTML(o[1])+'</option>').join('')+'</select>'
    : '<input id="'+id+'" name="'+field.id+'" type="'+(field.kind==='number'?'number':'text')+'" value="'+escapeHTML(field.value)+'"'+(field.min!==undefined?' min="'+field.min+'"':'')+(field.max!==undefined?' max="'+field.max+'"':'')+(field.kind==='number'?' step="1"':'')+'>';
  return '<div class="field"><label for="'+id+'">'+escapeHTML(field.label)+'</label>'+control+(field.hint?'<small>'+escapeHTML(field.hint)+'</small>':'')+'</div>';
}
function toolPage(tool) {
  frame('<div class="container tool-page"><div class="breadcrumb"><a href="/">Home</a> / <a href="/#'+(tool.category==='PDF tools'?'pdf-tools':'image-tools')+'">'+escapeHTML(tool.category)+'</a> / '+escapeHTML(tool.name)+'</div>'+
    '<div class="tool-heading"><span class="tool-symbol large '+(tool.category==='Image tools'?'purple':'')+'">'+icon(tool.icon)+'</span><div><h1>'+escapeHTML(tool.name)+'</h1><p>'+escapeHTML(tool.description)+'</p></div></div>'+
    '<div class="work-grid"><section class="workspace" aria-label="File processing workspace">'+
    (['merge-pdf','split-pdf','rotate-pdf','delete-pdf-pages'].includes(tool.id) ?
      '<div class="visual-shortcut"><span>▦</span><div><strong>Want to organize PDF pages?</strong><p>See page thumbnails and rearrange, rotate or remove pages.</p></div><a href="/tools/organize-pdf/">Open PDF Organizer ↗</a></div>' : '')+
    '<div class="workspace-title"><h2>Upload your '+(tool.category==='PDF tools'&&tool.id!=='images-to-pdf'?'PDF':'file')+(tool.multi?'s':'')+'</h2><span class="local-badge">✓ Processed locally</span></div>'+
    '<input id="files" class="visually-hidden" type="file" accept="'+escapeHTML(tool.accept)+'" '+(tool.multi?'multiple':'')+'>'+
    '<div class="dropzone" role="button" tabindex="0" aria-label="Choose files or drag and drop"><span class="upload-mark">⇧</span><strong>Drop '+(tool.multi?'files':'a file')+' here</strong><p>or click to browse your device</p><span class="fake-button">Choose file'+(tool.multi?'s':'')+'</span></div>'+
    '<div class="picked hidden" id="picked"><div class="picked-title"><strong>Selected files</strong><button class="text-button" id="clear-files" type="button">Clear all</button></div><div id="file-list"></div></div>'+
    (['merge-pdf','split-pdf','rotate-pdf','delete-pdf-pages'].includes(tool.id)?
      '<section class="pdf-inline-preview hidden" id="pdf-preview" aria-label="PDF page thumbnails">'+
      '<div class="pdf-preview-heading"><div><h3>Page previews</h3><p id="pdf-preview-summary">Loading page thumbnails locally…</p></div>'+
      '<button type="button" id="pdf-preview-select-all" class="pdf-preview-all" hidden>All pages</button></div>'+
      '<p id="pdf-preview-status" class="pdf-preview-status" role="status" aria-live="polite" hidden></p>'+
      '<div id="pdf-preview-grid" class="pdf-preview-grid"></div>'+
      '<p class="pdf-preview-tip">'+(tool.id==='merge-pdf'?
        'Files merge in the order listed above. Use ↑ and ↓ next to each file to change the order. For page-level reordering, use PDF Organizer.':
        tool.id==='split-pdf'?'Click thumbnails to choose pages to extract; each selected page becomes its own file. Use the page groups field below for grouped PDFs.':
        tool.id==='delete-pdf-pages'?'Click thumbnails to mark pages for deletion. The original PDF is not changed.':
        'Click thumbnails to choose pages to rotate. Use All pages to rotate the entire PDF.')+'</p></section>' : '')+
    (tool.fields.length?'<h3 class="form-title">Options</h3><div class="fields">'+tool.fields.map(renderField).join('')+'</div>':'')+
    (['number-pdf','watermark-pdf','images-to-pdf'].includes(tool.id)?
      '<section class="pdf-output-preview hidden" id="pdf-output-preview" aria-label="PDF output preview">'+
      '<div class="pdf-output-heading"><div><h3>Preview your PDF</h3><p id="pdf-output-summary">Generating local page previews…</p></div>'+
      '<button class="pdf-output-refresh" type="button" id="pdf-output-refresh">↻ Refresh preview</button></div>'+
      '<p class="pdf-output-status" id="pdf-output-status" role="status" aria-live="polite" hidden></p>'+
      '<div class="pdf-output-grid" id="pdf-output-grid"></div>'+
      '<p class="pdf-output-note">'+(tool.id==='images-to-pdf'
        ? 'The previews reflect image order, paper size and margins. Use the arrows beside your uploaded files to rearrange pages.'
        : tool.id==='number-pdf'
          ? 'The preview shows the resulting page numbers and their actual placement. Adjust the starting number or font size above.'
          : 'The preview reflects the watermark text and opacity. Adjust the values above to see the updated PDF.')+
      '</p></section>' : '')+
    '<div class="process-row"><button type="button" class="button primary" id="process">Process '+escapeHTML(tool.name)+' →</button><span>Nothing is uploaded to PDFRivo.</span></div>'+
    '<div class="result hidden" id="result" role="status" aria-live="polite"></div></section>'+
    '<aside class="right-panel"><div class="side-card"><h3>How it works</h3><ol><li>Choose '+(tool.multi?'your files':'a file')+' from your device.</li><li>Adjust the available options.</li><li>Process locally and download the result.</li></ol></div>'+
    '<div class="side-card privacy-side"><h3>🔒 Your privacy matters</h3><p>For this tool, processing takes place in the browser. Your document contents are not sent to a processing server.</p></div></aside></div>'+
    '<article class="tool-info"><h2>About '+escapeHTML(tool.name)+'</h2><p>'+escapeHTML(tool.description)+' PDFRivo operates this tool entirely in your browser, so it can be used without creating an account.</p>'+
    '<h3>What should I know?</h3><p>Results depend on the original file and your device’s capabilities. For important documents, review the downloaded output before sharing or submitting it. Password-protected, malformed and very large files may not work.</p>'+
    '<h3>Is it free?</h3><p>Yes. This tool is available without registration, a watermark or a daily quota. Browser and device memory limitations may still apply.</p></article></div>');
  const input=document.querySelector('#files'),zone=document.querySelector('.dropzone'),list=document.querySelector('#file-list'),
        picked=document.querySelector('#picked'),result=document.querySelector('#result'),button=document.querySelector('#process');
  let selected=[], currentURL=null, sequence=0, imageDimensions=null, pdfPreviews=null, pdfOutputPreviews=null;
  const alert=(message,error=false)=>{
    result.className='result '+(error?'error':'info');
    result.textContent=message;
  };
  function clearResult(){if(currentURL){URL.revokeObjectURL(currentURL);currentURL=null;}result.className='result hidden';result.textContent='';}
  function refresh(){
    picked.classList.toggle('hidden',selected.length===0);
    list.textContent='';
    selected.forEach((file,index)=>{
      const row=document.createElement('div');row.className='file-row';
      const marker=document.createElement('span');marker.className='file-type';marker.textContent=tool.category==='Image tools'||tool.id==='images-to-pdf'?'IMG':'PDF';
      const info=document.createElement('div');info.className='file-info';
      const title=document.createElement('strong');title.textContent=file.name;
      const meta=document.createElement('span');meta.textContent=filesize(file.size);
      info.append(title,meta);
      const actions=document.createElement('div');actions.className='file-actions';
      if(tool.multi&&selected.length>1){
        for(const [label,delta] of [['Move up',-1],['Move down',1]]){
          const b=document.createElement('button');b.type='button';b.className='small-action';b.textContent=delta<0?'↑':'↓';b.setAttribute('aria-label',label+' '+file.name);b.disabled=index+delta<0||index+delta>=selected.length;
          b.addEventListener('click',()=>{const other=index+delta;[selected[index],selected[other]]=[selected[other],selected[index]];clearResult();refresh();});actions.append(b);
        }
      }
      const remove=document.createElement('button');remove.type='button';remove.className='small-action';remove.textContent='×';remove.setAttribute('aria-label','Remove '+file.name);
      remove.addEventListener('click',()=>{selected.splice(index,1);clearResult();refresh();});
      actions.append(remove);row.append(marker,info,actions);list.append(row);
    });
    if(pdfPreviews)pdfPreviews.setFiles(selected);
    if(pdfOutputPreviews)pdfOutputPreviews.setFiles(selected);
  }
  async function addFiles(items){
    const extensionOK=file=>tool.category==='PDF tools'&&tool.id!=='images-to-pdf'?(/\.pdf$/i.test(file.name)||file.type==='application/pdf'):['image/jpeg','image/png','image/webp'].includes(file.type);
    const valid=Array.from(items).filter(extensionOK);
    if(!valid.length){alert('Choose a supported file type for this tool.',true);return;}
    selected=tool.multi?selected.concat(valid):[valid[0]];
    clearResult();refresh();
    if(tool.id==='resize-image'||tool.id==='crop-image'){
      const token=++sequence, file=selected[0];
      try{
        const dims=await getImageSize(file);
        if(token!==sequence||selected[0]!==file)return;
        imageDimensions=dims;
        if(tool.id==='resize-image'){
          document.querySelector('#field-width').value=dims.width;
          document.querySelector('#field-height').value=dims.height;
        } else {
          document.querySelector('#field-x').value=0;document.querySelector('#field-y').value=0;
          document.querySelector('#field-width').value=dims.width;
          document.querySelector('#field-height').value=dims.height;
        }
      }catch{alert('The image could not be decoded.',true);}
    }
  }
  if(['merge-pdf','split-pdf','rotate-pdf','delete-pdf-pages'].includes(tool.id)){
    import('./pdf-previews.js').then(({createPdfPreviews})=>{
      pdfPreviews=createPdfPreviews(tool.id,document.getElementById('pdf-preview'));
      pdfPreviews.setFiles(selected);
    }).catch(()=>{
      const el=document.getElementById('pdf-preview');
      if(el){el.classList.remove('hidden');const status=el.querySelector('#pdf-preview-status');status.hidden=false;status.classList.add('error');status.textContent='Previews unavailable. The PDF tool can still process your files.';}
    });
  }
  if(['number-pdf','watermark-pdf','images-to-pdf'].includes(tool.id)){
    import('./pdf-output-previews.js').then(({createPdfOutputPreviews})=>{
      pdfOutputPreviews=createPdfOutputPreviews(tool.id,document.getElementById('pdf-output-preview'));
      pdfOutputPreviews.setFiles(selected);
    }).catch(()=>{
      const el=document.getElementById('pdf-output-preview');
      if(el){el.classList.remove('hidden');const status=el.querySelector('#pdf-output-status');status.hidden=false;status.classList.add('error');status.textContent='Preview unavailable. You can still process and download the PDF.';}
    });
  }
  zone.addEventListener('click',()=>input.click());
  zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}});
  input.addEventListener('change',()=>{addFiles(input.files);input.value='';});
  zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('over');});
  zone.addEventListener('dragleave',()=>zone.classList.remove('over'));
  zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('over');addFiles(e.dataTransfer.files);});
  document.querySelector('#clear-files').addEventListener('click',()=>{selected=[];sequence++;clearResult();refresh();});
  if(tool.id==='resize-image'){
    const width=document.querySelector('#field-width'),height=document.querySelector('#field-height'),keep=document.querySelector('#field-keepRatio');
    width.addEventListener('input',()=>{if(keep.checked&&imageDimensions)height.value=Math.max(1,Math.round(Number(width.value)*imageDimensions.height/imageDimensions.width));});
    height.addEventListener('input',()=>{if(keep.checked&&imageDimensions)width.value=Math.max(1,Math.round(Number(height.value)*imageDimensions.width/imageDimensions.height));});
  }
  button.addEventListener('click',async()=>{
    if(!selected.length){alert('Please choose '+(tool.multi?'files':'a file')+' first.',true);return;}
    clearResult();button.disabled=true;button.textContent='Processing locally…';
    try{
      const values=Object.fromEntries((tool.fields||[]).map(field=>{
        const control=document.querySelector('#field-'+field.id);
        return [field.id,field.kind==='checkbox'?control.checked:control.value];
      }));
      const output=tool.category==='PDF tools'
        ? await processPdf(tool.id,selected,values)
        : await processImage(tool.id,selected[0],values);
      currentURL=URL.createObjectURL(output.blob);
      result.className='result success';
      const heading=document.createElement('strong');heading.textContent='Your file is ready';
      const details=document.createElement('p');details.textContent=output.name+' · '+filesize(output.blob.size);
      const link=document.createElement('a');link.className='button primary download';link.href=currentURL;link.download=output.name;link.textContent='Download file ↓';
      result.append(heading,details);
      if(tool.category==='Image tools') {
        const before=selected[0].size;
        if(before>0) {
          const percent=Math.abs((1-output.blob.size/before)*100);
          const note=document.createElement('p');
          note.className='size-note';
          note.textContent=output.blob.size<=before
            ? percent.toFixed(1)+'% smaller than the original ('+filesize(before)+').'
            : percent.toFixed(1)+'% larger than the original ('+filesize(before)+'). Try another quality or format if you need a smaller file.';
          result.append(note);
        }
      }
      result.append(link);
    } catch(error) {alert(error instanceof Error?error.message:'The operation failed. Please try a different file.',true);}
    finally{button.disabled=false;button.textContent='Process '+tool.name+' →';}
  });
  window.addEventListener('pagehide',()=>{if(currentURL)URL.revokeObjectURL(currentURL);},{once:true});
}

function visualOrganizerPage() {
  frame('<section class="container organizer-page">'+
    '<div class="breadcrumb"><a href="/">Home</a> / <a href="/#pdf-tools">PDF tools</a> / PDF Organizer</div>'+
    '<div class="organizer-heading"><div class="tool-symbol large">▦</div><div class="organizer-title"><div class="eyebrow">PDF page editing · No account</div><h1>Organize your PDF pages</h1><p>Drag pages to reorder, rotate or remove individual pages, then export a clean PDF. Everything happens in your browser.</p></div></div>'+
    '<div class="organizer-workspace">'+
      '<div class="organizer-start"><div id="visual-dropzone" class="visual-dropzone" role="button" tabindex="0" aria-label="Choose PDF files or drop files here"><div class="visual-upload-illustration" aria-hidden="true"><span>▤</span><span>▤</span><span>▤</span></div><strong>Drop your PDF files here</strong><p>Or click this area to select PDFs. Add more files at any time.</p><span class="visual-pick">Choose PDF files</span><small>Files stay on your device · Up to 200 pages and 100 MB per workspace</small></div>'+
      '<input id="visual-file-input" class="visually-hidden" type="file" accept=".pdf,application/pdf" multiple>'+
      '<div class="organizer-status" id="organizer-status" role="status" aria-live="polite" hidden></div>'+
      '<div id="visual-source-list" class="source-list" aria-label="Source PDFs"></div>'+
      '<div class="visual-toolbar"><div class="visual-toolbar-heading"><strong>Your page workspace</strong><div class="visual-stat-pills"><span id="visual-files">0 PDFs</span><span id="visual-count">0 pages</span><span id="visual-selected">0 selected</span></div></div>'+
      '<div class="visual-actions">'+
      '<button type="button" id="visual-add" class="button secondary">+ Add PDFs</button>'+
      '<button type="button" id="visual-select-all" class="button secondary">Select all</button>'+
      '<button type="button" id="visual-clear-selection" class="button secondary">Deselect</button>'+
      '<button type="button" id="visual-rotate-selected" class="button secondary">↻ Rotate selected</button>'+
      '<button type="button" id="visual-delete-selected" class="button secondary">× Remove selected</button>'+
      '<button type="button" id="visual-reset" class="button secondary">Reset pages</button>'+
      '<button type="button" id="visual-clear-files" class="button secondary visual-danger">Clear workspace</button>'+
      '</div></div>'+
      '<div id="organizer-empty" class="visual-empty"><div class="empty-symbol">▦</div><strong>Your pages will appear here</strong><p>Upload a PDF above to see its individual pages as thumbnails. You can drag pages to move them or use the arrow buttons.</p></div>'+
      '<div id="organizer-loaded" hidden><div class="visual-tips"><span>⠿ Drag cards to reorder</span><span>○ Click a thumbnail to select</span><span>↻ Rotate · × Remove</span><span>← → Keyboard-friendly movement</span></div><div id="visual-grid" class="visual-grid" aria-label="PDF page thumbnails in export order"></div></div>'+
      '<div class="visual-export-bar"><div><strong>Ready to save?</strong><p>Export every remaining page, or only those you selected, in the order shown above.</p></div><div class="visual-export-actions"><button type="button" id="visual-export-selected" class="button secondary" disabled>Export selected pages</button><button type="button" id="visual-export" class="button primary" disabled>Download organized PDF</button></div></div>'+
      '<div id="organizer-result" class="visual-result" role="status" aria-live="polite" hidden></div>'+
    '</div>'+
    '<article class="tool-info visual-info"><h2>How to organize PDF pages</h2><p>Choose one or more PDF files. Each original page appears as a thumbnail, in the current output order. Drag a page to another position or use the left/right arrows for accessible rearrangement. Rotate individual pages with the rotate button, remove pages you do not need, and select pages to export a smaller document.</p><h3>Are my files uploaded?</h3><p>No. PDF Organizer uses PDF.js for local page previews and pdf-lib to build the final PDF inside your browser. The original files are not modified or transmitted to a PDF processing server.</p><h3>What are the limits?</h3><p>This workspace currently supports up to 200 pages, 50 MB per individual PDF and 100 MB of combined input, to reduce browser memory problems. Password-protected or damaged documents may not load. After export, verify page orientation, annotations, form fields and digital signatures in important documents; these features may not survive editing unchanged.</p></article>'+
  '</section>');
  import('./organizer.js').then(({initOrganizer})=>initOrganizer()).catch(error=>{
    const status=document.querySelector('#organizer-status');
    if(status){status.hidden=false;status.className='organizer-status error';status.textContent='PDF Organizer could not load. Please refresh the page or try an updated browser.';}
    console.error('PDFRivo organizer:',error);
  });
}

function privacy() {
  frame('<section class="container legal"><div class="eyebrow">Privacy</div><h1>Privacy & file processing</h1>'+
    '<p>PDFRivo is an early-stage browser-based toolkit. This page describes the current application, not any future advertising or server-processing service.</p>'+
    '<h2>Files you select</h2><p>For the tools currently provided, selected files are processed locally by JavaScript in your browser. PDFRivo does not intentionally upload the content of those files to a processing server.</p>'+
    '<h2>Website requests</h2><p>Your browser still requests website files from our hosting provider. Standard hosting records may include IP addresses and other connection information.</p>'+
    '<h2>Analytics and advertising</h2><p>This initial version does not embed advertising, analytics trackers or payment widgets. This policy must be reviewed and updated before any of those services are enabled.</p>'+
    '<h2>Limitations</h2><p>Browser and device security are outside our control. For sensitive documents, use a trusted device, keep software updated and verify generated files.</p>'+
    '<h2>Project feedback</h2><p>Visit our <a href="https://github.com/MrLluminati/pdfrivo" rel="noopener noreferrer">GitHub repository</a> for development and feedback.</p></section>');
}
if(page==='home')home();
else if(page==='organize-pdf')visualOrganizerPage();
else if(page==='privacy')privacy();
else if(TOOL_MAP[page])toolPage(TOOL_MAP[page]);
else frame('<section class="container legal"><h1>Tool not found</h1><p><a href="/">Return to all tools.</a></p></section>');
