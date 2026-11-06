const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
fs.mkdirSync('target/monster-game-check',{recursive:true});const root=path.resolve('games/whack-a-mole');const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:");res.end(b);});});await new Promise(r=>server.listen(18789,'127.0.0.1',r));


const browser=await chromium.launch({headless:true,...(process.env.MONSTER_BROWSER_PATH?{executablePath:process.env.MONSTER_BROWSER_PATH}:{})});
try{
const page=await browser.newPage({viewport:{width:1100,height:850},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));const act=code=>page.evaluate(code);
await page.goto('http://127.0.0.1:18789');await page.waitForFunction(()=>state==='playing');assert.equal(await page.locator('#overlay').isVisible(),false,'no start screen');assert.equal(await act(()=>profileIndex),0);assert.equal(await act(()=>holes.find(h=>h.type!==null).type>=10),true);
if(process.env.MONSTER_MUSIC_CHECK){
 assert.equal(await act(()=>music.paused),true,'wait for a user gesture');
 await page.mouse.click(550,120);
 await page.waitForFunction(()=>!music.paused&&music.currentTime>.1);
 assert.equal(await act(()=>music.loop),true);assert.equal(await act(()=>music.volume),.28);
 assert.ok(await act(()=>music.duration>0&&music.readyState>=2),'MP3 decoded');
 await page.click('#pause');assert.equal(await act(()=>music.paused),true);
 const position=await act(()=>music.currentTime);await page.waitForTimeout(200);assert.equal(await act(()=>music.currentTime),position);
 await page.click('#start');await page.waitForFunction(()=>!music.paused&&music.currentTime>0);
 await page.click('#sound');assert.equal(await act(()=>music.paused),true);assert.equal(await act(()=>soundOn),false);
 await page.click('#sound');await page.waitForFunction(()=>!music.paused);assert.equal(await act(()=>soundOn),true);
 await act(()=>finish(true,'测试结算'));assert.equal(await act(()=>music.paused),true);
 await page.click('#start');await page.waitForFunction(()=>!music.paused);
 assert.equal(await page.locator('audio').count(),0,'one programmatic player');assert.deepEqual(errors,[]);
 console.log('PASS: MP3 decode, first-gesture playback, loop, volume, pause/resume, mute/unmute, finish/replay; no browser errors');return;
}
if(process.env.MONSTER_PREVIEW){await act(()=>{cancelAnimationFrame(clock);holes.forEach(clearHole);score=20;hits=2;left=78;render();const h=holes[8];h.type=10;setActor(h);h.el.classList.add('up');});await page.waitForTimeout(450);await page.screenshot({path:'target/monster-game-check/new-desktop.png'});await page.locator('#arena').screenshot({path:'games/whack-a-mole/cover.png'});await page.click('#pause');await page.screenshot({path:'target/monster-game-check/new-pause.png'});await page.click('#start');await act(()=>cancelAnimationFrame(clock));await page.setViewportSize({width:390,height:844});await page.screenshot({path:'target/monster-game-check/new-mobile.png'});console.log('Preview saved');return;}
for(let level=0;level<4;level++){
 await page.click('#pause');await page.locator('[data-level="'+level+'"]').click();await page.click('#start');
 assert.equal(await act(()=>profileIndex),level);assert.equal(await act(()=>TARGET),[60,100,150,200][level]);
 await act(()=>{cancelAnimationFrame(clock);for(let i=0;i<MAX_LIVES;i++){clearHole(holes[0]);holes[0].type=0;hit(0);}});assert.equal(await act(()=>state),'ended');assert.equal(await act(()=>lives),0);
 await page.click('#start');await act(()=>{cancelAnimationFrame(clock);for(let i=0;i<TARGET/10;i++){clearHole(holes[0]);holes[0].type=10;hit(0);}});assert.equal(await page.locator('#title').textContent(),'守护成功！');await page.click('#start');
}
await page.click('#pause');const before=await act(()=>left);await page.waitForTimeout(200);assert.equal(await act(()=>left),before);await page.locator('[data-level="0"]').click();await page.click('#start');
await act(()=>{cancelAnimationFrame(clock);left=.001;frame(last+16);});assert.match(await page.locator('#message').textContent(),/时间到/);await page.click('#start');await act(()=>{cancelAnimationFrame(clock);TARGET=10000;});
await page.addStyleTag({content:'.actor{transition:none!important}'});
for(const viewport of [{width:1100,height:850},{width:390,height:844},{width:844,height:390}]){
 await page.setViewportSize(viewport);
 for(let scene=0;scene<3;scene++){
  await act(()=>chooseScene((sceneIndex+1)%3));
  for(let i=0;i<9;i++)for(const [x,y] of [[.5,.1],[.15,.45],[.85,.45],[.5,.9]]){
   await page.evaluate(i=>{holes.forEach(clearHole);const h=holes[i];h.type=10;h.ttl=5000;setActor(h);h.el.classList.add('up');},i);
   const box=await page.locator('.actor').nth(i).boundingBox(),previous=await act(()=>score),px=box.x+box.width*x,py=box.y+box.height*y;
   assert.ok(px>=0&&px<viewport.width&&py>=0&&py<viewport.height);
   if(viewport.width===390)await page.touchscreen.tap(px,py);else await page.mouse.click(px,py);
   assert.equal(await act(()=>score),previous+10,`missed ${viewport.width} scene ${scene} unit ${i} point ${x},${y}`);
   await page.mouse.click(px,py);assert.equal(await act(()=>score),previous+10,'no double scoring');
  }
 }
}
// Reproduce reported screenshot in the actual live same-origin iframe, with artwork
// deliberately overflowing the old button geometry. Hit the visible red-box region.
if(process.env.MONSTER_LIVE_URL){
 const live=await browser.newPage({viewport:{width:1105,height:853}});await live.goto(process.env.MONSTER_LIVE_URL);await live.waitForTimeout(700);const frame=live.frames().find(f=>/games\/whack-a-mole/.test(f.url()));assert.ok(frame);await frame.waitForFunction(()=>state==='playing');assert.equal(await frame.locator('#overlay').isVisible(),false);
 const links=await frame.evaluate(()=>[document.querySelector('link[rel=stylesheet]').href,document.querySelector('script[src]').src]);assert.ok(links.every(s=>s.includes('?v=')),'versioned CSS and JS');
 await frame.evaluate(()=>{cancelAnimationFrame(clock);holes.forEach(clearHole);const h=holes[8];h.type=10;setActor(h);h.el.classList.add('up');});
 await frame.addStyleTag({content:'.actor{top:auto;bottom:40%;transition:none!important}.hole{aspect-ratio:1.2}.hole:not(.up){pointer-events:auto}'});
 const box=await frame.locator('.actor').nth(8).boundingBox();await live.mouse.click(box.x+box.width*.5,box.y+box.height*.2);assert.equal(await frame.evaluate(()=>score),10,'reported head region in actual iframe');await live.screenshot({path:'target/monster-game-check/live-red-box-regression.png'});await live.close();
}
assert.deepEqual(errors,[]);console.log('PASS: auto-start; 4 difficulties in pause only; wins/failures; pause; 324 mouse/touch whole-unit hit points plus double-tap guards; live iframe cache version and overflowing-head regression');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
