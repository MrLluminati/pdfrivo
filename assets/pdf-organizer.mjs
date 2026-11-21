import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Build an output PDF from an ordered list of page references.
 * All sources stay in browser memory. Each entry references one original page;
 * rotations are additional quarter-turns relative to its original rotation.
 */
export async function createOrganizedPdf(sources, pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('Keep at least one page to export.');
  }
  const index = new Map(sources.map(source => [source.id, source]));
  const loaded = new Map();
  const result = await PDFDocument.create();

  for (const item of pages) {
    const source = index.get(item.sourceId);
    if (!source || !(source.bytes instanceof ArrayBuffer || ArrayBuffer.isView(source.bytes))) {
      throw new Error('A source PDF is missing. Reload the files and try again.');
    }
    let document = loaded.get(item.sourceId);
    if (!document) {
      try { document = await PDFDocument.load(source.bytes); }
      catch { throw new Error('Could not read "' + source.name + '" for export.'); }
      loaded.set(item.sourceId, document);
    }
    if (!Number.isInteger(item.pageIndex) || item.pageIndex < 0 || item.pageIndex >= document.getPageCount()) {
      throw new Error('A page reference is invalid.');
    }
    if (!Number.isInteger(item.rotation) || item.rotation % 90 !== 0) {
      throw new Error('Page rotation must be in multiples of 90 degrees.');
    }
    const [copied] = await result.copyPages(document, [item.pageIndex]);
    const angle = ((copied.getRotation().angle + item.rotation) % 360 + 360) % 360;
    copied.setRotation(degrees(angle));
    result.addPage(copied);
  }
  return result.save();
}
