import {readFile,writeFile} from 'node:fs/promises';
const names={'index.html':'text/html; charset=utf-8','styles.css':'text/css; charset=utf-8','app.js':'text/javascript; charset=utf-8','version.js':'text/javascript; charset=utf-8','icon.svg':'image/svg+xml'};
const assets={};for(const [name,type] of Object.entries(names))assets['/'+name]={type,body:await readFile(new URL('../'+name,import.meta.url),'utf8')};
await writeFile(new URL('../assets.js',import.meta.url),'export const assets = '+JSON.stringify(assets)+';\n');
