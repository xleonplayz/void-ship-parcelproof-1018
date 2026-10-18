import {edition} from './version.js';
const $=id=>document.getElementById(id),key='parcelproof.receipt.v1';
$('edition').textContent='EDITION '+edition;document.body.dataset.edition=String(edition);
let files=[],parcel=null,generation=0;
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const digest=manifest=>hash(new TextEncoder().encode(JSON.stringify(manifest)));
const canonical=list=>({version:1,files:[...list].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).map(f=>({name:f.name,size:f.size,sha256:f.sha256}))});
function status(state,message){document.body.dataset.state=state;$('message').textContent=message;$('badge').textContent=({empty:'Ready when you are',hashing:'Reading your files',ready:'Parcel ready',sealing:'Making your receipt',sealed:'Receipt checked',error:'Please check your parcel'})[state];$('seal').disabled=!files.length||['hashing','sealing'].includes(state);}
function render(){
 $('files-list').replaceChildren();for(const file of files){const row=document.createElement('tr');for(const value of [file.name,String(file.size)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}row.dataset.sha256=file.sha256;$('files-list').append(row);}
 $('totals').textContent=files.length?`${files.length} file${files.length===1?'':'s'} · ${files.reduce((n,f)=>n+f.size,0)} bytes`:'No files selected.';
}
function showReceipt(value,saved=false){parcel=value;$('receipt-card').hidden=false;$('digest').textContent=value.receipt;$('saved-note').textContent=saved?'Saved receipt restored. Choose files to compare this handoff.':'Server receipt independently checked in your browser.';}
function invalidate(){parcel=null;$('receipt-card').hidden=true;$('digest').textContent='';$('verification').textContent='';}
async function choose(selected){
 const job=++generation;
 try{
  if(selected.length<1||selected.length>12)throw Error('Choose 1 to 12 files.');
  if(selected.some(f=>f.size>2097152))throw Error('Each file must fit within 2 MiB.');
  if(selected.reduce((n,f)=>n+f.size,0)>8388608)throw Error('The parcel must fit within 8 MiB.');
  if(new Set(selected.map(f=>f.name)).size!==selected.length)throw Error('File names must be unique.');
  if(selected.some(f=>!f.name||f.name.length>120||/[\x00-\x1f\/\\]/.test(f.name)))throw Error('A file name is invalid.');
  status('hashing','Making SHA-256 checksums on this device…');
  const result=await Promise.all(selected.map(async f=>({name:f.name,size:f.size,sha256:await hash(await f.arrayBuffer())})));
  if(job!==generation)return;
  files=canonical(result).files;invalidate();render();status('ready','Your file checksums are ready. Create a receipt to finish.');
 }catch(error){if(job===generation)status('error',error.message);}
 finally{$('files').value='';}
}
$('files').onchange=()=>choose([...$('files').files]);
$('sample').onclick=()=>choose([new File(['abc'],'notes.txt'),new File([],'empty.bin'),new File(['Café 🌊\n'],'海岸.txt')]);
$('clear').onclick=()=>{generation++;files=[];invalidate();localStorage.removeItem(key);render();status('empty','This parcel and its saved receipt have been cleared.');};
$('seal').onclick=async()=>{
 const job=++generation,manifest=canonical(files);status('sealing','Creating and checking the parcel receipt…');
 try{
  const response=await fetch('/api/seal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(manifest)});
  const value=await response.json();if(!response.ok)throw Error(value.error||'The receipt service could not finish.');
  if(JSON.stringify(value.manifest)!==JSON.stringify(manifest)||value.receipt!==await digest(manifest))throw Error('The receipt does not match this parcel.');
  if(job!==generation)return;
  showReceipt({manifest,receipt:value.receipt});localStorage.setItem(key,JSON.stringify(parcel));status('sealed','Receipt checked. Your handoff is ready to save.');
 }catch(error){if(job===generation)status('error',error.message);}
};
$('download').onclick=()=>{if(!parcel)return;const url=URL.createObjectURL(new Blob([JSON.stringify(parcel,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='parcelproof-receipt.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('receipt-file').onchange=async()=>{
 const file=$('receipt-file').files[0];$('receipt-file').value='';if(!file)return;
 try{
  if(file.size>32768)throw Error('Receipt exceeds 32 KiB.');
  const value=JSON.parse(await file.text()),m=value.manifest;
  if(!m||m.version!==1||!Array.isArray(m.files)||m.files.length<1||m.files.length>12||m.files.some(f=>!f||typeof f.name!=='string'||!Number.isSafeInteger(f.size)||f.size<0||!/^[a-f0-9]{64}$/.test(f.sha256)))throw Error('Receipt format is invalid.');
  if(value.receipt!==await digest(canonical(m.files)))throw Error('Receipt checksum mismatch.');
  if(!files.length)throw Error('Choose files before comparing this receipt.');
  if(JSON.stringify(canonical(files))!==JSON.stringify(canonical(m.files)))throw Error('This receipt belongs to a different parcel.');
  $('verification').textContent='Match — every file, size and checksum agrees.';document.body.dataset.verified='true';
 }catch(error){$('verification').textContent=error.message;document.body.dataset.verified='false';}
};
try{const value=JSON.parse(localStorage.getItem(key));if(value?.manifest?.version===1&&value.receipt===await digest(canonical(value.manifest.files))){showReceipt(value,true);status('empty','Your saved receipt is here. Choose files to compare it.');}}catch{localStorage.removeItem(key);}
