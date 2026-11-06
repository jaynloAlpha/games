'use strict';
const $=id=>document.getElementById(id);
const profiles=[
 {age:'3–4 岁',target:60,duration:90,lives:5,show:5000,interval:1200,simultaneous:1,heroChance:.15,penalty:10},
 {age:'5–6 岁',target:100,duration:75,lives:4,show:3500,interval:1000,simultaneous:2,heroChance:.22,penalty:10},
 {age:'7–8 岁',target:150,duration:60,lives:3,show:2400,interval:850,simultaneous:2,heroChance:.28,penalty:15},
 {age:'9–10 岁',target:200,duration:60,lives:3,show:1600,interval:650,simultaneous:3,heroChance:.32,penalty:20}
];
let profileIndex=0,selectedProfile=0,profile=profiles[0],TARGET=profile.target,DURATION=profile.duration,MAX_LIVES=profile.lives;
const names=['初代奥特曼','赛文奥特曼','泰罗奥特曼','迪迦奥特曼','戴拿奥特曼','盖亚奥特曼','高斯奥特曼','奈克瑟斯','梦比优斯','赛罗奥特曼','哥莫拉','巴尔坦星人','雷德王','艾雷王','皮古蒙','贝蒙斯坦','杰顿','金古桥','达达','巴顿'];
const holes=[];let state='ready',score=0,lives=MAX_LIVES,combo=0,hits=0,mistakes=0,left=DURATION,last=0,spawnIn=0,clock=null,soundOn=true,audio=null;
// Keep one music player for the lifetime of the game; resume from the same point.
const music=new Audio('assets/toy-town-adventure.mp3');
music.loop=true;music.preload='auto';music.volume=.28;
const wrongSound=new Audio('assets/wrong-ultraman.wav');
wrongSound.preload='auto';wrongSound.volume=.62;
let wrongFx=null;
function clearWrongFeedback(complete=false){
 const onComplete=complete&&wrongFx&&wrongFx.onComplete;
 if(wrongFx){clearTimeout(wrongFx.timer);wrongFx.layer.remove();wrongFx=null;}
 wrongSound.pause();wrongSound.currentTime=0;music.volume=.28;$('grid').style.animation='';if(onComplete)onComplete();
}
function pauseWrongFeedback(){
 if(!wrongFx)return;clearTimeout(wrongFx.timer);wrongFx.remaining=Math.max(0,wrongFx.remaining-(performance.now()-wrongFx.started));wrongFx.layer.classList.add('effect-paused');$('grid').style.animationPlayState='paused';wrongSound.pause();
}
function resumeWrongFeedback(){
 if(!wrongFx)return;wrongFx.started=performance.now();wrongFx.layer.classList.remove('effect-paused');$('grid').style.animationPlayState='running';wrongFx.timer=setTimeout(()=>clearWrongFeedback(true),wrongFx.remaining);
 if(soundOn&&wrongFx.soundEnabled)wrongSound.play().catch(()=>{});
}
function wrongFeedback(h){
 clearWrongFeedback();const a=$('arena').getBoundingClientRect(),r=h.el.querySelector('.actor').getBoundingClientRect();
 const x=r.left-a.left+r.width*.5,y=r.top-a.top+r.height*.4,tx=a.width*.5,ty=a.height*.5;
 const zoom=Math.hypot(a.width,a.height)/80*1.3;
 const layer=document.createElement('div');layer.className='wrong-feedback';layer.setAttribute('aria-hidden','true');
 const charge=document.createElement('i');charge.className='wave-charge';charge.style.cssText=`left:${x}px;top:${y}px`;
 const beam=document.createElement('i');beam.className='wave-projectile';beam.style.cssText=`left:${x}px;top:${y}px;--travel-x:${tx-x}px;--travel-y:${ty-y}px;--near-scale:${zoom};`;
 const flash=document.createElement('i');flash.className='wave-impact';
 const cracks=document.createElement('img');cracks.className='screen-cracks';cracks.src='assets/screen-glass.png';cracks.alt='';
 layer.append(charge,beam,flash,cracks);$('arena').append(layer);$('grid').style.animation='none';void $('grid').offsetWidth;$('grid').style.animation='lens-recoil 2.9s both';
 wrongFx={layer,remaining:2900,started:performance.now(),soundEnabled:soundOn,timer:setTimeout(()=>clearWrongFeedback(true),2900)};
 if(soundOn){wrongSound.currentTime=0;wrongSound.play().catch(()=>{if(soundOn){tone(240,.2,0,'triangle');tone(180,.25,.13);}});}
 music.volume=.12;
}
let musicUnlocked=false;
function syncMusic(){
 if(state==='playing'&&soundOn&&musicUnlocked&&!document.hidden){
  if(music.paused)music.play().catch(()=>{});
 }else music.pause();
}
for(let i=0;i<9;i++){const el=document.createElement('button');el.className='hole';el.setAttribute('aria-label',`位置 ${i+1}，空地`);el.innerHTML='<i class="sprite actor"></i><i class="prop"></i><span class="target-cue" aria-hidden="true"></span><span class="key">'+(i+1)+'</span>';el.addEventListener('click',e=>{if(e.detail===0){unlockAudio();hit(i);}});$('grid').append(el);holes.push({el,type:null,ttl:0,locked:false});}
function tone(f,d=.15,delay=0,type='sine',volume=.09){if(!soundOn||!audio)return;const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*.65,t+d);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+d);}
function sfx(kind){if(kind==='hit'){tone(160,.11,0,'triangle',.18);tone(880,.18,.025);tone(1320,.15,.08);}if(kind==='pop')tone(420,.07,0,'sine',.025);if(kind==='win')[523,659,784,1047,1318].forEach((f,i)=>tone(f,.3,i*.12));if(kind==='lose')[440,349,262].forEach((f,i)=>tone(f,.3,i*.18));}
let renderKey='';
function render(){
 const key=[score,lives,Math.ceil(left),TARGET,MAX_LIVES].join(':');if(key===renderKey)return;renderKey=key;
 $('score').textContent=score+' / '+TARGET;
 $('time').textContent=Math.ceil(left);
 $('energy').innerHTML=Array.from({length:6},(_,i)=>`<i class="goal-star ${i<Math.floor(Math.max(0,score)/TARGET*6)?'lit':''}"></i>`).join('');
 $('hearts').innerHTML=Array.from({length:MAX_LIVES},(_,i)=>`<i class="heart-balloon ${i>=lives?'lost':''}"></i>`).join('');
 $('hearts').setAttribute('aria-label',lives+' 颗爱心');
 $('arena').style.setProperty('--day',left/DURATION);
}
function clearHole(h){h.type=null;h.locked=false;h.el.classList.remove('up','hit','wrong');h.el.setAttribute('aria-label','空地');}
function spawn(){const free=holes.filter(h=>h.type===null&&!h.locked);if(!free.length)return;const h=free[Math.floor(Math.random()*free.length)];h.type=hits>=2&&Math.random()<profile.heroChance?Math.floor(Math.random()*10):10+Math.floor(Math.random()*10);h.ttl=profile.show;setActor(h);h.el.setAttribute('aria-label',names[h.type]+(h.type<10?'，请保护':'，点击得分'));h.el.classList.add('up');h.el.querySelector('.target-cue').textContent=h.type<10?'♥':'★';sfx('pop');}
function burst(h,bad){const r=h.el.getBoundingClientRect(),a=$('arena').getBoundingClientRect(),x=r.left-a.left+r.width/2,y=r.top-a.top+r.height*.35;const p=document.createElement('div');p.className='pop'+(bad?' bad':'');p.style.left=x+'px';p.style.top=y+'px';p.textContent=bad?'朋友哦！−'+profile.penalty:combo>=3?'+10 · '+combo+' 连击！':'+10 好棒！';$('effects').append(p);setTimeout(()=>p.remove(),800);for(let i=0;i<12;i++){const s=document.createElement('i');s.className='spark';s.style.cssText=`left:${x}px;top:${y}px;--color:${bad?'#ed9c92':['#fff3a7','#ffd05c','#fff','#82d9c3'][i%4]};--dx:${Math.cos(i*Math.PI/6)*(40+Math.random()*40)}px;--dy:${Math.sin(i*Math.PI/6)*65-25}px`;$('effects').append(s);setTimeout(()=>s.remove(),700);}}
function hit(i){const h=holes[i];if(state!=='playing'||h.type===null||h.locked)return;const bad=h.type<10;h.locked=true;h.ttl=650;h.el.classList.add(bad?'wrong':'hit');if(bad){score-=profile.penalty;lives--;mistakes++;combo=0;$('mission').textContent='这是我们的朋友，要保护奥特曼哦！';}else{score+=10;hits++;combo++;$('mission').textContent=combo>=3?`${combo} 连击！小小守护者真厉害！`:'打得漂亮！继续寻找怪兽吧';}if(bad){h.ttl=1200;wrongFeedback(h);}else sfx('hit');burst(h,bad);render();if(lives===0)finish(false,'爱心用完啦，下次看清楚再出手。');else if(score>=TARGET)finish(true,'小镇恢复了平静，你是今天的光之小英雄！');}
function frame(t){if(state!=='playing')return;const dt=Math.min(t-last,100);last=t;left=Math.max(0,left-dt/1000);holes.forEach(h=>{if(h.type!==null){h.ttl-=dt;if(h.ttl<=0){clearHole(h);}}});spawnIn-=dt;if(spawnIn<=0){if(holes.filter(h=>h.type!==null).length<profile.simultaneous)spawn();spawnIn=profile.interval;}render();if(left<=0){finish(false,'时间到啦！还差一点能量，再试一次吧。');return;}clock=requestAnimationFrame(frame);}
function start(){clearWrongFeedback();profileIndex=selectedProfile;profile=profiles[profileIndex];TARGET=profile.target;DURATION=profile.duration;MAX_LIVES=profile.lives;$('overlay').classList.remove('resting');cancelAnimationFrame(clock);holes.forEach(clearHole);$('effects').replaceChildren();score=0;lives=MAX_LIVES;combo=hits=mistakes=0;left=DURATION;spawnIn=350;state='playing';syncMusic();$('overlay').hidden=true;$('pause').disabled=false;$('mission').textContent='只打怪兽，保护奥特曼！';render();spawn();last=performance.now();clock=requestAnimationFrame(frame);}
function finish(win,message){state='ended';syncMusic();cancelAnimationFrame(clock);$('pause').disabled=true;holes.forEach(clearHole);$('title').textContent=win?'守护成功！':'再试一次吧！';$('message').textContent=message;$('overlay').classList.add('result');$('start').querySelector('span').textContent='再玩一次';$('start').setAttribute('aria-label','再玩一次');const reveal=()=>{$('overlay').hidden=false;$('start').focus();sfx(win?'win':'lose');};if(wrongFx)wrongFx.onComplete=reveal;else reveal();}
function pause(){if(state!=='playing')return;selectedProfile=profileIndex;state='paused';pauseWrongFeedback();syncMusic();cancelAnimationFrame(clock);$('title').textContent='休息一下';$('overlay').classList.remove('result');$('message').textContent='';chooseDifficulty(profileIndex);$('start').querySelector('span').textContent='继续玩';$('start').setAttribute('aria-label','继续游戏');$('overlay').hidden=false;$('start').focus();}
function resume(){state='playing';resumeWrongFeedback();syncMusic();$('overlay').hidden=true;last=performance.now();clock=requestAnimationFrame(frame);}
function unlockAudio(){musicUnlocked=true;syncMusic();try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
// Hit testing uses rendered screen geometry, including artwork overflowing its parent.
function hitAt(x,y){
 if(state!=='playing')return false;
 const candidates=holes.map((h,i)=>{if(h.type===null||h.locked)return null;const actor=h.el.querySelector('.actor').getBoundingClientRect(),body=h.el.getBoundingClientRect(),prop=h.el.querySelector('.prop').getBoundingClientRect();const l=Math.min(actor.left,body.left,prop.left)-12,r=Math.max(actor.right,body.right,prop.right)+12,t=Math.min(actor.top,body.top,prop.top)-12,b=Math.max(actor.bottom,body.bottom,prop.bottom)+12;if(x<l||x>r||y<t||y>b)return null;return {i,d:Math.hypot(x-(actor.left+actor.width/2),y-(actor.top+actor.height/2))};}).filter(Boolean).sort((a,b)=>a.d-b.d);
 if(!candidates.length)return false;hit(candidates[0].i);return true;
}
$('arena').addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('.game-tools,.scene-sign'))return;unlockAudio();if(hitAt(e.clientX,e.clientY)){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('pointerdown',unlockAudio,{once:true});document.addEventListener('keydown',unlockAudio,{once:true});
$('start').onclick=()=>state==='paused'&&selectedProfile===profileIndex?resume():start();$('pause').onclick=pause;$('scene-next').onclick=()=>chooseScene((sceneIndex+1)%scenes.length);
$('sound').onclick=()=>{soundOn=!soundOn;if(!soundOn){wrongSound.pause();if(wrongFx)wrongFx.soundEnabled=false;}$('sound').classList.toggle('muted',!soundOn);$('sound').setAttribute('aria-label',soundOn?'关闭声音':'开启声音');$('sound').setAttribute('aria-pressed',String(!soundOn));syncMusic();};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state==='playing')pause();else pauseWrongFeedback();}else if(state==='ended'&&wrongFx)resumeWrongFeedback();syncMusic();});
window.addEventListener('pagehide',()=>{music.pause();clearWrongFeedback();});
document.addEventListener('keydown',e=>{if(e.repeat)return;if(e.key>='1'&&e.key<='9'&&state==='playing'){e.preventDefault();hit(Number(e.key)-1);}if(e.code==='Space'&&e.target===document.body){e.preventDefault();if(state==='playing')pause();else if(state==='paused'){if(selectedProfile===profileIndex)resume();else start();}}});
Promise.all(['assets/heroes.png','assets/monsters.png','assets/props.png','assets/town.png','assets/forest.png','assets/harbor.png','assets/ui-atlas.png','assets/screen-glass.png','assets/front-blast.png'].map(src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=reject;im.src=src;}))).then(()=>start()).catch(()=>{$('title').textContent='再试一下';$('message').textContent='美术加载遇到问题，点击重新打开。';$('overlay').hidden=false;$('start').querySelector('span').textContent='重新打开';$('start').onclick=()=>location.reload();});
function setActor(h){const n=h.type%10;h.el.firstChild.classList.toggle('monster',h.type>=10);h.el.firstChild.style.setProperty('--col',n%5);h.el.firstChild.style.setProperty('--row',Math.floor(n/5));}
const scenes=[
 {name:'光之小镇',image:'town',spots:[[17,35,0],[47,29,1],[80,34,1],[29,56,2],[65,52,0],[87,68,2],[13,81,1],[46,82,2],[72,85,1]]},
 {name:'森林野餐',image:'forest',spots:[[13,36,0],[42,34,2],[77,31,0],[26,58,3],[61,55,0],[88,62,2],[12,82,2],[44,82,3],[75,83,0]]},
 {name:'海边港湾',image:'harbor',spots:[[16,34,5],[49,31,4],[82,36,5],[29,57,4],[65,56,3],[88,73,4],[13,83,3],[47,84,5],[73,86,4]]}
];
let sceneIndex=0;
function chooseScene(index){clearWrongFeedback();sceneIndex=index;const scene=scenes[index];$('arena').style.backgroundImage=`url('assets/${scene.image}.png')`;document.querySelector('.city-label').textContent=scene.name;document.querySelectorAll('[data-scene]').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));holes.forEach((h,i)=>{clearHole(h);const [x,y,prop]=scene.spots[i];h.el.style.left=x+'%';h.el.style.top=Math.max(40,y)+'%';h.el.querySelector('.prop').style.setProperty('--pc',prop%3);h.el.querySelector('.prop').style.setProperty('--pr',Math.floor(prop/3));});spawnIn=200;}
document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>chooseScene(Number(b.dataset.scene)));
chooseScene(0);
function chooseDifficulty(index){
 selectedProfile=index;const p=profiles[index];
 document.querySelectorAll('[data-level]').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
 $('difficulty-info').textContent=`一次 ${p.simultaneous} 位 · 停留 ${p.show/1000} 秒`;
 if(state==='paused'){$('start').querySelector('span').textContent=index===profileIndex?'继续玩':'重新开始';$('start').setAttribute('aria-label',index===profileIndex?'继续游戏':'按新难度重新开始');$('message').textContent=index===profileIndex?'':'换难度后重新开始这一局';}
}
document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>chooseDifficulty(Number(b.dataset.level)));
chooseDifficulty(0);render();
