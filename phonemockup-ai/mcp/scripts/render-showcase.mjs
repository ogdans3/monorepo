/** Render alpha device passes for the 26-second presentation showcase. */
import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from '../../client/node_modules/vite/dist/node/index.js';
import {chromium} from 'playwright';

const root = resolve(import.meta.dirname,'../..');
const args = process.argv.slice(2);
const out = resolve(args.find(a=>!a.startsWith('--')) || resolve(root,'assets/showcase-2026/output'));
const sample = args.includes('--samples');
const fps = 24;
const shots = [
  {id:'intro',model:'iphone-16-pro',duration:3},
  {id:'flip',model:'iphone-16-pro',duration:4},
  {id:'pixel',model:'pixel-9-pro',duration:4},
  {id:'samsung',model:'galaxy-s24-ultra',duration:4},
  {id:'macbook',model:'macbook-pro-14-m4',duration:5},
];
await mkdir(out,{recursive:true});
await build({configFile:false,logLevel:'warn',resolve:{alias:{$lib:resolve(root,'client/src/lib')}},
 build:{outDir:resolve(out,'.bundle'),emptyOutDir:true,target:'chrome120',lib:{entry:resolve(import.meta.dirname,'showcase-scene.ts'),name:'Showcase',formats:['iife'],fileName:()=> 'scene.js'}}});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
 args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:960}});
const origin='https://phonemockup.local';
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.origin!==origin)return route.abort();
 if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'});
 const path=resolve(root,'client/static','.'+decodeURIComponent(url.pathname));
 if(!path.startsWith(resolve(root,'client/static')+sep))return route.abort();
 try{return await route.fulfill({body:await readFile(path),contentType:extname(path)==='.glb'?'model/gltf-binary':'image/png'});}
 catch{return route.fulfill({status:404,body:'Not found'});}
});
page.on('pageerror',e=>console.error(e));
const report={fps,shots:[]};
try {
 await page.goto(origin);
 await page.addScriptTag({content:await readFile(resolve(out,'.bundle/scene.js'),'utf8')});
 for(const s of shots){
  await mkdir(resolve(out,s.id),{recursive:true});
  await page.evaluate(async s=>await window.showcase.init(s.id,s.model),s);
  const count=s.duration*fps;
  const frames=sample?[0,Math.floor(count*.25),Math.floor(count*.5),Math.floor(count*.75),count-1]:Array.from({length:count},(_,i)=>i);
  const start=Date.now();
  for(const i of frames){
   const path=resolve(out,s.id,`${String(i).padStart(4,'0')}.png`);
   try{await access(path);continue;}catch{}
   const data=await page.evaluate(t=>window.showcase.frame(t),i/fps);
   await writeFile(path,Buffer.from(data.split(',')[1],'base64'));
   if(i%24===0||sample)console.log(`${s.id} ${i}/${count} ${((Date.now()-start)/1000).toFixed(1)}s`);
  }
  report.shots.push({...s,frames:count,modelSha256:createHash('sha256').update(await readFile(resolve(root,'client/static',s.model+'.glb'))).digest('hex')});
 }
 await writeFile(resolve(out,'render-manifest.json'),JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}
