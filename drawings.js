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
const loadScript=src=>new Promise((res,rej)=>{const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('could not load '+src)); document.head.appendChild(s);});
async function makePdf(){
  if(!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  if(!window.svg2pdf) await loadScript('https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.1/dist/svg2pdf.umd.min.js');
  const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const figs=[...panel.querySelectorAll('figure')], W=297, H=210, m=12;
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
  doc.save('kalpa-villa-plan.pdf');
}
pdfBtn.addEventListener('click',async()=>{
  if(!built){build(); built=true;}
  pdfBtn.disabled=true; pdfBtn.textContent='Preparing…';
  try{ await makePdf(); }
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
    arc:(cx,cy,r,a0,a1,o={})=>{ // angles in radians, world space, counter-clockwise from +x
      const p=t=>[cx+r*Math.cos(t),cy+r*Math.sin(t)], [x0,y0]=p(a0), [x1,y1]=p(a1), sweep=mapY?((a1>a0)?0:1):((a1>a0)?1:0);
      out.push(`<path d="M${X(x0)},${Y(y0)} A${(r*S).toFixed(1)},${(r*S).toFixed(1)} 0 0 ${sweep} ${X(x1)},${Y(y1)}" ${a(Object.assign({fill:'none',stroke:'#111','stroke-width':LW*.8},o))}/>`);
    },
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
  const roofH=x=>Math.max(c.EAVE, x<=c.CX ? c.EAVE+x*c.SL : c.EAVE+(c.FAR-x)*c.SR);
  const segments=w=>{ // solid pieces of a wall between its openings, as [from,to] along the wall
    const segs=[]; let cur=w.a;
    [...w.openings].sort((p,q)=>p.s-q.s).forEach(o=>{segs.push([cur,o.s]); cur=o.e;});
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
      w.openings.forEach(o=>{
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
    panel.querySelector('.sheets').insertAdjacentHTML('beforeend',g.done());
  }

  // ---------- ELEVATIONS ----------
  // Each view maps world (x,z) to a horizontal drawing coordinate u and a depth d (smaller = nearer the viewer).
  const views=[
    {name:'Road-side elevation (looking towards the drain)',u:(x,z)=>-x,d:(x,z)=>z,facing:'x',ends:'road'},
    {name:'Paddy-side elevation (road on the left)',u:(x,z)=>z,d:(x,z)=>x,facing:'z',ends:'paddy'},
    {name:'Drain-side elevation (looking towards the road)',u:(x,z)=>x,d:(x,z)=>-z,facing:'x',ends:'drain'},
    {name:'Far-side elevation (main door)',u:(x,z)=>z,d:(x,z)=>-x,facing:'z',ends:'far'},
  ];
  const ground=-.75;
  views.forEach(v=>{
    const items=[];
    D.walls.forEach(w=>{
      const pts=w.axis==='x'?[[w.a,w.fixed],[w.b,w.fixed]]:[[w.fixed,w.a],[w.fixed,w.b]];
      const us=pts.map(([x,z])=>v.u(x,z)), ds=pts.map(([x,z])=>v.d(x,z));
      const facing=w.axis===v.facing;
      if(facing) items.push({d:Math.min(...ds),draw:g=>{
        g.rect(Math.min(...us),0,Math.max(...us),w.H);
        w.openings.forEach(o=>{
          if(o.type==='open') return;
          const p=w.axis==='x'?[[o.s,w.fixed],[o.e,w.fixed]]:[[w.fixed,o.s],[w.fixed,o.e]], ou=p.map(([x,z])=>v.u(x,z));
          const u0=Math.min(...ou), u1=Math.max(...ou), y0=o.sill, y1=o.head;
          g.rect(u0,y0,u1,y1,{'stroke-width':1}); g.rect(u0+.15,y0+(y0>0?.15:0),u1-.15,y1-.15,{'stroke-width':.5});
          if(o.type==='french'){ const n=o.panels||2, wd=(u1-u0)/n; for(let i=1;i<n;i++) g.line(u0+i*wd,y0,u0+i*wd,y1,{'stroke-width':.5}); g.line(u0,(y0+y1)/2,u1,(y0+y1)/2,{'stroke-width':.5}); }
          if(o.type==='window'&&(o.panels||1)>1){ const n=o.panels, wd=(u1-u0)/n; for(let i=1;i<n;i++) g.line(u0+i*wd,y0,u0+i*wd,y1,{'stroke-width':.5}); }
          if(o.type==='double') g.line((u0+u1)/2,y0,(u0+u1)/2,y1,{'stroke-width':.5});
          // size label above the head (width × height); sill height below the cill for windows
          g.text((u0+u1)/2,y1+.55,`${ft(u1-u0)} × ${ft(y1-y0)}`,{'font-size':7.5,fill:'#333'});
          if(y0>0) g.text((u0+u1)/2,y0-.55,`sill ${ft(y0)}`,{'font-size':7,fill:'#555'});
        });
      }});
      else{ // edge-on: a thin sliver, capped at the eave because the roof covers anything above
        const uc=v.u(...(w.axis==='x'?[w.a,w.fixed]:[w.fixed,w.a])); // same u for both ends
        items.push({d:Math.min(...ds),draw:g=>g.rect(uc-h,0,uc+h,Math.min(w.H,c.EAVE))});
      }
    });
    D.gables.forEach(gb=>{
      if(v.facing==='x'){
        const pts=[[gb.x0,c.EAVE],[gb.x1,c.EAVE],[gb.x1,roofH(gb.x1)]]; if(gb.x0<c.CX&&gb.x1>c.CX) pts.push([c.CX,c.RIDGE]); pts.push([gb.x0,roofH(gb.x0)]);
        items.push({d:v.d(gb.x0,gb.zc),draw:g=>g.poly(pts.map(([x,y])=>[v.u(x,gb.zc),y]))});
      }
    });
    items.sort((p,q)=>q.d-p.d); // far first
    // extents
    const allU=[]; D.walls.forEach(w=>{const pts=w.axis==='x'?[[w.a,w.fixed],[w.b,w.fixed]]:[[w.fixed,w.a],[w.fixed,w.b]]; pts.forEach(([x,z])=>allU.push(v.u(x,z)));});
    const umin=Math.min(...allU), umax=Math.max(...allU);
    const g=svg(v.name,umin-7,umax+8,ground-2.5,c.RIDGE+4,true);
    // ground line and plinth
    g.line(umin-7,ground,umax+7,ground,{'stroke-width':1.2});
    g.rect(umin,ground,umax,0,{fill:'#ddd'});
    items.forEach(it=>it.draw(g));
    // roof
    const O=c.OVER, eaveL=c.EAVE-O*c.SL, eaveR=c.EAVE-O*c.SR, th=.3;
    const profile=(u)=>{ // gable-end profile polygon in u for a view where the ridge runs towards the viewer
      const pts=[[u(-O),eaveL],[u(c.CX),c.RIDGE+.1],[u(c.FAR+O),eaveR],[u(c.FAR+O),eaveR+th],[u(c.CX),c.RIDGE+.1+th],[u(-O),eaveL+th]]; return pts;
    };
    if(v.ends==='road'){ g.poly(profile(x=>v.u(x,0)),{fill:'#f3f3f3'}); }
    if(v.ends==='drain'){ // bedroom block end is set back; its slope beyond the kitchen strip shows behind
      g.poly([[v.u(-O,0),eaveL],[v.u(c.CX,0),c.RIDGE+.1],[v.u(c.CX,0),c.RIDGE+.1+th],[v.u(-O,0),eaveL+th]],{fill:'#e6e6e6'});
      const u0=v.u(c.CX-2-O,0), hs=c.EAVE+(c.CX-2-O)*c.SL;
      g.poly([[u0,hs],[v.u(c.CX,0),c.RIDGE+.1],[v.u(c.FAR+O,0),eaveR],[v.u(c.FAR+O,0),eaveR+th],[v.u(c.CX,0),c.RIDGE+.1+th],[u0,hs+th]],{fill:'#f3f3f3'});
    }
    if(v.ends==='paddy'){ // paddy slope seen face-on: eave band to ridge; the strip over the kitchen bay has a higher eave
      const z0=v.u(0,-O), z1=v.u(0,19+O), z2=v.u(0,c.DZ+O), hs=c.EAVE+(c.CX-2-O)*c.SL;
      g.poly([[z0,eaveL],[z1,eaveL],[z1,hs],[z2,hs],[z2,c.RIDGE+.1+th],[z0,c.RIDGE+.1+th]],{fill:'#f3f3f3'});
      g.line(z0,c.RIDGE+.1,z2,c.RIDGE+.1,{'stroke-width':.5}); g.line(z0,eaveL+th,z1,eaveL+th,{'stroke-width':.5}); g.line(z1,hs+th,z2,hs+th,{'stroke-width':.5});
    }
    if(v.ends==='far'){
      const z0=v.u(0,-O), z2=v.u(0,c.DZ+O);
      g.poly([[z0,eaveR],[z2,eaveR],[z2,c.RIDGE+.1+th],[z0,c.RIDGE+.1+th]],{fill:'#f3f3f3'});
      g.line(z0,c.RIDGE+.1,z2,c.RIDGE+.1,{'stroke-width':.5}); g.line(z0,eaveR+th,z2,eaveR+th,{'stroke-width':.5});
    }
    // dimensions
    g.dim(umin,ground,umax,ground,-1.8,ft(umax-umin));
    g.dim(umax,0,umax,c.EAVE,-2.2,'11′'); g.dim(umax,0,umax,c.RIDGE,-4.4,'14′ 6″');
    g.dim(umin,ground,umin,0,2.2,'9″');
    panel.querySelector('.sheets').insertAdjacentHTML('beforeend',g.done());
  });
}
})();
