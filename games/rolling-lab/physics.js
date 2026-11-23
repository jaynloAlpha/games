(function(root){
'use strict';
var G=650,STEP=1/120,END=390,GROUND=390,EDGE=1110;
var surfaces=[{name:'光滑木板',mu:.16},{name:'毛毡',mu:.24},{name:'草地',mu:.34}];
function simulate(height,surface,options){
 options=options||{};var wind=Number(options.wind)||0,pins=options.pins||[],events=[],nextPin=0;
 var length=Math.hypot(260,height),a=5/7*G*(height/length-.018*260/length),s=0,v=0,t=0,points=[{x:130,y:GROUND-height-24,t:0,angle:0}],angle=0,flat=false,hit=false,stoppedAtPin=false;
 for(var n=0;n<2400;n++){
  var old=v,ds;
  if(!flat){v+=a*STEP;ds=(old+v)/2*STEP;s+=ds;angle+=ds/24;if(s>=length){flat=true;s=0;points.push({x:END,y:GROUND-24,t:t+STEP,angle:angle});}}
  else{var px=END+s,mu=options.patch&&px>=options.patch[0]&&px<=options.patch[1]?.42:surfaces[surface].mu;
   var breeze=px>=470&&px<=940?wind*155:0;
   v=Math.max(0,v+(breeze-mu*G)*STEP);ds=(old+v)/2*STEP;s+=ds;angle+=ds/24;
   while(nextPin<pins.length&&END+s>=pins[nextPin]-24){var energy=v*v-8500;
    if(energy<=0){s=pins[nextPin]-24-END;v=0;stoppedAtPin=true;break;}
    v=Math.sqrt(energy);events.push({x:pins[nextPin],t:t+STEP});nextPin++;
   }
   if(END+s>=EDGE){s=EDGE-END;v=0;hit=true;}}
  t+=STEP;
  if(n%4===0||v===0)points.push({x:flat?END+s:130+260*s/length,y:flat?GROUND-24:GROUND-height+height*s/length-24,t:t,angle:angle});
  if(flat&&v===0)break;
 }
 return {height:height,surface:surface,wind:wind,options:options,events:events,points:points,x:END+s,duration:t,cushion:hit,stoppedAtPin:stoppedAtPin};
}
function sample(trial,time){var p=trial.points;if(time>=trial.duration)return p[p.length-1];var lo=0,hi=p.length-1;while(lo+1<hi){var mid=(lo+hi)>>1;if(p[mid].t<=time)lo=mid;else hi=mid;}var u=(time-p[lo].t)/Math.max(.0001,p[hi].t-p[lo].t);return {x:p[lo].x+(p[hi].x-p[lo].x)*u,y:p[lo].y+(p[hi].y-p[lo].y)*u,angle:p[lo].angle+(p[hi].angle-p[lo].angle)*u};}
var api={simulate:simulate,sample:sample,surfaces:surfaces,heights:[70,120,180],ground:GROUND};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RollingPhysics=api;
}(typeof window!=='undefined'?window:this));
