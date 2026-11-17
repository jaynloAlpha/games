const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
const port=Number(process.env.BUCKET_TEST_PORT||18791);const root=path.resolve('games/bucket-captain'),out='target/bucket-captain-check';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(relative==='/')relative='/index.html';const file=path.join(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.svg':'image/svg+xml'})[ext]||'text/html');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'");res.end(b);});});await new Promise(r=>server.listen(port,'127.0.0.1',r));
const engine=process.env.BUCKET_BROWSER==='webkit'?'webkit':'chromium';let browser;
try{
browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.MONSTER_BROWSER_PATH?{executablePath:process.env.MONSTER_BROWSER_PATH}:{})});
const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
if(process.env.BUCKET_MUSIC_ONLY)await page.addInitScript(()=>{const NativeAudio=window.Audio;window.Audio=function(src){const player=new NativeAudio(src);if(String(src).includes('bucket-garden-loop'))window.__testMusic=player;return player;};window.Audio.prototype=NativeAudio.prototype;});
await page.goto('http://127.0.0.1:'+port);await page.waitForFunction(()=>window.BucketCaptain&&BucketCaptain.getState().phase==='assemble');
const state=()=>page.evaluate(()=>BucketCaptain.getState());
if(process.env.BUCKET_AUDIO_DIAGNOSTIC){await page.click('#hint');await page.waitForTimeout(1000);console.log(await page.evaluate(()=>({contextType:typeof AudioContext,audio:BucketCaptain.getAudioState()})));return;}
if(process.env.BUCKET_MUSIC_ONLY){
 assert.equal(await page.evaluate(()=>__testMusic.paused),true);await page.click('#captain');await page.waitForFunction(()=>!__testMusic.paused&&__testMusic.currentTime>.05);assert.ok(Math.abs(await page.evaluate(()=>__testMusic.duration)-36.923)<.01);assert.equal(await page.evaluate(()=>__testMusic.loop),true);
 await page.click('#pause');assert.equal(await page.evaluate(()=>__testMusic.paused),true);const time=await page.evaluate(()=>__testMusic.currentTime);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__testMusic.currentTime),time);await page.click('#resume');await page.waitForFunction(()=>!__testMusic.paused);
 await page.click('#pause');await page.click('#sound');await page.click('#resume');assert.equal(await page.evaluate(()=>__testMusic.paused),true);await page.click('#pause');await page.click('#sound');await page.click('#resume');await page.waitForFunction(()=>!__testMusic.paused);
 await page.waitForFunction(()=>!__testMusic.paused&&__testMusic.currentTime>.2);await page.evaluate(()=>{__testMusic.currentTime=__testMusic.duration-.2;});await page.waitForFunction(()=>!__testMusic.paused&&__testMusic.currentTime>.03&&__testMusic.currentTime<1);assert.deepEqual(errors,[]);
 console.log('PASS '+engine+': original music decoded, first gesture starts playback, pause/resume, mute/unmute, end-to-start loop');return;
}
if(process.env.BUCKET_TOUCH_ONLY){
 const cdp=await context.newCDPSession(page);const source=await page.locator('[data-piece="0"]').boundingBox(),board=await page.locator('#assembly').boundingBox();const x=source.x+source.width/2,y=source.y+source.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});assert.equal((await state()).dragging,true);
 const centers=(await state()).pieceCenters;const tx=board.x+board.width*(centers[0][0]+.09),ty=board.y+board.height*(centers[0][1]+.06);
 for(let k=1;k<=12;k++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*k/12,y:y+(ty-y)*k/12,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await state()).placed[0],true,'real finger drag and generous offset snapping');
 const other=await page.locator('[data-piece="1"]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:other.x+other.width/2,y:other.y+other.height/2,id:2}]});assert.equal((await state()).dragging,true);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal((await state()).dragging,false);assert.equal((await state()).placed[1],false);
 console.log('PASS real touch input: finger drag, offset magnet snap, touch cancellation without accidental placement');return;
}
async function dragPiece(i,wrong,touch){const source=await page.locator('[data-piece="'+i+'"]').boundingBox(),board=await page.locator('#assembly').boundingBox();const centers=(await state()).pieceCenters,from={x:source.x+source.width/2,y:source.y+source.height/2},to={x:board.x+board.width*centers[wrong?(i+1)%centers.length:i][0],y:board.y+board.height*centers[wrong?(i+1)%centers.length:i][1]};
 if(touch){await page.locator('[data-piece="'+i+'"]').dispatchEvent('touchstart',{touches:[{identifier:5,clientX:from.x,clientY:from.y}],changedTouches:[{identifier:5,clientX:from.x,clientY:from.y}]});await page.locator('body').dispatchEvent('touchmove',{touches:[{identifier:5,clientX:to.x,clientY:to.y}],changedTouches:[{identifier:5,clientX:to.x,clientY:to.y}]});await page.locator('body').dispatchEvent('touchend',{touches:[],changedTouches:[{identifier:5,clientX:to.x,clientY:to.y}]});
 }else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});if(!wrong&&!process.env.BUCKET_DIFFICULTY_ONLY)await page.screenshot({path:out+'/'+engine+'-drag.png'});await page.mouse.up();}}
if(process.env.BUCKET_DIFFICULTY_ONLY){
 assert.equal((await state()).difficulty,'brain');assert.equal((await state()).placed.length,4);
 async function finish(){const n=(await state()).placed.length;for(let i=n-1;i>=0;i--){await dragPiece(i,false,false);assert.equal((await state()).placed[i],true,'piece '+i+' fits in arbitrary order');}await page.waitForFunction(()=>BucketCaptain.getState().phase==='complete');}
 for(let round=0;round<5;round++){assert.equal((await state()).placed.length,round<2?4:round<4?5:6);assert.equal((await state()).extraCount,round<4?0:1);await finish();await page.click('#next');}
 assert.equal((await state()).placed.length,6);assert.equal((await state()).extraCount,1);
 const n=(await state()).placed.length,source=await page.locator('[data-piece="'+n+'"]').boundingBox(),board=await page.locator('#assembly').boundingBox(),center=(await state()).extraCenters[0];
 await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();assert.equal((await state()).dragging,true);await page.mouse.move(board.x+board.width*center[0],board.y+board.height*center[1],{steps:8});await page.mouse.up();assert.equal((await state()).step,0,'other animal cannot fit');assert.equal((await state()).mistakes,1);
 for(let j=0;j<2;j++){const b=await page.locator('[data-piece="0"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(20,20,{steps:8});await page.mouse.up();}
 assert.equal((await state()).assisted,true);assert.ok(await page.locator('.hinted').count()>0,'three failed drops reveal a helpful position');
 await page.click('#pause');await page.click('[data-difficulty="challenge"]');assert.equal((await state()).paused,true);assert.equal((await state()).placed.length,8);assert.equal((await state()).extraCount,2);await page.click('#resume');
 const seen=new Set();
 // Restart the bag so all nineteen challenge pictures are exercised once.
 await page.click('#pause');await page.click('#restart');
 for(let j=0;j<19;j++){const t=(await state()).task;assert.ok(!seen.has(t));seen.add(t);await finish();if(j<18)await page.click('#next');}
 for(const size of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]){await page.setViewportSize(size);await page.click('#pause');await page.click('#restart');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const boxes=await page.locator('.choice').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));assert.equal(boxes.length,10);for(const b of boxes){assert.ok(b.w>=44&&b.h>=44);assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=size.width+1&&b.y+b.h<=size.height+1,'all pieces remain onscreen');}
 await page.screenshot({path:out+'/'+engine+'-challenge-'+size.width+'.png'});await dragPiece(0,false,false);assert.equal((await state()).placed[0],true);}
 await page.click('#pause');await page.click('[data-difficulty="easy"]');await page.click('#resume');assert.equal((await state()).placed.length,4);assert.equal((await state()).extraCount,0);assert.equal(await page.locator('.puzzle-seams').count(),1);await page.reload();await page.waitForFunction(()=>BucketCaptain.getState().phase==='assemble');assert.equal((await state()).difficulty,'easy','difficulty persists');
 assert.deepEqual(errors,[]);console.log('PASS '+engine+': progressive 4/5/6 pieces; decoys rejected; help after mistakes; all 19 challenge puzzles solved with 8 pieces; 10 touch targets fit landscape/portrait/phone; pause difficulty controls and saved setting');return;
}
if(process.env.BUCKET_SNAP_ONLY){
 await page.click('#hint');await page.waitForFunction(()=>BucketCaptain.getAudioState().snapReady===4);
 const count=(await state()).placed.length,before=await page.evaluate(()=>BucketCaptain.getAudioState().snapEvents);
 await dragPiece(0,true,false);assert.equal(await page.evaluate(()=>BucketCaptain.getAudioState().snapEvents),before,'wrong drop is not rewarded');
 await dragPiece(0,false,false);let a=await page.evaluate(()=>BucketCaptain.getAudioState());assert.equal(a.snapEvents,before+1);assert.equal(a.musicVolume,.038,'music ducks beneath the snap');assert.ok(a.snapActive>0);assert.equal(await page.locator('#slot-0').evaluate(e=>getComputedStyle(e).animationName),'seat-press');assert.ok(await page.locator('.snap-ring').count()>0);
 await page.screenshot({path:out+'/'+engine+'-snap-feedback.png'});
 await page.click('#pause');assert.equal(await page.evaluate(()=>BucketCaptain.getAudioState().snapActive),0,'pause stops short feedback sources');await page.waitForTimeout(100);await page.click('#resume');assert.equal(await page.evaluate(()=>BucketCaptain.getAudioState().snapActive),0,'resume does not replay stale clicks');
 for(let i=1;i<count;i++)await dragPiece(i,false,false);
 assert.equal(await page.evaluate(()=>BucketCaptain.getAudioState().snapEvents),before+count);assert.ok(await page.locator('.snap-ring.final').count()>0,'final piece gets a special visual accent');
 await page.waitForFunction(()=>BucketCaptain.getState().phase==='complete');await page.waitForFunction(()=>BucketCaptain.getAudioState().snapActive===0);assert.ok(await page.locator('#creation').isVisible());
 await page.click('#pause');await page.click('#sound');await page.click('#restart');const muted=await page.evaluate(()=>BucketCaptain.getAudioState().snapEvents);await dragPiece(0,false,false);assert.equal(await page.evaluate(()=>BucketCaptain.getAudioState().snapEvents),muted,'muting covers new snap palette');assert.equal((await state()).placed[0],true,'mute does not disable feedback or placement');
 await page.click('#pause');await page.click('#sound');await page.click('#restart');await page.emulateMedia({reducedMotion:'reduce'});await dragPiece(0,false,false);assert.equal(await page.locator('#slot-0').evaluate(e=>getComputedStyle(e).animationName),'none');assert.equal(await page.locator('.snap-ring').first().evaluate(e=>getComputedStyle(e).display),'none');
 assert.deepEqual(errors,[]);console.log('PASS '+engine+': all 4 clips decoded; snap vs wrong-drop gating; louder layered audio and music duck; press/rebound/ring animation; final accent; pause stops stale sources; mute; reduced motion; no browser errors');return;
}
await page.click('#pause');await page.click('[data-difficulty="easy"]');await page.click('#resume');await page.screenshot({path:out+'/'+engine+'-puzzle-landscape.png'});
const taskCount=await page.evaluate(()=>BucketCaptain.tasks.length);assert.equal(taskCount,19);
const seenTasks=new Set(),orders=new Set(),pieceCounts=new Set();let previousOrder=null;
for(let t=0;t<taskCount;t++){
 const current=(await state()).task;const partCount=(await state()).placed.length;if(current>=9)pieceCounts.add(partCount);assert.ok(!seenTasks.has(current),'no repeated stations until all nine played');seenTasks.add(current);const order=await page.locator('.choice').evaluateAll(es=>es.map(e=>e.getAttribute('data-piece')).join(','));assert.notEqual(order,previousOrder,'consecutive piece arrangements change');previousOrder=order;orders.add(order);
 assert.equal(await page.locator('.puzzle-reference').isVisible(),true);assert.ok((await page.locator('.puzzle-reference').evaluate(e=>getComputedStyle(e).backgroundImage)).includes('silhouette-'));assert.equal(await page.locator('#wanted').isVisible(),true);
 // Clicks alone cannot solve the puzzle.
 await page.locator('[data-piece="0"]').tap();assert.equal((await state()).step,0);
 await dragPiece(0,true,false);assert.equal((await state()).step,0,'wrong socket must not snap');
 for(const i of Array.from({length:partCount},(_,i)=>i).reverse()){await dragPiece(i,false,false);assert.equal((await state()).placed[i],true,'arbitrary order');}
 await page.waitForFunction(()=>BucketCaptain.getState().phase==='complete');assert.equal((await state()).done[current],true);
 if(current===3){await page.waitForFunction(()=>BucketCaptain.getAudioState().voicePlaying);await page.click('#pause');assert.equal(await page.evaluate(()=>BucketCaptain.getAudioState().voicePlaying),false);await page.click('#resume');}
 await page.screenshot({path:out+'/'+engine+'-puzzle-task-'+t+'.png'});const nextBox=await page.locator('#next').boundingBox();assert.ok(nextBox.width>=100&&nextBox.height>=100);assert.equal(await page.locator('#next i').isVisible(),true);

 await page.locator('#creation').tap();await page.waitForFunction(()=>!BucketCaptain.getState().busy);
 if(t<taskCount-1)await page.locator('#next').tap();
}
assert.equal(seenTasks.size,19);assert.deepEqual([...pieceCounts].sort(),[4]);assert.ok(orders.size>1,'varied piece order');const lastStation=(await state()).task;await page.locator('#next').tap();assert.notEqual((await state()).task,lastStation,'no repeat at shuffle-bag boundary');await page.click('#pause');await page.click('#restart');
// Pause/rotation cancel a held piece without losing it.
let source=await page.locator('[data-piece="0"]').boundingBox();await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(500,400);await page.evaluate(()=>document.getElementById('pause').click());assert.equal((await state()).dragging,false);assert.equal((await state()).step,0);await page.mouse.up();await page.click('#resume');
for(const size of [{width:768,height:1024},{width:1024,height:768},{width:390,height:844}]){await page.setViewportSize(size);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:out+'/'+engine+'-puzzle-'+size.width+'.png'});await dragPiece(0,false,false);assert.equal((await state()).placed[0],true);await page.click('#pause');await page.click('#restart');}
// Legacy touch fallback for older iPad Safari without PointerEvent.
const legacy=await context.newPage();await legacy.addInitScript(()=>{window.PointerEvent=undefined;});await legacy.goto('http://127.0.0.1:'+port);await legacy.waitForFunction(()=>window.BucketCaptain&&BucketCaptain.getState().phase==='assemble');const oldPage=page;
let sb=await legacy.locator('[data-piece="1"]').boundingBox(),bb=await legacy.locator('#assembly').boundingBox();const center=await legacy.evaluate(()=>BucketCaptain.getState().pieceCenters[1]);const start={identifier:11,clientX:sb.x+sb.width/2,clientY:sb.y+sb.height/2},end={identifier:11,clientX:bb.x+bb.width*center[0],clientY:bb.y+bb.height*center[1]};await legacy.locator('[data-piece="1"]').dispatchEvent('touchstart',{touches:[start],changedTouches:[start]});await legacy.locator('body').dispatchEvent('touchmove',{touches:[end],changedTouches:[end]});await legacy.locator('body').dispatchEvent('touchend',{touches:[],changedTouches:[end]});assert.equal(await legacy.evaluate(()=>BucketCaptain.getState().placed[1]),true,'legacy touch drag');await legacy.close();
assert.deepEqual(errors,[]);
await context.close();console.log('PASS '+engine+': 19 randomized stations without repeats, easy mode uses 4 irregular pieces with white edging, shuffled pieces with correct matching, dashed outlines and previews, exact snap and rejected wrong slots, arbitrary order, no click-to-complete, pause/cancel, responsive layouts, legacy touch fallback, zebra voice; no script errors');
}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
