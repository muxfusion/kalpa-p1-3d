// Kalpa Villa — Plan tab. Line drawings (plan + four elevations) generated as SVG from the wall, opening and
// gable record that app.js publishes on window.KALPA, so they always match the 3D model. Units are feet.
(function(){
const tabs=document.querySelectorAll('#tabs button'), panel=document.getElementById('plan'), dock=document.querySelector('.dock');
let built=false;
tabs.forEach(b=>b.addEventListener('click',()=>{
  const plan=b.dataset.tab==='plan';
  tabs.forEach(t=>t.setAttribute('aria-pressed',t===b));
  panel.hidden=!plan; dock.hidden=plan;
  if(plan&&!built){build(); built=true;}
}));

// Download PDF: one A4 landscape page per sheet, drawn as vectors with jsPDF + svg2pdf (loaded on demand).
// If the libraries can't be fetched, fall back to the browser's print dialog (print CSS shows only the sheets).
const pdfBtn=document.getElementById('plan-pdf');
// Two drawing sets in the Plan tab: the general drawings and the door & window schedule. The PDF button exports
// whichever set is showing.
const sets=panel.querySelectorAll('#plan-sets button'), setEl=k=>panel.querySelector(`.sheets[data-set="${k}"]`);
let activeSet='drawings';
sets.forEach(b=>b.addEventListener('click',()=>{
  activeSet=b.dataset.set;
  sets.forEach(t=>t.setAttribute('aria-pressed',t===b));
  panel.querySelectorAll('.sheets').forEach(el=>{el.hidden=el.dataset.set!==activeSet;});
  panel.scrollTop=0;
}));
const loadScript=src=>new Promise((res,rej)=>{const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('could not load '+src)); document.head.appendChild(s);});
async function makePdf(set,filename){
  if(!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  if(!window.svg2pdf) await loadScript('https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.1/dist/svg2pdf.umd.min.js');
  const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const figs=[...setEl(set).querySelectorAll('figure')], W=297, H=210, m=12;
  for(let i=0;i<figs.length;i++){
    if(i) doc.addPage();
    // PDF standard fonts lack ′ ″ × and the mono face, so export a cleaned clone with ASCII marks in Helvetica
    const ascii=t=>t.replace(/′/g,"'").replace(/″/g,'"').replace(/×/g,'x').replace(/·/g,'-');
    const cap=ascii(figs[i].querySelector('figcaption').textContent), src=figs[i].querySelector('svg'), vb=src.viewBox.baseVal;
    const el=src.cloneNode(true); el.setAttribute('font-family','Helvetica'); el.querySelectorAll('text').forEach(t=>{t.textContent=ascii(t.textContent);});
    const hold=document.createElement('div'); hold.style.cssText='position:absolute;left:-99999px;top:0;width:'+vb.width+'px'; hold.appendChild(el); document.body.appendChild(hold);
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(0); doc.text(cap.toUpperCase(),m,m+2);
    const k=Math.min((W-2*m)/vb.width,(H-2*m-10)/vb.height);
    await doc.svg(el,{x:m,y:m+8,width:vb.width*k,height:vb.height*k});
    hold.remove();
  }
  doc.save(filename);
}
pdfBtn.addEventListener('click',async()=>{
  if(!built){build(); built=true;}
  pdfBtn.disabled=true; pdfBtn.textContent='Preparing…';
  try{ await makePdf(activeSet, activeSet==='dw'?'kalpa-villa-doors-windows.pdf':'kalpa-villa-plan.pdf'); }
  catch(e){ console.warn('PDF export failed, using print instead:',e); window.print(); }
  finally{ pdfBtn.disabled=false; pdfBtn.textContent='Download PDF'; }
});

const S=15, LW=.9; // px per foot, base line weight
const ft=v=>{ // 14.5 → 14′ 6″
  const sign=v<0?'-':'', a=Math.abs(v), f=Math.floor(a+1e-6), i=Math.round((a-f)*12);
  return sign+(i===12?`${f+1}′`:i?`${f}′ ${i}″`:`${f}′`);
};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');

// Tiny SVG builder: collects elements in world units and maps them through (mx,my) at the end
function svg(title,xmin,xmax,ymin,ymax,mapY){
  const out=[], X=x=>((x-xmin)*S).toFixed(1), Y=y=>(mapY?((ymax-y)*S):((y-ymin)*S)).toFixed(1);
  const W=(xmax-xmin)*S, H=(ymax-ymin)*S;
  const a=o=>Object.entries(o).map(([k,v])=>`${k}="${v}"`).join(' ');
  const api={
    line:(x1,y1,x2,y2,o={})=>out.push(`<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" ${a(Object.assign({stroke:'#111','stroke-width':LW},o))}/>`),
    rect:(x1,y1,x2,y2,o={})=>out.push(`<rect x="${X(Math.min(x1,x2))}" y="${Y(mapY?Math.max(y1,y2):Math.min(y1,y2))}" width="${(Math.abs(x2-x1)*S).toFixed(1)}" height="${(Math.abs(y2-y1)*S).toFixed(1)}" ${a(Object.assign({fill:'#fff',stroke:'#111','stroke-width':LW},o))}/>`),
    poly:(pts,o={})=>out.push(`<polygon points="${pts.map(([x,y])=>X(x)+','+Y(y)).join(' ')}" ${a(Object.assign({fill:'#fff',stroke:'#111','stroke-width':LW},o))}/>`),
    path:(d,o={})=>out.push(`<path d="${d}" ${a(Object.assign({fill:'none',stroke:'#111','stroke-width':LW},o))}/>`),
    polyline:(pts,o={})=>out.push(`<polyline points="${pts.map(([x,y])=>X(x)+','+Y(y)).join(' ')}" ${a(Object.assign({fill:'none',stroke:'#111','stroke-width':LW,'stroke-linejoin':'round'},o))}/>`),
    arc:(cx,cy,r,a0,a1,o={})=>{ // angles in radians, world space, counter-clockwise from +x
      const p=t=>[cx+r*Math.cos(t),cy+r*Math.sin(t)], [x0,y0]=p(a0), [x1,y1]=p(a1), sweep=mapY?((a1>a0)?0:1):((a1>a0)?1:0);
      out.push(`<path d="M${X(x0)},${Y(y0)} A${(r*S).toFixed(1)},${(r*S).toFixed(1)} 0 0 ${sweep} ${X(x1)},${Y(y1)}" ${a(Object.assign({fill:'none',stroke:'#111','stroke-width':LW*.8},o))}/>`);
    },
    circle:(x,y,r,o={})=>out.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="${(r*S).toFixed(1)}" ${a(Object.assign({fill:'#fff',stroke:'#111','stroke-width':LW},o))}/>`),
    text:(x,y,str,o={})=>out.push(`<text x="${X(x)}" y="${Y(y)}" ${a(Object.assign({'font-size':11,'text-anchor':'middle','dominant-baseline':'middle',fill:'#111'},o))}>${esc(str)}</text>`),
    // dimension line between two points with end ticks and a label (offset: perpendicular distance in ft)
    dim:(x1,y1,x2,y2,offset,label)=>{
      const dx=x2-x1, dy=y2-y1, L=Math.hypot(dx,dy), nx=-dy/L*offset, ny=dx/L*offset;
      const ax=x1+nx, ay=y1+ny, bx=x2+nx, by=y2+ny, e=.35;
      api.line(x1,y1,ax+nx/Math.abs(offset)*e,ay+ny/Math.abs(offset)*e,{'stroke-width':.5,stroke:'#555'});
      api.line(x2,y2,bx+nx/Math.abs(offset)*e,by+ny/Math.abs(offset)*e,{'stroke-width':.5,stroke:'#555'});
      api.line(ax,ay,bx,by,{'stroke-width':.6,stroke:'#333'});
      const tx=dx/L*.25, ty=dy/L*.25, px=-ty, py=tx; // 45° ticks
      [[ax,ay],[bx,by]].forEach(([x,y])=>api.line(x-tx-px,y-ty-py,x+tx+px,y+ty+py,{'stroke-width':.8,stroke:'#333'}));
      const vertical=Math.abs(dx)<1e-6, mx=(ax+bx)/2, my=(ay+by)/2;
      out.push(`<text x="${X(mx)}" y="${Y(my)}" font-size="10.5" text-anchor="middle" dominant-baseline="middle" fill="#111" ${vertical?`transform="rotate(-90 ${X(mx)} ${Y(my)})"`:''} dy="${vertical?'-5':'-4'}">${esc(label||ft(L))}</text>`);
    },
    done:()=>`<figure><figcaption>${esc(title)}</figcaption><svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Mono, ui-monospace, monospace"><rect width="${W.toFixed(0)}" height="${H.toFixed(0)}" fill="#fff"/>${out.join('')}</svg></figure>`
  };
  return api;
}

function build(){
  const D=window.KALPA, c=D.c, h=c.T/2;
  const CUT=4, cuts=o=>o.sill<CUT&&o.head>CUT; // plan cut plane at 4': only openings crossing it show in plan
  const segments=w=>{ // solid pieces of a wall between its openings, as [from,to] along the wall
    const segs=[]; let cur=w.a;
    [...w.openings].filter(cuts).sort((p,q)=>p.s-q.s).forEach(o=>{segs.push([cur,o.s]); cur=o.e;});
    segs.push([cur,w.b]); return segs.filter(([p,q])=>q-p>1e-3);
  };

  // ---------- PLAN ----------
  {
    const g=svg('Floor plan · 1 square = 1′',-14,38,-10,38,false);
    // grid
    for(let x=-14;x<=38;x++) g.line(x,-10,x,38,{stroke:'#eee','stroke-width':.5});
    for(let z=-10;z<=38;z++) g.line(-14,z,38,z,{stroke:'#eee','stroke-width':.5});
    // slabs: passage and verandas, light outline
    D.slabs.forEach(sl=>{
      if(sl.poly) g.poly(sl.poly,{fill:'none',stroke:'#999','stroke-width':.6,'stroke-dasharray':'3 2'});
      else{ g.rect(sl.x0,sl.z0,sl.x1,sl.z1,{fill:'#f4f4f4',stroke:'#999','stroke-width':.6}); g.text((sl.x0+sl.x1)/2,(sl.z0+sl.z1)/2,'VERANDA',{'font-size':8,fill:'#666'}); }
    });
    // walls (poché) and openings
    D.walls.forEach(w=>{
      const f=w.fixed, fill=w.future?'#999':'#111';
      segments(w).forEach(([p,q])=>w.axis==='x'?g.rect(p,f-h,q,f+h,{fill,stroke:'none'}):g.rect(f-h,p,f+h,q,{fill,stroke:'none'}));
      w.openings.filter(cuts).forEach(o=>{
        if(o.type==='open') return;
        const along=(t,n)=>w.axis==='x'?[t,f+n]:[f+n,t]; // point at distance t along the wall, n across it
        if(o.type==='window'||o.type==='french'){
          const L=(k)=>{const [x1,y1]=along(o.s,k),[x2,y2]=along(o.e,k); g.line(x1,y1,x2,y2,{'stroke-width':.6});};
          L(-h); L(h); L(0); // jambs implied by the poché ends, glazing line in the middle
          if(o.type==='french'){ const n=o.panels||2, wdt=(o.e-o.s)/n; for(let i=1;i<n;i++){const [x,y]=along(o.s+i*wdt,-h),[x2,y2]=along(o.s+i*wdt,h); g.line(x,y,x2,y2,{'stroke-width':.6});} }
        }else{ // single / double: leaf line + quarter-circle swing on the 'out' side
          const out=o.out||-1, leaves=o.type==='double'?[[o.s+.25,1],[o.e-.25,-1]]:[[o.hinge==='e'?o.e-.2:o.s+.2,o.hinge==='e'?-1:1]];
          leaves.forEach(([hp,dir])=>{
            const len=o.type==='double'?(o.e-o.s)/2-.3:(o.e-o.s-.4);
            const [hx,hy]=along(hp,0);
            const dirAlong=w.axis==='x'?[dir,0]:[0,dir], dirOut=w.axis==='x'?[0,out]:[out,0];
            const tip=[hx+dirOut[0]*len,hy+dirOut[1]*len];
            g.line(hx,hy,tip[0],tip[1],{'stroke-width':1.1});
            const a0=Math.atan2(dirAlong[1],dirAlong[0]), a1=Math.atan2(dirOut[1],dirOut[0]);
            g.arc(hx,hy,len,a0,a1,{stroke:'#555','stroke-width':.5});
          });
        }
      });
    });
    D.extras.forEach(e=>{ if(e.type==='slide'){ g.line(e.x0,e.z,e.x1,e.z,{'stroke-width':1.4}); g.line(e.x0+e.park,e.z,e.x0,e.z,{'stroke-width':.6,'stroke-dasharray':'2 2'}); g.text((e.x0+e.x1)/2,e.z-.9,'SLIDING',{'font-size':7,fill:'#444'}); } });
    // room labels
    const room=(x,z,name,size)=>{g.text(x,z-.4,name,{'font-size':10,'font-weight':600}); g.text(x,z+.7,size,{'font-size':9,fill:'#444'});};
    room(7.5,7,'BEDROOM','15′ × 14′'); room(12.5,16.5,'LAUNDRY','5′ × 5′'); room(5,16.5,'BATH','10′ × 5′');
    room(21,9.5,'LIVING','12′ × 19′'); room(21,23.5,'KITCHEN','14′ × 9′');
    g.text(-10,9.5,'PADDY FIELD',{'font-size':9,fill:'#666'}); g.text(13,-8,'ROAD',{'font-size':9,fill:'#666'}); g.text(13,36,'DRAIN',{'font-size':9,fill:'#666'});
    // dimensions: outside faces and room centrelines
    // room sizes centreline to centreline (as on plan-3), overall sizes to the outside faces
    g.dim(0,-h,c.CX,-h,-3.2,'15′'); g.dim(c.CX,-h,c.FAR,-h,-3.2,'12′'); g.dim(-h,-h,c.FAR+h,-h,-5.2,'27′ 6″');
    g.dim(-h,0,-h,14,7.6,'14′'); g.dim(-h,14,-h,19,7.6,'5′'); g.dim(-h,-h,-h,19+h,9.6,'19′ 6″');
    g.dim(c.FAR+h,0,c.FAR+h,19,-7.6,'19′'); g.dim(c.FAR+h,19,c.FAR+h,c.DZ,-7.6,'9′'); g.dim(c.FAR+h,-h,c.FAR+h,c.DZ+h,-9.6,'28′ 6″');
    g.dim(13,c.DZ+h,c.FAR,c.DZ+h,3.2,'14′'); g.dim(0,19+h,13,19+h,3.2,'13′');
    setEl('drawings').insertAdjacentHTML('beforeend',g.done());
  }

  // ---------- ELEVATIONS ----------
  // Each view maps world (x,z) to a horizontal drawing coordinate u and a depth d (smaller = nearer the viewer).
  const views=[
    {name:'Road-side elevation (looking towards the drain)',u:(x,z)=>-x,d:(x,z)=>z,facing:'x',ends:'road'},
    {name:'Paddy-side elevation (road on the left)',u:(x,z)=>z,d:(x,z)=>x,facing:'z',ends:'paddy'},
    {name:'Drain-side elevation (looking towards the road)',u:(x,z)=>x,d:(x,z)=>-z,facing:'x',ends:'drain'},
    {name:'Far-side elevation (main door, road on the right)',u:(x,z)=>-z,d:(x,z)=>-x,facing:'z',ends:'far'},
  ];
  const ground=-.75;
  views.forEach(v=>{
    const items=[], labels=[], facings=[]; // facings: depth + u-range of every facing wall, to tell hidden openings
    D.walls.forEach(w=>{ if(w.axis===v.facing){ const pts=w.axis==='x'?[[w.a,w.fixed],[w.b,w.fixed]]:[[w.fixed,w.a],[w.fixed,w.b]]; const us=pts.map(([x,z])=>v.u(x,z)); facings.push({d:Math.min(...pts.map(([x,z])=>v.d(x,z))),u0:Math.min(...us),u1:Math.max(...us)}); } });
    D.walls.forEach(w=>{
      const pts=w.axis==='x'?[[w.a,w.fixed],[w.b,w.fixed]]:[[w.fixed,w.a],[w.fixed,w.b]];
      const us=pts.map(([x,z])=>v.u(x,z)), ds=pts.map(([x,z])=>v.d(x,z));
      const facing=w.axis===v.facing;
      const gableAbove=w.axis==='x'&&D.gables.some(gb=>Math.abs(gb.zc-w.fixed)<1e-6); // wall continues up into a gable
      if(facing) items.push({d:Math.min(...ds),draw:g=>{
        const u0=Math.min(...us), u1=Math.max(...us);
        g.rect(u0,0,u1,w.H,{stroke:'none'});
        g.polyline(gableAbove?[[u0,w.H],[u0,0],[u1,0],[u1,w.H]]:[[u0,w.H],[u0,0],[u1,0],[u1,w.H],[u0,w.H]]); // no line along the top under a gable
        w.openings.forEach(o=>{
          if(o.type==='open') return;
          const p=w.axis==='x'?[[o.s,w.fixed],[o.e,w.fixed]]:[[w.fixed,o.s],[w.fixed,o.e]], ou=p.map(([x,z])=>v.u(x,z));
          const u0=Math.min(...ou), u1=Math.max(...ou), y0=o.sill, y1=o.head;
          g.rect(u0,y0,u1,y1,{'stroke-width':1}); g.rect(u0+.15,y0+(y0>0?.15:0),u1-.15,y1-.15,{'stroke-width':.5});
          if(o.type==='french'){ const n=o.panels||2, wd=(u1-u0)/n; for(let i=1;i<n;i++) g.line(u0+i*wd,y0,u0+i*wd,y1,{'stroke-width':.5}); g.line(u0,(y0+y1)/2,u1,(y0+y1)/2,{'stroke-width':.5}); }
          if(o.type==='window'&&(o.panels||1)>1){ const n=o.panels, wd=(u1-u0)/n; for(let i=1;i<n;i++) g.line(u0+i*wd,y0,u0+i*wd,y1,{'stroke-width':.5}); }
          if(o.type==='double') g.line((u0+u1)/2,y0,(u0+u1)/2,y1,{'stroke-width':.5});
          // size label above the head (width × height); sill height below the cill for windows. Labels are drawn
          // after all walls so an adjoining wall's fill can't clip them, but only for openings not hidden by a nearer wall.
          const wd=Math.min(...ds), hidden=facings.some(f=>f.d<wd-1e-6&&f.u0<=u0+1e-6&&f.u1>=u1-1e-6);
          if(!hidden) labels.push(g=>{
            g.text((u0+u1)/2,y1+.55,`${ft(u1-u0)} × ${ft(y1-y0)}`,{'font-size':7.5,fill:'#333'});
            if(y0>0) g.text((u0+u1)/2,y0-.55,`sill ${ft(y0)}`,{'font-size':7,fill:'#555'});
          });
        });
      }});
      else{ // edge-on: a thin sliver, capped at the eave because the roof covers anything above
        const uc=v.u(...(w.axis==='x'?[w.a,w.fixed]:[w.fixed,w.a])); // same u for both ends
        items.push({d:Math.min(...ds)+.3,draw:g=>g.rect(uc-h,0,uc+h,Math.min(w.H,c.EAVE)-.1)}); // biased behind a facing wall on the same line, top tucked under its fill
      }
    });
    D.gables.forEach(gb=>{
      if(v.facing==='x'){
        items.push({d:v.d(gb.x0,gb.zc),draw:g=>{
          const P=gb.pts.map(([x,y])=>[v.u(x,gb.zc),y]);
          g.poly(P,{stroke:'none'});
          g.polyline([...P.slice(1),P[0]]); // up one side, over the roof line and down the other: no base line
        }});
      }
    });
    items.sort((p,q)=>q.d-p.d); // far first
    // extents
    const allU=[]; D.walls.forEach(w=>{const pts=w.axis==='x'?[[w.a,w.fixed],[w.b,w.fixed]]:[[w.fixed,w.a],[w.fixed,w.b]]; pts.forEach(([x,z])=>allU.push(v.u(x,z)));});
    const umin=Math.min(...allU), umax=Math.max(...allU);
    const g=svg(v.name,umin-7,umax+8,ground-2.5,c.TOP+4,true);
    // ground line and plinth
    g.line(umin-7,ground,umax+7,ground,{'stroke-width':1.2});
    g.rect(umin,ground,umax,0,{fill:'#ddd'});
    items.forEach(it=>it.draw(g));
    labels.forEach(l=>l(g));
    // roof, from the slabs the model built (y0/y1 = top of tile at x0/x1), far pieces first
    const th=.25;
    const slabs=[...D.roof].sort((p,q)=>{
      if(v.facing==='x') return v.ends==='road' ? q.z0-p.z0 : p.z1-q.z1;
      return v.ends==='paddy' ? q.x0-p.x0 : p.x1-q.x1;
    });
    slabs.forEach(r=>{
      if(v.facing==='x'){ // gable-end view: the true sloped profile
        const u0=v.u(r.x0,0), u1=v.u(r.x1,0);
        g.poly([[u0,r.y0-th],[u1,r.y1-th],[u1,r.y1],[u0,r.y0]],{fill:'#f3f3f3'});
      }else{ // side view: the surface shows when it rises away from the viewer, otherwise only the near fascia
        const near=v.ends==='paddy'?r.y0:r.y1, far=v.ends==='paddy'?r.y1:r.y0, a=v.u(0,r.z0), b=v.u(0,r.z1);
        g.rect(a,near-th,b,Math.max(near,far),{fill:'#f3f3f3'}); if(far>near) g.line(a,near,b,near,{'stroke-width':.5});
      }
    });
    // dimensions
    g.dim(umin,ground,umax,ground,-1.8,ft(umax-umin));
    g.dim(umax,0,umax,c.EAVE,-2.2,'11′'); g.dim(umax,0,umax,c.TOP,-4.4,ft(c.TOP));
    g.dim(umin,ground,umin,0,2.2,'9″');
    setEl('drawings').insertAdjacentHTML('beforeend',g.done());
  });
  buildDW(D,c,h,cuts,segments);
}

// ---------- DOORS & WINDOWS ----------
// Every opening the model built is grouped into types (same kind, panels, width, height and sill), given a mark,
// and shown three ways: tagged on a key plan, drawn as a dimensioned elevation, and listed in a schedule.
function buildDW(D,c,h,cuts,segments){
  const where=(w,mid)=>{ // wall name and room for an opening
    if(w.axis==='x'){
      if(w.fixed===0) return ['Road wall', mid<c.CX?'Bedroom':'Living'];
      if(w.fixed===19) return ['Drain wall', mid<10?'Bathroom':'Laundry'];
      if(w.fixed===c.DZ) return ['Drain wall','Kitchen'];
      if(w.fixed===14) return ['Partition','Bedroom / laundry'];
    }else{
      if(w.fixed===0) return ['Paddy wall', mid<14?'Bedroom':'Bathroom'];
      if(w.fixed===10) return ['Bath / laundry wall','Bathroom'];
      if(w.fixed===c.FAR) return ['Far wall', mid<19?'Living':'Kitchen'];
      if(w.fixed===13) return ['Kitchen bay wall','Kitchen'];
      if(w.fixed===c.CX) return ['Centre wall','Laundry / living'];
    }
    return ['Wall',''];
  };
  // collect openings
  const ops=[];
  D.walls.forEach(w=>w.openings.forEach(o=>{
    if(o.type==='open') return;
    const mid=(o.s+o.e)/2, [wall,room]=where(w,mid), n=o.panels||1;
    const along=(t,k)=>w.axis==='x'?[t,w.fixed+k]:[w.fixed+k,t];
    ops.push({kind:o.type, panels:o.type==='single'?1:n, w:o.e-o.s, h:o.head-o.sill, sill:o.sill, wall, room, phase:w.future?'Phase 2':'Phase 1',
      at:along(mid,0), axis:w.axis, fixed:w.fixed, outward:o.out||-1});
  }));
  D.extras.forEach(e=>{ if(e.type==='slide') ops.push({kind:'sliding',panels:1,w:5,h:7.4,sill:0,wall:'Partition',room:'Bedroom / laundry',phase:'Phase 1',at:[12.5,14],axis:'x',fixed:14}); });
  // group into types and give marks: D doors, F French windows, W windows
  const cat=k=>k==='french'?'F':k==='window'?'W':'D';
  const key=o=>[o.kind,o.panels,o.w.toFixed(2),o.h.toFixed(2),o.sill.toFixed(2)].join('|');
  const types=[];
  ops.forEach(o=>{ let t=types.find(t=>t.key===key(o)); if(!t){ t={key:key(o),kind:o.kind,panels:o.panels,w:o.w,h:o.h,sill:o.sill,items:[]}; types.push(t);} t.items.push(o); });
  const order={D:0,F:1,W:2};
  types.sort((p,q)=>order[cat(p.kind)]-order[cat(q.kind)] || q.w*q.h-p.w*p.h);
  const count={D:0,F:0,W:0};
  types.forEach(t=>{ const k=cat(t.kind); t.mark=k+(++count[k]); t.items.forEach(o=>{o.mark=t.mark;}); });
  const name=t=>({french:'French window',window:'Window',single:'Door',double:'Double door',sliding:'Sliding door'}[t.kind]||t.kind);
  const operation=t=>t.kind==='french'?(t.panels>=4?`${t.panels}-panel bi-fold, outward`:`${t.panels} leaves, outward`)
    :t.kind==='window'?(t.panels>1?`${t.panels} panes, glazed`:'Single pane, glazed')
    :t.kind==='single'?'Hinged leaf':t.kind==='double'?'Hinged pair':t.kind==='sliding'?'Top-hung sliding':'';
  const finish=t=>t.kind==='french'?'Timber frame, glass above and below mid rail':t.kind==='window'?'Timber frame, clear glass'
    :t.kind==='sliding'?'Timber, vertical boards':'Timber leaf';
  const put=g=>setEl('dw').insertAdjacentHTML('beforeend',g.done());

  // 1. key plan
  {
    const g=svg('Door & window key plan',-8,36,-7,35,false);
    D.slabs.forEach(sl=>{ if(sl.poly) g.poly(sl.poly,{fill:'none',stroke:'#bbb','stroke-width':.5,'stroke-dasharray':'3 2'}); else g.rect(sl.x0,sl.z0,sl.x1,sl.z1,{fill:'#f6f6f6',stroke:'#ccc','stroke-width':.5}); });
    D.walls.forEach(w=>{
      const f=w.fixed, fill=w.future?'#999':'#111';
      segments(w).forEach(([p,q])=>w.axis==='x'?g.rect(p,f-h,q,f+h,{fill,stroke:'none'}):g.rect(f-h,p,f+h,q,{fill,stroke:'none'}));
      w.openings.filter(cuts).forEach(o=>{ if(o.type==='open') return; const A=w.axis==='x'?[[o.s,f],[o.e,f]]:[[f,o.s],[f,o.e]]; g.line(A[0][0],A[0][1],A[1][0],A[1][1],{'stroke-width':.6}); });
    });
    const room=(x,z,n)=>g.text(x,z,n,{'font-size':9,fill:'#777'});
    room(7.5,7,'BEDROOM'); room(12.5,16.5,'LAUNDRY'); room(5,16.5,'BATH'); room(21,9.5,'LIVING'); room(21,23.5,'KITCHEN');
    ops.forEach(o=>{
      // tag outside the wall line (away from the house centre), high-level windows marked the same way
      const [x,z]=o.at, n=o.axis==='x'?(o.fixed<=14?-1:1):(o.fixed<13.5?-1:1), off=1.7; // partition tags go to the bedroom side
      const tx=o.axis==='x'?x:x+n*off, tz=o.axis==='x'?z+n*off:z;
      g.line(x,z,tx,tz,{'stroke-width':.4,stroke:'#888'});
      g.circle(tx,tz,.85,{'stroke-width':.8});
      g.text(tx,tz,o.mark,{'font-size':8.5,'font-weight':600});
    });
    g.text(13,-5.5,'ROAD',{'font-size':9,fill:'#666'}); g.text(-6,13,'PADDY',{'font-size':9,fill:'#666'}); g.text(13,33.5,'DRAIN',{'font-size':9,fill:'#666'});
    put(g);
  }

  // 2. type elevations, drawn to scale, two rows
  {
    const half=Math.ceil(types.length/2), rows=[types.slice(0,half),types.slice(half)];
    const rowW=r=>r.reduce((s,t)=>s+Math.max(t.w,3)+6,0);
    const W=Math.max(...rows.map(rowW))+2, RH=19;
    const g=svg('Door & window types · elevations from outside',0,W,0,RH*rows.length,true);
    rows.forEach((r,ri)=>{
      let x=3; const base=RH*(rows.length-ri)-12.5; // floor line of this row
      r.forEach(t=>{
        const w=t.w, ox=x+(Math.max(w,3)-w)/2, y0=base+t.sill, y1=y0+t.h;
        g.line(ox-1,base,ox+w+1,base,{'stroke-width':.6,stroke:'#999'}); // floor
        g.rect(ox,y0,ox+w,y1,{'stroke-width':1.1});
        const f=.15; g.rect(ox+f,y0+(t.sill>0?f:0),ox+w-f,y1-f,{'stroke-width':.5});
        if(t.kind==='french'||t.kind==='window'){
          const n=t.panels, pw=w/n; for(let i=1;i<n;i++) g.line(ox+i*pw,y0,ox+i*pw,y1,{'stroke-width':.6});
          if(t.kind==='french'){ const m=y0+t.h*.5; g.line(ox,m,ox+w,m,{'stroke-width':.6});
            for(let i=0;i<n;i++){ const a=ox+i*pw, hingeLeft=i<n/2; // hinge side shown by the apex of the swing lines
              const hx=hingeLeft?a:a+pw, lx=hingeLeft?a+pw:a; g.polyline([[lx,y1-.15],[hx,(y0+y1)/2],[lx,y0+.15]],{'stroke-width':.4,stroke:'#888','stroke-dasharray':'3 2'}); } }
        }
        if(t.kind==='single'){ g.polyline([[ox+w-.15,y1-.15],[ox+.15,(y0+y1)/2],[ox+w-.15,y0+.15]],{'stroke-width':.4,stroke:'#888','stroke-dasharray':'3 2'}); g.line(ox+w-.45,y0+3.2,ox+w-.45,y0+3.9,{'stroke-width':1.2}); }
        if(t.kind==='sliding'){ for(let i=1;i<6;i++) g.line(ox+i*w/6,y0+.2,ox+i*w/6,y1-.2,{'stroke-width':.35,stroke:'#aaa'}); const ay=y0+3.6; g.line(ox+w*.75,ay,ox+w*.25,ay,{'stroke-width':.8}); g.polyline([[ox+w*.25+.4,ay+.3],[ox+w*.25,ay],[ox+w*.25+.4,ay-.3]],{'stroke-width':.8}); }
        // dimensions
        g.dim(ox,y0,ox+w,y0,-1.2,ft(w)); g.dim(ox,y0,ox,y1,1.3,ft(t.h)); if(t.sill>0) g.dim(ox+w,base,ox+w,y0,-1.1,ft(t.sill));
        // mark and notes
        g.circle(ox+w/2,y1+1.4,.9,{'stroke-width':.9}); g.text(ox+w/2,y1+1.4,t.mark,{'font-size':9,'font-weight':600});
        g.text(ox+w/2,base-3.0,name(t),{'font-size':9,'font-weight':600});
        g.text(ox+w/2,base-4.2,`${ft(w)} × ${ft(t.h)}${t.sill>0?`, sill ${ft(t.sill)}`:''}`,{'font-size':8.5,fill:'#333'});
        g.text(ox+w/2,base-5.4,`Qty ${t.items.length}`,{'font-size':8.5,fill:'#333'});
        x+=Math.max(w,3)+6;
      });
    });
    put(g);
  }

  // 3. schedule table
  {
    const cols=[['Mark',0],['Type',3.5],['Width',11],['Height',16],['Sill',21],['Operation',25],['Finish',36],['Qty',53],['Location',56.5]];
    const lines=[]; // one table row per type, locations stacked
    types.forEach(t=>{
      const locs=[...new Set(t.items.map(o=>`${o.room}, ${o.wall}${o.phase==='Phase 2'?' (phase 2)':''}`))];
      lines.push({t,locs});
    });
    const RH=1.25, rows=lines.reduce((s,l)=>s+Math.max(1,l.locs.length),0), W=84, H=4+rows*RH+1;
    const g=svg('Door & window schedule',0,W,0,H,false);
    const head=1.6; g.rect(.5,.6,W-.5,head+.6,{fill:'#f1f1f1',stroke:'#bbb','stroke-width':.5});
    cols.forEach(([n,x])=>g.text(1+x,1.4,n.toUpperCase(),{'text-anchor':'start','font-size':8,'font-weight':600,fill:'#444'}));
    let y=head+1.7;
    lines.forEach(({t,locs},i)=>{
      const nrow=Math.max(1,locs.length), top=y-RH*.7, bot=y+RH*(nrow-1)+RH*.45;
      if(i%2) g.rect(.5,top,W-.5,bot,{fill:'#fafafa',stroke:'none'});
      const cell=(x,v,o={})=>g.text(1+x,y,v,Object.assign({'text-anchor':'start','font-size':9},o));
      cell(0,t.mark,{'font-weight':600}); cell(3.5,name(t)); cell(11,ft(t.w)); cell(16,ft(t.h)); cell(21,t.sill>0?ft(t.sill):'—');
      cell(25,operation(t)); cell(36,finish(t)); cell(53,String(t.items.length));
      locs.forEach((l,k)=>g.text(1+56.5,y+k*RH,l,{'text-anchor':'start','font-size':9}));
      g.line(.5,bot,W-.5,bot,{'stroke-width':.3,stroke:'#ddd'});
      y+=nrow*RH;
    });
    g.text(1,y+.6,`Sizes are structural openings, width × height, in feet and inches. ${ops.length} openings in ${types.length} types.`,{'text-anchor':'start','font-size':8,fill:'#666'});
    put(g);
  }
}
})();
