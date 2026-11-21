import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { processImage, getImageSize } from '../assets/images.js';

const originalBitmap=globalThis.createImageBitmap;
const originalDocument=globalThis.document;
let mockCanvas, drawArguments;

before(()=>{
  globalThis.createImageBitmap=async()=>({width:1000,height:500,close(){}});
  globalThis.document={
    createElement(tag) {
      assert.equal(tag,'canvas');
      mockCanvas={
        width:0,height:0,
        getContext() {return {
          fillRect(){},set fillStyle(value){},set imageSmoothingEnabled(value){},set imageSmoothingQuality(value){},
          drawImage(...args){drawArguments=args;}
        };},
        toBlob(callback,mime) {callback(new Blob(['output-data'],{type:mime}));}
      };
      return mockCanvas;
    }
  };
});
after(()=>{
  if(originalBitmap===undefined)delete globalThis.createImageBitmap;
  else globalThis.createImageBitmap=originalBitmap;
  if(originalDocument===undefined)delete globalThis.document;
  else globalThis.document=originalDocument;
});
function fakeImage(type='image/png') {
  const f=new Blob(['source'],{type});
  Object.defineProperty(f,'name',{value:'example.png'});
  return f;
}

test('image dimensions can be read without uploading',async()=>{
  assert.deepEqual(await getImageSize(fakeImage()),{width:1000,height:500});
});
test('resize preserves aspect ratio',async()=>{
  const result=await processImage('resize-image',fakeImage(),{width:400,height:700,keepRatio:true,format:'image/png'});
  assert.equal(mockCanvas.width,400);
  assert.equal(mockCanvas.height,200);
  assert.equal(result.blob.type,'image/png');
});
test('resize permits explicit width and height when unlocked',async()=>{
  await processImage('resize-image',fakeImage(),{width:300,height:300,keepRatio:false,format:'image/jpeg'});
  assert.deepEqual([mockCanvas.width,mockCanvas.height],[300,300]);
});
test('crop uses selected source region',async()=>{
  const out=await processImage('crop-image',fakeImage(),{x:30,y:20,width:200,height:100});
  assert.deepEqual(drawArguments.slice(1),[30,20,200,100,0,0,200,100]);
  assert.equal(out.blob.type,'image/png');
});
test('crop rejects out-of-bounds rectangle',async()=>{
  await assert.rejects(processImage('crop-image',fakeImage(),{x:980,y:0,width:40,height:100}),/fit within/);
});
test('image conversion outputs requested format',async()=>{
  const out=await processImage('convert-image',fakeImage(),{format:'image/webp',quality:90});
  assert.match(out.name,/\.webp$/);
  assert.equal(out.blob.type,'image/webp');
});
test('image compression rejects unsupported quality',async()=>{
  await assert.rejects(processImage('compress-image',fakeImage(),{format:'image/webp',quality:1}),/Quality must/);
});
test('large output is rejected',async()=>{
  await assert.rejects(processImage('resize-image',fakeImage(),{width:8000,height:8000,keepRatio:false,format:'image/png'}),/50 million pixels/);
});
