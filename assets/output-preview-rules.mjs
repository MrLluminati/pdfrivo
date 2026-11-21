/**
 * A preview is advisory, not a substitute for processing the original files.
 * Size limits prevent repeated PDF generation while users edit options.
 */
export const PREVIEW_MAX_SOURCE_BYTES = 24 * 1024 * 1024;
export const PREVIEW_MAX_FILES = 20;
export const PREVIEW_MAX_PAGES = 6;

export function previewEligibility(files) {
  if (!Array.isArray(files) || files.length === 0) return { eligible:false, reason:'No files selected.' };
  if (files.length > PREVIEW_MAX_FILES) return { eligible:false, reason:'Preview supports up to 20 input files. You can still process the complete selection.' };
  const size = files.reduce((n,f) => n+Number(f?.size ?? 0),0);
  if (!Number.isFinite(size) || size < 0) return { eligible:false, reason:'Could not determine the total file size.' };
  if (size > PREVIEW_MAX_SOURCE_BYTES) return { eligible:false, reason:'Preview is limited to 24 MB of source files. Your full file can still be processed.' };
  return { eligible:true, reason:'' };
}

export function previewPageNumbers(count) {
  if (!Number.isInteger(count) || count < 1) return [];
  return Array.from({length:Math.min(count,PREVIEW_MAX_PAGES)},(_,index)=>index+1);
}
