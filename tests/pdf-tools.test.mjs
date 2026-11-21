import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { processPdf } from '../assets/pdf.js';

function namedFile(contents, name, mime = 'application/pdf') {
  const file = new Blob([contents], {type:mime});
  Object.defineProperty(file,'name',{value:name});
  return file;
}
async function fixture(pages=3,name='sample.pdf') {
  const doc=await PDFDocument.create();
  for (let i=0;i<pages;i++) {
    const page=doc.addPage([300+i*10,400+i*10]);
    page.drawText('Sample page '+(i+1));
  }
  return namedFile(await doc.save(),name);
}
async function readDoc(result) {
  assert.match(result.name,/\.pdf$/i);
  assert.ok(result.blob.size>0,'Should have non-empty PDF output');
  return PDFDocument.load(await result.blob.arrayBuffer());
}

test('merge combines PDF pages from two inputs',async()=>{
  const out=await processPdf('merge-pdf',[await fixture(2),await fixture(3,'another.pdf')],{});
  assert.equal((await readDoc(out)).getPageCount(),5);
});
test('merge rejects fewer than two files',async()=>{
  await assert.rejects(processPdf('merge-pdf',[await fixture(1)],{}),/at least two PDFs/);
});
test('split single page range yields standalone PDF',async()=>{
  const out=await processPdf('split-pdf',[await fixture(5)],{ranges:'2-4'});
  const doc=await readDoc(out);
  assert.equal(doc.getPageCount(),3);
});
test('split multiple page groups returns valid PDF files inside a ZIP',async()=>{
  const out=await processPdf('split-pdf',[await fixture(5)],{ranges:'1-2, 3-5'});
  assert.match(out.name,/\.zip$/);
  const zip=await JSZip.loadAsync(await out.blob.arrayBuffer());
  const paths=Object.keys(zip.files).filter(p=>!zip.files[p].dir).sort();
  assert.equal(paths.length,2);
  const counts=[];
  for(const path of paths) {
    const pdf=await PDFDocument.load(await zip.files[path].async('uint8array'));
    counts.push(pdf.getPageCount());
  }
  assert.deepEqual(counts,[2,3]);
});
test('invalid split range fails rather than making a corrupt download',async()=>{
  await assert.rejects(processPdf('split-pdf',[await fixture(3)],{ranges:'1-4'}),/range/i);
});
test('rotate updates page rotation while preserving page count',async()=>{
  const out=await processPdf('rotate-pdf',[await fixture(2)],{angle:'90'});
  const pdf=await readDoc(out);
  assert.deepEqual(pdf.getPages().map(p=>p.getRotation().angle),[90,90]);
});
test('delete pages keeps only selected pages',async()=>{
  const out=await processPdf('delete-pdf-pages',[await fixture(4)],{ranges:'2, 4'});
  assert.equal((await readDoc(out)).getPageCount(),2);
});
test('delete all pages is rejected',async()=>{
  await assert.rejects(processPdf('delete-pdf-pages',[await fixture(2)],{ranges:'1-2'}),/keep at least one page/);
});
test('add page numbers returns a valid, paginated PDF',async()=>{
  const out=await processPdf('number-pdf',[await fixture(3)],{start:'1',fontSize:'12'});
  assert.equal((await readDoc(out)).getPageCount(),3);
});
test('add page numbers rejects invalid size',async()=>{
  await assert.rejects(processPdf('number-pdf',[await fixture(1)],{start:'1',fontSize:'2'}),/Font size/);
});
test('add watermark returns a valid PDF and rejects unsupported glyphs',async()=>{
  const file=await fixture(2);
  const out=await processPdf('watermark-pdf',[file],{watermark:'CONFIDENTIAL',opacity:'25'});
  assert.equal((await readDoc(out)).getPageCount(),2);
  await assert.rejects(processPdf('watermark-pdf',[file],{watermark:'é',opacity:'20'}),/basic Latin/);
});
test('images to PDF embeds multiple PNGs as separate pages',async()=>{
  // A minimal transparent 1x1 PNG used only as an in-memory test fixture.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9NGdoAAAAASUVORK5CYII=','base64');
  const a=namedFile(png,'one.png','image/png');
  const b=namedFile(png,'two.png','image/png');
  const out=await processPdf('images-to-pdf',[a,b],{paper:'A4',margin:'10'});
  assert.equal((await readDoc(out)).getPageCount(),2);
});
test('damaged PDF fails with a useful error',async()=>{
  const bad=namedFile(new TextEncoder().encode('not a pdf'),'damaged.pdf');
  await assert.rejects(processPdf('rotate-pdf',[bad],{angle:'90'}),/encrypted, damaged, or unsupported/);
});
