const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
const root=path.resolve('games/bucket-captain'),out='target/bucket-captain-check';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(relative==='/')relative='/index.html';const file=path.join(root,relative);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.svg':'image/svg+xml'})[ext]||'text/html');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'");res.end(b);});});await new Promise(r=>server.listen(18791,'127.0.0.1',r));
const engine=process.env.BUCKET_BROWSER==='webkit'?'webkit':'chromium';let browser;
try{
browser=await pw[engine].launch({headless:true,...(engine==='chromium'&&process.env.MONSTER_BROWSER_PATH?{executablePath:process.env.MONSTER_BROWSER_PATH}:{})});
const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,deviceScaleFactor:2});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:18791');await page.waitForFunction(()=>window.BucketCaptain&&BucketCaptain.getState().phase==='assemble');
const state=()=>page.evaluate(()=>BucketCaptain.getState());
if(process.env.BUCKET_TOUCH_ONLY){
 const cdp=await context.newCDPSession(page);const source=await page.locator('[data-piece="0"]').boundingBox(),board=await page.locator('#assembly').boundingBox();const x=source.x+source.width/2,y=source.y+source.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});assert.equal((await state()).dragging,true);
 const tx=board.x+board.width*.59,ty=board.y+board.height*.26;
 for(let k=1;k<=12;k++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*k/12,y:y+(ty-y)*k/12,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await state()).placed[0],true,'real finger drag and generous offset snapping');
 const other=await page.locator('[data-piece="1"]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:other.x+other.width/2,y:other.y+other.height/2,id:2}]});assert.equal((await state()).dragging,true);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal((await state()).dragging,false);assert.equal((await state()).placed[1],false);
 console.log('PASS real touch input: finger drag, offset magnet snap, touch cancellation without accidental placement');return;
}
async function dragPiece(i,wrong,touch){const source=await page.locator('[data-piece="'+i+'"]').boundingBox(),board=await page.locator('#assembly').boundingBox();const centers=[.20,.52,.84],from={x:source.x+source.width/2,y:source.y+source.height/2},to={x:board.x+board.width/2,y:board.y+board.height*(wrong?centers[(i+1)%3]:centers[i])};
 if(touch){await page.locator('[data-piece="'+i+'"]').dispatchEvent('touchstart',{touches:[{identifier:5,clientX:from.x,clientY:from.y}],changedTouches:[{identifier:5,clientX:from.x,clientY:from.y}]});await page.locator('body').dispatchEvent('touchmove',{touches:[{identifier:5,clientX:to.x,clientY:to.y}],changedTouches:[{identifier:5,clientX:to.x,clientY:to.y}]});await page.locator('body').dispatchEvent('touchend',{touches:[],changedTouches:[{identifier:5,clientX:to.x,clientY:to.y}]});
 }else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:12});if(!wrong)await page.screenshot({path:out+'/'+engine+'-drag.png'});await page.mouse.up();}}
await page.screenshot({path:out+'/'+engine+'-puzzle-landscape.png'});
const taskCount=await page.evaluate(()=>BucketCaptain.tasks.length);assert.equal(taskCount,9);
const seenTasks=new Set(),orders=new Set();let previousOrder=null;
for(let t=0;t<taskCount;t++){
 const current=(await state()).task;assert.ok(!seenTasks.has(current),'no repeated stations until all nine played');seenTasks.add(current);const order=await page.locator('.choice').evaluateAll(es=>es.map(e=>e.getAttribute('data-piece')).join(','));assert.notEqual(order,previousOrder,'consecutive piece arrangements change');previousOrder=order;orders.add(order);
 assert.equal(await page.locator('.puzzle-reference').isVisible(),true);assert.ok((await page.locator('.puzzle-reference').evaluate(e=>getComputedStyle(e).backgroundImage)).includes('outline-'));assert.equal(await page.locator('#wanted').isVisible(),true);
 // Clicks alone cannot solve the puzzle.
 await page.locator('[data-piece="0"]').tap();assert.equal((await state()).step,0);
 await dragPiece(0,true,false);assert.equal((await state()).step,0,'wrong socket must not snap');
 for(const i of [2,0,1]){await dragPiece(i,false,false);assert.equal((await state()).placed[i],true,'arbitrary order');}
 await page.waitForFunction(()=>BucketCaptain.getState().phase==='complete');assert.equal((await state()).done[current],true);
 if(current===3){await page.waitForFunction(()=>BucketCaptain.getAudioState().voicePlaying);await page.click('#pause');assert.equal(await page.evaluate(()=>BucketCaptain.getAudioState().voicePlaying),false);await page.click('#resume');}
 await page.screenshot({path:out+'/'+engine+'-puzzle-task-'+t+'.png'});const nextBox=await page.locator('#next').boundingBox();assert.ok(nextBox.width>=100&&nextBox.height>=100);assert.equal(await page.locator('#next i').isVisible(),true);
 if(engine==='chromium'&&t===0)await page.screenshot({path:'games/bucket-captain/cover.jpg',type:'jpeg',quality:85});
 await page.locator('#creation').tap();await page.waitForFunction(()=>!BucketCaptain.getState().busy);
 if(t<taskCount-1)await page.locator('#next').tap();
}
assert.equal(seenTasks.size,9);assert.ok(orders.size>1,'varied piece order');const lastStation=(await state()).task;await page.locator('#next').tap();assert.notEqual((await state()).task,lastStation,'no repeat at shuffle-bag boundary');await page.click('#pause');await page.click('#restart');
// Pause/rotation cancel a held piece without losing it.
let source=await page.locator('[data-piece="0"]').boundingBox();await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(500,400);await page.evaluate(()=>document.getElementById('pause').click());assert.equal((await state()).dragging,false);assert.equal((await state()).step,0);await page.mouse.up();await page.click('#resume');
for(const size of [{width:768,height:1024},{width:1024,height:768},{width:390,height:844}]){await page.setViewportSize(size);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:out+'/'+engine+'-puzzle-'+size.width+'.png'});await dragPiece(0,false,false);assert.equal((await state()).placed[0],true);await page.click('#pause');await page.click('#restart');}
// Legacy touch fallback for older iPad Safari without PointerEvent.
const legacy=await context.newPage();await legacy.addInitScript(()=>{window.PointerEvent=undefined;});await legacy.goto('http://127.0.0.1:18791');await legacy.waitForFunction(()=>window.BucketCaptain&&BucketCaptain.getState().phase==='assemble');const oldPage=page;
let sb=await legacy.locator('[data-piece="1"]').boundingBox(),bb=await legacy.locator('#assembly').boundingBox();const start={identifier:11,clientX:sb.x+sb.width/2,clientY:sb.y+sb.height/2},end={identifier:11,clientX:bb.x+bb.width/2,clientY:bb.y+bb.height*.52};await legacy.locator('[data-piece="1"]').dispatchEvent('touchstart',{touches:[start],changedTouches:[start]});await legacy.locator('body').dispatchEvent('touchmove',{touches:[end],changedTouches:[end]});await legacy.locator('body').dispatchEvent('touchend',{touches:[],changedTouches:[end]});assert.equal(await legacy.evaluate(()=>BucketCaptain.getState().placed[1]),true,'legacy touch drag');await legacy.close();
assert.deepEqual(errors,[]);
await context.close();console.log('PASS '+engine+': 9 randomized stations without repeats, shuffled pieces with correct matching, dashed outlines and previews, exact snap and rejected wrong slots, arbitrary order, no click-to-complete, pause/cancel, responsive layouts, legacy touch fallback, zebra voice; no script errors');
}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
