// All image operations use the browser Canvas API without uploading the file.
const supported=['image/jpeg','image/png','image/webp'];
const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const number=(v,label,min,max)=>{
  const n=Number(v);
  if(!Number.isInteger(n)||n<min||n>max)throw new Error(label+' must be between '+min+' and '+max+'.');
  return n;
};
export async function getImageSize(file) {
  const image=await createImageBitmap(file);
  try{return {width:image.width,height:image.height};}
  finally{image.close();}
}
export async function processImage(id,file,values) {
  if(!file||!supported.includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  const bmp=await createImageBitmap(file);
  try {
    let x=0,y=0,sourceWidth=bmp.width,sourceHeight=bmp.height;
    let w=bmp.width,h=bmp.height;
    let mime=values.format==='original'||!values.format?file.type:values.format;
    if(!supported.includes(mime))throw new Error('Unsupported output format.');
    if(id==='resize-image') {
      w=number(values.width,'Width',1,12000);h=number(values.height,'Height',1,12000);
      if(values.keepRatio) h=Math.max(1,Math.round(bmp.height*w/bmp.width));
    } else if(id==='crop-image') {
      x=number(values.x,'Left',0,12000);y=number(values.y,'Top',0,12000);
      sourceWidth=number(values.width,'Crop width',1,12000);
      sourceHeight=number(values.height,'Crop height',1,12000);
      if(x+sourceWidth>bmp.width||y+sourceHeight>bmp.height)throw new Error('The crop must fit within the original image.');
      w=sourceWidth;h=sourceHeight;
    } else if(!['compress-image','convert-image'].includes(id)) {
      throw new Error('This image tool is not available.');
    }
    if(w*h>50000000)throw new Error('This operation would create an image larger than 50 million pixels and could exhaust your device memory.');
    const canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:mime!=='image/jpeg'});
    if(!ctx)throw new Error('Canvas is not available.');
    if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp,x,y,sourceWidth,sourceHeight,0,0,w,h);
    const quality=Number(values.quality??90)/100;
    if(!Number.isFinite(quality)||quality<.2||quality>1)throw new Error('Quality must be from 20 to 100%.');
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>{
      if(!b||b.type!==mime)reject(new Error('This browser cannot export the selected image format.'));
      else resolve(b);
    },mime,mime==='image/png'?undefined:quality));
    const clean=file.name.replace(/\.[^.]+$/,'').replace(/[^\w -]+/g,'').trim()||'image';
    return {blob,name:clean+'-'+id+'.'+extensions[mime]};
  } finally {bmp.close();}
}
