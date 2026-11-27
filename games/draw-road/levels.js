(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.DrawRoadLevels=factory();
}(typeof window==='undefined'?this:window,function(){
 'use strict';
 var groups=['画出来的形状','看清路线','弹起来','用重量开门','快一点慢一点','绕轴转动','运过去','两颗球的分工','一笔多用','玩具工坊'];
 var levels=[];
 function rail(x1,y1,x2,y2,material,w){return {x1:x1,y1:y1,x2:x2,y2:y2,w:w||18,material:material||'wood'};}
 function floor(x1,x2,y,material){return rail(x1,y+9,x2,y+9,material);}
 function wall(x,y,w,h){return {x:x,y:y,w:w,h:h};}
 function box(x,y,w,h){return Object.assign(wall(x,y,w,h),{solid:true});}
 function paper(x,y,w,h){return {x:x,y:y,w:w,h:h};}
 function onPaper(layout,sheets){
  layout.sheets=sheets;
  return layout;
 }
 function ball(x,y,vx,cup,id){return {id:id||'red',x:x,y:y,vx:vx||0,cup:cup||'home',r:16};}
 function target(x,y,w,id){return {id:id||'home',x:x,y:y,w:w||136,h:43};}
 function switchAt(id,x,y,w,h,role){return {id:id,x:x,y:y,w:w,h:h,role:role||'ink'};}
 function build(name,budget,detail){
  return Object.assign({name:name,theme:levels.length<10?'workbench':levels.length<25?'garden':'factory',
   budget:budget,ink:740,beams:[],walls:[],balls:[],cups:[],pins:[],gates:[],movers:[],bells:[],requires:[],switches:[],toys:[],demo:[]},detail);
 }
 function add(name,budget,detail){levels.push(build(name,budget,detail));}
 function mirror(data){
  ['walls','balls','cups','pins','gates','bells','switches','toys'].forEach(function(key){
   (data[key]||[]).forEach(function(s){
    s.x=1024-s.x;
    if(s.vx)s.vx=-s.vx;
    if(s.slide)s.slide.x=-s.slide.x;
   });
  });
  (data.beams||[]).forEach(function(s){s.x1=1024-s.x1;s.x2=1024-s.x2;});
  (data.movers||[]).forEach(function(s){
   s.x=1024-s.x;s.toX=1024-s.toX;
   if(s.tilt)s.tilt=-s.tilt;
   if(s.rim)s.rim=-s.rim;
  });
  data.demo=data.demo.map(function(stroke){return stroke.map(function(p){return [1024-p[0],p[1]];});});
  return data;
 }
 function bridge(gaps,opts){
  opts=opts||{};
  var y=opts.y||342,beams=[rail(52,y-100,185,y-38)],walls=[],demos=[];
  var last=174,lastTop=y;
  gaps.forEach(function(g,index){
   var before=g[0],after=g[1],top=y+index*26;
   beams.push(rail(last,lastTop+9,before,top+9,'wood'));
   demos.push([[before-29,top-11],[after+30,top-11]]);
   last=after;lastTop=top;
  });
  var endY=Math.max(388,lastTop+26);
  if(opts.felt){
   beams.push(rail(last,lastTop+9,730,endY-20));
   beams.push(rail(730,endY-20,793,endY,'felt'));
  }else beams.push(rail(last,lastTop+9,793,endY));
  walls.push(wall(976,416,18,194));
  var cup=target(883,475,174);
  return {beams:beams,walls:walls,cups:[cup],balls:[ball(96,y-136,(opts.vx||4.5)+1.15)],demo:demos};
 }
 function slope(opts){
  opts=opts||{};
  var x=opts.start||160,y=opts.y||270,span=opts.span||267,drop=opts.drop||67;
  var end=x+span,tip=y+drop,beams=[
   floor(x+7,x+39,y+18,opts.felt?'felt':'wood'),
   floor(end-34,end-2,tip+7,opts.felt?'felt':'wood'),
   rail(end-2,tip+32,758,397,'wood')
  ];
  var d={beams:beams,walls:[wall(960,443,17,130)],
   balls:[ball(x+75,117,0)],cups:[target(855,490,190)],demo:[[[x,y],[end,tip]]]};
  return opts.flip?mirror(d):d;
 }
 function underBox(){
  var d=slope({start:113,span:275});
  // The low opening is on the ball's route. The box covers the tempting
  // high diagonal from its release point to the receiving track.
  d.walls.push(box(258,163,82,145));
  d.sheets=[paper(70,228,370,146)];
  return d;
 }
 function openTarget(x,y,w,id){return Object.assign(target(x,y,w,id),{open:true,h:74});}
 function zigzag(){
  var d=slope({});
  d.beams.pop();
  d.beams.push(floor(287,325,479),floor(568,600,405),rail(160,395,315,360));
  d.cups=[Object.assign(target(218,529,160),{h:46})];
  d.walls=[wall(129,454,17,161)];
  d.balls[0].y=140;d.balls[0].vx=1.4;
  d.demo.push([[270,473],[606,390]]);
  return d;
 }
 function cradle(){
  return {beams:[floor(193,850,425)],cups:[openTarget(645,425,160)],
   balls:[ball(303,117,7.5)],demo:[[[570,310],[586,409],[706,409],[724,307]]]};
 }
 function brake(opts){
  opts=opts||{};
  var center=opts.center||718,y=425,block=center+45;
  var deck=[rail(55,320,245,402),floor(226,842,y,opts.felt?'felt':'wood')];
  var d={beams:deck,walls:[wall(846,468,26,70)],cups:[openTarget(center,y,185)],
   balls:[ball(117,259,opts.vx||11.5)],demo:[[[block,335],[block+68,335],[block+68,413],[block,413],[block,335]]]};
  if(opts.brace){
   d.demo=[[[block-4,336],[block+14,410]],[[block+21,388],[block+76,410],[block+23,411],[block+21,388]]];
   d.walls[0]=wall(847,458,26,100);
  }
  return opts.flip?mirror(d):d;
 }
 function pressure(opts){
  opts=opts||{};
  var sx=opts.sx||269,sy=opts.sy||392,require='start';
  var d={beams:[floor(sx-86,sx+80,sy+10,opts.felt?'felt':'wood'),rail(440,275,791,402)],
   walls:[wall(974,456,18,158)],switches:[switchAt(require,sx,sy,opts.narrow?56:86,16)],
   cups:[target(877,493,176)],balls:[ball(477,238,3.1)],
   gates:[{x:659,y:302,w:22,h:104,by:require}],demo:[]};
  if(opts.rolling){
   d.beams[0]=rail(sx-192,sy-111,sx+84,sy+36,opts.felt?'felt':'wood');
   d.switches[0].y=sy-17;
   var cx=sx-130,cy=sy-125,r=34;
   d.demo=[Array.from({length:13},function(_,i){return [cx+r*Math.cos(i*Math.PI/6),cy+r*Math.sin(i*Math.PI/6)];})];
  }else {
   var w=opts.narrow?26:42,top=opts.high?132:221;
   d.demo=[[[sx-w,top],[sx+w,top],[sx+w,top+60],[sx-w,top+60],[sx-w,top]]];
  }
  if(opts.flip)return mirror(d);
  return d;
 }
 function auxiliary(layout){
  // A separate bench above the delivery track: it cannot be reached by a
  // single continuous bridge or by the ball on the lower track.
  layout.beams.push(floor(713,823,220));
  layout.switches.push(Object.assign(switchAt('upper',767,210,66,16),{mass:3.5}));
  layout.demo.push([[734,95],[800,95],[800,159],[734,159],[734,95]]);
  (layout.gates||[]).forEach(function(g){
   if(g.by==='start')g.by=['start','upper'];
  });
  return layout;
 }
 function lever(opts){
  opts=opts||{};
  var x=opts.x||307,y=opts.y||287,reach=opts.reach||176,left=opts.left||83;
  var d=pressure({sx:210,sy:449});
  d.beams.shift();
  d.pins=[{x:x,y:y}];
  d.switches=[switchAt('start',x+Math.round(reach*.69),y+Math.round(reach*.69),53,24)];
  d.demo=[[[x-left,y],[x+reach,y]]];
  if(opts.counter){
   d.switches=[switchAt('start',x-left*.74,y+43,40,19)];
   var a=x-left+7,b=Math.min(x-43,a+76);
   d.demo.push([[a,y-118],[b,y-118],[b,y-13],[a,y-13],[a,y-118]]);
  }
  d.switches[0].anchored=true;
  if(opts.highGate)d.gates[0].h=142;
  return opts.flip?mirror(d):d;
 }
 function hingedDoor(){
  var d=pressure({rolling:true,sx:306});
  d.beams[0]=rail(65,226,165,390);
  d.beams.push(floor(164,405,380));
  d.toys=[{x:224,y:325,w:20,h:108,density:.0012,pivot:true}];
  d.switches=[switchAt('start',270,345,22,27,'toy')];
  d.demo=[Array.from({length:13},function(_,i){
   return [137+36*Math.cos(i*Math.PI/6),221+36*Math.sin(i*Math.PI/6)];
  })];
  return d;
 }
 function domino(opts){
  opts=opts||{};
  var x=opts.x||388,y=389;
  var d=pressure({sx:215,sy:440});
  d.beams[0]=rail(62,233,x-48,y+3);
  d.beams.push(floor(x-48,x+145,y));
  d.switches=[switchAt('start',x+61,y-11,34,23,'toy')];
  d.toys=[{id:'first',x:x,y:y-47,w:20,h:88,density:.0014}];
  var cx=x-(opts.double?188:176),cy=y-(opts.double?135:155),r=opts.double?34:43;
  d.demo=[Array.from({length:13},function(_,i){return [cx+r*Math.cos(i*Math.PI/6),cy+r*Math.sin(i*Math.PI/6)];})];
  if(opts.double){
   d.toys.push({id:'second',x:x+35,y:y-47,w:20,h:88,density:.0014});
   d.switches[0]=Object.assign(switchAt('start',x+66,y-27,34,23,'toy'),{actor:'second'});
  }
  return opts.flip?mirror(d):d;
 }
 function split(opts){
  opts=opts||{};
  var left=opts.left||186,right=opts.right||836;
  var d={beams:[floor(122,167,309),floor(344,377,377),floor(655,688,377),floor(857,902,309)],
   walls:[wall(510,450,17,130)],cups:[target(424,487,152,'redHome'),target(600,487,152,'blueHome')],
   balls:[ball(left,132,0,'redHome','red'),ball(right,132,0,'blueHome','blue')],
   demo:[[[116,290],[377,366]],[[911,290],[655,366]]]};
  if(opts.asymmetric)d.balls[1].y=94;
  if(opts.bell){
   d.balls[0].cup=null;d.bells=[{id:'ring',x:421,y:390,r:26,ball:'red'}];d.requires=['ring'];d.cups.shift();
  }
  return d;
 }
 function roof(opts){
  opts=opts||{};
  var d={beams:[floor(327,368,330),floor(656,697,330),floor(487,537,240)],
   cups:[target(257,477,152,'redHome'),target(767,477,152,'blueHome')],
   walls:[wall(178,440,16,134),wall(846,440,16,134)],
   balls:[ball(432,129,0,'redHome','red'),ball(592,129,0,'blueHome','blue')],
   demo:[[[308,329],[512,226],[716,329]]]};
  if(opts.bell){d.balls[0].cup=null;d.bells=[{id:'ring',x:275,y:359,r:28,ball:'red'}];d.requires=['ring'];d.cups.shift();}
  if(opts.narrow){
   d.cups.forEach(function(c){c.w=120;});
   d.balls[0].x-=12;d.balls[1].x+=12;
  }
  return d;
 }
 function relay(opts){
  opts=opts||{};
  var d=opts.lever?lever({x:419,y:155,reach:161,left:75}):pressure({sx:764,sy:211,narrow:opts.narrow,high:true});
  if(!opts.lever)d.demo=[[[733,101],[795,101],[795,159],[733,159],[733,101]]];
  var route=bridge(opts.two?[[249,377],[514,652]]:[[386,541]],{y:359,vx:5.3});
  route.balls[0].vx=opts.two?11.25:10;
  d.beams=d.beams.slice(0,opts.lever?0:1).concat(route.beams);
  d.walls=route.walls;d.cups=route.cups;d.balls=route.balls;
  d.gates=[{x:712,y:308,w:21,h:103,by:'start'}];
  d.demo=d.demo.concat(route.demo);
  return opts.flip?mirror(d):d;
 }
 function paired(opts){
  opts=opts||{};
  var d=split({asymmetric:true,bell:opts.bell});
  var sw=opts.switchX||509;
  d.switches=[switchAt('start',sw,378,62,15)];
  d.beams.push(floor(sw-48,sw+48,386));
  d.gates=[{x:638,y:345,w:15,h:104,by:'start'}];
  d.demo.push([[sw-31,238],[sw+31,238],[sw+31,298],[sw-31,298],[sw-31,238]]);
  if(opts.ballGate){
   d.switches=[switchAt('start',410,434,64,26,'ball')];
   d.beams.pop();
   d.demo.pop();
  }
  if(opts.final){
   d.balls.push({id:'yellow',x:509,y:111,r:14,vx:0,cup:null});
   d.gates.push({x:509,y:159,w:71,h:14,by:'start',afterCups:true,slide:{x:64,y:0}});
   d.bells=[{id:'finalBell',x:509,y:202,r:20,ball:'yellow'}];
   d.requires=['finalBell'];
  }
  return opts.flip?mirror(d):d;
 }
 function passesBell(){
  var d=roof({bell:true});
  d.beams.push(rail(706,350,753,368));
  d.gates=[{x:749,y:306,w:16,h:125,by:'ring'}];
  return d;
 }
 function warehouse(){
  var d=relay({});
  d.walls.push(box(535,220,93,148));
  return onPaper(d,[paper(700,67,130,115),paper(321,320,270,89)]);
 }
 function bridgeLatch(){
  var d=bridge([[221,475]],{vx:5.3});
  d.switches=[switchAt('bridgeReady',499,332,34,18)];
  d.gates=[{x:624,y:304,w:20,h:116,by:'bridgeReady'}];
  return onPaper(d,[paper(162,291,377,83)]);
 }
 function rebound(){
  var d={
   balls:[ball(218,98,0)],
   beams:[Object.assign(rail(143,422,309,454,'bounce',24),{signal:'bounce'}),
    floor(406,448,344),floor(595,631,373),rail(620,391,786,419)],
   walls:[wall(953,465,16,120)],cups:[target(866,501,164)],
   requires:['bounce'],demo:[[[386,321],[632,359]]]
  };
  return onPaper(d,[paper(346,272,331,127)]);
 }
 function sideBank(){
  return onPaper({
   balls:[ball(276,115,8.5)],
   beams:[Object.assign(rail(572,363,572,132,'bounce',25),{signal:'return'}),
    floor(284,325,406),floor(492,529,352),rail(109,453,295,417)],
   walls:[wall(21,486,16,130)],cups:[target(87,521,142)],requires:['return'],
   demo:[[[274,392],[525,342]]]
  },[paper(246,319,325,106)]);
 }
 function reboundBell(){
  var d=rebound();
  d.beams[0].y2=442;
  d.bells=[{id:'sky',x:328,y:185,r:23,ball:'red'}];
  d.requires.push('sky');
  return d;
 }
 function reboundWall(){
  var d=rebound();
  d.walls.push(box(370,424,30,278));
  d.beams[1]=floor(414,447,344);
  d.demo[0][0]=[409,324];
  d.sheets=[paper(401,272,276,127)];
  return d;
 }
 function feedRebound(){
  var d=rebound();
  d.balls[0].x=111;d.balls[0].y=91;
  d.beams[1]=floor(335,365,390);
  d.beams[2]=floor(591,631,427);
  d.beams[3]=rail(620,449,786,474);
  d.cups[0].y=545;d.walls[0].y=502;
  d.beams.push(floor(78,119,247),floor(162,187,262));
  d.sheets[0]=paper(301,348,376,87);
  d.sheets.push(paper(45,192,170,103));
  d.demo=[[[71,226],[186,252]],[[323,376],[632,417]]];
  return d;
 }
 function reboundBridge(){
  var d=reboundWall();
  d.beams.pop();
  d.beams.push(rail(618,388,667,407),floor(786,818,434),rail(803,451,853,462));
  d.cups=[target(912,526,132)];
  d.demo.push([[642,391],[821,419]]);
  d.sheets[0]=paper(347,274,298,101);
  d.sheets.push(paper(630,381,214,66));
  return d;
 }
 function holdGate(){
  var d=pressure({sx:260,sy:397});
  d.switches[0].hold=true;d.gates[0].follow=true;
  return onPaper(d,[paper(184,165,151,155)]);
 }
 function weightedSwitch(){
  var d=pressure({sx:319,sy:407,narrow:true,high:true});
  d.switches[0].w=76;
  d.switches[0].load=3.8;
  d.demo=[[[291,143],[346,143],[346,193],[291,193],[291,143]]];
  return onPaper(d,[paper(261,106,118,133)]);
 }
 function bridgeToFelt(){
  var d=bridge([[243,423]],{vx:8.2});
  d.beams.pop();
  d.beams.push(rail(423,351,640,376));
  d.beams.push(Object.assign(floor(633,854,408,'felt'),{signal:'softLanding'}));
  d.walls=[];
  d.cups=[openTarget(750,408,168)];
  d.requires=['softLanding'];
  return onPaper(d,[paper(178,275,309,100)]);
 }
 function sweepLocks(twoEnds){
  var d=lever({x:274,y:275,reach:181,left:twoEnds?80:68,highGate:true});
  var first=twoEnds?[418,317]:[413,332],second=twoEnds?[223,231]:[401,386];
  d.demo[0].forEach(function(point){point[1]+=twoEnds?10:7;});
  d.switches=[
   Object.assign(switchAt('outer',first[0],first[1],41,23),{anchored:true}),
   Object.assign(switchAt('start',second[0],second[1],twoEnds?31:39,23),{anchored:true})
  ];
  d.gates[0].by=['outer','start'];
  if(twoEnds)return onPaper(mirror(d),[paper(535,232,327,83)]);
  return onPaper(d,[paper(164,224,325,91)]);
 }
 function bothPads(){
  var d=pressure({sx:232,sy:393});
  d.switches=[
   Object.assign(switchAt('leftPad',192,393,29,17),{hold:true}),
   Object.assign(switchAt('rightPad',270,393,29,17),{hold:true})
  ];
  d.gates[0].by=['leftPad','rightPad'];d.gates[0].follow=true;
  d.demo=[[[171,211],[290,211],[290,261],[171,261],[171,211]]];
  return onPaper(d,[paper(147,175,160,118)]);
 }
 function carrierLevel(mode){
  var isFerry=mode==='ferry',usesLever=mode==='lever';
  var d=usesLever?lever({x:249,y:232,reach:143,left:71}):
   pressure({sx:isFerry?255:237,sy:isFerry?345:413,rolling:isFerry});
  d.beams=d.beams.slice(0,usesLever?0:1);
  d.gates=[];
  var boat={x:isFerry?468:531,y:isFerry?355:431,w:116,h:17,rim:-1,
   toX:isFerry?721:531,toY:isFerry?355:241,tilt:.24,by:'start',signal:'arrived',duration:1690};
  d.movers=[boat];
  d.requires=['arrived'];
  d.balls=[ball(isFerry?484:544,isFerry?160:234,0)];
  d.beams.push(rail(isFerry?775:576,isFerry?377:270,isFerry?849:805,421));
  d.cups=[target(897,510,172)];
  d.walls=[wall(983,456,16,179)];
  if(usesLever){
   d.beams.pop();
   d.beams.push(floor(589,612,286),floor(756,788,327),rail(786,355,838,393));
   d.demo.push([[586,274],[797,317]]);
  }
  return onPaper(d,usesLever?[paper(147,200,270,76),paper(552,253,270,134)]:
   isFerry?[paper(64,150,131,121)]:[paper(170,171,138,141)]);
 }
 function ringThenBasket(){
  var d=slope({start:201,drop:74});
  d.bells=[{id:'ring',x:669,y:365,r:26,ball:'red'}];d.requires=['ring'];
  return onPaper(d,[paper(169,231,335,148)]);
 }
 function ferryRelay(){
  var d=carrierLevel('ferry'),approach=split({});
  d.balls[0].id='blue';d.balls[0].cup='blueHome';d.cups[0].id='blueHome';
  d.balls.unshift(approach.balls[0]);d.cups.unshift(approach.cups[0]);
  d.beams=approach.beams.slice(0,2).concat([floor(768,797,384),floor(840,866,411)]);
  d.switches=[Object.assign(switchAt('start',353,330,38,24,'ball'),{actor:'red'})];
  d.demo=[approach.demo[0],[[777,374],[852,401]]];
  return onPaper(d,[paper(85,240,325,157),paper(750,327,157,108)]);
 }

 add('跨过小沟',3,bridge([[238,370]],{vx:7.85}));
 add('接住高处的球',3,slope({}));
 add('桌沿挡一挡',3,onPaper(brake({}),[paper(700,279,155,144)]));
 add('中间有桥墩',3,onPaper(bridge([[230,366],[407,548]],{vx:7.6}),[paper(172,289,245,57),paper(352,347,257,69)]));
 add('弯一弯，接住它',3,onPaper(cradle(),[paper(523,268,249,152)]));

 add('落球向左转',3,slope({start:209,drop:74,flip:true}));
 add('碰铃再进篮',2,ringThenBasket());
 add('钻过木箱下面',3,underBox());
 add('走两段折线路',3,onPaper(zigzag(),[paper(125,232,347,125),paper(220,376,434,137)]));
 add('接过第一段，再搭第二段',3,onPaper(bridge([[219,379],[481,657]],{y:367,vx:9.85}),[paper(163,313,259,62),paper(426,372,295,69)]));

 add('弹起来，接一下',3,rebound());
 add('碰墙弹回来',3,sideBank());
 add('弹到空中的铃',3,reboundBell());
 add('跳过纸箱向左走',2,onPaper(mirror(reboundWall()),[paper(347,272,276,127)]));
 add('先送上弹垫，再接住',3,feedRebound());

 add('积木按开关',3,onPaper(pressure({}),[paper(195,170,148,146)]));
 add('稳稳压住开关',3,holdGate());
 add('把配重放上托盘',2,weightedSwitch());
 add('会荡回来的门',2,onPaper(hingedDoor(),[paper(75,162,119,125)]));
 add('两把锁都打开',2,onPaper(auxiliary(pressure({sx:246,sy:363,narrow:true})),[paper(179,160,134,146),paper(691,66,152,108)]));

 add('木板走得远',3,onPaper(bridge([[249,421]],{vx:5.6}),[paper(186,287,288,97)]));
 add('毛毡慢一点',3,onPaper(brake({center:695,felt:true,vx:16.5}),[paper(700,282,144,145)]));
 add('木坡传配重',2,onPaper(pressure({rolling:true,sx:336,sy:363}),[paper(157,168,116,129)]));
 add('防滑垫上的脚',2,onPaper(slope({start:183,y:251,span:266,drop:83,felt:true}),[paper(149,206,338,157)]));
 add('过桥后慢慢停下',3,bridgeToFelt());

 add('轴上跷跷板',3,onPaper(lever({x:277,reach:171}),[paper(166,249,318,76)]));
 add('压低这一头',3,onPaper(lever({x:307,y:252,left:112,reach:145,counter:true}),[paper(170,242,312,57),paper(178,108,108,141)]));
 add('杠杆扫过两把锁',2,sweepLocks());
 add('翻板开路，另搭一座桥',3,onPaper(relay({lever:true}),[paper(315,126,304,70),paper(330,316,278,90)]));
 add('重物和转轴',2,onPaper(lever({x:298,y:252,left:124,reach:145,counter:true,flip:true,highGate:true}),[paper(556,242,321,56),paper(750,105,113,144)]));

 add('撞倒第一块',3,onPaper(domino({}),[paper(144,166,137,127)]));
 add('积木传一传',3,onPaper(domino({x:364,double:true}),[paper(117,194,119,116)]));
 add('把小球抬上去',3,carrierLevel('lift'));
 add('横着走的小车',2,carrierLevel('ferry'));
 add('升降到半空才有路',3,carrierLevel('lever'));

 add('两个小篮子',4,onPaper(split({}),[paper(85,240,325,157),paper(622,240,322,157)]));
 add('一笔分两路',3,roof({}));
 add('一颗响铃一颗回家',3,onPaper(split({asymmetric:true,bell:true}),[paper(85,230,322,181),paper(627,230,325,181)]));
 add('红球开门，蓝球过门',3,onPaper(paired({ballGate:true}),[paper(87,239,323,157),paper(623,239,324,157)]));
 add('红球撞铃抬起蓝球的门',2,passesBell());

 add('一笔搭桥兼开锁',1,bridgeLatch());
 add('两笔打开仓库',2,warehouse());
 add('一笔压住两个开关',1,bothPads());
 add('一根杆，两头各开一把锁',1,sweepLocks(true));
 add('一笔接两颗',1,roof({narrow:true}));

 add('跳过纸箱再过桥',2,reboundBridge());
 add('压下翻板再过沟',3,onPaper(relay({lever:true,two:true}),[paper(311,122,305,70),paper(192,313,241,60),paper(472,363,246,80)]));
 add('红球给蓝球叫小车',2,ferryRelay());
 var bellRoute=paired({bell:true});
 bellRoute.gates[0].by=['start','ring'];
 add('分到铃铛和篮子',3,onPaper(bellRoute,[paper(86,239,324,158),paper(621,239,328,158),paper(454,204,109,110)]));
 add('小熊的玩具工坊',3,onPaper(paired({final:true}),[paper(83,245,323,164),paper(624,239,326,169),paper(453,208,112,111)]));

 var tips=[
  '试试搭路、接球，或者让挡板把球留下来。',
  '看看球从哪边来，再想想接住后要往哪边送。',
  '先放一次球，看看球碰到弹垫后往哪里飞。',
  '画出会落下或滚动的零件。零件碰到开关，就能打开小球前面的门。',
  '看一看光滑的木板和粗糙的毛毡。让球有足够冲劲，再在目标前停住。',
  '让一笔穿过金色转轴。它会转动，压到开关。',
  '看看是哪件东西带动了下一件。小球也可以让托盘运过去。',
  '两颗球需要自己的路线。把小球送到和它同色的篮子。',
  '用下方纸条表示的笔数画好路线，再放球。',
  '看清每个目标，用画的零件安排机关工作的先后。'
 ];
 var specific={
  4:'每张蓝纸可以单独画。在桥墩两边分别搭路。',
  3:'让球停在小熊身边的圈里。挡板要站得稳。',
  5:'画一个两端翘起的凹槽，接住斜着飞过来的球。',
  7:'小球要先碰铃，再进篮。',
  8:'木箱把上方堵住了。从木箱下面把球接到右边。',
  9:'接住球，再让它转向左边的篮子。',
  13:'把接球的路留在铃铛下面，让小球有空间弹起来。',
  15:'上面的纸用来送球去弹垫，下面的纸用来接球。',
  17:'物体要留在开关上。它一滑走，门就会落下。',
  18:'在蓝纸上画一块够重的积木，也可以叠两块压下托盘。',
  20:'球会先滚到门前。两张纸上的重物分别按下开关，两把锁都打开才抬门。',
  28:'让转轴杆的一端先后碰到两把锁。',
  33:'压住开关，托盘会把小球抬到高处的路上。',
  34:'让零件滚过去碰开关，小车就会把小球送到对面。',
  35:'先让转轴启动托盘，再在托盘升到的位置接球。',
  39:'两颗球同时落下。让红球经过开关，抬起蓝球前面的门。',
  40:'两颗球同时落下。红球撞铃后会抬起蓝球前面的门。',
  41:'只用一笔跨过宽沟，桥还要碰到另一端的小开关。',
  42:'在上方按开关，在下方搭桥，让球从纸箱下面过去。',
  43:'画一个能同时留在两个开关上的零件。',
  44:'一根杆的两端会往相反方向转。让两头各碰一把锁。',
  46:'在第一张纸上接住越过纸箱的球，再在第二张纸上补路。',
  48:'红球经过开关，小车就会运走蓝球。在对岸给蓝球留一段路。',
  49:'重物按开关、红球碰铃，两把锁都打开后蓝球才能过门。',
  50:'三颗球同时出发。红球和蓝球进篮后，中间的挡板会抽开，黄球会落下撞铃。'
 };
 levels.forEach(function(level,i){
  level.id=i+1;level.group=Math.floor(i/5);level.tip=specific[level.id]||tips[level.group];
  if(level.sheets&&level.sheets.length&&!specific[level.id])level.tip+=' 在蓝色纸面上画。';
 });
 return {levels:levels,groups:groups};
}));
