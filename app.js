// Kalpa Villa 3D — phase 1 model built from docs/plan-3.pdf with three.js r128.
// Sections: renderer + scene, materials and textures, wall/opening builders (incl. interactive doors),
// phase-1 block, future living room + kitchen, roof, fittings, site, views and controls, sun, interaction loop.
(async function(){
const stage=document.getElementById('stage');
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
stage.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xcfe0e6);
scene.fog=new THREE.Fog(0xcfe0e6,90,220);
// Sky dome: blue at the zenith fading to the fog colour at the horizon, so the ground plane blends into it.
// The horizon warms towards sunrise and sunset (set from placeSun).
const sky=new THREE.Mesh(new THREE.SphereGeometry(420,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{top:{value:new THREE.Color(0x3d86d4)},horizon:{value:new THREE.Color(0xcfe0e6)}},
  vertexShader:'varying vec3 vP; void main(){vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform vec3 top,horizon; varying vec3 vP; void main(){float h=clamp(normalize(vP).y,0.0,1.0); gl_FragColor=linearToOutputTexel(vec4(mix(horizon,top,pow(h,0.6)),1.0));}'}));
scene.add(sky);
const camera=new THREE.PerspectiveCamera(45,1,0.1,500);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.maxPolarAngle=Math.PI*0.495; controls.minDistance=1; controls.maxDistance=140;

// Units: feet (plan-3). x: 0 = paddy-side wall, 15 = centre wall under the ridge, 27 = far wall of the living room.
// z: 0 = road side, 19 = drain wall of the bedroom block, DZ = 28 = drain wall of the living room / kitchen.
const T=0.5, EAVE=11, RIDGE=14.5, OVER=2.5, CX=15, FAR=27, DZ=28, SL=(RIDGE-EAVE)/CX, SR=(RIDGE-EAVE)/(FAR-CX);
// Passive ventilation option (set VENT=false to revert to the sealed roof): the roof slopes stop RIDGE_GAP short
// of the ridge under a cap raised RIDGE_LIFT on spacer blocks, and eave-side walls stop VENT_GAP below the roof
// with exposed rafter tails across the slot. Gable-end walls stay closed.
const VENT=true, VENT_GAP=.5, RIDGE_GAP=.6, RIDGE_LIFT=.5;
// Height of the roof underside at the wall line for any x (both slopes meet at the ridge over x = CX)
const roofH=x=>Math.max(EAVE, x<=CX ? EAVE+x*SL : EAVE+(FAR-x)*SR);
// Compass: north is the paddy-field direction (-x) turned 30° towards the drain side (+z); east is 90° clockwise from it.
const NORTH=new THREE.Vector3(-Math.cos(Math.PI/6),0,Math.sin(Math.PI/6)), EAST=new THREE.Vector3(-Math.sin(Math.PI/6),0,-Math.cos(Math.PI/6));

scene.add(new THREE.HemisphereLight(0xeaf3ff,0x6b5a3e,0.55));
const sun=new THREE.DirectionalLight(0xfff1d6,1.05);
sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:160});
sun.shadow.bias=-0.0005; sun.target.position.set(13.5,0,13);
scene.add(sun,sun.target);

const M=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.85},o));

const mat={
  plaster:M(0xf2efe6), plinth:M(0x9a958a), floor:M(0xd8d2c4,{roughness:.5}), bathFloor:M(0xd9c3a3,{roughness:.4}),
  frame:M(0x4a3a2c,{roughness:.6}), glass:M(0x9fc4d0,{transparent:true,opacity:.35,roughness:.05,metalness:.1}),
  door:M(0x6b4f37,{roughness:.6}), white:M(0xffffff,{roughness:.3}), fabric:M(0xe8e2d4), wood:M(0x8a6a4c),
  ghost:new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.14,depthWrite:false}),
  cement:M(0xc9c6bd,{roughness:.9}) // light cement render on the outside face of exterior walls
};
mat.ghostOut=mat.ghost.clone(); // ghost living room: outside face, turns cement-coloured when shown solid
// Scale a box's UVs to its real size so textures keep their scale (S = feet per texture tile)
function uvScale(geo,w,hh,d,S=4){
  const uv=geo.attributes.uv, dims=[[d,hh],[d,hh],[w,d],[w,d],[w,hh],[w,hh]];
  for(let f=0;f<6;f++)for(let i=0;i<4;i++){const k=f*4+i; uv.setXY(k,uv.getX(k)*dims[f][0]/S,uv.getY(k)*dims[f][1]/S);}
  uv.needsUpdate=true; return geo;
}
const sBox=(w,hh,d,m)=>uvScale(new THREE.BoxGeometry(w,hh,d),w,hh,d,(m&&m.userData&&m.userData.S)||4);

function tileTexture(){
  const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  g.fillStyle='#a8562f'; g.fillRect(0,0,128,128);
  for(let r=0;r<2;r++)for(let k=0;k<2;k++){
    const x=k*64, y=r*64;
    const grd=g.createLinearGradient(x,0,x+64,0);
    grd.addColorStop(0,'#b9643a'); grd.addColorStop(.5,'#dc9268'); grd.addColorStop(1,'#b0603a');
    g.fillStyle=grd; g.beginPath(); g.moveTo(x+3,y+62); g.lineTo(x+3,y+14); g.quadraticCurveTo(x+32,y-6,x+61,y+14); g.lineTo(x+61,y+62); g.fill();
    g.fillStyle='rgba(60,25,10,.35)'; g.fillRect(x+3,y+58,58,5);
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.encoding=THREE.sRGBEncoding; t.anisotropy=8; return t;
}
// Timber boards for the French window panels: one tile = 1', two vertical 6" boards with a shadow groove
function shutterTexture(){
  const N=128, c=document.createElement('canvas'); c.width=c.height=N; const g=c.getContext('2d');
  for(let b=0;b<2;b++){
    const x=b*64, gr=g.createLinearGradient(x,0,x+64,0);
    gr.addColorStop(0,'#c98f52'); gr.addColorStop(.55,'#b77c44'); gr.addColorStop(1,'#9c6535');
    g.fillStyle=gr; g.fillRect(x,0,64,N); g.fillStyle='rgba(55,28,10,.6)'; g.fillRect(x+57,0,7,N);
  }
  for(let i=0;i<36;i++){g.fillStyle=`rgba(85,48,22,${.05+Math.random()*.09})`; g.fillRect(Math.random()*N,0,1+Math.random()*2,N);}
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.encoding=THREE.sRGBEncoding; t.anisotropy=8; return t;
}
function stripeTexture(a,b,n){
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  g.fillStyle=a; g.fillRect(0,0,64,64); g.fillStyle=b;
  for(let i=0;i<n;i++) g.fillRect(0,i*64/n,64,64/n/2.5);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.encoding=THREE.sRGBEncoding; return t;
}

const groups={core:new THREE.Group(),living:new THREE.Group(),roof:new THREE.Group(),furn:new THREE.Group(),site:new THREE.Group(),labels:new THREE.Group(),wind:new THREE.Group()};
Object.values(groups).forEach(g=>scene.add(g));

function mesh(geo,m,parent,shadow=true){const o=new THREE.Mesh(geo,m); o.castShadow=shadow; o.receiveShadow=true; parent.add(o); return o;}
// axis 'x': wall runs along x at z=fixed; axis 'z': runs along z at x=fixed
// out = {dir, mat}: give the face on the +/- side of the wall's normal (z for 'x' walls, x for 'z' walls) its own material
function box(axis,fixed,s1,s2,y1,y2,th,m,parent,out){
  if(s2-s1<=1e-3||y2-y1<=1e-3) return;
  const L=s2-s1,H=y2-y1,c=(s1+s2)/2,cy=(y1+y2)/2;
  const geo=axis==='x'?sBox(L,H,th,m):sBox(th,H,L,m);
  let mm=m;
  if(out){ mm=[m,m,m,m,m,m]; mm[axis==='x'?(out.dir>0?4:5):(out.dir>0?0:1)]=out.mat; }
  const o=mesh(geo,mm,parent); axis==='x'?o.position.set(c,cy,fixed):o.position.set(fixed,cy,c); return o;
}
mat.shutter=M(0xffffff,{map:shutterTexture(),roughness:.7}); mat.shutter.userData.S=1;
const fillCore={frame:mat.frame,glass:mat.glass,door:mat.door,shutter:mat.shutter};
// Living-room fittings get their own materials so they fade with the ghost walls
const fillLiving={frame:mat.frame.clone(),glass:mat.glass.clone(),door:mat.door.clone(),shutter:mat.shutter.clone()};
Object.values(fillLiving).forEach(m=>{m.transparent=true;});
// Interactive doors: every hinged leaf hangs from a group on its hinge line; p runs 0 (closed) → 1 (open)
const doors=[];


// Everything the Plan tab needs: walls, openings and gables are recorded as they are built, so the 2D
// drawings in drawings.js always match the 3D model. Shared with that script through window.KALPA.
const DRAW={walls:[],gables:[],extras:[],slabs:[],c:{T,EAVE,RIDGE,OVER,CX,FAR,DZ,SL,SR}};
window.KALPA=DRAW;
function hingedLeaf(axis,fixed,hinge,dir,len,y0,H,th,m,parentObj,local){
  const g=new THREE.Group(); parentObj.add(g);
  if(local) axis==='x'?g.position.set(hinge,0,0):g.position.set(0,0,hinge);
  else axis==='x'?g.position.set(hinge,y0,fixed):g.position.set(fixed,y0,hinge);
  const leaf=new THREE.Mesh(axis==='x'?sBox(len-.04,H,th,m):sBox(th,H,len-.04,m),m);
  leaf.castShadow=leaf.receiveShadow=true; g.add(leaf);
  axis==='x'?leaf.position.set(dir*len/2,H/2,0):leaf.position.set(0,H/2,dir*len/2);
  return g;
}
// French window panel: timber stiles and rails, glass above and below the mid rail
function frenchLeaf(axis,fixed,hinge,dir,len,y0,H,fm,parentObj,local){
  const g=new THREE.Group(); parentObj.add(g);
  if(local) axis==='x'?g.position.set(hinge,0,0):g.position.set(0,0,hinge);
  else axis==='x'?g.position.set(hinge,y0,fixed):g.position.set(fixed,y0,hinge);
  const part=(a0,a1,y1,y2,th,m,sh=true)=>{ // a0..a1 measured along the panel from the hinge
    const Lw=a1-a0, Hh=y2-y1, ob=new THREE.Mesh(axis==='x'?sBox(Lw,Hh,th,m):sBox(th,Hh,Lw,m),m);
    ob.castShadow=sh; ob.receiveShadow=true; const c=dir*(a0+a1)/2;
    axis==='x'?ob.position.set(c,(y1+y2)/2,0):ob.position.set(0,(y1+y2)/2,c); g.add(ob); return ob;
  };
  const st=.18, w=len-.02, mid=H*.5;
  part(.02,.02+st,0,H,.12,fm.frame); part(w-st,w,0,H,.12,fm.frame);                 // stiles
  part(.02+st,w-st,0,.3,.12,fm.frame); part(.02+st,w-st,H-st,H,.12,fm.frame);       // bottom and top rails
  part(.02+st,w-st,mid-.1,mid+.1,.12,fm.frame);                                    // mid rail
  part(.02+st,w-st,.3,mid-.1,.05,fm.glass,false);                                  // lower glass
  part(.02+st,w-st,mid+.1,H-st,.05,fm.glass,false);                                // glass
  return g;
}
function fillOpening(axis,fixed,o,parent,fm=fillCore){
  const {s,e,sill,head,type,panels=1}=o;
  if(type==='open') return;
  if(type==='french'){ // full-height glazed timber panels, bi-folding in pairs from each jamb; click to open
    const f=.18, out=o.out||-1, n=panels, w=(e-s-2*f)/n, y0=sill>0?sill+f:.06, H=head-f-y0;
    const entry={leaves:[],p:o.open?1:0,target:o.open?1:0}; doors.push(entry);
    const parts=[box(axis,fixed,s,e,head-f,head,.3,fm.frame,parent), box(axis,fixed,s,e,sill>0?sill:0,y0,.3,fm.frame,parent),
      box(axis,fixed,s,s+f,sill,head,.3,fm.frame,parent), box(axis,fixed,e-f,e,sill,head,.3,fm.frame,parent)];
    const left=Math.ceil(n/2);
    [[1,left],[-1,n-left]].forEach(([dir,count])=>{
      let par=parent, hinge=dir===1?s+f:e-f, local=false;
      for(let i=0;i<count;i++){
        const g=frenchLeaf(axis,fixed,hinge,dir,w,y0,H,fm,par,local);
        const sign=(axis==='x'?-dir:dir)*out;
        entry.leaves.push({g,rot:i===0?sign:-2*sign}); // first panel swings out 90°, the next folds back flat against it
        par=g; hinge=dir*w; local=true;
      }
    });
    parts.forEach(m=>{if(m) m.userData.door=entry;});
    entry.leaves.forEach(l=>l.g.traverse(ob=>{ob.userData.door=entry;}));
    return;
  }
  if(type==='single'){ // single hinged timber door; click to swing it 90° (out: swing direction, hinge: 's' or 'e' end)
    const f=.2, H=head-f, out=o.out||-1, atE=o.hinge==='e';
    const entry={leaves:[],p:o.open?1:0,target:o.open?1:0}; doors.push(entry);
    const parts=[box(axis,fixed,s,e,head-f,head,.35,fm.frame,parent),
      box(axis,fixed,s,s+f,0,head,.35,fm.frame,parent), box(axis,fixed,e-f,e,0,head,.35,fm.frame,parent)];
    const hz=atE?e-f:s+f, dir=atE?-1:1, Lf=e-s-2*f-.02;
    const g=hingedLeaf(axis,fixed,hz,dir,Lf,0,H,.18,fm.door,parent,false);
    const hnd=new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?.1:.3,1,axis==='x'?.3:.1),fm.frame); g.add(hnd);
    axis==='x'?hnd.position.set(dir*(Lf-.3),3.5,0):hnd.position.set(0,3.5,dir*(Lf-.3));
    entry.leaves.push({g,rot:(axis==='x'?-dir:dir)*out});
    parts.forEach(mm=>{if(mm) mm.userData.door=entry;}); g.traverse(ob=>{ob.userData.door=entry;});
  }
  else if(type==='double'){ // timber double door with frame and handles; click to swing both leaves 90° (out: -1 towards -x/-z, 1 towards +x/+z)
    const f=.25, m=(s+e)/2, Lf=m-.03-(s+f), H=head-f, out=o.out||-1;
    const entry={leaves:[],p:o.open?1:0,target:o.open?1:0}; doors.push(entry);
    const parts=[box(axis,fixed,s,e,head-f,head,.35,fm.frame,parent),
      box(axis,fixed,s,s+f,0,head,.35,fm.frame,parent), box(axis,fixed,e-f,e,0,head,.35,fm.frame,parent)];
    [[s+f,1],[e-f,-1]].forEach(([hz,dir])=>{
      const g=hingedLeaf(axis,fixed,hz,dir,Lf,0,H,.18,fm.door,parent,false);
      const hnd=new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?.1:.3,1,axis==='x'?.3:.1),fm.frame); g.add(hnd);
      axis==='x'?hnd.position.set(dir*(Lf-.3),3.5,0):hnd.position.set(0,3.5,dir*(Lf-.3));
      entry.leaves.push({g,rot:(axis==='x'?-dir:dir)*out});
    });
    parts.forEach(mm=>{if(mm) mm.userData.door=entry;}); entry.leaves.forEach(l=>l.g.traverse(ob=>{ob.userData.door=entry;}));
  }
  else{
    const f=.18; // frame members
    box(axis,fixed,s,e,head-f,head,.3,fm.frame,parent);
    box(axis,fixed,s,e,sill,sill+f,.3,fm.frame,parent);
    const w=(e-s)/panels;
    for(let i=0;i<=panels;i++){const x=s+i*w; box(axis,fixed,Math.max(s,x-f/2),Math.min(e,x+f/2),sill,head,.3,fm.frame,parent);}
    if(type==='french'){const mid=sill+2.7; box(axis,fixed,s,e,mid,mid+.12,.3,fm.frame,parent);}
    const g=box(axis,fixed,s+f/2,e-f/2,sill+f,head-f,.06,fm.glass,parent); if(g){g.castShadow=false;}
  }
}
// outDir (optional): which side of the wall is outside (+1 / -1 along its normal); that face gets the cement material
function wall(axis,fixed,a,b,H,openings,m,parent,outDir){
  const vent=VENT&&outDir&&axis==='z'; // eave-side exterior wall: leave a slot under the roof, bridged by rafters
  if(vent) H-=VENT_GAP;
  DRAW.walls.push({axis,fixed,a,b,H,openings,future:m===mat.ghost});
  const out=outDir?{dir:outDir,mat:m===mat.ghost?mat.ghostOut:mat.cement}:undefined;
  if(vent){
    const fm=m===mat.ghost?fillLiving:fillCore, sl=fixed<CX?SL:SR, tilt=(fixed<CX?1:-1)*Math.atan(sl);
    const len=OVER+T+.3, cx=fixed+outDir*(OVER/2+.15-T/2);
    for(let z=a+.5;z<b-.3;z+=2){ // rafter tails every 2', pitched with the roof
      const r=mesh(sBox(len,VENT_GAP*.9,.3,fm.frame),fm.frame,parent); r.position.set(cx,H+VENT_GAP/2,z); r.rotation.z=tilt;
    }
    [a,b-.5].forEach(z=>box(axis,fixed,z,z+.5,H,H+VENT_GAP,T,m,parent,out)); // close the slot at the corners
  }
  // Solid wall is built column by column between the openings' edges, so openings may sit above one another
  // (e.g. a fanlight over a door). Within a column the openings are stacked by sill height.
  const cuts=[...new Set([a,b,...openings.flatMap(o=>[o.s,o.e])])].sort((p,q)=>p-q);
  for(let i=0;i<cuts.length-1;i++){
    const p=cuts[i], q=cuts[i+1]; if(q-p<=1e-6) continue;
    const col=openings.filter(o=>o.s<=p+1e-6&&o.e>=q-1e-6).sort((u,v)=>u.sill-v.sill);
    let y=0; col.forEach(o=>{ box(axis,fixed,p,q,y,o.sill,T,m,parent,out); y=Math.max(y,o.head); });
    box(axis,fixed,p,q,y,H,T,m,parent,out);
  }
  openings.forEach(o=>fillOpening(axis,fixed,o,parent,m===mat.ghost?fillLiving:fillCore));
}
function gable(x0,x1,zc,m,parent){ // wall above eave height, following the roof slopes (ridge at x=CX)
  DRAW.gables.push({x0,x1,zc,future:m===mat.ghostOut});
  const sh=new THREE.Shape(); sh.moveTo(x0,EAVE); sh.lineTo(x1,EAVE); sh.lineTo(x1,roofH(x1));
  if(x0<CX&&x1>CX) sh.lineTo(CX,RIDGE);
  sh.lineTo(x0,roofH(x0)); sh.lineTo(x0,EAVE);
  const geo=new THREE.ExtrudeGeometry(sh,{depth:T,bevelEnabled:false});
  const o=mesh(geo,m,parent); o.position.z=zc-T/2; return o;
}

// Shared roof materials
const tiles=tileTexture();
const fascia=M(0x3b2d22);

// ---- Phase 1: bedroom + laundry + bathroom ----
const C=groups.core, h=T/2;
mesh(new THREE.BoxGeometry(CX+T,.75,19+T),mat.plinth,C).position.set(CX/2,-.375,9.5);
mesh(new THREE.BoxGeometry(CX,.02,14),mat.floor,C,false).position.set(CX/2,.01,7);          // bedroom 15' × 14'
mesh(new THREE.BoxGeometry(5,.02,5),mat.floor,C,false).position.set(12.5,.01,16.5);         // laundry 5' × 5', sliding door to the bedroom
mesh(new THREE.BoxGeometry(10,.02,5),mat.bathFloor,C,false).position.set(5,.01,16.5);       // bathroom 10' × 5'
// Paddy-side wall: 8' French window 2' from the road corner, 3' bath window at 5' sill
wall('z',0,-h,19+h,EAVE,[{s:2,e:10,sill:0,head:7.5,type:'french',panels:4},{s:15,e:18,sill:5,head:7.5,type:'window',panels:2}],mat.plaster,C,-1);
// Road-side wall: 4' two-panel French window, 2' from the centre wall
wall('x',0,-h,CX,EAVE,[{s:9,e:13,sill:0,head:7.5,type:'french',panels:2}],mat.plaster,C,-1);
// Drain-side wall of the bedroom block (bathroom + laundry), running through to the centre wall so the laundry is closed off from the kitchen bay: small windows at 5' sill as in the drain-side elevation
wall('x',19,-h,13,EAVE,[{s:4,e:5.5,sill:5,head:7.5,type:'window',panels:1},{s:11.2,e:12.2,sill:5,head:7.5,type:'window',panels:1}],mat.plaster,C,1);
wall('x',19,13,CX+h,EAVE,[],mat.plaster,C); // the last 2' back onto the kitchen bay, so no cement face
// Bedroom / bathroom partition, taken up to the roof underside so the bedroom can be air-conditioned
wall('x',14,h,10,EAVE,[],mat.plaster,C); gable(h,CX,14,mat.plaster,C);
// Wall above the 5' sliding door between the bedroom and the laundry (door head at 7'4"), sealing the bedroom to the roof
wall('x',14,10,CX,EAVE,[{s:10,e:CX,sill:0,head:7.4,type:'open'}],mat.plaster,C);
// Sliding door: top-hung timber panel on the bedroom face of the partition, parks westwards over the bathroom wall. Click to slide.
{
  const entry={leaves:[],p:0,target:0}; doors.push(entry);
  const track=mesh(sBox(10.5,.4,.3,mat.frame),mat.frame,C); track.position.set(9.75,7.6,13.55); track.userData.door=entry;
  const g=new THREE.Group(); g.position.set(12.5,0,13.6); C.add(g);
  const panel=mesh(sBox(4.75,7.3,.15,mat.shutter),mat.shutter,g); panel.position.y=3.65;
  [-2.3,2.3].forEach(x=>{const st=mesh(sBox(.15,7.3,.17,mat.frame),mat.frame,g); st.position.set(x,3.65,0);});
  [1.2,3.65,6.1].forEach(y=>{const r=mesh(sBox(4.45,.15,.17,mat.frame),mat.frame,g); r.position.set(0,y,0);});
  const pull=mesh(new THREE.BoxGeometry(.1,1,.3),mat.frame,g); pull.position.set(-1.9,3.5,0);
  g.traverse(ob=>{ob.userData.door=entry;});
  entry.leaves.push({g,slide:new THREE.Vector3(-5,0,0),base:g.position.clone()});
  DRAW.extras.push({type:'slide',z:13.6,x0:10.1,x1:14.9,park:-5});
}
// Bathroom / laundry wall with the bathroom door opening from the laundry, also up to the roof underside
wall('z',10,14-h,19-h,roofH(10),[{s:14.5,e:17,sill:0,head:7,type:'single',out:-1,hinge:'s'}],mat.plaster,C);
// Centre wall up to the ridge; 4' opening from the living room squarely into the laundry, 1' clear of the drain wall
wall('z',CX,-h,19+h,RIDGE,[{s:14,e:18,sill:0,head:8,type:'open'}],mat.plaster,C);
gable(-h,CX,0,mat.cement,C); gable(-h,CX,19,mat.cement,C);
// Open veranda outside the bedroom's paddy-side French window: 10' × 6' deck at floor level, one step down to the lawn
DRAW.slabs.push({x0:-6-h,x1:-h,z0:1,z1:11,name:'veranda'});
mesh(new THREE.BoxGeometry(6,.75,10),mat.plinth,C).position.set(-3-h,-.375,6);
mesh(new THREE.BoxGeometry(6,.02,10),mat.floor,C,false).position.set(-3-h,.01,6);
mesh(new THREE.BoxGeometry(1,.375,10),mat.plinth,C).position.set(-6.5-h,-.5625,6);
mesh(new THREE.BoxGeometry(6,.375,1),mat.plinth,C).position.set(-3-h,-.5625,11.5);

// ---- Future living room: 12' × 19' plus a 14' × 9' kitchen bay at the drain end ----
const L=groups.living;
mesh(new THREE.BoxGeometry(FAR-CX,.75,DZ+T),mat.ghost,L,false).position.set((CX+FAR)/2+h/2,-.375,DZ/2);
mesh(new THREE.BoxGeometry(2+T,.75,DZ-19+h),mat.ghost,L,false).position.set(14,-.375,(19+DZ)/2+h/2);
// Road-side wall: 8' four-panel French window
wall('x',0,CX,FAR+h,EAVE,[{s:18,e:26,sill:0,head:7.5,type:'french',panels:4}],mat.ghost,L,-1);
// Far wall: main entrance, 4' timber double door near the road corner so it is seen from the road
wall('z',FAR,-h,DZ+h,EAVE,[{s:3,e:7,sill:0,head:7.5,type:'double',open:true,out:1}],mat.ghost,L,1);
// Drain-side wall: 4' two-panel French window used as the garden door
wall('x',DZ,13-h,FAR+h,EAVE,[{s:19,e:23,sill:0,head:7.5,type:'french',panels:2,out:1}],mat.ghost,L,1);
// Kitchen bay wall on the paddy side, up to the roof underside, with a wide 5½' window above the counter looking over the paddy field; solid wall behind the fridge in the laundry-side corner
wall('z',13,19,DZ-h,roofH(13),[{s:21.75,e:27.25,sill:3.5,head:7.5,type:'window',panels:3}],mat.ghost,L,-1);
gable(CX,FAR+h,0,mat.ghostOut,L); gable(13-h,FAR+h,DZ,mat.ghostOut,L);

// Open kitchen in the 14' × 9' bay at the drain end: L-counter along the paddy-side and drain walls,
// plus a 7' counter against the far wall (the grey blocks on plan-3).
const K=new THREE.Group(); L.add(K);
const kMat={base:M(0x5f6b52,{roughness:.7}),top:M(0xcfc8bb,{roughness:.35}),steel:M(0xb8bcbf,{roughness:.3,metalness:.6}),
  dark:M(0x2a2a2a,{roughness:.5}),shelf:M(0x8a6a4c)};
const kb=(w,hh,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,hh,d),m); o.position.set(x,y,z); o.receiveShadow=true; K.add(o); return o;};
// paddy-side (pantry) run: fridge in the laundry-side corner (z 19.25 → 21.55), counter from there to the drain-end corner (z 21.6 → 27.75)
kb(2.3,5.8,2.3,14.4,2.9,20.4,M(0xe9e9e6,{roughness:.4}));
kb(2,2.8,6.15,14.25,1.4,24.675,kMat.base); kb(2.1,.15,6.25,14.25,2.875,24.675,kMat.top);
// drain-wall run: x 15.25 → 18, 2' deep
kb(2.75,2.8,2,16.625,1.4,26.75,kMat.base); kb(2.85,.15,2.1,16.625,2.875,26.72,kMat.top);
// sink on the paddy-side run
kb(1.3,.05,1.8,14.3,2.96,24.5,kMat.steel); kb(1,.06,1.5,14.3,2.94,24.5,kMat.dark);
const tap=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.9,8),kMat.steel); tap.position.set(13.5,3.4,24.5); K.add(tap);
// two-burner hob on the drain-wall run
kb(1.6,.06,1.3,16.8,2.98,26.8,kMat.dark);
[[16.45,26.8],[17.15,26.8]].forEach(([x,z])=>{const r=new THREE.Mesh(new THREE.TorusGeometry(.25,.04,6,20),kMat.steel); r.rotation.x=Math.PI/2; r.position.set(x,3.02,z); K.add(r);});
// 7' bar-height dining table against the far wall: timber top at 3'6" on two slim end frames, three bar chairs on each side
kb(6.75,.15,2,23.375,3.5,20.5,kMat.shelf);
[20.4,26.35].forEach(x=>{kb(.15,3.45,1.6,x,1.72,20.5,kMat.dark);});
kb(5.6,.12,.12,23.375,.5,20.5,kMat.dark);
const chair=(x,z,dir)=>{ // bar chair: round base, post, seat and a low backrest on the side away from the table
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.06,20),kMat.dark); base.position.set(x,.03,z); K.add(base);
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,2.3,10),kMat.dark); post.position.set(x,1.18,z); K.add(post);
  const seat=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.14,20),kMat.shelf); seat.position.set(x,2.4,z); K.add(seat);
  kb(1.1,.6,.1,x,3.1,z+dir*.55,kMat.shelf);
  kb(.08,.6,.1,x-.42,2.75,z+dir*.55,kMat.dark); kb(.08,.6,.1,x+.42,2.75,z+dir*.55,kMat.dark);
};
[21.4,23.4,25.4].forEach(x=>{chair(x,22.4,1); chair(x,18.6,-1);}); // three each side
K.traverse(o=>{if(o.isMesh){o.castShadow=true;o.userData.solid=true;}});

// Open veranda at the front door: 10' × 6' deck at floor level hugging the road corner of the far wall,
// with a step towards the road and another along the outer edge
const V=new THREE.Group(); L.add(V);
const vb=(w,hh,d,x,y,z,m,sh=true)=>{const o=mesh(new THREE.BoxGeometry(w,hh,d),m,V,sh); o.position.set(x,y,z); o.userData.solid=true; return o;};
DRAW.slabs.push({x0:FAR+h,x1:FAR+h+6,z0:-.25,z1:10,name:'veranda'});
vb(6,.75,10.25,FAR+h+3,-.375,4.875,mat.plinth);
vb(6,.02,10.25,FAR+h+3,.01,4.875,mat.floor,false);
vb(1,.375,10.25,FAR+h+6.5,-.5625,4.875,mat.plinth);
vb(7,.375,1,FAR+h+3.5,-.5625,-.75,mat.plinth);
L.traverse(o=>{if(o.isMesh&&!o.userData.solid){o.castShadow=false;o.renderOrder=2;}});
fillLiving.frame.opacity=fillLiving.door.opacity=fillLiving.shutter.opacity=.3; fillLiving.glass.opacity=.12;

// ---- Roof: clay tiles, ridge over the centre wall (x = 15). The paddy-side slope is 15' + overhang, the
// living-room slope 12' + overhang, both from 11' eaves to the 14½' ridge. The living room runs 7' further
// towards the drain, so the ridge and living slope are longer, and a narrow strip of the paddy-side slope
// continues over the kitchen bay (x 13 → 15).
function slope(side,run,sl,z0,z1,gap=0){ // side -1 = paddy side of the ridge, 1 = living side; gap = clear slot left at the ridge
  run-=gap;
  const len=Math.hypot(run,run*sl), dep=z1-z0, t=tiles.clone(); t.needsUpdate=true; t.repeat.set(len/1.1,dep/1.05);
  const o=mesh(new THREE.BoxGeometry(len,.25,dep),[fascia,fascia,M(0xffffff,{map:t,roughness:.75}),fascia,fascia,fascia],groups.roof);
  o.position.set(CX+side*(gap+run/2), RIDGE-(gap+run/2)*sl+.35, (z0+z1)/2);
  o.rotation.z=-side*Math.atan(sl);
}
const RG=VENT?RIDGE_GAP:0;
slope(-1,CX+OVER,SL,-OVER,19+OVER,RG);
slope(-1,2+OVER,SL,19+OVER,DZ+OVER,RG);
slope(1,FAR-CX+OVER,SR,-OVER,DZ+OVER,RG);
if(VENT){ // ventilated ridge: a short capping on each side, lifted on spacer blocks, slot open underneath
  const lift=RIDGE_LIFT, capRun=RIDGE_GAP+1.2;
  [[-1,SL],[1,SR]].forEach(([side,sl])=>{
    const len=Math.hypot(capRun,capRun*sl), t=tiles.clone(); t.needsUpdate=true; t.repeat.set(len/1.1,(DZ+2*OVER)/1.05);
    const cap=mesh(new THREE.BoxGeometry(len,.2,DZ+2*OVER),[fascia,fascia,M(0xffffff,{map:t,roughness:.75}),fascia,fascia,fascia],groups.roof);
    cap.position.set(CX+side*(capRun/2), RIDGE-(capRun/2)*sl+.35+lift, DZ/2); cap.rotation.z=-side*Math.atan(sl);
    for(let z=-OVER+1;z<DZ+OVER;z+=4){ const sp=mesh(new THREE.BoxGeometry(.3,lift,.4),fascia,groups.roof); sp.position.set(CX+side*(RIDGE_GAP+.5),RIDGE-(RIDGE_GAP+.5)*sl+.35+lift/2,z); }
  });
}
const ridge=mesh(new THREE.CylinderGeometry(.32,.32,DZ+2*OVER,12),M(0x9b4d2a),groups.roof); ridge.rotation.x=Math.PI/2; ridge.position.set(CX,RIDGE+.45+(VENT?RIDGE_LIFT:0),DZ/2);

// ---- Fittings ----
const F=groups.furn;
const blk=(w,hh,d,x,y,z,m)=>{const o=mesh(new THREE.BoxGeometry(w,hh,d),m,F); o.position.set(x,y,z); return o;};
// bed with its headboard on the centre wall, clear of the road-side window and the laundry opening
blk(6.5,1.4,5,11.4,.7,7,mat.wood); blk(6.3,.6,4.8,11.4,1.7,7,mat.fabric); blk(.4,3.6,5.2,14.55,1.8,7,mat.wood);
blk(1.6,.4,1.2,12.9,2.2,5.4,mat.white); blk(1.6,.4,1.2,12.9,2.2,8.6,mat.white);
// laundry: 2'-deep counter-height storage on the drain wall (the grey strip on plan-3), under the small window
blk(3.5,3,1.8,12,1.5,17.85,mat.wood);
// bathroom: shower at the paddy end behind a half-height wall, WC and basin on the drain wall
blk(.33,5,3,3,2.5,17.25,mat.plaster); // 4" shower wall, 5' high, 3' long from the drain wall, 1½' entry gap at the laundry end
blk(1.6,.1,1.6,1.5,.06,16.5,mat.plinth);
blk(1.5,1.4,2.2,5.3,.7,17.6,mat.white);
blk(2.2,2.6,1.6,8.3,1.3,18,mat.wood); blk(1.3,.4,1,8.3,2.8,18,mat.white);

// The phase-1 block (walls + fittings) gets its own material instances so the Bedroom toggle can ghost it
// without touching the shared materials used by the living room, verandas and site.
const coreMats=new Map();
[groups.core,groups.furn].forEach(g=>g.traverse(o=>{
  if(!o.isMesh) return;
  const cl=m=>{if(!coreMats.has(m)) coreMats.set(m,m.clone()); return coreMats.get(m);};
  o.material=Array.isArray(o.material)?o.material.map(cl):cl(o.material); o.userData.cast=o.castShadow;
}));
const coreGlass=coreMats.get(mat.glass);

// ---- Site: ground, lawn, paddy field, passage, labels ----
const S=groups.site;
const ground=mesh(new THREE.PlaneGeometry(240,240),M(0x8a7a55),S,false); ground.rotation.x=-Math.PI/2; ground.position.y=-.76;
const lawn=mesh(new THREE.PlaneGeometry(46,44),M(0x7d9a52),S,false); lawn.rotation.x=-Math.PI/2; lawn.position.set(13.5,-.755,13);
const pt=stripeTexture('#7fae4a','#5e8f36',4); pt.repeat.set(30,1);
const paddy=mesh(new THREE.PlaneGeometry(110,120),M(0xffffff,{map:pt}),S,false); paddy.rotation.x=-Math.PI/2; paddy.position.set(-62,-.75,9.5);
const bund=mesh(new THREE.BoxGeometry(1.2,.6,120),M(0x7a6a48),S); bund.position.set(-7.5,-.5,9.5);
// Raised concrete passage around the house under the eaves: the L-shaped footprint pushed out by the roof overhang
{
  const d=OVER, pts=[[-h-d,-h-d],[FAR+h+d,-h-d],[FAR+h+d,DZ+h+d],[13-h-d,DZ+h+d],[13-h-d,19+h+d],[-h-d,19+h+d]];
  DRAW.slabs.push({poly:pts,name:'passage'});
  const sh=new THREE.Shape(); pts.forEach(([x,z],i)=>i?sh.lineTo(x,-z):sh.moveTo(x,-z)); sh.closePath();
  // raised 4½" like the veranda steps: extruded upwards from ground level
  const apron=mesh(new THREE.ExtrudeGeometry(sh,{depth:.375,bevelEnabled:false}),M(0xb8b2a5,{roughness:.95}),S); apron.rotation.x=-Math.PI/2; apron.position.y=-.75;
}


// Side labels (Sinhala from the drawings + English), depth-tested so they sit behind the house, toggled with the Labels button
await document.fonts.load('500 40px "Noto Sans Sinhala"').catch(()=>{});
// Two-line label sprite (English + Sinhala, or any title + subtitle). Returns a setter so the text can change.
function makeLabel(parent,scale=4){
  const c=document.createElement('canvas'); c.width=512; c.height=150; const g=c.getContext('2d');
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t})); sp.scale.set(scale,scale*150/512,1); parent.add(sp);
  const set=(en,si)=>{
    g.clearRect(0,0,512,150);
    g.fillStyle='rgba(20,28,20,.72)'; g.beginPath(); g.roundRect?g.roundRect(6,6,500,138,24):g.rect(6,6,500,138); g.fill();
    g.fillStyle='#fff'; g.textAlign='center'; g.font='600 46px "IBM Plex Sans", sans-serif'; g.fillText(en,256,64);
    g.fillStyle='#cfe3c6'; g.font='500 40px "Noto Sans Sinhala", "IBM Plex Mono", sans-serif'; g.fillText(si,256,120);
    t.needsUpdate=true;
  };
  return {sprite:sp,set};
}
function label(en,si,x,y,z){ const l=makeLabel(groups.labels); l.set(en,si); l.sprite.position.set(x,y,z); }
label('Paddy field','කුඹුර',-20,2.5,9.5);
label('Road','පාර',13,2.5,-20);
label('Drain','කුණු ඇළ',8,2.5,42);
label('North','උතුර',13.5+NORTH.x*48,2.5,13+NORTH.z*48);

// ---- Wind: monthly prevailing wind at the site (7.978°N, 81.025°E, near Polonnaruwa) ----
// [bearing the wind blows FROM in degrees clockwise from north, mean speed km/h, steadiness 0–1].
// Vector means of hourly 10 m wind, 2019–2023, from the Open-Meteo ERA5 archive. The north-east
// monsoon shows Dec–Feb, the south-west monsoon May–Sep; Mar–Apr and Nov are light and variable.
const WIND=[[51,7.7,.7],[62,7.9,.7],[96,7,.51],[161,5.9,.26],[247,13.7,.91],[248,18.4,.99],[249,17.6,.97],[248,17.9,.98],[247,16.4,.96],[253,10.4,.74],[305,6.9,.11],[52,7.8,.45]];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const compass=b=>['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(b/22.5)%16];
const WG=groups.wind; WG.visible=false;
const windMat=M(0x2a7fc9,{roughness:.5,transparent:true,opacity:.85});
// big arrow over the house, built along +x and turned to the flow direction
const arrow=new THREE.Group(); WG.add(arrow); arrow.position.set(13.5,17.5,13);
const windLabel=makeLabel(WG,7); windLabel.sprite.position.set(13.5,21.3,13); // readout floats above the arrow
const shaft=mesh(new THREE.CylinderGeometry(.35,.35,12,16),windMat,arrow,false); shaft.rotation.z=-Math.PI/2; shaft.position.x=-1.5;
const head=mesh(new THREE.ConeGeometry(1.3,3.5,20),windMat,arrow,false); head.rotation.z=-Math.PI/2; head.position.x=6.2;
// drifting streaks across the site
const NS=70, streakPos=new Float32Array(NS*6), streakGeo=new THREE.BufferGeometry();
streakGeo.setAttribute('position',new THREE.BufferAttribute(streakPos,3));
WG.add(new THREE.LineSegments(streakGeo,new THREE.LineBasicMaterial({color:0x2a7fc9,transparent:true,opacity:.55})));
const streaks=Array.from({length:NS},()=>({x:0,y:0,z:0}));
const wind={flow:new THREE.Vector3(1,0,0),speed:10,len:3,steady:1,R:46};
function seedStreak(s,anywhere){
  const perp=new THREE.Vector3(-wind.flow.z,0,wind.flow.x), along=anywhere?(Math.random()*2-1)*wind.R:-wind.R;
  s.x=13.5+wind.flow.x*along+perp.x*(Math.random()*2-1)*wind.R; s.z=13+wind.flow.z*along+perp.z*(Math.random()*2-1)*wind.R; s.y=1.5+Math.random()*15;
}
function setMonth(m){
  const [bearing,kmh,steady]=WIND[m-1], b=bearing*Math.PI/180;
  const from=new THREE.Vector3().addScaledVector(NORTH,Math.cos(b)).addScaledVector(EAST,Math.sin(b));
  wind.flow.copy(from).negate(); wind.speed=kmh; wind.steady=steady; wind.len=1.5+kmh*.25;
  arrow.rotation.y=Math.atan2(-wind.flow.z,wind.flow.x); arrow.scale.setScalar(.7+kmh/30);
  windMat.opacity=.35+.5*steady;
  windOut.textContent=MONTHS[m-1];
  const detail=`${Math.round(kmh)} km/h${steady<.4?' · variable':''}`;
  windLabel.set(`${MONTHS[m-1]} · wind from ${compass(bearing)}`,detail);
  monthIn.setAttribute('aria-valuetext',`${MONTHS[m-1]}, from ${compass(bearing)}, ${detail}`);
  streaks.forEach(s=>seedStreak(s,true));
}
function animateWind(dt){
  if(!WG.visible) return;
  const step=wind.speed*.0022*dt; // km/h → feet per ms, scaled for legibility
  streaks.forEach((s,i)=>{
    s.x+=wind.flow.x*step; s.z+=wind.flow.z*step;
    const along=(s.x-13.5)*wind.flow.x+(s.z-13)*wind.flow.z; if(along>wind.R) seedStreak(s,false);
    const o=i*6; streakPos[o]=s.x; streakPos[o+1]=s.y; streakPos[o+2]=s.z;
    streakPos[o+3]=s.x-wind.flow.x*wind.len; streakPos[o+4]=s.y; streakPos[o+5]=s.z-wind.flow.z*wind.len;
  });
  streakGeo.attributes.position.needsUpdate=true;
}
const monthIn=document.getElementById('month'), windOut=document.getElementById('windout');
monthIn.value=new Date().getMonth()+1; monthIn.addEventListener('input',()=>setMonth(+monthIn.value)); setMonth(+monthIn.value);

// ---- Views ----
const views={
  aerial:{p:[-30,30,46],t:[13,4,13]},
  paddy:{p:[-42,7,11],t:[10,6,11]},
  road:{p:[15,7,-42],t:[13,5,8]},
  drain:{p:[16,8,60],t:[15,6,14]},
  plan:{p:[13.5,58,13.05],t:[13.5,0,13],roofOff:true},
  inside:{p:[13.5,5.3,13],t:[2,4,3],roofOff:false},
  kitchen:{p:[23,6,9],t:[16,3,23],roofOff:false}
};
let anim=null;
function go(name){
  const v=views[name];
  viewSel.value=name;
  if(v.roofOff!==undefined) setToggle('t-roof',!v.roofOff);
  if(name==='inside') setToggle('t-bed',true);
  if(name==='kitchen') setToggle('t-living',true);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const from={p:camera.position.clone(),t:controls.target.clone()}, to={p:new THREE.Vector3(...v.p),t:new THREE.Vector3(...v.t)};
  if(reduce){camera.position.copy(to.p);controls.target.copy(to.t);return;}
  anim={from,to,t0:performance.now(),dur:900};
}
const viewSel=document.getElementById('views'); viewSel.addEventListener('change',()=>go(viewSel.value));

// Help overlay: full-screen native dialog, closes with the × button or Escape
const help=document.getElementById('help');
document.getElementById('help-open').addEventListener('click',()=>help.showModal());
document.getElementById('help-close').addEventListener('click',()=>help.close());

function setToggle(id,on){
  const b=document.getElementById(id); b.setAttribute('aria-pressed',on);
  if(id==='t-roof') groups.roof.visible=on;
  if(id==='t-labels') groups.labels.visible=on;
  if(id==='t-wind'){groups.wind.visible=on; document.getElementById('g-wind').hidden=!on;}
  if(id==='t-bed'){ // solid phase-1 block, or a ghost like the living room
    coreMats.forEach(m=>{
      if(m===coreGlass){m.opacity=on?.35:.12; return;} // glass keeps its own transparency
      m.transparent=!on; m.opacity=on?1:.14; m.depthWrite=on;
    });
    [groups.core,groups.furn].forEach(g=>g.traverse(o=>{if(o.isMesh) o.castShadow=on&&o.userData.cast;}));
  }
  if(id==='t-living'){ // fully solid when on, faint ghost when off
    [mat.ghost,mat.ghostOut].forEach(g=>{g.transparent=!on; g.opacity=on?1:.14; g.depthWrite=on;});
    mat.ghost.color.set(on?0xf2efe6:0xffffff); mat.ghostOut.color.set(on?0xc9c6bd:0xffffff);
    [fillLiving.frame,fillLiving.door,fillLiving.shutter].forEach(m=>{m.transparent=!on; m.opacity=on?1:.3;});
    fillLiving.glass.opacity=on?.35:.12;
    L.traverse(o=>{if(o.isMesh&&!o.userData.solid){o.castShadow=on;}});
  }
}
['t-roof','t-bed','t-living','t-labels','t-wind'].forEach(id=>document.getElementById(id).addEventListener('click',e=>setToggle(id,e.currentTarget.getAttribute('aria-pressed')!=='true')));

// Sun: Sri Lanka, 7°N. North is the paddy-field direction (-x) turned 30° towards the drain side (+z).
// Slider = time of day, 06:00 → 18:00. Declination from today's date, so the noon sun sits a little
// north of overhead in May–August and a little south the rest of the year.
const sunIn=document.getElementById('sun');
const LAT=7*Math.PI/180;
const doy=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/864e5);
const DECL=23.44*Math.PI/180*Math.sin(2*Math.PI*(284+doy)/365);
const clock=document.getElementById('clock');
function placeSun(){
  const hour=6+sunIn.value/100*12, H=(hour-12)*15*Math.PI/180;
  const hh=Math.floor(hour), mm=Math.round((hour-hh)*60)%60, h12=((hh+11)%12)+1;
  clock.textContent=`${h12}:${String(mm).padStart(2,'0')} ${hh<12?'am':'pm'}`;
  sunIn.setAttribute('aria-valuetext',clock.textContent);
  let el=Math.asin(Math.sin(LAT)*Math.sin(DECL)+Math.cos(LAT)*Math.cos(DECL)*Math.cos(H));
  const az=Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(LAT)-Math.tan(DECL)*Math.cos(LAT))+Math.PI; // from north, clockwise
  el=Math.max(el,4*Math.PI/180);
  const d=new THREE.Vector3().addScaledVector(NORTH,Math.cos(az)*Math.cos(el)).addScaledVector(EAST,Math.sin(az)*Math.cos(el)); d.y=Math.sin(el);
  sun.position.copy(sun.target.position).addScaledVector(d,80);
  const t=Math.min(1,Math.sin(el)/.5); // warm, dimmer light near sunrise and sunset
  sun.intensity=.45+.7*t; sun.color.setRGB(1,.82+.13*t,.6+.3*t);
  sky.material.uniforms.horizon.value.setRGB(.81+.12*(1-t),.88-.08*(1-t),.9-.25*(1-t)); // warm horizon at low sun
  sky.material.uniforms.top.value.setRGB(.24+.1*(1-t),.53,.83-.1*(1-t));
}
sunIn.addEventListener('input',placeSun); placeSun();

function resize(){const w=stage.clientWidth,hh=stage.clientHeight; renderer.setSize(w,hh,false); camera.aspect=w/hh; camera.updateProjectionMatrix();}
addEventListener('resize',resize); resize();
camera.position.set(...views.aerial.p); controls.target.set(...views.aerial.t);
// Open a view directly with a hash, e.g. #road or #plan
const hv=location.hash.slice(1); if(views[hv]){camera.position.set(...views[hv].p); controls.target.set(...views[hv].t); if(views[hv].roofOff!==undefined) setToggle('t-roof',!views[hv].roofOff); viewSel.value=hv;}

const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

// Click a door or French window to toggle it (a drag is ignored so orbiting still works)
const ray=new THREE.Raycaster(), ptr=new THREE.Vector2(); let pdown=null;
function doorAt(ev){
  const r=renderer.domElement.getBoundingClientRect();
  ptr.set(((ev.clientX-r.left)/r.width)*2-1,-((ev.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ptr,camera);
  for(const hit of ray.intersectObjects(scene.children,true)){
    const ob=hit.object; if(ob.isSprite||!ob.visible) continue;
    if(ob.userData.door) return ob.userData.door;
    const mt=ob.material; if(mt&&mt.transparent&&mt.opacity<.5) continue; // see through ghost walls and glass
    return null;
  }
  return null;
}
renderer.domElement.addEventListener('pointerdown',e=>{pdown=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{
  const moved=!pdown||Math.hypot(e.clientX-pdown[0],e.clientY-pdown[1])>5; pdown=null; if(moved) return;
  const d=doorAt(e); if(d) d.target=d.target?0:1;
});
renderer.domElement.addEventListener('pointermove',e=>{if(!pdown) renderer.domElement.style.cursor=doorAt(e)?'pointer':'';});
function animateDoors(dt){
  for(const d of doors){
    if(d.p===d.target) continue;
    d.p=d.target>d.p?Math.min(d.target,d.p+dt/900):Math.max(d.target,d.p-dt/900);
    const k=ease(d.p), a=k*Math.PI/2; d.leaves.forEach(l=>{if(l.slide) l.g.position.copy(l.base).addScaledVector(l.slide,k); else l.g.rotation.y=l.rot*a;});
  }
}
doors.forEach(d=>{const a=d.p*Math.PI/2; d.leaves.forEach(l=>{if(l.slide) l.g.position.copy(l.base).addScaledVector(l.slide,d.p); else l.g.rotation.y=l.rot*a;});});
let lastT=performance.now();
renderer.setAnimationLoop(now=>{
  animateDoors(Math.min(50,now-lastT)); animateWind(Math.min(50,now-lastT)); lastT=now;
  if(anim){const k=Math.min(1,(now-anim.t0)/anim.dur),e=ease(k);
    camera.position.lerpVectors(anim.from.p,anim.to.p,e); controls.target.lerpVectors(anim.from.t,anim.to.t,e); if(k>=1)anim=null;}
  controls.update(); renderer.render(scene,camera);
});
})();
