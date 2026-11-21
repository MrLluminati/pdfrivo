import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewSelectedPages, togglePreviewPage } from '../assets/preview-selection.mjs';

test('all denotes every page in ascending order', () => {
  assert.deepEqual(previewSelectedPages('all', 4), [0,1,2,3]);
  assert.deepEqual(previewSelectedPages(' ALL ', 2), [0,1]);
});
test('manual page group input is represented in the preview', () => {
  assert.deepEqual(previewSelectedPages('3, 1-2', 5), [0,1,2]);
});
test('clicking while all selected starts specific selection', () => {
  assert.equal(togglePreviewPage('all', 5, 3), '4');
});
test('additional clicks toggle page selections in natural order', () => {
  assert.equal(togglePreviewPage('4', 5, 0), '1, 4');
  assert.equal(togglePreviewPage('1, 4', 5, 3), '1');
});
test('toggling the last selected page preserves at least one', () => {
  assert.equal(togglePreviewPage('2', 4, 1), '2');
});
test('invalid range and page number are rejected', () => {
  assert.throws(() => previewSelectedPages('8', 4), /between 1 and 4/);
  assert.throws(() => togglePreviewPage('all', 4, 7), /Invalid page index/);
});
test('empty document is rejected', () => {
  assert.throws(() => previewSelectedPages('all', 0), /no pages/);
});
