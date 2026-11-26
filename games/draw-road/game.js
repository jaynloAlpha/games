(function(){
 'use strict';
 var P=window.DrawPhysics, content=window.DrawRoadLevels, levels=content.levels;
 var W=P.W,H=P.H,canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
 var $=function(id){return document.getElementById(id);};
 var palette=['#258573','#3276a0','#ab537b','#8a6331'];
 var artNames=['beam','felt','ball','basket','bell','bear','pin','paper-pad','box-wall','spring-launcher'];
 var art={},scale=1,ox=0,oy=0,pixelRatio=1;
 var index=0,completed={},drafts=[],drawing=null,world=null,phase='setup',paused=false,sound=true,ready=false;
 var frameId=0,lastFrame=0,accumulator=0,displayMs=0,context=null,voices=[],lastKnock=-1000;
 var hintTimer=0,hintEnd=0,hintTarget=null,levelButtons=[];
 var quietMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 var key='draw-road-v1';
 var stored=null;
 try{stored=JSON.parse(localStorage.getItem(key)||'null');}catch(ignore){}
 if(stored){
  if(Number.isInteger(stored.index))index=Math.max(0,Math.min(levels.length-1,stored.index));
  if(stored.completed&&typeof stored.completed==='object')completed=stored.completed;
  sound=stored.sound!==false;
 }
 function level(){return levels[index];}
 function save(){
  var sketches=drafts.map(function(d){
   var path=d.points.slice();
   if(d.closed)path.push(path[0]);
   return path.map(function(p){return [p.x,p.y];});
  });
  try{localStorage.setItem(key,JSON.stringify({index:index,completed:completed,sketches:sketches,sound:sound}));}catch(ignore){}
 }
 function status(message){$('status').textContent=message;}
 function unlock(){
  if(!sound)return;
  if(!context)try{
   var Audio=window.AudioContext||window.webkitAudioContext;
   if(Audio)context=new Audio();
  }catch(ignore){}
  if(context&&context.state!=='running'&&context.state!=='closed')context.resume().catch(function(){});
 }
 function note(freq,gain,duration,delay,type){
  if(!context||!sound||paused||context.state!=='running')return;
  var start=context.currentTime+(delay||0),source=context.createOscillator(),volume=context.createGain();
  source.type=type||'sine';
  source.frequency.setValueAtTime(freq,start);
  source.frequency.exponentialRampToValueAtTime(freq*.85,start+duration);
  volume.gain.setValueAtTime(.0001,start);
  volume.gain.exponentialRampToValueAtTime(gain,start+.007);
  volume.gain.exponentialRampToValueAtTime(.0001,start+duration);
  source.connect(volume);volume.connect(context.destination);
  voices.push(source);
  source.onended=function(){
   source.disconnect();volume.disconnect();
   voices=voices.filter(function(v){return v!==source;});
  };
  source.start(start);source.stop(start+duration+.015);
 }
 function silence(){
  voices.forEach(function(source){try{source.stop();}catch(ignore){}});
  voices=[];
 }
 function gameSound(event){
  if(event.kind==='release'&&event.impulse){
   var strength=Math.min(1,event.impulse/11.5);
   note(211,.038+strength*.038,.09,0,'triangle');
   note(362,.024+strength*.024,.115,.024);
  }else if(event.kind==='knock'&&event.time-lastKnock>=65){
   lastKnock=event.time;note(172+event.strength*106,.018+event.strength*.055,.11,0,'triangle');
  }else if(event.kind==='switch'){
   note(345,.062,.15,0,'triangle');note(512,.03,.16,.055);
  }else if(event.kind==='bell'){
   note(820,.11,.52,0,'triangle');note(1310,.042,.34);
  }else if(event.kind==='win'){
   note(392,.065,.26);note(523,.055,.29,.095);note(659,.052,.35,.19);
  }
 }

 function clearHint(){
  clearTimeout(hintTimer);clearTimeout(hintEnd);
  if(hintTarget)hintTarget.classList.remove('touch-hint');
  hintTarget=null;$('quiet-hint').hidden=true;
 }
 function scheduleHint(){
  clearHint();
  if(!ready||paused||drawing||document.hidden||(phase!=='setup'&&phase!=='won'))return;
  hintTimer=setTimeout(function(){
   if(paused||drawing||document.hidden)return;
   hintTarget=phase==='won'?$('next'):drafts.length?$('release'):$('quiet-hint');
   if(hintTarget===$('quiet-hint'))hintTarget.hidden=false;
   hintTarget.classList.add('touch-hint');
   hintEnd=setTimeout(clearHint,1650);
  },10000);
 }
 function resize(){
  var b=canvas.getBoundingClientRect();
  if(!b.width||!b.height)return;
  pixelRatio=Math.min(window.devicePixelRatio||1,2);
  if(b.width*b.height*pixelRatio*pixelRatio>3500000)pixelRatio=Math.sqrt(3500000/(b.width*b.height));
  canvas.width=Math.round(b.width*pixelRatio);canvas.height=Math.round(b.height*pixelRatio);
  var top=b.height<440?22:40,bottom=b.height<440?23:52;
  scale=Math.min((b.width-12)/W,(b.height-top-bottom)/H);
  ox=(b.width-W*scale)/2;
  oy=top+(b.height-top-bottom-H*scale)/2;
  positionControls();
  draw();
 }
 function positionControls(){
  var ball=level().balls[0],button=$('release');
  var size=Math.max(54,Math.round((ball.r||16)*3.6*scale));
  button.style.left=(ox+ball.x*scale)+'px';
  button.style.top=(oy+ball.y*scale)+'px';
  button.style.width=size+'px';button.style.height=size+'px';
  var first=(level().sheets||[])[0];
  var bounds=first?[first.x,first.y,first.w,first.h]:level().id===1?[193,249,235,99]:[29,61,W-58,H-120];
  var hint=$('quiet-hint');
  hint.style.left=(ox+bounds[0]*scale)+'px';hint.style.top=(oy+bounds[1]*scale)+'px';
  hint.style.width=bounds[2]*scale+'px';hint.style.height=bounds[3]*scale+'px';
 }
 function sync(){
  var canDraw=phase==='setup',won=phase==='won';
  $('game').dataset.phase=phase;
  $('game').dataset.theme=level().theme;
  $('release').hidden=!canDraw;
  $('release').disabled=!ready||paused;
  $('undo').hidden=!canDraw||!drafts.length;
  $('undo').disabled=paused;
  $('retry').hidden=phase!=='playing'&&phase!=='result';
  $('next').hidden=!won;
  $('next').disabled=paused;
  $('next').setAttribute('aria-label',index===levels.length-1?'再玩一轮':'下一关');
  $('pause-layer').hidden=!paused;
  $('paper-strips').hidden=!canDraw||level().group<8;
  var strips=$('paper-strips');
  strips.textContent='';
  strips.setAttribute('aria-label','还能画 '+(level().budget-drafts.length)+' 笔');
  if(!strips.hidden)for(var n=0;n<level().budget;n++){
   var strip=document.createElement('i');strip.className=n<drafts.length?'used':'';
   strips.appendChild(strip);
  }
  $('goal').textContent=level().tip;
  $('description').textContent=level().tip;
  $('progress').textContent=(index+1)+' / '+levels.length+' · '+content.groups[level().group];
  $('menu-title').textContent=level().name;
  $('sound').textContent=sound?'声音 开':'声音 关';
  $('sound').setAttribute('aria-pressed',String(sound));
  $('clear').disabled=!drafts.length;
  levelButtons.forEach(function(button,i){
   button.dataset.done=String(!!completed[i+1]);
   if(i===index)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');
  });
  positionControls();scheduleHint();
 }

 function sprite(name,x,y,w,h,alpha){
  if(!art[name])return;
  ctx.save();if(alpha!==undefined)ctx.globalAlpha=alpha;
  ctx.drawImage(art[name],x,y,w,h);ctx.restore();
 }
 function stroke(points,closed,color,alpha){
  if(points.length<2)return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x,points[0].y);
  for(var i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=color;ctx.globalAlpha=alpha||1;
  if(closed){
   ctx.closePath();ctx.fillStyle=color;ctx.fill();
   ctx.lineWidth=2;ctx.stroke();
  }else{
   ctx.lineWidth=P.WIDTH;ctx.stroke();
   ctx.strokeStyle='#fff8d3';ctx.lineWidth=2.2;ctx.globalAlpha*=.26;ctx.stroke();
  }
  ctx.restore();
 }
 function renderBall(spec,body){
  var p=body?body.position:spec,r=spec.r||16;
  ctx.save();
  ctx.translate(p.x,p.y);if(body)ctx.rotate(body.angle);
  sprite(spec.id==='blue'?'blue-ball':spec.id==='yellow'?'gold-ball':'ball',-r,-r,2*r,2*r);
  ctx.restore();
 }
 function renderLauncher(spec,entry){
  var vx=spec.vx||0,vy=spec.vy||0;
  if(!vx&&!vy)return;
  var artSpring=art['spring-launcher'],radius=spec.r||16;
  var power=Math.min(1,Math.hypot(vx,vy)/12);
  var springX=-radius-61,head=-radius-3,extension=0;
  var time=entry&&entry.released?world.elapsed-entry.releasedAt:-1;
  if(time<0&&world){
   var begins=spec.delay===undefined?440:spec.delay;
   var charge=Math.max(0,Math.min(1,(world.elapsed-(begins-190))/190));
   head-=charge*7;
  }else if(time>=0&&time<240){
   var reach=12+17*power;
   extension=reach*(time<48?time/48:Math.max(0,1-(time-48)/192));
   head=-radius+2+extension;
  }
  ctx.save();
  ctx.translate(spec.x,spec.y);
  if(!vy&&vx<0)ctx.scale(-1,1);else ctx.rotate(Math.atan2(vy,vx));
  var cut1=Math.round(artSpring.width*.48),cut2=Math.round(artSpring.width*.78);
  var h=35,base=25,piston=14;
  ctx.drawImage(artSpring,0,0,cut1,artSpring.height,springX,-h/2,base,h);
  ctx.drawImage(artSpring,cut1,0,cut2-cut1,artSpring.height,springX+base-.35,-h/2,head-springX-base-piston+.7,h);
  ctx.drawImage(artSpring,cut2,0,artSpring.width-cut2,artSpring.height,head-piston,-h/2,piston,h);
  if(time>=0&&time<150&&!quietMotion){
   var ray=time/150;
   ctx.globalAlpha=(1-ray)*.66;ctx.lineWidth=2.7;ctx.lineCap='round';ctx.strokeStyle='#cf7546';
   ctx.beginPath();
   ctx.moveTo(-radius+ray*15,-19);ctx.lineTo(-radius+11+ray*20,-26);
   ctx.moveTo(-radius+ray*15,19);ctx.lineTo(-radius+11+ray*20,26);
   ctx.stroke();
  }
  ctx.restore();
 }
 function renderBox(spriteName,x,y,w,h,angle,alpha){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);sprite(spriteName,-w/2,-h/2,w,h,alpha);ctx.restore();
 }
 function renderBeam(b){
  var dx=b.x2-b.x1,dy=b.y2-b.y1;
  renderBox(b.material==='felt'?'felt':'beam',(b.x1+b.x2)/2,(b.y1+b.y2)/2,Math.hypot(dx,dy),b.w,Math.atan2(dy,dx));
 }
 function renderCup(cup){
  if(cup.open){
   ctx.save();ctx.setLineDash([8,8]);ctx.strokeStyle='#31796c93';ctx.lineWidth=3;
   ctx.beginPath();ctx.ellipse(cup.x,cup.y+1,cup.w/2,15,0,0,Math.PI*2);ctx.stroke();ctx.restore();
   sprite('bear',cup.x-42,cup.y-136,84,108,.95);
   return;
  }
  var color=cup.id.indexOf('blue')===0?'blue-ball':'ball';
  sprite('basket',cup.x-cup.w/2,cup.y-cup.h, cup.w,cup.h+15);
  if(level().cups.length>1&&cup.id!=='decoy')sprite(color,cup.x-11,cup.y+7,22,22);
 }
 function foreCup(cup){
  if(cup.open||!art.basket)return;
  var img=art.basket,cut=Math.floor(img.height*.65),w=cup.w,h=cup.h+15;
  ctx.drawImage(img,0,cut,img.width,img.height-cut,cup.x-w/2,cup.y-cup.h+h*(cut/img.height),w,h*(1-cut/img.height));
 }
 function renderSwitch(s){
  var on=world&&world.pressed[s.id];
  sprite('felt',s.x-s.w/2,s.y-4,s.w,14,on?.58:1);
  sprite('pin',s.x-11,s.y-(on?13:20),22,22);
 }
 function renderCord(s){
  var l=level();
  function takesSignal(part){
   return Array.isArray(part.by)?part.by.indexOf(s.id)!==-1:part.by===s.id;
  }
  var destination=l.gates.find(takesSignal)||l.balls.find(takesSignal);
  if(!destination)return;
  var low=Math.max(s.y,destination.y)+28;
  ctx.save();
  ctx.setLineDash([4,7]);ctx.lineCap='round';ctx.lineWidth=2;
  ctx.strokeStyle=world&&world.pressed[s.id]?'#4d857f99':'#a2715466';
  ctx.beginPath();ctx.moveTo(s.x,s.y);
  ctx.bezierCurveTo(s.x,low,destination.x,low,destination.x,destination.y);
  ctx.stroke();ctx.restore();
 }
 function renderBell(s){
  var hit=world&&world.pressed[s.id];
  var shake=hit&&!quietMotion?Math.sin((world.elapsed-hit)/34)*Math.max(0,.19-(world.elapsed-hit)/3900):0;
  renderBox('bell',s.x,s.y-21,62,78,shake);
 }
 function renderWin(){
  if(phase!=='won'||quietMotion||displayMs>1050)return;
  var c=level().cups[0]||{x:W/2,y:H/2},t=displayMs/1050;
  var colors=['#e57853','#ebae46','#368878','#e4779a','#3b83a8'];
  ctx.save();ctx.globalAlpha=1-t;
  for(var i=0;i<19;i++){
   var angle=i*2.399,dx=Math.cos(angle)*(32+(i%4)*11),dy=Math.sin(angle)*52-36;
   ctx.save();ctx.translate(c.x+dx*t*2,c.y+dy*t*2+66*t*t-44);
   ctx.rotate(angle+t*3);
   ctx.fillStyle=colors[i%colors.length];ctx.fillRect(-3,-5,6+(i%4),9);ctx.restore();
  }
  ctx.restore();
 }
 function draw(){
  var l=level();
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(pixelRatio*scale,0,0,pixelRatio*scale,pixelRatio*ox,pixelRatio*oy);
  if(!ready)return;
  (l.sheets||[]).forEach(function(sheet){
   var alpha=phase==='setup'?drawing&&drawing.sheet===sheet?1:.87:.48;
   sprite('paper-pad',sheet.x,sheet.y,sheet.w,sheet.h,alpha);
  });
  if(l.cups.length===1&&!l.cups[0].open){
   var c=l.cups[0];
   sprite('bear',c.x-54,c.y-c.h-112,108,131);
  }
  l.switches.forEach(renderCord);
  l.cups.forEach(renderCup);
  l.beams.forEach(renderBeam);
  l.walls.forEach(function(w){
   if(w.solid)sprite('box-wall',w.x-w.w/2,w.y-w.h/2,w.w,w.h);
   else renderBox('beam',w.x,w.y,w.h,w.w,Math.PI/2);
  });
  l.switches.forEach(renderSwitch);l.bells.forEach(renderBell);
  if(world){
   world.gates.forEach(function(g){if(g.progress<1)renderBox('felt',g.body.position.x,g.body.position.y,g.spec.h,g.spec.w,Math.PI/2);});
   world.things.forEach(function(entry){
    if(entry.role==='toy'){
     var s=entry.spec,b=entry.body;renderBox('beam',b.position.x,b.position.y,s.h,s.w,b.angle+Math.PI/2);
    }
   });
   world.inks.forEach(function(ink){
    var b=ink.body;
    if(b.position.y>H+135)return;
    ctx.save();ctx.translate(b.position.x,b.position.y);ctx.rotate(b.angle);ctx.translate(-ink.x,-ink.y);
    stroke(ink.stroke.points,ink.stroke.closed,palette[ink.color%palette.length]);
    ctx.restore();
   });
   world.balls.forEach(function(entry){renderLauncher(entry.spec,entry);renderBall(entry.spec,entry.body);});
  }else{
   l.gates.forEach(function(g){renderBox('felt',g.x,g.y,g.h,g.w,Math.PI/2);});
   l.toys.forEach(function(t){renderBox('beam',t.x,t.y,t.h,t.w,Math.PI/2);});
   drafts.forEach(function(d,i){stroke(d.points,d.closed,palette[i%palette.length]);});
   if(drawing)stroke(drawing.points,false,palette[drafts.length%palette.length],.84);
   l.balls.forEach(function(b){renderLauncher(b,null);renderBall(b,null);});
  }
  l.cups.forEach(foreCup);
  l.pins.forEach(function(p){sprite('pin',p.x-17,p.y-17,34,34);});
  l.toys.forEach(function(t){if(t.pivot)sprite('pin',t.x-12,t.y-t.h/2-5,24,24);});
  renderWin();
 }

 function clearFrame(){
  cancelAnimationFrame(frameId);frameId=0;lastFrame=0;accumulator=0;
 }
 function animate(){
  if(!frameId&&!paused)frameId=requestAnimationFrame(tick);
 }
 function tick(now){
  frameId=0;
  if(paused)return;
  var dt=lastFrame?Math.min(45,now-lastFrame):0;
  lastFrame=now;
  if(phase==='playing'){
   accumulator+=dt;
   while(accumulator>=P.STEP&&phase==='playing'){
    accumulator-=P.STEP;
    var outcome=world.step();
    if(outcome==='won'){
     phase='won';displayMs=0;
     completed[level().id]=true;save();sync();
     status(index===levels.length-1?'工坊修好啦，最后一关完成。':'成功了，可以进入下一关。');
    }else if(outcome==='retry'){
     phase='result';displayMs=0;sync();
     status('画稿已经保留，可以改一笔再试。');
    }
   }
  }else if(phase==='result'){
   displayMs+=dt;
   if(displayMs>=1050)restoreDraft();
  }else if(phase==='won')displayMs+=dt;
  draw();
  if(phase==='playing'||phase==='result'||(phase==='won'&&displayMs<1050))animate();
 }
 function restoreDraft(){
  clearFrame();silence();world=null;phase='setup';drawing=null;displayMs=0;sync();draw();
 }
 function enter(next,sketches){
  index=next;drafts=[];
  (sketches||[]).slice(0,level().budget).forEach(function(points){
   if(!Array.isArray(points)||points.length>64)return;
   var result=P.draft(level(),points,drafts);
   if(!result.error)drafts.push(result);
  });
  status('');restoreDraft();save();
 }
 function release(){
  if(phase!=='setup'||paused||!ready||drawing)return;
  unlock();clearHint();lastKnock=-1000;
  world=P.create(level(),drafts,gameSound);
  phase='playing';
  status('开始实验。');
  sync();animate();draw();
 }
 function append(point){
  var current=drawing,prev=current.points[current.points.length-1],d=P.distance(point,prev);
  if(d<2)return;
  var remaining=level().ink-current.length;
  if(remaining<1||current.points.length>=360)return;
  if(d>remaining){
   point={x:prev.x+(point.x-prev.x)*remaining/d,y:prev.y+(point.y-prev.y)*remaining/d};
   d=remaining;
  }
  current.length+=d;current.points.push(point);
 }
 function point(input,clamp){
  var rect=canvas.getBoundingClientRect();
  var x=(input.clientX-rect.left-ox)/scale,y=(input.clientY-rect.top-oy)/scale;
  if(clamp){
   var area=drawing&&drawing.sheet;
   return area?{x:Math.max(area.x,Math.min(area.x+area.w,x)),y:Math.max(area.y,Math.min(area.y+area.h,y))}:
    {x:Math.max(12,Math.min(W-12,x)),y:Math.max(58,Math.min(H-18,y))};
  }
  return x>=12&&x<=W-12&&y>=58&&y<=H-18?{x:x,y:y}:null;
 }
 function start(input,id){
  clearHint();
  if(!ready||paused||phase!=='setup'||drawing)return false;
  if(drafts.length>=level().budget){status('可以撤掉一笔再画。');scheduleHint();return false;}
  var p=point(input,false);
  if(!p){scheduleHint();return false;}
  var sheet=P.containingSheet(level(),p);
  if(level().sheets&&level().sheets.length&&!sheet){
   status('在蓝色纸面上画。');scheduleHint();return false;
  }
  unlock();drawing={id:id,points:[p],length:0,sheet:sheet};
  return true;
 }
 function move(input,id){
  if(!drawing||drawing.id!==id)return false;
  append(point(input,true));draw();return true;
 }
 function end(input,id,cancelled){
  if(!drawing||drawing.id!==id)return;
  if(input&&!cancelled)append(point(input,true));
  var drawn=drawing;drawing=null;
  if(!cancelled){
   var item=P.draft(level(),drawn.points,drafts);
   if(!item.error){
    drafts.push(item);note(285,.036,.09,0,'triangle');save();
    status(item.pin?'已画好一个可转动零件。':item.closed?'已画好一个实心零件。':'已画好一笔。');
   }else if(item.error==='pin')status('这个转轴已经连着一笔。');
   else if(item.error==='solid'){
    status('笔迹碰到了实心纸箱。');note(154,.032,.12,0,'triangle');
   }
  }
  sync();draw();
 }
 if(window.PointerEvent){
  canvas.addEventListener('pointerdown',function(e){
   if((e.button===0||e.button===-1)&&start(e,e.pointerId)){
    e.preventDefault();
    if(canvas.setPointerCapture)try{canvas.setPointerCapture(e.pointerId);}catch(ignore){}
   }
  });
  canvas.addEventListener('pointermove',function(e){
   if(drawing&&drawing.id===e.pointerId){
    var samples=e.getCoalescedEvents?e.getCoalescedEvents():[];
    samples.forEach(function(s){append(point(s,true));});
    move(e,e.pointerId);if(e.cancelable)e.preventDefault();
   }
  });
  window.addEventListener('pointerup',function(e){end(e,e.pointerId,false);});
  window.addEventListener('pointercancel',function(e){end(e,e.pointerId,true);});
  canvas.addEventListener('lostpointercapture',function(e){end(e,e.pointerId,true);});
 }else{
  canvas.addEventListener('mousedown',function(e){if(e.button===0&&start(e,'mouse'))e.preventDefault();});
  window.addEventListener('mousemove',function(e){if(move(e,'mouse')&&e.cancelable)e.preventDefault();});
  window.addEventListener('mouseup',function(e){end(e,'mouse',false);});
  canvas.addEventListener('touchstart',function(e){
   var t=e.changedTouches[0];
   if(t&&start(t,t.identifier))e.preventDefault();
  },{passive:false});
  window.addEventListener('touchmove',function(e){
   if(!drawing)return;
   for(var i=0;i<e.changedTouches.length;i++){
    var t=e.changedTouches[i];if(move(t,t.identifier)){if(e.cancelable)e.preventDefault();break;}
   }
  },{passive:false});
  ['touchend','touchcancel'].forEach(function(name){
   window.addEventListener(name,function(e){
    for(var i=0;i<e.changedTouches.length;i++){
     var t=e.changedTouches[i];
     if(drawing&&t.identifier===drawing.id){end(t,t.identifier,name==='touchcancel');if(e.cancelable)e.preventDefault();break;}
    }
   },{passive:false});
  });
 }

 function pause(){
  if(paused)return;
  paused=true;drawing=null;clearFrame();silence();sync();draw();$('resume').focus();
 }
 function resume(){
  if(!paused)return;
  paused=false;unlock();lastFrame=0;sync();draw();
  if(phase!=='setup')animate();
 }
 $('pause').onclick=pause;
 $('resume').onclick=resume;
 $('release').onclick=release;
 $('next').onclick=function(){
  if(phase==='won'&&!paused){unlock();enter((index+1)%levels.length);}
 };
 $('retry').onclick=function(){if(!paused)restoreDraft();};
 $('undo').onclick=function(){
  if(phase!=='setup'||paused||!drafts.length)return;
  unlock();drafts.pop();save();sync();draw();
 };
 $('clear').onclick=function(){drafts=[];paused=false;restoreDraft();save();};
 $('sound').onclick=function(){sound=!sound;if(!sound)silence();else unlock();sync();save();};
 document.addEventListener('visibilitychange',function(){if(document.hidden)pause();});
 window.addEventListener('pagehide',pause);
 window.addEventListener('resize',resize);
 if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas);
 document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){if(paused)resume();else pause();}
  else if(!paused&&e.key==='Backspace'&&drafts.length&&phase==='setup'){
   e.preventDefault();$('undo').click();
  }else if(!paused)scheduleHint();
 });
 $('game').addEventListener(window.PointerEvent?'pointerdown':'touchstart',clearHint,true);
 $('game').addEventListener('click',scheduleHint,true);
 content.groups.forEach(function(name,group){
  var section=document.createElement('div'),heading=document.createElement('h2');
  section.className='chapter';heading.textContent=name;section.appendChild(heading);
  levels.slice(group*5,group*5+5).forEach(function(l){
   var button=document.createElement('button');
   button.type='button';button.className='level-button';button.textContent=l.id;
   button.dataset.level=l.id;button.setAttribute('aria-label',l.id+' · '+l.name);
   button.onclick=function(){paused=false;enter(l.id-1);};
   section.appendChild(button);levelButtons.push(button);
  });
  $('chapters').appendChild(section);
 });

 function tint(source,color){
  var tile=document.createElement('canvas');tile.width=source.width;tile.height=source.height;
  var g=tile.getContext('2d');g.drawImage(source,0,0);
  g.globalCompositeOperation='color';g.fillStyle=color;g.fillRect(0,0,tile.width,tile.height);
  g.globalCompositeOperation='destination-in';g.drawImage(source,0,0);
  return tile;
 }
 function loadArt(name){
  return new Promise(function(resolve,reject){
   var img=new Image();img.onload=function(){art[name]=img;resolve();};img.onerror=reject;
   img.src='assets/'+name+'.png';
  });
 }
 enter(index,stored&&Array.isArray(stored.sketches)?stored.sketches:[]);
 resize();
 Promise.all(artNames.map(loadArt)).then(function(){
  art['blue-ball']=tint(art.ball,'#2879b7');art['gold-ball']=tint(art.ball,'#dbac2a');
  ready=true;sync();draw();
 }).catch(function(){status('图片加载失败，请刷新页面重试。');});
 window.DrawRoad={getState:function(){
  return {ready:ready,phase:phase,paused:paused,level:level().id,
   draft:drafts.map(function(d){return {closed:d.closed,pinned:!!d.pin,points:d.points.length};}),
   completed:Object.keys(completed).length,elapsed:world?world.elapsed:0,scale:scale,offset:[ox,oy]};
 }};
}());
