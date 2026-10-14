/** Presentation-only choreography; all geometry/materials use the app renderer. */
import { SceneRenderer } from '../../client/src/lib/render/scene-renderer';
import { getModel } from '../../client/src/lib/models/3d-models/3d-models-spec';

let scene: SceneRenderer;
let media: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let first: HTMLImageElement;
let second: HTMLImageElement;
let shot = '';
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { x = clamp(x); return x*x*(3-2*x); };
const mix = (a: number, b: number, t: number) => a+(b-a)*t;
async function image(url: string) {
  const img = new Image(); img.src = url; await img.decode(); return img;
}

async function init(id: string, modelId: string) {
  scene?.dispose(); shot = id;
  const laptop = modelId === 'macbook-pro-14-m4';
  const canvas = document.createElement('canvas');
  document.body.replaceChildren(canvas);
  scene = new SceneRenderer({canvas, width: laptop ? 1280 : 900, height: 960,
    background: [0,0,0,0], glassReflections: false, antialias: true});
  scene.renderer.setPixelRatio(1);
  const model = getModel(modelId)!;
  await scene.setModel({...model, ...(laptop ? {lidAngle: 108, lidOpenDuration: 2.5} : {})});
  first = await image('/media/studio/' + (laptop ? 'workspace' : id === 'pixel' ? 'focus-complete' : 'focus') + '.png');
  second = await image('/media/studio/focus-complete.png');
  media = document.createElement('canvas'); media.width = first.width; media.height = first.height;
  ctx = media.getContext('2d')!;
  ctx.drawImage(first, 0, 0);
  scene.setMedia({kind:'image', el:media});
}

function frame(t: number) {
  let pos = {x:0, y:0, z:-0.5};
  let rot = {x:0, y:0, z:0};
  if (shot === 'intro') {
    const p = ease(t/2.8);
    pos.z = mix(0.8,-0.35,p);
    rot = {x:mix(18,-8,p), y:mix(-72,-16,p), z:mix(18,-9,p)};
  } else if (shot === 'flip') {
    const turn = t < 0.65 ? 0 : t < 1.85 ? 180*ease((t-0.65)/1.2) : t < 2.25 ? 180 : 180+180*ease((t-2.25)/1.2);
    rot = {x:0,y:turn,z:0};
    pos.z = -0.65 + 0.15*Math.sin(t*Math.PI/4);
    ctx.drawImage(t >= 2.05 ? second : first, 0, 0, media.width, media.height);
    scene.markMediaDirty();
  } else if (shot === 'pixel') {
    const p = ease(t/3.8);
    rot = {x:mix(-15,12,p), y:-30+50*Math.sin(p*Math.PI), z:-12+360*p};
    pos.z = -0.75 + 0.65*Math.sin(p*Math.PI);
  } else if (shot === 'samsung') {
    const p = ease(clamp((t-0.25)/3.45));
    rot = {x:-8+16*Math.sin(p*Math.PI),y:720*p,z:8*Math.sin(p*Math.PI*2)};
    pos.z = -0.55 + 0.25*Math.sin(p*Math.PI);
  } else if (shot === 'macbook') {
    const p = ease(t/4.8);
    scene.setLidAtTime(t);
    rot = {x:mix(22,-4,p),y:mix(-30,35,p),z:mix(-8,4,p)};
    pos = {x:0,y:0.14,z:mix(1.5,1.95,p)};
  }
  scene.applyTransform(pos,rot);
  scene.render();
  return scene.renderer.domElement.toDataURL('image/png');
}
(window as any).showcase = {init,frame};
