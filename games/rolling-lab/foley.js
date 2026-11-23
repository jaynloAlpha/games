(function(root){
'use strict';

var names=['wood','felt','grass','block','bell','soft','basket'];

function create(){
 var context=null,buffers={},loops={},voices=[];
 var recordings=names.map(function(name){
  return fetch('assets/foley/'+name+'.wav').then(function(response){
   if(!response.ok)throw new Error('音效未加载');
   return response.arrayBuffer();
  }).catch(function(){return null;});
 });

 function attach(audioContext){
  if(context||!audioContext)return;
  context=audioContext;
  names.forEach(function(name,index){
   recordings[index].then(function(bytes){
    if(!bytes)return;
    // The callback form also works with older iPad Safari.
    context.decodeAudioData(bytes,function(buffer){buffers[name]=buffer;},function(){});
   });
  });
 }

 function makeVoice(name,x,loop,volume,rate){
  var source=context.createBufferSource(),gain=context.createGain();
  var pan=context.createStereoPanner?context.createStereoPanner():null;
  source.buffer=buffers[name];
  source.loop=loop;
  source.playbackRate.value=rate;
  gain.gain.value=volume;
  source.connect(gain);
  if(pan){
   pan.pan.value=position(x);
   gain.connect(pan);
   pan.connect(context.destination);
  }else gain.connect(context.destination);
  var voice={source:source,gain:gain,pan:pan};
  source.onended=function(){
   source.disconnect();
   gain.disconnect();
   if(pan)pan.disconnect();
   voices=voices.filter(function(active){return active!==voice;});
  };
  voices.push(voice);
  source.start();
  return voice;
 }

 function position(x){return Math.max(-.36,Math.min(.36,(x-600)/1400));}

 function roll(material,speed,x){
  if(!context)return;
  var name=names[material],now=context.currentTime;
  var pace=Math.min(1,speed/370);
  var volume=Math.pow(pace,.85)*[.40,.33,.41][material];
  if(buffers[name]&&!loops[name]&&volume>.004)loops[name]=makeVoice(name,x,true,0,.60+pace*.85);
  Object.keys(loops).forEach(function(key){
   var voice=loops[key];
   voice.gain.gain.setTargetAtTime(key===name?volume:0,now,.026);
   if(key===name){
    voice.source.playbackRate.setTargetAtTime(.60+pace*.85,now,.04);
    if(voice.pan)voice.pan.pan.setTargetAtTime(position(x),now,.06);
   }
  });
 }

 function impact(name,x,volume,rate){
  if(context&&buffers[name])makeVoice(name,x,false,volume,rate||1);
 }

 function stopRoll(fade){
  if(!context)return;
  var now=context.currentTime;
  Object.keys(loops).forEach(function(name){
   var voice=loops[name];
   if(fade)voice.gain.gain.setTargetAtTime(0,now,.012);
   voice.source.stop(now+(fade ? .06 : 0));
  });
  loops={};
 }

 function silence(){
  voices.forEach(function(voice){voice.source.stop();});
  voices=[];
  loops={};
 }

 return {attach:attach,roll:roll,impact:impact,stopRoll:stopRoll,silence:silence};
}

root.RollingFoley={create:create};
}(window));
