import {test, expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve(import.meta.dirname,'../../assets/models/macbook-pro-14-m4/qa/app');

test('hinged GLB keeps its base fixed and its video upright at every angle',async({page})=>{
 await page.goto('/');await mkdir(output,{recursive:true});
 const result=await page.evaluate(async()=>{
  const load=(url:string)=>import(url);
  const {SceneRenderer}=await load('/src/lib/render/scene-renderer.ts');
  const {models}=await load('/src/lib/models/3d-models/3d-models-spec.ts');
  const {lidAngleAt}=await load('/src/lib/render/lid-motion.ts');
  const config=models.find((m:any)=>m.id==='macbook-pro-14-m4');
  const r=new SceneRenderer({width:900,height:700,background:[25,32,39,1],glassReflections:false});
  document.body.replaceChildren(r.renderer.domElement);await r.setModel(config);
  r.applyTransform({x:0,y:0,z:0},{x:0,y:0,z:0});
  const media=document.createElement('canvas');media.width=3024;media.height=1964;const ctx=media.getContext('2d')!;
  for(const [x,y,color] of [[0,0,'#ff3030'],[1512,0,'#30ff30'],[0,982,'#3030ff'],[1512,982,'#ffff30']] as const){ctx.fillStyle=color;ctx.fillRect(x,y,1512,982);}
  r.setMedia({kind:'image',el:media});
  const screen=r.model!.getObjectByName('screen') as any,base=r.model!.getObjectByName('base_enclosure')!,hinge=r.model!.getObjectByName('lid_hinge')!;
  r.model!.updateMatrixWorld(true);const baseMatrix=base.matrixWorld.toArray(),uvs=Array.from(screen.geometry.attributes.uv.array);
  const checks=[];
  for(const angle of [0,15,45,90,105,130]){
   await r.setModel({...config,lidAngle:angle});r.model!.updateMatrixWorld(true);
   checks.push({angle,rotation:hinge.rotation.x,baseUnchanged:base.matrixWorld.toArray().every((v:number,i:number)=>Math.abs(v-baseMatrix[i])<1e-12),uvUnchanged:uvs.every((v,i)=>v===screen.geometry.attributes.uv.array[i]),dirty:r.needsRender});r.render();
  }
  await r.setModel({...config,lidAngle:105,lidOpenDuration:2});const animation=[];
  for(const t of [-1,0,1,2,8]){r.setLidAtTime(t);animation.push(-hinge.rotation.x*180/Math.PI);}
  await r.setModel({...config,lidAngle:90});r.render();
  const copy=document.createElement('canvas');copy.width=900;copy.height=700;const c=copy.getContext('2d')!;c.drawImage(r.renderer.domElement,0,0,900,700);
  const attr=screen.geometry.attributes.position;const pts:Record<string,number>[]=[];
  for(let i=0;i<attr.count;i++)pts.push({x:attr.getX(i),y:attr.getY(i),z:attr.getZ(i)});
  const min=Object.fromEntries(['x','y','z'].map(k=>[k,Math.min(...pts.map((p:any)=>p[k]))]));
  const max=Object.fromEntries(['x','y','z'].map(k=>[k,Math.max(...pts.map((p:any)=>p[k]))]));
  const samples=[];
  // glTF hinge-local X/Z spans the closed panel; +Z runs toward its top.
  for(const [u,v] of [[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){
   const pos=r.camera.position.clone().set(min.x+(max.x-min.x)*u,(min.y+max.y)/2,min.z+(max.z-min.z)*v);pos.applyMatrix4(screen.matrixWorld).project(r.camera);
   const x=Math.round((pos.x*.5+.5)*900),y=Math.round((.5-pos.y*.5)*700);samples.push(Array.from(c.getImageData(x,y,1,1).data).slice(0,3));
  }
  const badPixels=[];let interiorSamples=0;
  for(let j=0;j<40;j++)for(let i=0;i<52;i++){
   const u=.08+.84*(i+.5)/52,v=.08+.84*(j+.5)/40;
   if(Math.abs(u-.5)<.02||Math.abs(v-.5)<.02)continue;
   const pos=r.camera.position.clone().set(min.x+(max.x-min.x)*u,(min.y+max.y)/2,min.z+(max.z-min.z)*v);pos.applyMatrix4(screen.matrixWorld).project(r.camera);
   const x=Math.round((pos.x*.5+.5)*900),y=Math.round((.5-pos.y*.5)*700);
   const rgb=Array.from(c.getImageData(x,y,1,1).data).slice(0,3).map(n=>n>100?1:0);
   const expected=v>.5?(u<.5?[1,0,0]:[0,1,0]):(u<.5?[0,0,1]:[1,1,0]);
   interiorSamples++;if(rgb.some((n,k)=>n!==expected[k]))badPixels.push({u,v,x,y,rgb});
  }
  (window as any).laptopTest={r,config};
  return {checks,animation,samples,badPixels,interiorSamples,clampLow:lidAngleAt({...config,lidAngle:-9},0),clampHigh:lidAngleAt({...config,lidAngle:999},0),defaultAngle:lidAngleAt({...config,lidAngle:NaN},0),noHinge:lidAngleAt(models.find((m:any)=>m.id==='pixel-9-pro'),1)};
 });
 for(const c of result.checks){expect(c.rotation).toBeCloseTo(-c.angle*Math.PI/180,7);expect(c.baseUnchanged).toBe(true);expect(c.uvUnchanged).toBe(true);expect(c.dirty).toBe(true);}
 expect(result.animation.map(x=>Math.round(x*10)/10)).toEqual([0,0,52.5,105,105]);
 expect(result.clampLow).toBe(0);expect(result.clampHigh).toBe(130);expect(result.defaultAngle).toBe(105);expect(result.noHinge).toBeNull();
 await page.screenshot({path:resolve(output,'browser-UV-quadrants.png')});
 expect(result.samples.map(s=>s.map(v=>v>100?1:0))).toEqual([[0,0,1],[1,1,0],[1,0,0],[0,1,0]]);
 expect(result.interiorSamples).toBeGreaterThan(1800);expect(result.badPixels).toEqual([]);
 await page.evaluate(()=>{(window as any).laptopTest.r.dispose();});
});

test('laptop settings survive a saved-project round trip',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const load=(url:string)=>import(url);
  const {ProjectState}=await load('/src/lib/stores/project.svelte.ts');const {models}=await load('/src/lib/models/3d-models/3d-models-spec.ts');
  const p=new ProjectState();p.model={...models.find((m:any)=>m.id==='macbook-pro-14-m4'),lidAngle:73,lidOpenDuration:3.2};
  const saved=JSON.parse(JSON.stringify(p.toProject()));saved.model.modelPath='/obsolete-file.glb';const restored=new ProjectState();restored.fromProject(saved);
  return {angle:restored.model.lidAngle,duration:restored.model.lidOpenDuration,path:restored.model.modelPath};
 });expect(result).toEqual({angle:73,duration:3.2,path:'/macbook-pro-14-m4.glb'});
});

test('editor exposes a working lid slider and opening-duration control',async({page})=>{
 await page.goto('/platform/animation/still');
 await expect(page.getByTestId('timeline')).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Model',exact:true}).click();
 await page.getByLabel('Select 3D model').click();
 await page.getByRole('option',{name:'MacBook Pro 14-inch M4',exact:true}).click();
 const slider=page.locator('#lid-angle');await expect(slider).toHaveValue('105');
 await slider.focus();await slider.press('Home');await expect(slider).toHaveValue('0');
 await slider.press('End');await expect(slider).toHaveValue('130');
 await page.getByLabel('Open lid during animation').check();
 await page.getByLabel('Opening duration (seconds)').fill('1.5');
 await expect(page.getByLabel('Opening duration (seconds)')).toHaveValue('1.5');
 await page.screenshot({path:resolve(output,'editor-lid-controls.png')});
});
