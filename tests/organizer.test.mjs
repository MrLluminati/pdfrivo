import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
import { createOrganizedPdf } from '../assets/pdf-organizer.mjs';

async function source(id, widths, rotation=0) {
  const pdf=await PDFDocument.create();
  for (const width of widths) {
    const page=pdf.addPage([width,400]);
    if(rotation) page.setRotation(degrees(rotation));
    page.drawText('page-'+width);
  }
  const bytes=await pdf.save();
  return { id, name:id+'.pdf', bytes:bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength) };
}
const page=(sourceId,pageIndex,rotation=0)=>({sourceId,pageIndex,rotation});

test('organizer merges and reorders pages across source documents',async()=>{
  const a=await source('a',[210,220]);
  const b=await source('b',[330]);
  const output=await PDFDocument.load(await createOrganizedPdf([a,b],[page('b',0),page('a',1),page('a',0)]));
  assert.deepEqual(output.getPages().map(p=>p.getWidth()),[330,220,210]);
});
test('organizer rotates one page without rotating other pages',async()=>{
  const a=await source('a',[200,220]);
  const result=await PDFDocument.load(await createOrganizedPdf([a],[page('a',0,90),page('a',1,0)]));
  assert.deepEqual(result.getPages().map(p=>p.getRotation().angle),[90,0]);
});
test('organizer preserves and combines original page rotation',async()=>{
  const a=await source('a',[210],90);
  const result=await PDFDocument.load(await createOrganizedPdf([a],[page('a',0,270)]));
  assert.equal(result.getPages()[0].getRotation().angle,0);
});
test('organizer exports only chosen pages in displayed order',async()=>{
  const a=await source('a',[200,210,220]);
  const result=await PDFDocument.load(await createOrganizedPdf([a],[page('a',2),page('a',0)]));
  assert.deepEqual(result.getPages().map(p=>p.getWidth()),[220,200]);
});
test('organizer rejects empty output',async()=>{
  await assert.rejects(createOrganizedPdf([],[]),/at least one page/);
});
test('organizer rejects unsupported rotation and bad page index',async()=>{
  const a=await source('a',[200]);
  await assert.rejects(createOrganizedPdf([a],[page('a',0,33)]),/multiples of 90/);
  await assert.rejects(createOrganizedPdf([a],[page('a',2)]),/page reference/);
});
test('organizer rejects missing source',async()=>{
  await assert.rejects(createOrganizedPdf([], [page('missing',0)]),/source PDF is missing/);
});
