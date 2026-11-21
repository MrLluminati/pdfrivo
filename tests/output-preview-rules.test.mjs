import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewEligibility, previewPageNumbers, PREVIEW_MAX_SOURCE_BYTES } from '../assets/output-preview-rules.mjs';

const f=size=>({size});
test('short PDFs are eligible for previews',()=>{
  assert.equal(previewEligibility([f(1024),f(2048)]).eligible,true);
});
test('preview is optional when source data is too large',()=>{
  const result=previewEligibility([f(PREVIEW_MAX_SOURCE_BYTES+1)]);
  assert.equal(result.eligible,false);
  assert.match(result.reason,/can still be processed/);
});
test('preview is optional for batches of over twenty files',()=>{
  assert.equal(previewEligibility(Array.from({length:21},()=>f(20))).eligible,false);
});
test('empty files do not trigger preview generation',()=>{
  assert.equal(previewEligibility([]).eligible,false);
});
test('preview page numbers are bounded and one-based',()=>{
  assert.deepEqual(previewPageNumbers(3),[1,2,3]);
  assert.deepEqual(previewPageNumbers(400),[1,2,3,4,5,6]);
});
test('invalid PDF page counts produce no preview cards',()=>{
  assert.deepEqual(previewPageNumbers(0),[]);
  assert.deepEqual(previewPageNumbers(Number.NaN),[]);
});
