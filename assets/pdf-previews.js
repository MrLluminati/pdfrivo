import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { previewSelectedPages, togglePreviewPage } from './preview-selection.mjs';

GlobalWorkerOptions.workerSrc = workerURL;

// Previews are optional: oversized or unsupported files can still be sent
// through the original tool processor without changing its behavior.
const MAX_FILE = 50 * 1024 * 1024;
const MAX_TILES = 80;
const MAX_MERGE_PER_FILE = 24;

export function createPdfPreviews(toolId, root) {
  if (!root) return { setFiles() {}, dispose() {} };
  const grid = root.querySelector('#pdf-preview-grid');
  const status = root.querySelector('#pdf-preview-status');
  const summary = root.querySelector('#pdf-preview-summary');
  const selectAll = root.querySelector('#pdf-preview-select-all');
  const fieldId = toolId === 'rotate-pdf' ? 'pages' : 'ranges';
  const field = toolId === 'merge-pdf' ? null : document.querySelector('#field-' + fieldId);

  let disposed = false, generation = 0, observer = null, inFlight = 0;
  let pageCount = 0, tiles = [], jobs = [];
  const documentCache = new Map();

  const isStale = token => disposed || token !== generation;

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
    status.hidden = !message;
  }
  function cleanupRemoved(files) {
    const kept = new Set(files);
    for (const [file, promise] of documentCache) {
      if (kept.has(file)) continue;
      documentCache.delete(file);
      Promise.resolve(promise).then(pdf => pdf.destroy()).catch(() => {});
    }
  }
  async function getPdf(file) {
    if (!documentCache.has(file)) {
      const promise = file.arrayBuffer().then(bytes => getDocument({
        data: new Uint8Array(bytes),
        isEvalSupported: false
      }).promise);
      documentCache.set(file, promise);
      promise.catch(() => {
        if (documentCache.get(file) === promise) documentCache.delete(file);
      });
    }
    return documentCache.get(file);
  }

  function getSelected() {
    if (!field || pageCount < 1) return new Set();
    try { return new Set(previewSelectedPages(field.value, pageCount)); }
    catch { return new Set(); }
  }
  function syncSelection() {
    if (!field) return;
    const selected = getSelected();
    const angle = toolId === 'rotate-pdf' ? Number(document.querySelector('#field-angle')?.value || 90) : 0;
    for (const {element, index} of tiles) {
      const targeted = selected.has(index);
      element.classList.toggle('is-targeted', targeted);
      element.setAttribute('aria-pressed', String(targeted));
      const canvas = element.querySelector('canvas');
      if (canvas && toolId === 'rotate-pdf') {
        const scaled = angle === 90 || angle === 270 ? ' scale(.68)' : '';
        canvas.style.transform = targeted ? 'rotate(' + angle + 'deg)' + scaled : '';
      }
    }
    if (pageCount > 0) {
      summary.textContent = selected.size + ' of ' + pageCount + ' pages selected. ' +
        (toolId === 'split-pdf' ? 'Each clicked page becomes a separate PDF. You can also type grouped ranges below.' :
          toolId === 'delete-pdf-pages' ? 'Selected pages will be removed.' : 'Selected pages will be rotated.');
    }
  }
  function queueTile(job) {
    jobs.push(job);
    pump();
  }
  function pump() {
    while (inFlight < 2 && jobs.length) {
      const job = jobs.shift();
      if (isStale(job.token)) continue;
      inFlight++;
      (async () => {
        let page, canvas;
        try {
          page = await job.pdf.getPage(job.pageNumber);
          if (isStale(job.token)) return;
          const normal = page.getViewport({ scale: 1 });
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.7);
          const scale = Math.min(146 / normal.width, 175 / normal.height) * pixelRatio;
          const viewport = page.getViewport({ scale });
          canvas = job.element.querySelector('canvas');
          if (!canvas) return;
          canvas.width = Math.max(1, Math.ceil(viewport.width));
          canvas.height = Math.max(1, Math.ceil(viewport.height));
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) throw new Error('Canvas is not supported.');
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (!isStale(job.token)) {
            canvas.hidden = false;
            job.element.querySelector('.pdf-preview-loading').hidden = true;
            syncSelection();
          }
        } catch {
          if (!isStale(job.token)) {
            const placeholder = job.element.querySelector('.pdf-preview-loading');
            if (placeholder) placeholder.textContent = 'Preview unavailable';
          }
        } finally {
          try { page?.cleanup(); } catch { /* ignore preview cleanup errors */ }
          inFlight--;
          pump();
        }
      })();
    }
  }
  function activateObserver() {
    observer?.disconnect();
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const item = entry.target._previewJob;
          if (item) queueTile(item);
          observer.unobserve(entry.target);
        }
      }, { rootMargin: '300px' });
      grid.querySelectorAll('.pdf-page-thumbnail').forEach(el => observer.observe(el));
    } else {
      grid.querySelectorAll('.pdf-page-thumbnail').forEach(el => {
        if (el._previewJob) queueTile(el._previewJob);
      });
    }
  }
  function createTile(pdf, pageIndex, token, label, selectable) {
    const element = document.createElement(selectable ? 'button' : 'div');
    element.className = 'pdf-page-thumbnail';
    if (selectable) element.type = 'button';
    element.setAttribute('aria-label', selectable
      ? 'Select page ' + (pageIndex + 1) + ' for ' + label
      : 'Page ' + (pageIndex + 1) + ' of ' + label);
    const frame = document.createElement('span');
    frame.className = 'pdf-page-frame';
    const canvas = document.createElement('canvas');
    canvas.hidden = true;
    const loading = document.createElement('span');
    loading.className = 'pdf-preview-loading';
    loading.textContent = 'Rendering…';
    frame.append(canvas, loading);
    const caption = document.createElement('span');
    caption.className = 'pdf-preview-page-label';
    caption.textContent = 'Page ' + (pageIndex + 1);
    element.append(frame, caption);
    element._previewJob = { pdf, pageNumber: pageIndex + 1, token, element };
    if (selectable) {
      element.addEventListener('click', () => {
        if (disposed || pageCount < 1 || !field) return;
        try {
          field.value = togglePreviewPage(field.value, pageCount, pageIndex);
          field.dispatchEvent(new Event('input', { bubbles:true }));
          syncSelection();
        } catch (error) {
          setStatus(error.message || 'Invalid page selection.', true);
        }
      });
      tiles.push({element, index:pageIndex});
    }
    return element;
  }
  function createSection(file, pdf, showCount, token) {
    const section = document.createElement('section');
    section.className = 'pdf-preview-file';
    const heading = document.createElement('div');
    heading.className = 'pdf-preview-file-head';
    const name = document.createElement('strong');
    name.textContent = file.name;
    const meta = document.createElement('span');
    meta.textContent = pdf.numPages + ' page' + (pdf.numPages === 1 ? '' : 's');
    heading.append(name, meta);
    const strip = document.createElement('div');
    strip.className = 'pdf-preview-strip';
    for (let i=0;i<showCount;i++) {
      strip.append(createTile(pdf,i,token,file.name,Boolean(field)));
    }
    section.append(heading,strip);
    if (showCount < pdf.numPages) {
      const note = document.createElement('p');
      note.className = 'pdf-preview-note';
      note.textContent = 'Showing first ' + showCount + ' of ' + pdf.numPages + ' pages. You can enter other page numbers in the options field.';
      section.append(note);
    }
    return section;
  }

  async function setFiles(files) {
    if (disposed) return;
    const token = ++generation;
    observer?.disconnect();
    jobs = [];
    tiles = [];
    pageCount = 0;
    grid.replaceChildren();
    root.classList.toggle('hidden', files.length === 0);
    if (!files.length) { setStatus(''); summary.textContent = ''; cleanupRemoved(files); return; }
    setStatus('Preparing local PDF previews…');
    summary.textContent = 'Files are processed on your device.';
    cleanupRemoved(files);
    let totalTiles = 0, warnings = [], totalPages = 0;
    for (const file of files) {
      if (isStale(token)) return;
      if (file.size > MAX_FILE) {
        warnings.push(file.name + ': preview skipped (over 50 MB). Processing is still available.');
        continue;
      }
      try {
        const pdf = await getPdf(file);
        if (isStale(token)) return;
        totalPages += pdf.numPages;
        if (pdf.numPages < 1) throw new Error('No pages found.');
        const allowed = Math.max(0, MAX_TILES - totalTiles);
        const limit = Math.min(pdf.numPages,toolId==='merge-pdf'?MAX_MERGE_PER_FILE:MAX_TILES, allowed);
        if (limit) {
          grid.append(createSection(file, pdf, limit, token));
          totalTiles += limit;
        } else {
          warnings.push('Some pages are not previewed because the 80-thumbnail preview limit was reached.');
        }
        if (field) pageCount = pdf.numPages;
      } catch {
        if (isStale(token)) return;
        warnings.push(file.name + ': could not display a preview. Try processing or choose another PDF.');
      }
    }
    if (isStale(token)) return;
    if (field && pageCount) syncSelection();
    else summary.textContent = totalPages + ' pages across ' + files.length + ' file' + (files.length===1?'':'s') + '. Files merge in the order shown above.';
    setStatus(warnings.join(' '),Boolean(warnings.length));
    if (toolId !== 'merge-pdf') selectAll.hidden = !pageCount;
    activateObserver();
  }

  if (field) field.addEventListener('input', syncSelection);
  if (field && toolId==='rotate-pdf') document.querySelector('#field-angle')?.addEventListener('change',syncSelection);
  if (selectAll) {
    selectAll.hidden = toolId === 'merge-pdf' || toolId === 'delete-pdf-pages';
    selectAll.addEventListener('click', () => {
      if (!field || !pageCount) return;
      field.value = 'all';
      field.dispatchEvent(new Event('input', { bubbles:true }));
      syncSelection();
    });
  }
  function dispose() {
    disposed = true;
    generation++;
    observer?.disconnect();
    jobs = [];
    for (const promise of documentCache.values()) {
      Promise.resolve(promise).then(pdf=>pdf.destroy()).catch(()=>{});
    }
    documentCache.clear();
  }
  window.addEventListener('pagehide',dispose,{once:true});
  return {setFiles,dispose};
}
