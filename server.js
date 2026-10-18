import http from 'node:http';
import {createHash} from 'node:crypto';
import {assets} from './assets.js';
import {edition} from './version.js';

function normalize(input) {
  if (!input || !Array.isArray(input.files) || input.files.length < 1 || input.files.length > 12) throw new Error('Choose 1 to 12 files.');
  const names = new Set();
  let total = 0;
  const files = input.files.map(file => {
    if (!file || typeof file.name !== 'string' || file.name.length < 1 || file.name.length > 120 || /[\x00-\x1f\/\\]/.test(file.name)) throw new Error('A file name is invalid.');
    if (names.has(file.name)) throw new Error('File names must be unique.');
    names.add(file.name);
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > 2097152) throw new Error('Each file must fit within 2 MiB.');
    if (typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('A SHA-256 checksum is invalid.');
    total += file.size;
    return {name:file.name,size:file.size,sha256:file.sha256};
  });
  if (total > 8388608) throw new Error('The parcel must fit within 8 MiB.');
  files.sort((a,b)=>a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return {version:1,files};
}
const send = (res,status,value) => {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(value));
};
http.createServer((req,res)=>{
  const path=req.url.split('?')[0];
  console.error('parcelproof-request',req.method,path);
  if (path==='/api/seal' && req.method==='POST') {
    let bytes=0,overflow=false;const chunks=[];
    req.on('data',chunk=>{bytes+=chunk.length;if(bytes>32768){overflow=true;return;}chunks.push(chunk);});
    req.on('end',()=>{
      if(overflow)return send(res,413,{error:'Manifest exceeds 32 KiB.'});
      let input;
      try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(res,400,{error:'Manifest is not valid JSON.'});}
      let manifest;
      try{manifest=normalize(input);}catch(error){return send(res,422,{error:error.message});}
      try{
        const receipt=createHash('sha256').update(JSON.stringify(manifest),'utf8').digest('hex');
        return send(res,201,{manifest,receipt,edition});
      }catch(error){console.error('parcelproof-hash-error',error.message);return send(res,500,{error:'Receipt hashing failed.'});}
    });
    return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,{error:'Method not allowed.'});
  if(path==='/health')return send(res,200,{service:'parcelproof',edition});
  const asset=assets[path==='/'?'/index.html':path];
  if(!asset)return send(res,404,{error:'Not found.'});
  res.writeHead(200,{'content-type':asset.type,'cache-control':'no-store'});
  res.end(req.method==='HEAD'?'':asset.body);
}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.error('parcelproof-ready',edition));
