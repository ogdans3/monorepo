/** Render the actual shared scene at exact animation times; encode these PNGs separately. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {RenderSession} from '../dist/renderer.js';
const root=resolve(import.meta.dirname,'../..');
const out=resolve(root,'assets/models/macbook-pro-14-m4');
await mkdir(resolve(out,'previews/animation'),{recursive:true});
const session=await RenderSession.launch();
const report={glbSha256:createHash('sha256').update(await readFile(resolve(root,'client/static/macbook-pro-14-m4.glb'))).digest('hex'),fps:24,frames:[],angles:[]};
try {
 const catalog=await session.catalog();
 const still=catalog.animations.find(x=>x.name.toLowerCase().includes('still'));
 if(!still)throw new Error('Still preset missing');
 await session.initScene({modelId:'macbook-pro-14-m4',width:960,height:720,background:[25,32,39,1],glassReflections:false,antialias:true,lidAngle:105,lidOpenDuration:2.5});
 await session.setScreenSource(resolve(out,'screen-demo.png'));
 for(let i=0;i<72;i++){
  const t=i/24;const file=`previews/animation/frame_${String(i).padStart(3,'0')}.png`;
  await writeFile(resolve(out,file),await session.renderFrame(still.id,t,'image/png'));
  report.frames.push({file,time:t});
  if(i%12===0)console.log('Opening frame',i);
 }
 for(const angle of [0,15,30,60,90,105,120,130]){
  await session.initScene({modelId:'macbook-pro-14-m4',width:960,height:720,background:[25,32,39,1],glassReflections:false,antialias:true,lidAngle:angle});
  await session.setScreenSource(resolve(out,'screen-demo.png'));
  const file=`qa/app/lid-${String(angle).padStart(3,'0')}.png`;
  await writeFile(resolve(out,file),await session.renderStill('image/png'));report.angles.push({file,angle});
 }
} finally {await session.close();await writeFile(resolve(out,'qa/app/motion-report.json'),JSON.stringify(report,null,2)+'\n');}
console.log('Motion check complete:',report.frames.length,'frames,',report.angles.length,'angles');
