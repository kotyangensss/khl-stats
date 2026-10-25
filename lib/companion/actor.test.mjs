import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const bundled=await build({entryPoints:[fileURLToPath(new URL('../../components/companion/actor.ts',import.meta.url))],bundle:true,write:false,format:'cjs',platform:'node',loader:{'.gif':'dataurl'}});

function environment(reduced=false) {
  let now=10000,nextFrame=0;
  const callbacks=new Map(),listeners=new Map();
  class Element {
    children=[];dataset={};style={setProperty(){}};attributes={};events=new Map();hidden=false;
    classList={add(){},remove(){},toggle(){}};
    append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node)}}
    remove(){this.parent.children=this.parent.children.filter(node=>node!==this)}
    setAttribute(key,value){this.attributes[key]=value}
    addEventListener(key,listener){this.events.set(key,listener)}
    removeEventListener(key){this.events.delete(key)}
    closest(){return null}
  }
  const body=new Element();
  const testModule={exports:{}};
  const context={module:testModule,exports:testModule.exports,Element,Date:class extends Date {static now(){return now}},innerHeight:844,document:{body,hidden:false,documentElement:{clientWidth:390},createElement(){return new Element()}},window:{addEventListener(name,listener){listeners.set(name,listener)},removeEventListener(name){listeners.delete(name)}},requestAnimationFrame(callback){callbacks.set(++nextFrame,callback);return nextFrame},cancelAnimationFrame(id){callbacks.delete(id)}};
  vm.runInNewContext(bundled.outputFiles[0].text,context);
  const actor=testModule.exports.createNeko(reduced),cat=body.children[0],puck=body.children[1];
  const advance=ms=>{for(let step=0;step<ms;step+=16){now+=16;const scheduled=[...callbacks.values()];callbacks.clear();for(const callback of scheduled)callback(now)}};
  const point=node=>{const [x,y]=node.style.transform.match(/-?\d+/g).map(Number);return {x:x+(node===cat?32:11),y:y+(node===cat?32:7)}};
  const pointer=(x,y,pointerType='mouse')=>listeners.get('pointermove')({clientX:x,clientY:y,pointerType,target:new Element()});
  return {actor,cat,puck,advance,point,pointer,listeners,callbacks,body};
}

test('mouse movement makes the running actor pursue the cursor, then return to puck play',()=>{
  const env=environment(),before=env.point(env.cat),target={x:60,y:150};
  env.pointer(target.x,target.y);env.advance(800);
  const distance=point=>Math.hypot(point.x-target.x,point.y-target.y);
  const followed=env.cat.dataset.scene==='cursor-chase'&&distance(env.point(env.cat))<distance(before);
  env.advance(1400);
  assert.ok(followed&&env.cat.dataset.scene.startsWith('puck-'));
  env.actor.destroy();
});

test('moving near the puck launches it away without waiting for an autonomous swat',()=>{
  const env=environment(),before=env.point(env.puck);
  env.pointer(before.x-20,before.y);env.advance(160);
  assert.ok(env.puck.dataset.moving==='true'&&env.point(env.puck).x>before.x&&env.cat.dataset.scene==='puck-chase');
  env.actor.destroy();
});

test('touch input does not start a cursor pursuit',()=>{
  const env=environment();env.pointer(60,150,'touch');env.advance(300);
  assert.notEqual(env.cat.dataset.scene,'cursor-chase');
  env.actor.destroy();
});

test('goal reaction interrupts cursor pursuit and then restores autonomous play',()=>{
  const env=environment();env.pointer(60,150);env.advance(100);env.actor.goal();env.advance(1200);
  const reacted=env.cat.dataset.scene==='goal'&&env.cat.dataset.goalPhase==='stare';
  env.advance(3000);
  assert.ok(reacted&&env.cat.dataset.scene.startsWith('puck-'));
  env.actor.destroy();
});

test('reduced motion keeps the actor stationary even when the cursor moves',()=>{
  const env=environment(true),before=env.cat.style.transform;env.pointer(60,150);env.advance(1000);
  assert.ok(env.puck.hidden&&env.cat.style.transform===before&&env.cat.dataset.scene==='idle');
  env.actor.destroy();
});

test('destroy removes pointer listeners, animation frames, cat and puck',()=>{
  const env=environment();env.actor.destroy();
  assert.equal(env.listeners.size+env.callbacks.size+env.body.children.length,0);
});
