(function(root){'use strict';
var P=typeof module!=='undefined'&&module.exports?require('./physics.js'):root.RollingPhysics;
var opening=[
 {name:'碰响铃铛',text:'抬高坡道，碰响铃铛。',kind:'bell',target:600,height:70,surface:2,h:true,s:false,predict:false},
 {name:'送得更远',text:'先放小旗，再让小球碰到远处的铃铛。',kind:'bell',target:720,height:120,surface:2,h:true,s:false,predict:true},
 {name:'换条跑道',text:'坡道不动，换一条路。',kind:'bell',target:820,height:120,surface:2,h:false,s:true,predict:true},
 {name:'高一点会怎样',text:'用两个不同高度试一试。',kind:'height',height:70,surface:1,h:true,s:false,predict:true},
 {name:'哪条路更远',text:'保持高度，用两种地面试一试。',kind:'surface',height:120,surface:2,h:false,s:true,predict:true},
 {name:'刚刚好的礼物',text:'让球停在篮子里。',kind:'basket',target:760,height:70,surface:2,h:true,s:true,predict:true}
];
function options(m,w){return {wind:w||0,pins:m.pins||[],patch:m.patch||null};}
function success(m,t,previous){if(m.kind==='height')return !!previous&&previous.height!==t.height&&previous.surface===t.surface;
 if(m.kind==='surface')return !!previous&&previous.surface!==t.surface&&previous.height===t.height;
 if(m.kind==='bell')return t.x>=m.target-22;
 return Math.abs(t.x-m.target)<=(m.tolerance||45)&&t.events.length===(m.pins||[]).length;
}
function candidates(m){var found=[];(m.h?P.heights:[m.height]).forEach(function(h){(m.s?[0,1,2]:[m.surface]).forEach(function(s){(m.f?[-1,0,1]:[m.wind||0]).forEach(function(w){var t=P.simulate(h,s,options(m,w));if(t.x>460&&t.x<1060&&t.events.length===(m.pins||[]).length)found.push(t);});});});return found;}
function build(group,index,seed){var m={name:'',text:'把球送进篮子，也让机关动起来。',kind:'basket',height:70,surface:2,wind:0,h:true,s:true,f:false,predict:true,tolerance:42,group:group};
 if(group===1){m.name=['推倒第一块','多米诺接力','轻轻推到家','远处的积木','穿过积木林','积木大挑战'][index];m.pins=index<2?[550]:index<4?[530,650]:[510,610,710];if(index===0)m.s=false;}
 if(group===2){m.name=['顺风快递','逆风停靠','风向变了','风里的脚印','草地和风','风车实验家'][index];m.f=true;if(index<2){m.h=false;m.s=false;m.height=120;m.surface=1;}if(index===4)m.surface=2;}
 if(group===3){m.name=['刹车小毯','穿过两条路','风吹多米诺','轻推慢停','机关接力','小小科学家'][index];m.f=index>=2;m.pins=index>=2?[540,680]:[];m.patch=index===0?[560,730]:index===1?[720,900]:index===3?[650,790]:index===5?[760,890]:null;}
 var all=candidates(m),chosen=all[(seed*7+index*5+group*3)%all.length];m.target=Math.round(chosen.x);
 // Start away from the goal; each puzzle remains solvable without a lucky initial launch.
 var starts=[];(m.h?P.heights:[m.height]).forEach(function(h){(m.s?[0,1,2]:[m.surface]).forEach(function(s){(m.f?[-1,0,1]:[0]).forEach(function(w){var t=P.simulate(h,s,options(m,w));if(!success(m,t))starts.push({h:h,s:s,w:w});});});});
 var start=starts[(seed+index)%starts.length];if(start){m.height=start.h;m.surface=start.s;m.wind=start.w;}return m;
}
var list=opening.slice();for(var g=1;g<=3;g++)for(var i=0;i<6;i++)list.push(build(g,i,11));
function expedition(seed,last){var m;for(var a=0;a<5;a++){var code=(Math.imul(seed+a*97,1664525)+1013904223)>>>0;m=build(1+code%3,Math.floor(code/3)%6,code%65536);if(!last||Math.abs(m.target-last.target)>35||JSON.stringify(m.pins)!==JSON.stringify(last.pins)||JSON.stringify(m.patch)!==JSON.stringify(last.patch))break;}m.name='新的小发现';m.expedition=true;return m;}
var api={list:list,options:options,success:success,candidates:candidates,expedition:expedition};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RollingMissions=api;
}(typeof window!=='undefined'?window:this));
