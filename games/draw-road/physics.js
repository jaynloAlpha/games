(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/matter-0.20.0.min.js'));
 else root.DrawPhysics=factory(root.Matter);
}(typeof window==='undefined'?this:window,function(M){
 'use strict';
 var Bodies=M.Bodies, Body=M.Body, Engine=M.Engine, Composite=M.Composite;
 var W=1024,H=576,STEP=1000/120,WIDTH=18;
 var layers={ball:1,ink:2,fixture:4,mechanism:8};
 var materials={
  wood:{friction:.032,frictionStatic:.47},
  felt:{friction:.68,frictionStatic:1.1},
  block:{friction:.30,frictionStatic:.8}
 };

 function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
 function length(points){return points.reduce(function(sum,p,i){return sum+(i?distance(p,points[i-1]):0);},0);}
 function copy(p){return {x:p.x,y:p.y};}
 function segmentDistance(p,a,b){
  var dx=b.x-a.x,dy=b.y-a.y,div=dx*dx+dy*dy;
  var t=div?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/div)):0;
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
 }
 function simplify(points,tolerance){
  if(points.length<3)return points.slice();
  var split=0,largest=tolerance,a=points[0],b=points[points.length-1];
  for(var i=1;i<points.length-1;i++){
   var d=segmentDistance(points[i],a,b);
   if(d>largest){largest=d;split=i;}
  }
  if(!split)return [a,b];
  return simplify(points.slice(0,split+1),tolerance).slice(0,-1).concat(simplify(points.slice(split),tolerance));
 }
 function cross(a,b,c){return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
 function signedArea(poly){return poly.reduce(function(sum,p,i){return sum+cross({x:0,y:0},p,poly[(i+1)%poly.length]);},0)/2;}
 function triangulate(poly){
  var nodes=(signedArea(poly)<0?poly.slice().reverse():poly.slice()),triangles=[];
  while(nodes.length>3){
   var ear=-1;
   for(var i=0;i<nodes.length;i++){
    var a=nodes[(i+nodes.length-1)%nodes.length],b=nodes[i],c=nodes[(i+1)%nodes.length];
    if(cross(a,b,c)<=.05)continue;
    if(nodes.some(function(p){
     return p!==a&&p!==b&&p!==c&&cross(a,b,p)>=0&&cross(b,c,p)>=0&&cross(c,a,p)>=0;
    }))continue;
    triangles.push([a,b,c]);ear=i;break;
   }
   if(ear<0)return [];
   nodes.splice(ear,1);
  }
  if(nodes.length===3&&cross(nodes[0],nodes[1],nodes[2])>.05)triangles.push(nodes);
  return triangles;
 }
 function simpleRing(poly){
  for(var i=0;i<poly.length;i++){
   var a=poly[i],b=poly[(i+1)%poly.length];
   for(var j=i+2;j<poly.length;j++){
    if(i===0&&j===poly.length-1)continue;
    var c=poly[j],d=poly[(j+1)%poly.length];
    if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return false;
   }
  }
  return true;
 }
 function shape(raw,maxLength){
  if(!raw||raw.length<2)return null;
  var pts=raw.map(function(p){return Array.isArray(p)?{x:p[0],y:p[1]}:copy(p);});
  if(pts.some(function(p){return !Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<12||p.x>W-12||p.y<58||p.y>H-18;}))return null;
  var measured=length(pts);
  if(measured<14||measured>(maxLength||740)+1)return null;
  var near=pts.length>=4&&distance(pts[0],pts[pts.length-1])<=25&&measured>=100;
  if(near)pts[pts.length-1]=copy(pts[0]);
  var tolerance=2.5;
  var outline=simplify(pts,tolerance);
  while(outline.length>27){tolerance+=1.8;outline=simplify(pts,tolerance);}
  var poly=near?outline.slice(0,-1):[];
  var fill=poly.length>=3&&Math.abs(signedArea(poly))>=520&&simpleRing(poly)?triangulate(poly):[];
  return {points:fill.length?poly:outline,triangles:fill,closed:!!fill.length,length:measured};
 }

 function filter(category,mask){return {category:category,mask:mask===undefined?15:mask};}
 function plank(a,b,w,opts){
  return Bodies.rectangle((a.x+b.x)/2,(a.y+b.y)/2,distance(a,b),w,
   Object.assign({angle:Math.atan2(b.y-a.y,b.x-a.x)},opts));
 }
 function strokeBody(stroke){
  var opts={collisionFilter:filter(layers.ink),friction:.57,frictionStatic:.72,
   frictionAir:.008,restitution:.025,density:.0019,slop:.045};
  var parts=[];
  if(stroke.closed){
   stroke.triangles.forEach(function(tri){
    var center=M.Vertices.centre(tri);
    parts.push(Body.create(Object.assign({position:center,vertices:tri.map(copy)},opts)));
   });
   // Adjacent triangle edges should not snag another part sliding across the fill.
   for(var a=0;a<parts.length;a++)for(var b=a+1;b<parts.length;b++){
    var va=parts[a].vertices,vb=parts[b].vertices;
    for(var j=0;j<va.length;j++)for(var k=0;k<vb.length;k++){
     if(distance(va[j],vb[(k+1)%vb.length])<.1&&distance(va[(j+1)%va.length],vb[k])<.1){va[j].isInternal=true;vb[k].isInternal=true;}
    }
   }
  }else{
   stroke.points.forEach(function(p,i){
    parts.push(Bodies.circle(p.x,p.y,WIDTH/2,opts,12));
    if(i)parts.push(plank(stroke.points[i-1],p,WIDTH,opts));
   });
  }
  var body=parts.length===1?parts[0]:Body.create(Object.assign({parts:parts},opts));
  body.plugin.ink=stroke;
  return body;
 }
 function closestPin(stroke,pins){
  return (pins||[]).find(function(pin){
   var p={x:pin.x,y:pin.y};
   return stroke.points.some(function(a,i){
    return distance(p,a)<23||i>0&&segmentDistance(p,stroke.points[i-1],a)<18;
   });
  });
 }
 function inRect(point,rect){
  return point.x>=rect.x&&point.x<=rect.x+rect.w&&point.y>=rect.y&&point.y<=rect.y+rect.h;
 }
 function containingSheet(level,point){
  return (level.sheets||[]).find(function(sheet){return inRect(point,sheet);});
 }
 // Clip against the visible solid box, including sparse mouse or touch samples.
 function crossesBox(a,b,box){
  var deltaX=b.x-a.x,deltaY=b.y-a.y,min=0,max=1;
  var edges=[
   [-deltaX,a.x-box.x],[deltaX,box.x+box.w-a.x],
   [-deltaY,a.y-box.y],[deltaY,box.y+box.h-a.y]
  ];
  for(var i=0;i<edges.length;i++){
   var p=edges[i][0],q=edges[i][1];
   if(!p){if(q<0)return false;continue;}
   var t=q/p;
   if(p<0)min=Math.max(t,min);else max=Math.min(t,max);
   if(min>max)return false;
  }
  return true;
 }
 function obstructed(paths,wall,closed){
  var box={x:wall.x-wall.w/2+2,y:wall.y-wall.h/2+2,w:wall.w-4,h:wall.h-4};
  var crosses=paths.some(function(a,i){
   if(i===0&&!closed)return inRect(a,box);
   return crossesBox(paths[(i+paths.length-1)%paths.length],a,box);
  });
  if(crosses||!closed)return crosses;
  var encloses=false;
  paths.forEach(function(a,i){
   var b=paths[(i+1)%paths.length];
   if((a.y>wall.y)!==(b.y>wall.y)&&wall.x<(b.x-a.x)*(wall.y-a.y)/(b.y-a.y)+a.x)encloses=!encloses;
  });
  return encloses;
 }
 function draft(level,raw,existing){
  if(existing.length>=level.budget)return {error:'budget'};
  var s=shape(raw,level.ink);
  if(!s)return {error:'shape'};
  var path=raw.map(function(p){return Array.isArray(p)?{x:p[0],y:p[1]}:p;});
  if(level.sheets&&level.sheets.length&&!level.sheets.some(function(sheet){
   return path.every(function(p){return inRect(p,sheet);});
  }))return {error:'sheet'};
  if((level.walls||[]).some(function(w){return w.solid&&obstructed(s.points,w,s.closed);}))return {error:'solid'};
  var pin=closestPin(s,level.pins);
  if(pin&&existing.some(function(other){return other.pin===pin;}))return {error:'pin'};
  s.pin=pin||null;
  return s;
 }

 function create(level,strokes,onEvent){
  var engine=Engine.create({positionIterations:10,velocityIterations:8,constraintIterations:5,enableSleeping:false});
  engine.gravity.y=.98;
  var world=engine.world,things=[],balls=[],gates=[],cups=[],switches=[],bells=[],inks=[],pressed={},events=[];
  var elapsed=0,verdict='running',touches=[],settled={},removed={};
  function add(body,role,spec){
   body.plugin.role=role;body.plugin.spec=spec;
   Composite.add(world,body);things.push({body:body,role:role,spec:spec});return body;
  }
  function emit(kind,body,strength,impulse){
   var event={kind:kind,x:body?body.position.x:W/2,y:body?body.position.y:H/2,strength:strength||1,time:elapsed};
   if(impulse)event.impulse=impulse;
   events.push(event);if(onEvent)onEvent(event);
  }
  function staticRect(x,y,w,h,role,spec,extras){
   return add(Bodies.rectangle(x,y,w,h,Object.assign({isStatic:true,collisionFilter:filter(layers.fixture)},extras)),role,spec);
  }
  (level.beams||[]).forEach(function(s){
   var material=materials[s.material]||materials.wood;
   add(plank({x:s.x1,y:s.y1},{x:s.x2,y:s.y2},s.w,Object.assign({isStatic:true,collisionFilter:filter(layers.fixture)},material)),'beam',s);
  });
  (level.walls||[]).forEach(function(s){staticRect(s.x,s.y,s.w,s.h,'wall',s,{friction:.42});});
  (level.cups||[]).forEach(function(s){
   cups.push(s);
   if(s.open)return;
   var cupMask=filter(layers.fixture,layers.ball|layers.ink|layers.mechanism);
   var base={collisionFilter:cupMask,restitution:.01,friction:.9};
   staticRect(s.x,s.y+7,s.w,14,'cupPart',s,base);
   staticRect(s.x-s.w/2+5,s.y-s.h/2,10,s.h,'cupPart',s,base);
   staticRect(s.x+s.w/2-5,s.y-s.h/2,10,s.h,'cupPart',s,base);
  });
  (level.switches||[]).forEach(function(s){
   var b=staticRect(s.x,s.y,s.w,s.h,'switch',s,{isSensor:true,collisionFilter:filter(layers.fixture,layers.ball|layers.ink|layers.mechanism)});
   switches.push({body:b,spec:s});
  });
  (level.bells||[]).forEach(function(s){
   var b=add(Bodies.circle(s.x,s.y,s.r||23,{isStatic:true,isSensor:true,collisionFilter:filter(layers.fixture,layers.ball|layers.mechanism)}),'bell',s);
   bells.push({body:b,spec:s});
  });
  (level.gates||[]).forEach(function(s){
   var b=staticRect(s.x,s.y,s.w,s.h,'gate',s,{friction:.2,collisionFilter:filter(layers.mechanism)});
   gates.push({body:b,spec:s,progress:0});
  });
  (level.toys||[]).forEach(function(s){
   var b=add(Bodies.rectangle(s.x,s.y,s.w,s.h,{density:s.density||.0022,friction:.42,restitution:.02,
    frictionAir:.012,collisionFilter:filter(layers.mechanism)}),'toy',s);
   if(s.pivot){
    Composite.add(world,M.Constraint.create({pointA:{x:s.x,y:s.y-s.h/2+7},bodyB:b,pointB:{x:0,y:-s.h/2+7},length:0,stiffness:1,damping:.18}));
   }
  });
  level.balls.forEach(function(s){
   var b=add(Bodies.circle(s.x,s.y,s.r||16,{density:.0023,restitution:.055,
    friction:.19,frictionStatic:.43,frictionAir:.001,collisionFilter:filter(layers.ball)}),'ball',s);
   var velocity={x:s.vx||0,y:s.vy||0};
   Body.setVelocity(b,velocity);
   balls.push({body:b,spec:s});
   emit('release',b,.6,Math.hypot(velocity.x,velocity.y));
  });
  strokes.forEach(function(s,i){
   var body=add(strokeBody(s),'ink',s);
   var tether=s.pin;
   if(tether){
    Composite.add(world,M.Constraint.create({pointA:{x:tether.x,y:tether.y},bodyB:body,
     pointB:{x:tether.x-body.position.x,y:tether.y-body.position.y},length:0,stiffness:1,damping:.15}));
   }
   inks.push({body:body,stroke:s,x:body.position.x,y:body.position.y,color:i});
  });
  function trigger(entity,name){
   if(!pressed[name]){pressed[name]=elapsed;emit(entity.plugin.role,entity,.8);}
  }
  function openSignal(requirement){
   if(Array.isArray(requirement))return requirement.every(openSignal);
   return !requirement||!!pressed[requirement];
  }
  function collision(pair){
   var x=pair.bodyA.parent,y=pair.bodyB.parent;
   [x,y].forEach(function(a,i){
    var other=i?x:y, s=a.plugin.spec;
    if(a.plugin.role==='switch'&&!other.isStatic){
     var attached=other.plugin.ink&&other.plugin.ink.pin;
     if((!s.role||other.plugin.role===s.role)&&(!s.mass||other.mass>=s.mass)&&
       (!s.anchored||attached)&&(!s.actor||s.actor===other.plugin.spec.id))trigger(a,s.id);
    }else if(a.plugin.role==='bell'&&other.plugin.role==='ball'){
     if(!s.ball||s.ball===other.plugin.spec.id)trigger(a,s.id);
    }else if(a.plugin.role==='beam'&&s.material==='felt'&&other.plugin.role==='ball'){
     touches.push(other);
    }
   });
  }
  M.Events.on(engine,'collisionStart',function(e){
   e.pairs.forEach(function(pair){
    collision(pair);
    var a=pair.bodyA.parent,b=pair.bodyB.parent;
    if(a.isSensor||b.isSensor||a.isStatic&&b.isStatic)return;
    var rx=a.velocity.x-b.velocity.x,ry=a.velocity.y-b.velocity.y;
    var speed=Math.abs(rx*pair.collision.normal.x+ry*pair.collision.normal.y);
    if(speed>2.3)emit('knock',a.isStatic?b:a,Math.min(1,speed/12));
   });
  });
  M.Events.on(engine,'collisionActive',function(e){e.pairs.forEach(collision);});

  function out(body){return body.position.y>H+115||body.position.x<-140||body.position.x>W+140;}
  function step(){
   if(verdict!=='running')return verdict;
   elapsed+=STEP;
   gates.forEach(function(g){
    if(g.spec.afterCups&&!balls.every(function(entry){return !entry.spec.cup||settled[entry.spec.id]>240;}))return;
    if(!openSignal(g.spec.by)||g.progress>=1)return;
    if(g.progress===0)emit('gate-open',g.body,.7);
    g.progress=Math.min(1,g.progress+STEP/365);
    var slide=g.spec.slide||{x:0,y:-(g.spec.h+22)};
    Body.setPosition(g.body,{x:g.spec.x+slide.x*g.progress,y:g.spec.y+slide.y*g.progress});
    if(g.progress===1)Composite.remove(world,g.body);
   });
   touches=[];
   Engine.update(engine,STEP);
   touches.forEach(function(b){
    if(!b.isStatic){Body.setVelocity(b,{x:b.velocity.x*.978,y:b.velocity.y});Body.setAngularVelocity(b,b.angularVelocity*.975);}
   });
   inks.forEach(function(ink){
    if(!removed[ink.body.id]&&out(ink.body)){removed[ink.body.id]=true;Composite.remove(world,ink.body);}
   });
   var all=balls.map(function(entry){
    var b=entry.body,s=entry.spec;
    if(!s.cup)return true;
    var cup=cups.find(function(c){return c.id===s.cup;});
    var r=s.r||16;
    var inside=Math.abs(b.position.x-cup.x)<cup.w/2-r*.48&&b.position.y>=cup.y-cup.h-5&&b.position.y<=cup.y+3&&b.speed<2.1;
    settled[s.id]=inside?(settled[s.id]||0)+STEP:0;
    return settled[s.id]>240;
   }).every(Boolean);
   var fulfilled=(level.requires||[]).every(function(id){return !!pressed[id];});
   if(all&&fulfilled){verdict='won';emit('win');}
   else if(balls.some(function(o){return o.spec.cup&&out(o.body);})||elapsed>=10800)verdict='retry';
   return verdict;
  }
  return {step:step,things:things,balls:balls,cups:cups,switches:switches,bells:bells,gates:gates,inks:inks,
   pressed:pressed,events:events,get elapsed(){return elapsed;},get verdict(){return verdict;}};
 }
 return {W:W,H:H,STEP:STEP,WIDTH:WIDTH,distance:distance,shape:shape,draft:draft,containingSheet:containingSheet,create:create};
}));
