import { parseRanges } from './ranges.mjs';

/** All page indices in this module are zero-based; user-facing ranges are one-based. */
export function previewSelectedPages(text, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error('The PDF has no pages.');
  if (String(text).trim().toLowerCase() === 'all') {
    return Array.from({ length: count }, (_, index) => index);
  }
  return parseRanges(text, count).sort((a, b) => a - b);
}

/**
 * Clicking a page while the field is "all" starts a new selection with that
 * page. Subsequent clicks toggle individual pages. At least one remains.
 * This method intentionally flattens manual split groups into single-page
 * selections; the UI explains that existing groupings will be replaced.
 */
export function togglePreviewPage(text, count, index) {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error('Invalid page index.');
  }
  if (String(text).trim().toLowerCase() === 'all') return String(index + 1);
  const selected = new Set(previewSelectedPages(text, count));
  if (selected.has(index)) {
    if (selected.size > 1) selected.delete(index);
  } else {
    selected.add(index);
  }
  return [...selected].sort((a, b) => a - b).map(i => i + 1).join(', ');
}
