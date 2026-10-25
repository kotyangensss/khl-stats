import test from 'node:test';
import assert from 'node:assert/strict';
import {puckPlayPlan,goalMoment,cursorChaseTarget,pointerPuckKick} from './companion/hockey';

test('puck play and both cat destinations fit phone and desktop viewports',()=>{
  const viewports=[{width:320,height:568},{width:390,height:844},{width:2560,height:1440}];
  assert.ok(viewports.every(viewport=>Array.from({length:6},(_,i)=>puckPlayPlan(i,viewport)).every(plan=>[plan.puckStart,plan.puckEnd,plan.catStart,plan.catEnd].every(point=>point.x>=32&&point.x<=viewport.width-32&&point.y>=32&&point.y<=viewport.height-32))));
});
test('the next swat continues from where the puck stopped and reverses direction',()=>{
  const viewport={width:390,height:844};
  const first=puckPlayPlan(0,viewport),second=puckPlayPlan(1,viewport);
  assert.deepEqual([first.puckEnd,Math.sign(first.puckEnd.x-first.puckStart.x)],[second.puckStart,-Math.sign(second.puckEnd.x-second.puckStart.x)]);
});
test('goal reaction freezes, gives one hop, stares, then finishes',()=>{
  assert.deepEqual([0,650,1000,3200,4000].map(ms=>goalMoment(ms).phase),['notice','hop','stare','settle','done']);
});
test('reduced motion keeps the caption without a hop and still finishes',()=>{
  assert.deepEqual([goalMoment(700,true),goalMoment(4000,true)].map(moment=>[moment.action,moment.hop,moment.done]),[['idle',false,false],['idle',false,true]]);
});

test('autonomous puck play visits both sides and different heights of the screen',()=>{
  const viewport={width:1200,height:900};
  const points=Array.from({length:6},(_,i)=>puckPlayPlan(i,viewport).puckEnd);
  assert.ok(Math.min(...points.map(p=>p.x))<viewport.width*.3&&Math.max(...points.map(p=>p.x))>viewport.width*.7&&Math.min(...points.map(p=>p.y))<viewport.height*.3&&Math.max(...points.map(p=>p.y))>viewport.height*.7);
});
test('resuming play keeps the actual puck position after an interruption',()=>{
  const from={x:234,y:167};
  assert.deepEqual(puckPlayPlan(3,{width:390,height:844},from).puckStart,from);
});
test('cursor pursuit leaves space around the pointer to keep page controls usable',()=>{
  assert.deepEqual(cursorChaseTarget({x:100,y:100},{x:300,y:100,at:900},{width:1200,height:900},1000),{x:246,y:100});
});
test('the cat stays near a caught cursor and ignores stale pointer positions',()=>{
  const viewport={width:1200,height:900},cat={x:270,y:100},pointer={x:300,y:100,at:900};
  assert.deepEqual([cursorChaseTarget(cat,pointer,viewport,1000),cursorChaseTarget(cat,pointer,viewport,3000),cursorChaseTarget(cat,null,viewport,1000)],[cat,null,null]);
});
test('the puck moves away from a nearby cursor and stays inside the viewport',()=>{
  const viewport={width:390,height:844};
  const kicked=pointerPuckKick({x:350,y:200},{x:330,y:200,dx:4,dy:0},viewport);
  assert.deepEqual(kicked,{x:358,y:200});
});
test('a distant cursor leaves the puck alone and exact overlap uses movement direction',()=>{
  const viewport={width:390,height:844},puck={x:150,y:200};
  assert.deepEqual([pointerPuckKick(puck,{x:300,y:300,dx:1,dy:0},viewport),pointerPuckKick(puck,{x:150,y:200,dx:0,dy:10},viewport)],[null,{x:150,y:350}]);
});
