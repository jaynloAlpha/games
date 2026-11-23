(function(){'use strict';
var $=function(id){return document.getElementById(id);},P=RollingPhysics,canvas=$('canvas'),ctx=canvas.getContext('2d'),scale=1,ox=0,oy=0;
var M=RollingMissions,missions=M.list,grades=missions.map(function(){return 0;}),badges=missions.map(function(){return 0;}),expedition=false,seed=1,discoveries=0,randomMission=null,restoredChallenge=null,predictionMode=false,wind=0,lastPin=0;
var playground={name:'自由探索',text:'抬高、换路、吹吹风。',kind:'basket',h:true,s:true,f:true,pins:[],patch:null};
var level=0,free=false,completed=missions.map(function(){return false;}),height=70,surface=2,phase='idle',paused=false,sound=true,flag=null,history=[],won=false,run=null,elapsed=0,raf=0,lastTime=0,drag=null,ring=false,effect=0,audio=null,tones=[],foley=RollingFoley.create();
var sprites={},artReady=false,motionClock=0;var artNames=['ball-red','ball-blue','ramp-board','bell-goal','basket-goal','flag','surface-wood','surface-felt','surface-grass','next-button','pause-button','cushion','height-handle','reward-star','bear-cheer','bear','fan','domino'];
try{var saved=JSON.parse(localStorage.getItem('rolling-lab-v1')||'null');if(saved){level=Math.max(0,Math.min(missions.length-1,Number(saved.level)||0));predictionMode=!!saved.predictionMode;seed=Math.max(1,Number(saved.seed)||1);discoveries=Math.max(0,Number(saved.discoveries)||0);expedition=!!saved.expedition;restoredChallenge=saved.challenge||null;if(Array.isArray(saved.grades))grades=grades.map(function(v,i){return Math.min(3,Number(saved.grades[i])||0);});if(Array.isArray(saved.badges))badges=badges.map(function(v,i){return (Number(saved.badges[i])||0)&7;});if(Array.isArray(saved.completed))completed=completed.map(function(v,i){return !!saved.completed[i];});}}catch(e){}
completed.forEach(function(done,i){if(done){badges[i]|=1;grades[i]=Math.max(grades[i],1);}});
function save(){try{localStorage.setItem('rolling-lab-v1',JSON.stringify({level:level,completed:completed,predictionMode:predictionMode,grades:grades,badges:badges,expedition:expedition,seed:seed,discoveries:discoveries,challenge:expedition?randomMission:null}));}catch(e){}}
function speak(t){if(!sound||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;try{speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(t);u.lang='zh-CN';u.rate=.86;u.pitch=1.07;speechSynthesis.speak(u);}catch(e){}}
function say(t){$('feedback').textContent=t;}
function unlock(){if(!audio)try{var C=window.AudioContext||window.webkitAudioContext;if(C)audio=new C();}catch(e){}foley.attach(audio);if(audio&&audio.state==='suspended')audio.resume().catch(function(){});}
function tone(f,d,volume){if(!audio||!sound||paused)return;var o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type='sine';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*.7,t+d);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume||.1,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(audio.destination);tones.push(o);o.start();o.stop(t+d+.02);o.onended=function(){tones=tones.filter(function(n){return n!==o;});o.disconnect();g.disconnect();};}
function stopTones(){tones.slice().forEach(function(o){try{o.stop();}catch(e){}});tones=[];}
function followBall(trial,time,x){
 if(!sound)return;
 var before=Math.max(0,time-.03),after=Math.min(trial.duration,time+.03);
 var speed=(P.sample(trial,after).angle-P.sample(trial,before).angle)*24/Math.max(.001,after-before);
 var patch=trial.options.patch;
 var material=x<390?0:patch&&x>=patch[0]&&x<=patch[1]?2:trial.surface;
 foley.roll(material,speed,x);
}
function impact(name,x,volume,rate){if(sound)foley.impact(name,x,volume,rate);}
function goalVoice(){var m=mission();return free?'动一动，再点小球！':predictionMode&&m.predict?'点跑道上方，猜猜停哪里！':m.kind==='height'?'抬抬坡道，再点小球！':m.kind==='surface'?'换条跑道，再滚一次！':m.f?'转转风扇，把球送进篮子！':(m.pins||[]).length?'推倒积木，把球送进篮子！':m.kind==='basket'?'把小球送给小熊！':'让小球碰响铃铛！';}
function mission(){return free?playground:expedition?randomMission:missions[level];}
function trialOptions(){return M.options(mission(),wind);}
function sameConditions(a,b){return a.height===b.height&&a.surface===b.surface&&(a.wind||0)===(b.wind||0);}
function baseline(){return history.length?history[history.length-1]:null;}
function setCondition(key,value){if(paused||phase!=='idle'||won)return false;var m=mission();if(!free&&!(key==='height'?m.h:key==='wind'?m.f:m.s)){say(key==='height'?'这次把高度保持不变，只换地面。':'这次地面保持不变，只改高度。');return false;}var nextH=key==='height'?value:height,nextS=key==='surface'?value:surface,nextW=key==='wind'?value:wind,b=baseline();if(b&&Number(nextH!==b.height)+Number(nextS!==b.surface)+Number(nextW!==(b.wind||0))>1){say('每次只改一个条件。');return false;}height=nextH;surface=nextS;wind=nextW;tone(380,.09,.045);sync();draw();return true;}
function sync(){
 var editable=phase==='idle'&&!won;
 var locked=!editable||paused||!artReady;
 $('game').dataset.stage=phase==='idle'&&won?'success':phase;
 $('prediction-mode').setAttribute('aria-pressed',String(predictionMode));
 $('prediction-mode').textContent='预测挑战：'+(predictionMode?'开':'关');
 $('surface-control').hidden=!editable||!mission().s;
 $('surface-control').disabled=locked;
 $('launch').hidden=!editable;
 $('launch').disabled=locked;
 $('height').disabled=locked||!mission().h;
 $('try-again').disabled=!won||phase!=='idle';
 $('replay').disabled=phase!=='idle'||!artReady||history.length<2;
 $('next').hidden=!won||free||phase!=='idle';
 $('task-mode').setAttribute('aria-pressed',String(!free&&!expedition));$('free-mode').setAttribute('aria-pressed',String(free));$('undo').disabled=!baseline()||phase!=='idle';$('fan-control').hidden=!mission().f;$('fan-control').disabled=locked;$('fan-control').dataset.wind=wind;$('fan-direction').style.transform=wind<0?'rotate(180deg)':'none';$('fan-direction').src='assets/'+(wind===0?'pause-button':'next-button')+'.png';$('fan-control').setAttribute('aria-label',wind===0?'风扇关闭，点一下改变风向':wind>0?'顺风，点一下改变风向':'逆风，点一下改变风向');$('chapter').innerHTML='';var base=Math.floor(level/6)*6;for(var ci=0;ci<6;ci++){var star=document.createElement('img'),done=expedition?ci<discoveries%6:completed[base+ci];star.src='assets/reward-star.png';star.alt=done?'已完成':'还没完成';star.className=(done?'done ':'')+(!expedition&&base+ci===level?'current':'');$('chapter').appendChild(star);}$('chapter').setAttribute('aria-label',expedition?'探索完成'+discoveries+'个挑战':'第'+(Math.floor(level/6)+1)+'组实验进度');$('collection').textContent=grades.reduce(function(a,b){return a+b;},0)+' / 72';$('endless-mode').setAttribute('aria-pressed',String(expedition));document.querySelectorAll('[data-level]').forEach(function(b){var i=Number(b.dataset.level);b.setAttribute('aria-current',String(!free&&!expedition&&i===level));b.textContent=(i+1)+' '+(grades[i]?'★'.repeat(grades[i]):'');});positionHandle();scheduleIdleHint();}
function begin(index,isFree,isEndless){foley.silence();cancelAnimationFrame(raf);raf=0;level=index;free=!!isFree;expedition=!!isEndless;if(expedition){randomMission=restoredChallenge||M.expedition(seed,randomMission);restoredChallenge=null;}height=free?120:mission().height;surface=free?1:mission().surface;wind=free?0:mission().wind||0;lastPin=0;history=[];flag=null;phase='idle';run=null;won=false;ring=false;effect=0;drag=null;elapsed=0;motionClock=0;delete $('next').dataset.counted;$('instruction').textContent=free?'抬高坡道、换地面，发现自己的小秘密。':mission().text;$('feedback').textContent='';save();sync();draw();}
function launch(){if(paused||phase!=='idle'||won||!artReady)return;unlock();if(predictionMode&&!free&&mission().predict&&flag===null){say('先放小旗');return;}run=P.simulate(height,surface,trialOptions());lastPin=0;run.prediction=flag;flag=null;elapsed=0;ring=false;phase='playing';$('feedback').textContent='小球出发啦，仔细看看！';sync();startAnimation();}
function relation(a,b){if((a.wind||0)!==(b.wind||0))return b.wind>a.wind?'向前的风更强，这次小球滚得更远。':'向后的风让小球减速，这次停得更近。';if(a.height!==b.height&&a.surface===b.surface)return b.height>a.height?'坡道抬高后，这次滚得更远啦！':'坡道放低后，这次停得更近啦！';if(a.height===b.height&&a.surface!==b.surface)return P.surfaces[b.surface].mu<P.surfaces[a.surface].mu?'高度没变，换成更光滑的地面，小球滚得更远。':'高度没变，换成阻力更大的地面，小球停得更近。';return '条件相同，结果也差不多。再改变一个条件试试。';}
function finish(){phase='idle';var previous=baseline();history.push(run);if(history.length>4)history.shift();var m=mission();won=!free&&M.success(m,run,previous);if(won){if(expedition){if(!$('next').dataset.counted){discoveries++;$('next').dataset.counted='yes';}}else{completed[level]=true;badges[level]|=1;if(run.prediction!==null&&Math.abs(run.prediction-run.x)<65)badges[level]|=2;if(history.some(function(t){return !sameConditions(t,run);}))badges[level]|=4;grades[level]=Number(!!(badges[level]&1))+Number(!!(badges[level]&2))+Number(!!(badges[level]&4));}save();effect=1.3;$('game').classList.add('celebrate');}var text=previous?relation(previous,run):'记住小球停在哪里。改一个条件，再试一次吧！';if(!free&&m.kind==='basket'&&!won)text=run.x<m.target-45?'还没到接球篮。想想怎样让它再远一点。':'超过接球篮了。想想怎样让它慢一点。';if(!free&&!won&&(m.pins||[]).length>run.events.length)text='还有积木没倒下，试着多一点冲劲。';if(!free&&m.kind==='bell'&&!won)text='还没有碰到铃铛，看看怎样让它再远一点。';if(won&&m.kind==='bell')text='叮！铃铛响啦！'+(previous?relation(previous,run):'你让小球送到啦！');if(won&&m.kind==='basket')text='停得刚刚好！小熊收到小球啦！';if(run.cushion)text='小球碰到了尽头的软垫。'+text;if(run.prediction!==null&&run.prediction!==undefined)text+=Math.abs(run.prediction-run.x)<65?' 你的小旗猜得很接近！':run.prediction<run.x?' 这次比小旗更远。':' 这次比小旗更近。';say(text);sync();draw();}
function replay(){if(history.length<2||paused||phase!=='idle')return;unlock();phase='replay';elapsed=0;foley.silence();say('一起比一比');sync();startAnimation();}
function startAnimation(){if(raf||paused)return;lastTime=0;raf=requestAnimationFrame(frame);}
function frame(t){
 raf=0;
 if(paused)return;
 var dt=lastTime?Math.min(.05,(t-lastTime)/1000):0;
 lastTime=t;
 motionClock+=dt;
 if(phase==='playing'){
  elapsed=Math.min(run.duration,elapsed+dt);
  var p=P.sample(run,elapsed);
  if(elapsed<run.duration)followBall(run,elapsed,p.x);
  while(lastPin<run.events.length&&elapsed>=run.events[lastPin].t){
   var event=run.events[lastPin++];
   impact('block',event.x,.68,1.01-lastPin*.035);
  }
  var m=mission();
  if(!free&&m.kind==='bell'&&!ring&&p.x>=m.target-22){
   ring=true;
   impact('bell',m.target,.62);
  }
  if(elapsed>=run.duration){
   foley.stopRoll(true);
   var succeeded=!free&&M.success(m,run,baseline());
   if(run.cushion)impact('soft',run.x,.65);
   else if(run.stoppedAtPin)impact('block',run.x,.38,.86);
   else if(succeeded&&m.kind==='basket')impact('basket',m.target,.66);
   if(succeeded)finish();
   else{
    phase='observing';
    sync();
   }
  }
 }else if(phase==='observing'){
  elapsed+=dt;
  if(elapsed>=run.duration+1.1)finish();
 }else if(phase==='replay'){
  elapsed+=dt;
  var latest=baseline(),older=history[history.length-2];
  if(elapsed<latest.duration)followBall(latest,elapsed,P.sample(latest,elapsed).x);
  else if(elapsed-dt<latest.duration)foley.stopRoll(true);
  if(elapsed>=Math.max(latest.duration,older.duration)+.5){
   phase='idle';
   sync();
  }
 }
 if(effect>0){
  effect=Math.max(0,effect-dt);
  if(!effect)$('game').classList.remove('celebrate');
 }
 draw();
 if(phase!=='idle'||effect>0)raf=requestAnimationFrame(frame);
}
function pause(){if(paused)return;paused=true;$('game').dataset.paused='true';drag=null;cancelAnimationFrame(raf);raf=0;foley.silence();stopTones();if(window.speechSynthesis)speechSynthesis.cancel();$('menu').hidden=false;sync();$('resume').focus();}
function resume(){paused=false;$('game').dataset.paused='false';$('menu').hidden=true;sync();if(sound&&(phase==='playing'||phase==='replay'))unlock();if(phase!=='idle'||effect>0)startAnimation();draw();}
function image(id,x,y,w,h,alpha){var img=sprites[id];if(!img||!img.naturalWidth)return;ctx.save();ctx.globalAlpha=alpha===undefined?1:alpha;ctx.drawImage(img,x,y,w,h);ctx.restore();}
function ball(p,color,alpha){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle||0);image(color==='blue'?'ball-blue':'ball-red',-24,-24,48,48,alpha);ctx.restore();}
function flagArt(x,y,alpha){image('flag',x-5,y-86,56,88,alpha);}
function plank(x,y,x2,y2,width,alpha){ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(y2-y,x2-x));image('ramp-board',0,0,Math.hypot(x2-x,y2-y),width,alpha);ctx.restore();}
function draw(){if(!ctx||!canvas.width)return;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);if(!artReady)return;var dpr=Math.min(2,window.devicePixelRatio||1);ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*ox,dpr*oy);ctx.lineJoin='round';ctx.lineCap='round';var g=P.ground,startY=g-height;
 for(var x=390;x<1130;x+=185)image(['surface-wood','surface-felt','surface-grass'][surface],x,g-2,188,49);
 var patch=mission().patch;if(patch)image('surface-grass',patch[0],g-4,patch[1]-patch[0],53);
 if(mission().f){plank(690,g-170,690,g,12);plank(665,g,715,g,12);ctx.save();ctx.translate(690,g-185);if(wind<0)ctx.scale(-1,1);image('fan',-45,-75,90,90);ctx.restore();}
 (mission().pins||[]).forEach(function(px){var showingRun=phase==='playing'||phase==='observing',trial=showingRun?run:won?baseline():null,time=showingRun?elapsed:trial?trial.duration:0,event=trial&&trial.events.filter(function(e){return e.x===px&&e.t<=time;})[0];ctx.save();ctx.translate(px,g);if(event)ctx.rotate(Math.min(1,(time-event.t)*5)*Math.PI*.48);image('domino',-15,-78,30,78);ctx.restore();});
 image('cushion',1093,g-35,44,86);
 plank(150,startY+24,150,g+32,16);plank(245,startY+height*115/260+20,245,g+32,14);plank(135,g+30,270,g+30,14);plank(130,startY,390,g,28);
 var happy=won||(phase==='playing'&&ring);var bob=happy&&!paused?Math.sin(motionClock*11)*6:0;var bearX=mission().target?Math.min(1005,Math.max(680,mission().target+55)):985;image(happy?'bear-cheer':'bear',bearX,g-170+bob,135,165);
 if(!free&&mission().target){var tx=mission().target;if(mission().kind==='basket')image('basket-goal',tx-67,g-32,134,83);else{ctx.save();ctx.translate(tx,g+5);if(ring&&(phase==='playing'||effect>0))ctx.rotate(Math.sin(motionClock*19)*.025);image('bell-goal',-65,-135,130,145);ctx.restore();}}
 if(predictionMode){if(flag!==null)flagArt(flag,g);else if(phase==='playing'&&run.prediction!==null)flagArt(run.prediction,g,.7);}
 if(phase==='replay'){var old=history[history.length-2],now=history[history.length-1];plank(130,g-old.height,390,g,17,.3);image(['surface-wood','surface-felt','surface-grass'][old.surface],540,g+135,90,22,.5);image('ball-blue',510,g+134,22,22,.7);image(['surface-wood','surface-felt','surface-grass'][now.surface],825,g+135,90,22);image('ball-red',795,g+134,22,22);}
 if(phase==='playing'||phase==='observing')ball(P.sample(run,elapsed));
 else if(phase==='replay'){ball(P.sample(history[history.length-2],elapsed),'blue',.65);ball(P.sample(history[history.length-1],elapsed));}
 else if(won&&mission().kind==='basket')ball({x:mission().target,y:g-24,angle:0});
 else if(won&&history.length)ball(P.sample(baseline(),baseline().duration));
 else ball({x:130,y:startY-24,angle:0});
 if(effect>0&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){var origin=mission().target||760;for(var j=0;j<10;j++){var a=j*Math.PI/5,r=(1.3-effect)*100;ctx.save();ctx.translate(origin+Math.cos(a)*r,g-75+Math.sin(a)*r);ctx.rotate(motionClock+j);image('reward-star',-12,-12,24,24,Math.min(1,effect));ctx.restore();}}

}
var IDLE_HINT_DELAY=10000, IDLE_HINT_DURATION=1600;
var hintTimer=0, pulseTimer=0, hintedTargets=[];

function clearIdleHint(){
 clearTimeout(hintTimer);
 clearTimeout(pulseTimer);
 hintedTargets.forEach(function(target){target.classList.remove('touch-hint');});
 hintedTargets=[];
}

function canShowIdleHint(){
 return artReady&&!document.hidden&&!paused&&phase==='idle'&&!drag;
}

function showIdleHint(){
 if(!canShowIdleHint())return;
 if(won){
  hintedTargets=[$('next')];
 }else{
  var needsFlag=predictionMode&&!free&&mission().predict&&flag===null;
  hintedTargets=[needsFlag?$('flag-zone'):$('launch')];
  var previous=baseline();
  var changed=null;
  if(previous){
   if(height!==previous.height)changed='height';
   else if(surface!==previous.surface)changed='surface-control';
   else if(wind!==(previous.wind||0))changed='fan-control';
  }
  ['height','surface-control','fan-control'].forEach(function(id){
   var control=$(id);
   if(!control.hidden&&!control.disabled&&(!changed||changed===id))hintedTargets.push(control);
  });
 }
 hintedTargets.forEach(function(target){target.classList.add('touch-hint');});
 pulseTimer=setTimeout(clearIdleHint,IDLE_HINT_DURATION);
}

function scheduleIdleHint(){
 clearIdleHint();
 if(canShowIdleHint())hintTimer=setTimeout(showIdleHint,IDLE_HINT_DELAY);
}

function positionHandle(){var cr=canvas.getBoundingClientRect(),gr=$('game').getBoundingClientRect(),fc=$('fan-control');fc.style.left=(cr.left-gr.left+ox+645*scale)+'px';fc.style.top=(cr.top-gr.top+oy+(P.ground-260)*scale)+'px';fc.style.width=Math.max(52,90*scale)+'px';fc.style.height=Math.max(52,90*scale)+'px';var launch=$('launch');launch.style.left=(cr.left-gr.left+ox+130*scale)+'px';launch.style.top=(cr.top-gr.top+oy+(P.ground-height-24)*scale)+'px';launch.style.width=Math.max(64,65*scale)+'px';launch.style.height=Math.max(64,65*scale)+'px';var road=$('surface-control');road.style.left=(cr.left-gr.left+ox+400*scale)+'px';road.style.top=(cr.top-gr.top+oy+(P.ground+6)*scale)+'px';road.style.width=(690*scale)+'px';road.style.height=Math.max(48,52*scale)+'px';var b=$('height');b.style.left=(ox+80*scale)+'px';b.style.top=(oy+(P.ground-height-24)*scale+Math.max(89*scale,48))+'px';b.hidden=!free&&!mission().h;var zone=$('flag-zone');zone.style.left=(ox+400*scale)+'px';zone.style.top=(oy+(P.ground-102)*scale)+'px';zone.style.width=(690*scale)+'px';zone.style.height=(100*scale)+'px';}
function resize(){drag=null;var r=canvas.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);scale=Math.min(r.width/1200,r.height/560);ox=(r.width-1200*scale)/2;oy=(r.height-560*scale)/2;positionHandle();scheduleIdleHint();draw();}
function point(e,end){var t=e.changedTouches&&end?e.changedTouches[0]:e.touches?e.touches[0]:e;if(e.touches&&drag&&drag.touch!==null){t=null;for(var i=0;i<e.touches.length;i++)if(e.touches[i].identifier===drag.touch)t=e.touches[i];}if(!t)return null;var r=canvas.getBoundingClientRect();return {x:(t.clientX-r.left-ox)/scale,y:(t.clientY-r.top-oy)/scale,clientY:t.clientY};}
function putFlag(p){if(!predictionMode||won||paused||phase!=='idle')return;if(p.x>=400&&p.x<=1090&&Math.abs(p.y-P.ground)<110){flag=Math.max(420,Math.min(1080,p.x));tone(560,.1,.04);draw();}}
function down(e,handle){if(paused||won||phase!=='idle'||e.button!==undefined&&e.button!==0||drag)return;unlock();var p=point(e);if(!p)return;e.preventDefault();if(!handle&&mission().h&&p.x>=100&&p.x<=375&&Math.abs(p.y-(P.ground-height+height*(p.x-130)/260))<60)handle=true;drag={handle:handle,start:p.clientY,height:height,moved:false,id:e.pointerId,touch:e.touches?e.touches[0].identifier:null};if(!handle)putFlag(p);if(e.currentTarget.setPointerCapture&&e.pointerId!==undefined)try{e.currentTarget.setPointerCapture(e.pointerId);}catch(ignore){}}
function move(e){if(!drag||e.pointerId!==undefined&&drag.id!==undefined&&e.pointerId!==drag.id)return;if(e.touches&&drag.touch!==null){var own=false;for(var i=0;i<e.touches.length;i++)if(e.touches[i].identifier===drag.touch)own=true;if(!own)return;}var p=point(e);if(!p)return;if(e.cancelable)e.preventDefault();drag.moved=drag.moved||Math.abs(p.clientY-drag.start)>7;if(drag.handle&&drag.moved){var h=drag.height+(drag.start-p.clientY)/scale,closest=P.heights.reduce(function(a,b){return Math.abs(b-h)<Math.abs(a-h)?b:a;});if(closest!==height)setCondition('height',closest);}else if(!drag.handle)putFlag(p);}
function up(e,cancel){if(!drag||e.pointerId!==undefined&&drag.id!==undefined&&e.pointerId!==drag.id)return;if(e.changedTouches&&drag.touch!==null){var own=false;for(var i=0;i<e.changedTouches.length;i++)if(e.changedTouches[i].identifier===drag.touch)own=true;if(!own&&e.type!=='touchcancel')return;}var d=drag;drag=null;if(e.cancelable)e.preventDefault();if(!cancel&&d.handle&&!d.moved)setCondition('height',P.heights[(P.heights.indexOf(height)+1)%3]);}
[['height',true],['canvas',false]].forEach(function(pair){var el=$(pair[0]);if(window.PointerEvent)el.addEventListener('pointerdown',function(e){down(e,pair[1]);});else{el.addEventListener('touchstart',function(e){down(e,pair[1]);},{passive:false});el.addEventListener('mousedown',function(e){down(e,pair[1]);});}});
if(window.PointerEvent){window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',function(e){up(e,false);});window.addEventListener('pointercancel',function(e){up(e,true);});}else{window.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',function(e){up(e,false);},{passive:false});window.addEventListener('touchcancel',function(e){up(e,true);},{passive:false});window.addEventListener('mousemove',move);window.addEventListener('mouseup',function(e){up(e,false);});}
$('height').addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();unlock();setCondition('height',P.heights[(P.heights.indexOf(height)+1)%3]);}});
function hint(){resume();unlock();speak(goalVoice());}
$('surface-control').onclick=function(){unlock();var next=(surface+1)%3;setCondition('surface',next);};$('prediction-mode').onclick=function(){predictionMode=!predictionMode;flag=null;save();sync();draw();};$('try-again').onclick=function(){won=false;effect=0;$('game').classList.remove('celebrate');resume();};
$('fan-control').onclick=function(){unlock();setCondition('wind',wind===-1?0:wind===0?1:-1);};$('endless-mode').onclick=function(){begin(level,false,true);};$('toy-domino').onclick=function(){playground.pins=playground.pins.length?[]:[530,650,770];begin(level,true);};$('toy-patch').onclick=function(){playground.patch=playground.patch?null:[650,830];begin(level,true);};$('speech').onclick=hint;$('launch').onclick=function(event){
 // On touch screens, changing the ramp can move the ball under the finger
 // before Chromium delivers the click. Require the press to have started there.
 if(window.PointerEvent&&event.detail!==0&&!pressedBall)return;
 pressedBall=false;
 launch();
};$('replay').onclick=function(){if(paused)resume();replay();};$('pause').onclick=pause;$('resume').onclick=resume;$('next').onclick=function(){if(paused||phase!=='idle'||!won)return;if(expedition||level===missions.length-1){seed++;begin(level,false,true);}else begin(level+1,false);};$('sound').onclick=function(){sound=!sound;$('sound').textContent='声音：'+(sound?'开':'关');if(!sound){foley.silence();stopTones();if(window.speechSynthesis)speechSynthesis.cancel();}else unlock();};$('undo').onclick=function(){var b=baseline();if(b&&phase==='idle'){height=b.height;surface=b.surface;wind=b.wind||0;sync();draw();}};$('task-mode').onclick=function(){begin(level,false);};$('free-mode').onclick=function(){begin(level,true);};
missions.forEach(function(m,i){if(i%6===0){var label=document.createElement('strong');label.textContent=['滚球起步','多米诺乐园','风车山谷','机关实验室'][Math.floor(i/6)];$('levels').appendChild(label);}var b=document.createElement('button');b.dataset.level=i;b.setAttribute('aria-label','实验'+(i+1)+'：'+m.name);b.onclick=function(){begin(i,false);};$('levels').appendChild(b);});
// Capture clears hints at the start of input, and the release restarts the idle timer.
var playArea=$('game'),pressedBall=false;
if(window.PointerEvent){
 playArea.addEventListener('pointerdown',function(event){
  pressedBall=event.target===$('launch');
  clearIdleHint();
 },true);
 window.addEventListener('pointerup',scheduleIdleHint);
 window.addEventListener('pointercancel',scheduleIdleHint);
}else{
 playArea.addEventListener('touchstart',clearIdleHint,true);
 playArea.addEventListener('mousedown',clearIdleHint,true);
 window.addEventListener('touchend',scheduleIdleHint);
 window.addEventListener('touchcancel',scheduleIdleHint);
 window.addEventListener('mouseup',scheduleIdleHint);
}
playArea.addEventListener('click',scheduleIdleHint,true);
document.addEventListener('keydown',scheduleIdleHint,true);
document.addEventListener('visibilitychange',function(){if(document.hidden)pause();});window.addEventListener('pagehide',function(){pause();});window.addEventListener('resize',resize);window.addEventListener('orientationchange',function(){resize();setTimeout(resize,150);});if(window.ResizeObserver)new ResizeObserver(resize).observe($('scene'));document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(paused)resume();else pause();}});
begin(level,false,expedition);resize();Promise.all(artNames.map(function(id){return new Promise(function(resolve,reject){var img=new Image();img.onload=resolve;img.onerror=reject;img.src='assets/'+id+'.png';sprites[id]=img;});})).then(function(){artReady=true;sync();draw();}).catch(function(){say('图片加载中，请刷新重试');});window.RollingLab={getState:function(){return {artReady:artReady,level:level,free:free,height:height,surface:surface,wind:wind,expedition:expedition,seed:seed,discoveries:discoveries,grades:grades.slice(),badges:badges.slice(),mission:mission(),predictionMode:predictionMode,phase:phase,paused:paused,flag:flag,won:won,elapsed:elapsed,completed:completed.slice(),history:history.map(function(t){return {height:t.height,surface:t.surface,wind:t.wind,events:t.events,x:t.x,prediction:t.prediction,duration:t.duration,cushion:t.cushion};}),scale:scale,offset:[ox,oy]};},missions:missions};
}());
