import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { parseRanges, parseGroups } from './ranges.mjs';

const pdfBlob = bytes => new Blob([bytes], {type:'application/pdf'});
const basename = name => name.replace(/\.pdf$/i, '').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-') || 'document';

async function loadPdf(file) {
  try {
    return await PDFDocument.load(await file.arrayBuffer());
  } catch {
    throw new Error('Could not open "' + file.name + '". The file may be encrypted, damaged, or unsupported.');
  }
}

function validNumber(value, min, max, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(label + ' must be between ' + min + ' and ' + max + '.');
  return n;
}

async function asPng(file) {
  const bmp = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width=bmp.width; canvas.height=bmp.height;
    const ctx=canvas.getContext('2d');
    if(!ctx) throw new Error('Canvas is unavailable.');
    ctx.drawImage(bmp,0,0);
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image conversion failed.')),'image/png'));
  } finally { bmp.close(); }
}

export async function processPdf(id, files, values) {
  if (!files.length) throw new Error('Select a file to continue.');
  const name=basename(files[0].name);
  if (id==='merge-pdf') {
    if(files.length<2) throw new Error('Select at least two PDFs to merge.');
    const out=await PDFDocument.create();
    for(const file of files) {
      const src=await loadPdf(file);
      const copies=await out.copyPages(src,src.getPageIndices());
      copies.forEach(page=>out.addPage(page));
    }
    return {blob:pdfBlob(await out.save()),name:'merged.pdf'};
  }
  if(id==='images-to-pdf') {
    const out=await PDFDocument.create();
    const paper=values.paper==='Letter'?[612,792]:[595.28,841.89];
    const margin=validNumber(values.margin,0,50,'Margin')*72/25.4;
    for(const file of files) {
      let image;
      if(file.type==='image/jpeg') image=await out.embedJpg(await file.arrayBuffer());
      else if(file.type==='image/png') image=await out.embedPng(await file.arrayBuffer());
      else if(file.type==='image/webp') image=await out.embedPng(await (await asPng(file)).arrayBuffer());
      else throw new Error('Unsupported image type: '+file.name);
      const landscape=image.width>image.height;
      const [w,h]=landscape?[paper[1],paper[0]]:paper;
      const scale=Math.min((w-2*margin)/image.width,(h-2*margin)/image.height);
      if(scale<=0) throw new Error('The page margins leave no room for the image.');
      const page=out.addPage([w,h]);
      const iw=image.width*scale, ih=image.height*scale;
      page.drawImage(image,{x:(w-iw)/2,y:(h-ih)/2,width:iw,height:ih});
    }
    return {blob:pdfBlob(await out.save()),name:'images-to-pdf.pdf'};
  }

  const pdf=await loadPdf(files[0]);
  if(id==='split-pdf') {
    const count=pdf.getPageCount();
    const allPages=String(values.ranges||'').trim().toLowerCase()==='all';
    if(allPages&&count>200)throw new Error('For a document over 200 pages, enter specific page groups instead of splitting all pages at once.');
    const groups=allPages?Array.from({length:count},(_,i)=>[i]):parseGroups(values.ranges,count);
    const results=[];
    for(let i=0;i<groups.length;i++) {
      const out=await PDFDocument.create();
      (await out.copyPages(pdf,groups[i])).forEach(page=>out.addPage(page));
      results.push({name:name+'-part-'+(i+1)+'.pdf',bytes:await out.save()});
    }
    if(results.length===1) return {blob:pdfBlob(results[0].bytes),name:results[0].name};
    const zip=new JSZip();
    results.forEach(part=>zip.file(part.name,part.bytes));
    return {blob:await zip.generateAsync({type:'blob'}),name:name+'-split.zip'};
  }
  if(id==='delete-pdf-pages') {
    const deleted=parseRanges(values.ranges,pdf.getPageCount());
    const retained=pdf.getPageIndices().filter(i=>!deleted.includes(i));
    if(!retained.length) throw new Error('You must keep at least one page.');
    const out=await PDFDocument.create();
    (await out.copyPages(pdf,retained)).forEach(page=>out.addPage(page));
    return {blob:pdfBlob(await out.save()),name:name+'-pages-removed.pdf'};
  }
  if(id==='rotate-pdf') {
    const angle=validNumber(values.angle,90,270,'Angle');
    if(![90,180,270].includes(angle)) throw new Error('Choose a rotation of 90°, 180°, or 270°.');
    const requested=String(values.pages??'all').trim().toLowerCase()==='all'
      ? pdf.getPageIndices()
      : parseRanges(values.pages,pdf.getPageCount());
    const selected=new Set(requested);
    pdf.getPages().forEach((page,index)=>{
      if(!selected.has(index))return;
      const current=page.getRotation().angle;
      page.setRotation(degrees(((current+angle)%360+360)%360));
    });
    return {blob:pdfBlob(await pdf.save()),name:name+'-rotated.pdf'};
  }
  if(id==='number-pdf') {
    const start=validNumber(values.start,0,1000000,'Starting number');
    if(!Number.isInteger(start)) throw new Error('Starting page number must be a whole number.');
    const size=validNumber(values.fontSize,6,36,'Font size');
    const font=await pdf.embedFont(StandardFonts.Helvetica);
    pdf.getPages().forEach((page,i)=>{
      const label=String(start+i),width=font.widthOfTextAtSize(label,size);
      page.drawText(label,{x:(page.getWidth()-width)/2,y:Math.max(12,size),size,font,color:rgb(.2,.27,.35)});
    });
    return {blob:pdfBlob(await pdf.save()),name:name+'-numbered.pdf'};
  }
  if(id==='watermark-pdf') {
    const label=String(values.watermark||'').trim();
    if(!label || label.length>60 || !/^[\x20-\x7E]+$/.test(label)) throw new Error('Use 1–60 basic Latin characters for the watermark.');
    const opacity=validNumber(values.opacity,5,70,'Opacity')/100;
    const font=await pdf.embedFont(StandardFonts.HelveticaBold);
    pdf.getPages().forEach(page=>{
      const {width,height}=page.getSize();
      let size=Math.min(64,Math.max(18,width/9));
      while(size>10&&font.widthOfTextAtSize(label,size)>Math.min(width,height)*.85)size--;
      const tw=font.widthOfTextAtSize(label,size);
      page.drawText(label,{x:width/2-tw*.38,y:height/2-tw*.25,size,font,rotate:degrees(35),opacity,color:rgb(.27,.36,.55)});
    });
    return {blob:pdfBlob(await pdf.save()),name:name+'-watermarked.pdf'};
  }
  throw new Error('This PDF tool is not available.');
}
