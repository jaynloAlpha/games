const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const P=require('../games/draw-road/physics.js');
const {levels,groups}=require('../games/draw-road/levels.js');

function strokes(level,paths){
 const result=[];
 for(const points of paths){
  const stroke=P.draft(level,points,result);
  assert.equal(stroke.error,undefined,'invalid stroke in level '+level.id);
  result.push(stroke);
 }
 return result;
}
function run(level,ink){
 const simulation=P.create(level,ink);
 for(let step=0;step<1350&&simulation.step()==='running';step++){
  for(const {body} of simulation.balls)
   assert.ok(Number.isFinite(body.position.x)&&Number.isFinite(body.position.y),'finite motion at '+level.id);
 }
 return simulation;
}

assert.equal(levels.length,50);
assert.equal(groups.length,10);
let maxRun=0;
const expectedRuns={};
for(const [index,level] of levels.entries()){
 assert.equal(level.id,index+1);
 assert.equal(level.group,Math.floor(index/5));
 assert.ok(level.demo.length>0&&level.demo.length<=level.budget);
 if(level.sheets)for(const stroke of level.demo){
  assert.ok(level.sheets.some(sheet=>stroke.every(([x,y])=>
   x>=sheet.x+8&&x<=sheet.x+sheet.w-8&&y>=sheet.y+8&&y<=sheet.y+sheet.h-8)),
  'leave room for touch rounding around drawings in level '+level.id);
 }
 const solved=run(level,strokes(level,level.demo));
 assert.equal(solved.verdict,'won','reference drawing in level '+level.id);
 const releases=solved.events.filter(event=>event.kind==='release');
 assert.equal(releases.length,level.balls.length,'each ball is released once');
 for(const ball of level.balls){
  const release=releases.find(event=>event.x===ball.x&&event.y===ball.y);
  assert.equal(release.impulse||0,Math.hypot(ball.vx||0,ball.vy||0),'only moving starts kick the spring at release');
 }
 assert.equal(run(level,[]).verdict,'retry','a blank sheet should not win level '+level.id);
 maxRun=Math.max(maxRun,solved.elapsed);
 expectedRuns[level.id]=solved.elapsed;
}
for(const level of levels.slice(0,5)){
 for(const [dx,dy] of [[-6,-3],[-3,0],[2,3],[3,-4],[5,5],[-4,4]]){
  const handDrawn=level.demo.map(line=>line.map(([x,y],i)=>[x+dx,y+dy+(i%2?1:0)]));
  assert.equal(run(level,strokes(level,handDrawn)).verdict,'won','forgiving first bridge '+level.id);
 }
}
const concave=P.shape([[360,145],[440,145],[437,261],[400,205],[362,259],[360,145]]);
assert.ok(concave.closed&&concave.triangles.length===3,'closed concave crayon art has a solid fixture');
const large=P.shape([[300,100],[410,100],[410,195],[300,195],[300,100]]);
const small=P.shape([[200,100],[254,100],[254,156],[200,156],[200,100]]);
const pieces=P.create(levels[0],[small,large]).inks;
assert.ok(pieces[1].body.mass>pieces[0].body.mass*2,'larger shapes have more mass');
assert.equal(P.shape([[230,160],[390,260],[250,260],[385,160],[230,160]]).closed,false,'self-crossing lines stay open');
const lever=run(levels[25],strokes(levels[25],levels[25].demo));
assert.ok(Math.abs(lever.inks[0].body.angle)>.15&&lever.pressed.start,'a physical pivot trips the actual sensor');
const final=run(levels[49],strokes(levels[49],levels[49].demo));
assert.ok(final.pressed.finalBell>final.pressed.start,'the celebration bell follows the opening switch');
console.log('PASS 50 solutions, 50 blank-sheet failures, finite motion, masses, concave shapes, pivot and finale ('+Math.round(maxRun)+'ms max)');

const picturedSlope=[[135,286],[144,181],[151,137],[214,190],[302,260],[442,353]];
const boxLevel=levels[7];
assert.equal(P.draft(boxLevel,picturedSlope,[]).error,'sheet');
assert.equal(P.draft({...boxLevel,sheets:[]},picturedSlope,[]).error,'solid','the box physically blocks the high route');
assert.equal(P.draft({...boxLevel,sheets:[]},[[179,58],[336,58],[336,254],[179,254],[179,58]],[]).error,'solid','a filled shape cannot enclose the box either');

const separateJobs=new Set([4,5,9,20,27,30,33,34,35,36,38,39,42,46,47,48,49,50]);
for(const id of separateJobs){
 const level=levels[id-1];
 for(const i of level.demo.keys()){
  const partial=level.demo.filter((_,index)=>index!==i);
  assert.equal(run(level,strokes(level,partial)).verdict,'retry','each distinct job matters in level '+id);
 }
}
const delayed=run(levels[39],strokes(levels[39],levels[39].demo));
assert.ok(delayed.events.find(event=>event.kind==='release'&&event.x>512).time>delayed.pressed.ring,'the red bell releases the blue ball');
const full=run(levels[48],strokes(levels[48],levels[48].demo));
assert.ok(full.events.find(event=>event.kind==='release'&&event.x>512).time>Math.max(full.pressed.start,full.pressed.ring),'the late relay waits for both signals');

// Drag variants of the same ramp and hooked ramp across every layout.
// The first bridge and a few other simple layouts intentionally permit a single ramp.
let audited=0;
for(const level of levels){
 const first=level.balls[0];
 const bound=(n,min,max)=>Math.max(min,Math.min(n,max));
 for(const side of [-1,1])for(const offset of [21,45,100])
 for(const span of [155,260,390,520])for(const drop of [43,104,192]){
  const x=bound(first.x-side*46,14,1010),y=bound(first.y+offset,60,555);
  const ramp=[[x,y],[bound(x+side*span,14,1010),bound(y+drop,60,555)]];
  for(const path of [ramp,[[x,bound(y+132,60,555)],...ramp]]){
   audited++;
   const shape=P.draft(level,path,[]);
   if(shape.error)continue;
   const verdict=run(level,[shape]).verdict;
   if(separateJobs.has(level.id)||level.id===8||level.id===41){
    assert.equal(verdict,'retry','a generic ramp should not win level '+level.id);
   }
  }
 }
}
console.log('PASS '+audited+' generic ramp trials, pictured bypass, 18 multi-part levels and latch ordering');

if(process.argv.includes('--physics-only'))process.exit(0);
const engine=process.env.DRAW_BROWSER||'chromium';
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const shots=path.resolve('target','draw-road-check');
fs.mkdirSync(shots,{recursive:true});
const url=process.env.DRAW_GAME_URL||'http://127.0.0.1:8787/play/draw-road';

(async()=>{
 const browser=await pw[engine].launch(engine==='chromium'&&process.env.MONSTER_BROWSER_PATH?
  {executablePath:process.env.MONSTER_BROWSER_PATH}:{});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install();
  await page.goto(url);
  async function currentGame(){
   const iframe=await page.locator('iframe').count()?await page.locator('iframe').elementHandle():null;
   return iframe?iframe.contentFrame():page.mainFrame();
  }
  let game=await currentGame();
  await game.waitForFunction(()=>window.DrawRoad&&DrawRoad.getState().ready);
  const state=()=>game.evaluate(()=>DrawRoad.getState());
  async function pick(id){
   await game.locator('#pause').tap();
   await game.locator('[data-level="'+id+'"]').click();
   assert.equal((await state()).level,id);
  }
  async function trace(points){
   const s=await state(),rect=await game.locator('#scene').boundingBox();
   const client=([x,y])=>[rect.x+s.offset[0]+x*s.scale,rect.y+s.offset[1]+y*s.scale];
   await page.mouse.move(...client(points[0]));
   await page.mouse.down();
   for(const p of points.slice(1))await page.mouse.move(...client(p),{steps:5});
   await page.mouse.up();
  }
  const played=[1,4,5,7,8,9,12,16,19,20,26,33,36,40,41,42,47,48,49,50];
  for(const id of played){
   await pick(id);
   const level=levels[id-1];
   if(id===1){
    await page.screenshot({path:path.join(shots,engine+'-opening.png')});
    await trace([[205,329],[249,331]]);
    assert.equal((await state()).draft.length,1);
    await game.locator('#release').tap();
    await page.clock.runFor(12800);
    assert.equal((await state()).phase,'setup');
    assert.equal((await state()).draft.length,1,'keep the failed drawing');
    await game.locator('#undo').tap();
    assert.equal((await state()).draft.length,0);
   }
   if(id===8){
    await trace(picturedSlope);
    assert.equal((await state()).draft.length,0,'the pictured high line is rejected through real input');
    await page.screenshot({path:path.join(shots,engine+'-under-box.png')});
   }
   for(const line of level.demo)await trace(line);
   assert.equal((await state()).draft.length,level.demo.length,'register all strokes at '+id);
   if(id===16)assert.equal((await state()).draft[0].closed,true);
   if(id===26)assert.equal((await state()).draft[0].pinned,true);
   if([1,8,20,26,42,50].includes(id))await page.screenshot({path:path.join(shots,engine+'-level-'+id+'.png')});
   await game.locator('#release').tap();
   if(id===1){
    await page.clock.runFor(600);
    await game.locator('#pause').tap();
    const stopped=(await state()).elapsed;
    await page.clock.runFor(550);
    assert.equal((await state()).elapsed,stopped,'pause freezes physics');
    await game.locator('#resume').tap();
   }
   await page.clock.runFor(Math.ceil(expectedRuns[id]+750));
   if((await state()).phase==='playing')await page.clock.runFor(Math.ceil(11800-expectedRuns[id]));
   assert.equal((await state()).phase,'won','play the reference by drawing on the canvas at '+id);
  }
  assert.equal((await state()).completed,played.length);
  await game.locator('#next').tap();
  assert.equal((await state()).level,1);
  await page.reload();
  game=await currentGame();
  await game.waitForFunction(()=>window.DrawRoad&&DrawRoad.getState().ready);
  assert.equal((await state()).completed,played.length);
  for(const viewport of [{width:768,height:1024},{width:390,height:844}]){
   await page.setViewportSize(viewport);
   await page.waitForTimeout(150);
   const box=await game.locator('#release').boundingBox();
   assert.ok(box&&box.width>=44&&box.height>=44&&box.x>=0&&box.x+box.width<=viewport.width+1);
  }
  // An older iPad sends TouchEvents with no PointerEvent API.
  const legacy=await browser.newPage({viewport:{width:768,height:1024},hasTouch:true});
  await legacy.addInitScript(()=>{window.PointerEvent=undefined;});
  await legacy.goto(game.url());
  await legacy.waitForFunction(()=>window.DrawRoad&&DrawRoad.getState().ready);
  await legacy.evaluate(()=>{
   const canvas=document.querySelector('canvas'),s=DrawRoad.getState(),r=canvas.getBoundingClientRect();
   const touch=(x,y)=>({identifier:1,target:canvas,clientX:r.left+s.offset[0]+x*s.scale,clientY:r.top+s.offset[1]+y*s.scale});
   const send=(name,t)=>{
    const event=new Event(name,{bubbles:true,cancelable:true});
    Object.defineProperty(event,'changedTouches',{value:[t]});
    canvas.dispatchEvent(event);
   };
   send('touchstart',touch(210,331));send('touchmove',touch(288,331));send('touchend',touch(400,331));
  });
  assert.equal(await legacy.evaluate(()=>DrawRoad.getState().draft.length),1);
  await legacy.close();
  assert.deepEqual(errors,[]);
  console.log('PASS '+engine+': '+played.length+' levels drawn in UI, pictured bypass rejected, failed draft retained, undo, pause, saved progress, tablet/phone and legacy touch');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
