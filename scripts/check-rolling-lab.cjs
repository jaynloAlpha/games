const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),P=require('../games/rolling-lab/physics.js');
for(let s=0;s<3;s++){const a=P.heights.map(h=>P.simulate(h,s));assert.ok(a[0].x<a[1].x&&a[1].x<a[2].x);for(const t of a){assert.ok(t.duration>0&&t.duration<15);assert.ok(t.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));assert.equal(P.sample(t,t.duration+10).x,t.x);}}
for(const h of P.heights){assert.ok(P.simulate(h,0).x>P.simulate(h,1).x);assert.ok(P.simulate(h,1).x>P.simulate(h,2).x);}
(async()=>{const root=path.resolve('games/rolling-lab'),port=Number(process.env.ROLLING_TEST_PORT||18801),out='target/rolling-lab-check';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/')pathname='/index.html';const file=path.join(root,decodeURIComponent(pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.wav':'audio/wav'})[path.extname(file)]||'text/html');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; media-src 'self'");res.end(data);});});await new Promise(r=>server.listen(port,'127.0.0.1',r));let browser;
try{const engine=process.env.ROLLING_BROWSER==='webkit'?'webkit':'chromium';browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.MONSTER_BROWSER_PATH?{executablePath:process.env.MONSTER_BROWSER_PATH}:{})});const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,deviceScaleFactor:2});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>window.RollingLab&&RollingLab.getState().artReady);const state=()=>page.evaluate(()=>RollingLab.getState());assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#instruction')).clip),'rect(0px, 0px, 0px, 0px)');assert.equal(await page.locator('#gesture-guide').count(),0);assert.equal(await page.locator('#chapter').isVisible(),false);assert.equal(await page.locator('#surface-control').isVisible(),false);await page.screenshot({path:out+'/'+engine+'-initial.png'});
const highlighted=()=>page.locator('.touch-hint').evaluateAll(nodes=>nodes.map(node=>node.id).sort());
await page.keyboard.press('Shift');
await page.clock.runFor(9000);
assert.deepEqual(await highlighted(),[],'no immediate prompts');
await page.clock.runFor(1100);
assert.deepEqual(await highlighted(),['height','launch']);
await page.locator('#pause').tap();
assert.deepEqual(await highlighted(),[],'input clears the pulses');
await page.clock.runFor(12000);
assert.deepEqual(await highlighted(),[],'paused games do not hint');
await page.click('#resume');
await page.clock.runFor(10100);
assert.deepEqual(await highlighted(),['height','launch']);
await page.clock.runFor(1800);
assert.deepEqual(await highlighted(),[],'two pulses then quiet');
await page.clock.runFor(11000);
assert.deepEqual(await highlighted(),[],'no repeating prompt in the same idle stretch');
async function flag(x){const b=await page.locator('#canvas').boundingBox(),st=await state();await page.mouse.click(b.x+st.offset[0]+x*st.scale,b.y+st.offset[1]+390*st.scale);assert.ok(Math.abs((await state()).flag-x)<2);}
async function experiment(x){if(x)await flag(x);await page.click('#launch');await page.waitForFunction(()=>RollingLab.getState().phase==='idle');}
await page.locator('#launch').tap();
await page.waitForFunction(()=>RollingLab.getState().phase==='observing');
assert.equal(await page.locator('#launch').isVisible(),false,'give the child time to see the stop');
await page.waitForFunction(()=>RollingLab.getState().phase==='idle');
assert.equal((await state()).won,false);
assert.deepEqual(await highlighted(),[]);
const ramp=await page.locator('#canvas').boundingBox(),initial=await state();
const grabX=ramp.x+initial.offset[0]+245*initial.scale,grabY=ramp.y+initial.offset[1]+351*initial.scale;
await page.mouse.move(grabX,grabY);await page.mouse.down();await page.mouse.move(grabX,grabY-50*initial.scale,{steps:4});await page.mouse.up();
assert.equal((await state()).height,120,'drag the actual ramp');
assert.deepEqual(await highlighted(),[]);await page.click('#launch');assert.equal((await state()).phase,'playing');await page.waitForTimeout(300);await page.click('#pause');const pausedTime=(await state()).elapsed;await page.waitForTimeout(350);assert.equal((await state()).elapsed,pausedTime);await page.click('#resume');await page.waitForFunction(()=>RollingLab.getState().phase==='idle');assert.equal((await state()).won,true);assert.equal((await state()).history.length,2);
assert.equal(await page.locator('#next').isVisible(),true);
for(const id of ['height','launch','surface-control','replay','chapter'])assert.equal(await page.locator('#'+id).isVisible(),false,id+' is out of the way after success');
await page.clock.runFor(10100);assert.deepEqual(await highlighted(),['next']);await page.click('#next');assert.deepEqual(await highlighted(),[]);assert.equal((await state()).level,1);await page.click('#pause');await page.click('#prediction-mode');await page.click('#resume');await page.clock.runFor(10100);assert.deepEqual(await highlighted(),['flag-zone','height']);await page.click('#launch');assert.equal((await state()).history.length,0,'prediction is requested before second task');await page.locator('#height').tap();await experiment(760);assert.equal((await state()).won,true);
await page.click('#next');assert.equal((await state()).height,120);assert.equal(await page.locator('#height').isVisible(),false);while((await state()).surface!==0)await page.click('#surface-control');await experiment(910);assert.equal((await state()).won,true);
await page.click('#next');await experiment(585);assert.equal((await state()).won,false);await page.locator('#height').tap();await experiment(735);assert.equal((await state()).won,true);const before=JSON.stringify((await state()).history);await page.click('#pause');await page.click('#replay');assert.equal((await state()).phase,'replay');await page.waitForFunction(()=>RollingLab.getState().phase==='idle');assert.equal(JSON.stringify((await state()).history),before,'replay never records a new experiment');
await page.click('#next');await experiment(635);while((await state()).surface!==0)await page.click('#surface-control');await experiment(910);assert.equal((await state()).won,true);
await page.click('#next');await page.locator('#height').tap();await page.locator('#height').tap();await experiment(760);assert.equal((await state()).won,true);assert.ok((await state()).completed.slice(0,6).every(Boolean));await page.screenshot({path:out+'/'+engine+'-success.png'});
await page.click('#pause');await page.click('#try-again');await page.locator('#height').tap();const h=(await state()).height;await page.click('#surface-control');assert.equal((await state()).height,h);assert.equal((await state()).surface,2,'cannot change two variables between experiments');await page.click('#pause');await page.click('#undo');assert.equal((await state()).height,180);await page.click('#free-mode');await page.click('#resume');assert.equal((await state()).free,true);
for(const size of [{width:768,height:1024},{width:390,height:844},{width:1024,height:768}]){await page.setViewportSize(size);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);for(const id of ['launch','height','pause']){const b=await page.locator('#'+id).boundingBox();assert.ok(b,id+' is visible at '+size.width+'×'+size.height+' '+JSON.stringify(await page.evaluate(()=>{const x=RollingLab.getState();return {phase:x.phase,paused:x.paused,won:x.won,free:x.free};})));assert.ok(b.width>=44&&b.height>=44&&b.x>=0&&b.y>=0&&b.x+b.width<=size.width+1&&b.y+b.height<=size.height+1,id+' stays usable');}await page.screenshot({path:out+'/'+engine+'-'+size.width+'.png'});const beforeTap=(await state()).height;await page.locator('#height').tap({timeout:2500});assert.notEqual((await state()).height,beforeTap,'ramp handle remains tappable beside the ball');assert.equal((await state()).phase,'idle','adjusting height does not launch the ball');}
await page.reload();await page.waitForFunction(()=>window.RollingLab&&RollingLab.getState().artReady);assert.ok((await state()).completed.slice(0,6).every(Boolean),'progress survives reload');
// Legacy touch fallback: a touch changes height once; cancellation leaves it unchanged.
const legacy=await context.newPage();await legacy.addInitScript(()=>{window.PointerEvent=undefined;});await legacy.goto('http://127.0.0.1:'+port);await legacy.waitForFunction(()=>window.RollingLab&&RollingLab.getState().artReady);await legacy.click('#pause');await legacy.click('[data-level="0"]');await legacy.click('#resume');const b=await legacy.locator('#height').boundingBox(),p={identifier:1,clientX:b.x+b.width/2,clientY:b.y+b.height/2};await legacy.locator('#height').dispatchEvent('touchstart',{touches:[p],changedTouches:[p]});await legacy.locator('body').dispatchEvent('touchend',{touches:[],changedTouches:[p]});assert.equal(await legacy.evaluate(()=>RollingLab.getState().height),120);await legacy.close();assert.deepEqual(errors,[]);console.log('PASS '+engine+': idle touch pulses; physics invariants; all six missions; prediction; pause; one-variable rule and undo; replay without mutation; free mode; iPad/phone layouts; persistence; legacy touch');
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
