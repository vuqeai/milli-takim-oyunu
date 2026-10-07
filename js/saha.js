(function (g) {
  'use strict';
  g.MT = g.MT || {};
  const MT = g.MT;
  const PITCH = 105 / 68;
  const ease = t => t * t * (3 - 2 * t);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DASH=[7,6], SOLID=[];
  const pitch = {x:0,y:0,w:0,h:0};
  const state = { canvas:null, ctx:null, raf:0, prev:0, width:0, height:0, dpr:1, match:null, nodes:[], ballX:.5, ballY:.5,
    event:null, elapsed:0, duration:0, resolve:null, paused:false, skip:false, reduced:false, low:false, hidden:false,
    startX:.5,startY:.5,endX:.5,endY:.5, lastShot:null, particles:new Float32Array(40*5), particleCount:0, goalPulse:0, netWave:0,
    gradient:null,gradientX:0,gradientY:0,gradientW:0,gradientH:0,clock:0,crowd:null,crowdKey:'',passStep:-1,passStart:0,
    passFromX:.5,passFromY:.5,passToX:.5,passToY:.5,ambientX:.5,ambientY:.5,lastTeam:null,camX:null,camY:null,
    attackRight:true,penSide:1,supportIds:[],
    // Gerçek maç verisinden top akışı: topa sahip takım, oynanan zincir, santra beklemesi.
    hiz:1,ambientTime:0,poss:null,possAt:-1e9,nextTeam:null,chain:null,chainNo:0,chainAt:0,chainMirror:false,chainOx:0,chainOy:0,kickoffUntil:0 };
  const ADIM_MS=240, GECIS_MS=2400, SANTRA_MS=1600;
  const KV=()=>MT.konumVerisi;
  const shapeCache={};
  function slots(d) { return MT.veri?.DIZILISLER?.[d] || []; }
  function kodColor(kod, match) {
    if (kod === 'TUR') return '#E30A17';
    if (kod === 'ITA') return '#0878BB';
    const clash = match && (match.takimA === 'TUR' || match.takimB === 'TUR');
    return clash ? '#F6F8FA' : (MT.veri?.takim?.(kod)?.forma?.ana || '#F6F8FA');
  }
  function rgbText(kod) { return kod === 'TUR' || kod === 'ITA' ? '#fff' : '#111923'; }
  function slotNode(kod, id, s, mirror, no) {
    const baseX = mirror ? 1-(.04+s.x*.50) : .04+s.x*.50, baseY = mirror ? 1-s.y : s.y;
    return {kod,id,no,x:baseX,y:baseY,tx:baseX,ty:baseY,bx:baseX,by:baseY,hat:s.hat};
  }
  function teamMirror(kod){
    const m=state.match;if(!m)return false;
    return m.takimA==='TUR'||m.takimB==='TUR'?kod!=='TUR':kod===m.takimB;
  }
  function otherTeam(kod){const m=state.match;return !m?null:kod===m.takimA?m.takimB:m.takimA;}
  // Dizilişin her mevkisi, veri tablosundaki 10 saha oyuncusu derinlik sırasından hangilerine denk geliyor.
  function shapeInfo(d){
    if(shapeCache[d])return shapeCache[d];
    const sl=slots(d),out=sl.filter(s=>s.hat!=='KL').sort((a,b)=>a.x-b.x||Math.abs(b.y-.5)-Math.abs(a.y-.5));
    const lines={};
    out.forEach((s,r)=>{const L=lines[s.hat]=lines[s.hat]||{r:[],x:[]};L.r.push(r);L.x.push(s.x);});
    const my=out.reduce((a,s)=>a+s.y,0)/Math.max(1,out.length);
    const info={sy:Math.sqrt(out.reduce((a,s)=>a+(s.y-my)**2,0)/Math.max(1,out.length))||.25,slot:{}};
    for(const s of sl){
      if(s.hat==='KL'){info.slot[s.slot]={kl:true};continue;}
      const L=lines[s.hat],mx=L.x.reduce((a,b)=>a+b,0)/L.x.length;
      info.slot[s.slot]={r:L.r.map(r=>Math.round(r*9/Math.max(1,out.length-1))),off:(s.x-mx)*.4,y:s.y};
    }
    return shapeCache[d]=info;
  }
  function cell(grid,bx,by){
    const kv=KV(),nx=kv.bx,ny=kv.by;
    const fx=clamp(bx*nx-.5,0,nx-1),fy=clamp(by*ny-.5,0,ny-1);
    const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(nx-1,x0+1),y1=Math.min(ny-1,y0+1),ax=fx-x0,ay=fy-y0;
    const a=grid[x0][y0],b=grid[x1][y0],c=grid[x0][y1],d=grid[x1][y1];
    const mix=(va,vb,vc,vd)=>(va*(1-ax)+vb*ax)*(1-ay)+(vc*(1-ax)+vd*ax)*ay;
    const q=new Array(10);for(let i=0;i<10;i++)q[i]=mix(a.q[i],b.q[i],c.q[i],d.q[i]);
    return {kl:mix(a.kl,b.kl,c.kl,d.kl),cy:mix(a.cy,b.cy,c.cy,d.cy),sy:mix(a.sy,b.sy,c.sy,d.sy),q};
  }
  function blendShape(a,b,t){
    if(t<=0)return a;
    const q=a.q.map((v,i)=>v+(b.q[i]-v)*t);
    return {kl:a.kl+(b.kl-a.kl)*t,cy:a.cy+(b.cy-a.cy)*t,sy:a.sy+(b.sy-a.sy)*t,q};
  }
  // Takımın o anki şekli: topa sahip mi, geçişte mi, top nerede (takım kendi kalesinden rakibe doğru bakar).
  function teamShape(kod,ballX,ballY,shot){
    const kv=KV(),mirror=teamMirror(kod),tx=mirror?1-ballX:ballX,ty=mirror?1-ballY:ballY;
    const has=state.poss===kod,tr=state.ambientTime-state.possAt<GECIS_MS;
    let sh=cell(kv.tablo[has?(tr?'HG':'H'):(tr?'SG':'S')],tx,ty);
    if(shot>0){const s=kv.sut[has?'A':'D'];sh=blendShape(sh,{kl:s.kl,q:s.q,sy:s.sy,cy:s.cy+(ty-.5)*.3},shot);}
    // Hoca modu: hat yüksekliği, top rakipteyken pres, genişlik.
    const h=hocaOf(kod);
    if(h&&(h.hat||h.pres||h.genislik!==1)){
      const up=has?h.hat:h.hat+h.pres*(tx>.5?1:tx>.3?.5:0);
      sh={kl:clamp(sh.kl+up*.5,.01,.3),cy:sh.cy,sy:sh.sy*(has?h.genislik:1+(h.genislik-1)*.5),q:sh.q.map(v=>clamp(v+up,.03,.96))};
    }
    return {sh,mirror,ty};
  }
  function hocaOf(kod){const h=MT.veri?.HOCALAR?.[state.match?.hocalar?.[kod]];return h&&h.plan?h:null;}
  function shapeTarget(n,t){
    const info=shapeInfo(n.diz),inf=info.slot[n.slot],sh=t.sh;
    if(!inf)return [n.bx,n.by];
    let x,y;
    if(inf.kl){x=sh.kl;y=.5+(t.ty-.5)*.12;}
    else{let sum=0;for(const r of inf.r)sum+=sh.q[r];x=sum/inf.r.length+inf.off;y=sh.cy+(inf.y-.5)*sh.sy/info.sy;}
    return t.mirror?[1-x,1-y]:[x,y];
  }
  function syncNodes(m) {
    if (!m || !MT.veri) return;
    const nodes = state.nodes, keep = new Set();
    for (const kod of [m.takimA,m.takimB]) {
      const isTur = kod === 'TUR', mirror = m.takimA === 'TUR' || m.takimB === 'TUR' ? !isTur : kod === m.takimB;
      const formation = m.taktikler?.[kod]?.dizilis || MT.veri.takim(kod).varsayilanDizilis;
      const active = isTur ? m.kadro?.ilk11 || {} : m.anonimKadrolar?.[kod]?.aktif || {};
      for (const s of slots(formation)) {
        const id = active[s.slot]; if (!id || m.kirmiziKartlar?.[id] || m.sakatlar?.[id]) continue;
        const key = `${kod}|${id}`, no = isTur ? null : Number(String(id).split('#')[1]); keep.add(key);
        if (!nodes.length && (m.dakika === 0 || m.dakika === 45)) kickoff(m.dakika === 45 ? m.takimB : m.takimA);
        let n = nodes.find(x=>x.kod===kod && x.id===id);
        if (!n) { n = slotNode(kod,id,s,mirror,no); nodes.push(n); }
        n.bx=mirror?1-(.04+s.x*.50):.04+s.x*.50;n.by=mirror?1-s.y:s.y;n.hat=s.hat;n.no=no;n.slot=s.slot;n.diz=formation;
      }
    }
    for (let i=nodes.length-1;i>=0;i--) if (!keep.has(`${nodes[i].kod}|${nodes[i].id}`)) nodes.splice(i,1);
  }
  function resize() {
    if (!state.canvas) return;
    const rect=state.canvas.getBoundingClientRect();
    const w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
    const d=Math.min(2,g.devicePixelRatio||1);
    if (state.width===w && state.height===h && state.dpr===d) return;
    state.width=w;state.height=h;state.dpr=d;
    state.canvas.width=Math.round(w*d);state.canvas.height=Math.round(h*d);
    state.ctx.setTransform(d,0,0,d,0,0);
  }
  function geometry() {
    const pad=Math.max(20,Math.min(state.width,state.height)*.045);
    let w=state.width-pad*2,h=state.height-pad*2;
    if (w/h>PITCH) w=h*PITCH; else h=w/PITCH;
    pitch.x=(state.width-w)/2;pitch.y=(state.height-h)/2;pitch.w=w;pitch.h=h;
    return pitch;
  }
  function drawPitch(ctx,p) {
    const x=p.x,y=p.y,w=p.w,h=p.h;
    if(!state.gradient || state.gradientX!==x || state.gradientY!==y || state.gradientW!==w || state.gradientH!==h){
      state.gradient=ctx.createLinearGradient(x,y,x+w,y+h);
      state.gradient.addColorStop(0,'#14533B');state.gradient.addColorStop(.5,'#123B2A');state.gradient.addColorStop(1,'#0B3325');
      state.gradientX=x;state.gradientY=y;state.gradientW=w;state.gradientH=h;
    }
    ctx.fillStyle=state.gradient;ctx.fillRect(x,y,w,h);
    for(let i=0;i<10;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.025)':'rgba(0,0,0,.065)';ctx.fillRect(x+w*i/10,y,w/10,h);}
    ctx.strokeStyle='rgba(246,255,247,.82)';ctx.lineWidth=Math.max(1.5,w*.002);ctx.strokeRect(x,y,w,h);
    ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w/2,y+h);ctx.stroke();
    ctx.beginPath();ctx.arc(x+w/2,y+h/2,h*.115,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#F4FFF2';ctx.beginPath();ctx.arc(x+w/2,y+h/2,2.4,0,Math.PI*2);ctx.fill();
    for(const side of [0,1]){
      const gx=side?x+w:x,dir=side?-1:1;
      ctx.strokeRect(gx+(side?-w*.165:0),y+h*.21,w*.165,h*.58);
      ctx.strokeRect(gx+(side?-w*.065:0),y+h*.35,w*.065,h*.30);
      ctx.beginPath();ctx.arc(gx+dir*w*.11,y+h/2,2.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(gx+(side?0:-w*.012),y+h*.43,w*.012,h*.14);ctx.fillStyle='#F4FFF2';
    }
  }
  function drawCrowd(ctx,p) {
    const left=p.x-24,right=state.width-(p.x+p.w+24);
    if(left<18)return;
    const key=state.width+'x'+state.height+'x'+Math.round(p.x)+'x'+state.dpr;
    if(state.crowdKey!==key && g.document){
      const c=g.document.createElement('canvas');c.width=Math.round(state.width*state.dpr);c.height=Math.round(state.height*state.dpr);
      const k=c.getContext('2d');k.setTransform(state.dpr,0,0,state.dpr,0,0);
      const step=Math.max(8,Math.round(state.height/46)),colors=['#E30A17','#B80812','#E9EDF0','#F4F5F7','#2A3A31','#FFE40C','#9E0711','#C9CFD3'];
      const sides=[[0,left],[state.width-right,right]];
      let n=0;
      for(const [x0,w] of sides){
        const grad=k.createLinearGradient(x0,0,x0+w,0);
        const inner=x0===0?1:0;
        grad.addColorStop(inner?0:1,'rgba(4,10,7,.92)');grad.addColorStop(inner?1:0,'rgba(10,28,20,.35)');
        k.fillStyle=grad;k.fillRect(x0,0,w,state.height);
        for(let y=step*.6;y<state.height;y+=step){
          const row=Math.round(y/step);
          for(let x=x0+step*.5+(row%2)*step*.5;x<x0+w-2;x+=step){
            n++;const hs=((n*2654435761)>>>0)/4294967296;
            const edge=inner?x/w:1-(x-x0)/w;
            const dim=.28+.62*Math.max(0,Math.min(1,edge));
            k.globalAlpha=dim*(.55+.45*hs);k.fillStyle=colors[Math.floor(hs*colors.length*7.31)%colors.length];
            k.beginPath();k.arc(x,y,step*.26,0,Math.PI*2);k.fill();
          }
        }
        k.globalAlpha=1;
        const shade=k.createLinearGradient(0,0,0,state.height);
        shade.addColorStop(0,'rgba(0,0,0,.55)');shade.addColorStop(.5,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.55)');
        k.fillStyle=shade;k.fillRect(x0,0,w,state.height);
      }
      state.crowd=c;state.crowdKey=key;
    }
    if(!state.crowd)return;
    const goalNow=state.event?.tur==='gol' && !state.reduced && !state.low;
    const bob=state.reduced||state.low?0:(goalNow?Math.sin(state.clock/55)*3.2*Math.max(0,1-state.elapsed/Math.max(1,state.duration)):Math.sin(state.clock/900)*.8);
    ctx.drawImage(state.crowd,0,0,state.crowd.width,state.crowd.height,0,bob,state.width,state.height);
  }
  function drawStands(ctx,p) {
    const excited=state.event?.tur==='gol' && !state.reduced && !state.low;
    const shake=excited?Math.max(0,1-state.elapsed/state.duration)*2.5:0;
    ctx.fillStyle='#19251D';ctx.fillRect(p.x-20,p.y-22,p.w+40,p.h+44);
    ctx.fillStyle='#26372C';ctx.fillRect(p.x-14,p.y-15,p.w+28,p.h+30);
    for(let i=0;i<86;i++){
      const x=p.x+p.w*(i+.5)/86;
      const delta=shake*Math.sin(i*7.17+state.elapsed*.042);
      ctx.fillStyle=i%7===0?'#FFE40C':i%3===0?'#E9675B':'#B9C5B8';
      ctx.fillRect(x,p.y-16+delta,2.7,3.2);
      ctx.fillRect(x,p.y+p.h+12-delta,2.7,3.2);
    }
  }
  function eventProgress() {
    if(!state.event || !state.duration)return 0;
    const p=clamp(state.elapsed/state.duration,0,1);
    if(state.event.tur!=='gol')return p;
    if(p<.50)return p/.50;
    if(p<.63)return 1;
    return (p-.63)/.37;
  }
  function targets(progress) {
    const ev=state.event, attacking=ev?.takimKod;
    if(ev?.tur==='penalti'){
      const right=state.attackRight,side=state.penSide;
      const run=ease(clamp(progress/.30,0,1));
      const dive=ease(clamp((progress-.35)/.35,0,1));
      const spotX=state.startX+(right?-.03:.03);
      const waitingRank={};
      const dx=clamp(48/Math.max(pitch.w,1),.048,.075);
      const dy=clamp(48/Math.max(pitch.h,1),.09,.12);
      for(let i=0;i<state.nodes.length;i++){
        const n=state.nodes[i];
        const shooter=n.kod===attacking&&(n.id===ev.oyuncuId||ev.formaNo!==null&&n.no===ev.formaNo);
        if(shooter){n.tx=clamp(n.bx+(spotX-n.bx)*run,.04,.96);n.ty=clamp(n.by+(.5-n.by)*run,.04,.96);}
        else if(n.kod!==attacking&&n.hat==='KL'){
          n.tx=right?.975:.025;n.ty=.5+(ev.sonuc==='gol'?-side:side)*.05*dive;
          n.tx=clamp(n.tx,.04,.96);n.ty=clamp(n.ty,.04,.96);
        }else{
          const rank=waitingRank[n.kod]||0;waitingRank[n.kod]=rank+1;
          n.tx=clamp(.5+(rank%5-2)*dx,.04,.96);
          n.ty=clamp((n.kod===attacking?.34:.57)+Math.floor(rank/5)*dy,.04,.96);
        }
      }
      return;
    }
    const ballX=ev?state.ballX:state.ambientX,ballY=ev?state.ballY:state.ambientY;
    const amp=state.reduced||state.low?.5:1;
    const raw=ev&&state.duration?clamp(state.elapsed/state.duration,0,1):0;
    const shotScene=(ev?.tur==='sut'||ev?.tur==='gol')&&!state.reduced&&!state.low;
    const shotBallX=state.startX+(state.endX-state.startX)*ease(progress);
    const shotBallY=state.startY+(state.endY-state.startY)*ease(progress);
    let press=shotScene?ease(clamp(raw/.55,0,1)):0;
    if(ev?.tur==='gol'&&raw>=.63)press*=1-ease(clamp((raw-.63)/.2,0,1));
    const supportRun=shotScene?Math.sign(state.endX-state.startX)*.05*ease(clamp(raw/.6,0,1)):0;
    const celeb=ev?.tur==='gol'&&!state.reduced&&!state.low&&raw>=.50&&raw<.63;
    const cx=clamp(state.startX+(state.endX-state.startX)*.7,.04,.96);
    const cy=clamp(state.startY+(state.endY-state.startY)*.7,.04,.96);
    const gather=celeb?ease(clamp((raw-.50)/.06,0,1))*.55:0;
    const ballScene=ev&&(ev.tur==='atak'||ev.tur==='sut'||ev.tur==='gol');
    const sbx=ballScene?shotBallX:ballX,sby=ballScene?shotBallY:ballY;
    const shotMix=shotScene?ease(clamp(raw/.4,0,1)):0;
    const kick=KV()?clamp((state.kickoffUntil-state.ambientTime)/700,0,1):1;
    const shapes={};
    if(KV()&&state.match)for(const kod of [state.match.takimA,state.match.takimB])shapes[kod]=teamShape(kod,sbx,sby,shotMix);
    for(let i=0;i<state.nodes.length;i++){
      const n=state.nodes[i];
      const nodeAmp=n.hat==='KL'?amp*.4:amp;
      const t=shapes[n.kod];
      let px=n.bx,py=n.by;
      if(t){const [sx,sy]=shapeTarget(n,t);px=sx+(n.bx-sx)*kick;py=sy+(n.by-sy)*kick;}
      n.tx=clamp(px+Math.sin(state.clock/1100+i*1.9)*.012*nodeAmp,.03,.97);
      n.ty=clamp(py+Math.cos(state.clock/1300+i*1.3)*.016*nodeAmp,.04,.96);
      if(ev && (ev.tur==='sut'||ev.tur==='gol'||ev.tur==='atak') && (n.id===ev.oyuncuId || n.no===ev.formaNo && ev.formaNo!==null && n.kod===ev.takimKod)){
        n.tx=clamp(state.startX+(state.endX-state.startX)*Math.min(progress,.7),.04,.96);
        n.ty=clamp(state.startY+(state.endY-state.startY)*Math.min(progress,.7),.04,.96);
      }
      if(shotScene&&n.kod!==attacking&&n.hat!=='KL'){
        n.tx=clamp(n.tx+(shotBallX-n.tx)*.22*press,.04,.96);
        n.ty=clamp(n.ty+(shotBallY-n.ty)*.14*press,.04,.96);
      }
      if(shotScene&&state.supportIds.includes(`${n.kod}|${n.id}`)){
        n.tx=clamp(n.tx+supportRun,.04,.96);
      }
      if(celeb&&n.kod===attacking&&n.id!==ev.oyuncuId&&!(ev.formaNo!==null&&n.no===ev.formaNo)){
        n.tx=clamp(n.tx+(cx-n.tx)*gather,.04,.96);
        n.ty=clamp(n.ty+(cy-n.ty)*gather,.04,.96);
      }
    }
  }
  function drawTrail(ctx,p,progress) {
    const ev=state.event;if(!ev || !['atak','sut','gol','penalti'].includes(ev.tur))return;
    if(ev.tur==='penalti')progress=ease(clamp((progress-.30)/.45,0,1));
    const x1=p.x+p.w*state.startX,y1=p.y+p.h*state.startY,x2=p.x+p.w*state.endX,y2=p.y+p.h*state.endY;
    ctx.save();ctx.lineCap='round';ctx.setLineDash(ev.tur==='atak'?DASH:SOLID);
    if(ev.tur==='sut' || ev.tur==='gol'){
      let mate=null,best=Infinity;
      for(let i=0;i<state.nodes.length;i++){
        const n=state.nodes[i];if(n.kod!==ev.takimKod || n.id===ev.oyuncuId || ev.formaNo!=null && n.no===ev.formaNo)continue;
        const dx=n.x-state.startX,dy=n.y-state.startY,d=dx*dx+dy*dy;
        if(d<best){best=d;mate=n;}
      }
      if(mate){
        ctx.setLineDash(DASH);ctx.strokeStyle='rgba(255,228,12,.7)';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(p.x+p.w*mate.x,p.y+p.h*mate.y);ctx.lineTo(x1,y1);ctx.stroke();ctx.setLineDash(SOLID);
      }
    }
    ctx.strokeStyle=ev.tur==='gol'?'rgba(255,228,12,.95)':ev.tur==='sut'?'rgba(255,255,255,.9)':'rgba(255,228,12,.66)';
    ctx.lineWidth=ev.tur==='gol'?4:2.5;ctx.shadowColor=ev.tur==='gol'?'#FFE40C':'#FFFFFF';ctx.shadowBlur=15;
    ctx.beginPath();ctx.moveTo(x1,y1);const xm=x1+(x2-x1)*progress,ym=y1+(y2-y1)*progress;
    ctx.quadraticCurveTo((x1+xm)/2,(y1+ym)/2-p.h*.11*progress,xm,ym);ctx.stroke();ctx.restore();
  }
  function badgeR(p){return clamp(p.w*.026,15,20);}
  function drawPlayers(ctx,p,dt) {
    const radius=badgeR(p), alpha=clamp(dt/125,0,.25);
    const ev=state.event,raw=ev&&state.duration?state.elapsed/state.duration:0;
    ctx.textAlign='center';ctx.textBaseline='middle';
    for(let i=0;i<state.nodes.length;i++){
      const n=state.nodes[i];n.x+=(n.tx-n.x)*alpha;n.y+=(n.ty-n.y)*alpha;
      const x=p.x+p.w*n.x,y=p.y+p.h*n.y;
      ctx.beginPath();ctx.ellipse(x,y+radius*.95,radius*.88,radius*.35,0,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,.33)';ctx.fill();
      ctx.shadowColor=n.kod==='TUR'?'rgba(227,10,23,.8)':'rgba(255,255,255,.45)';ctx.shadowBlur=12;
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle=kodColor(n.kod,state.match);ctx.fill();ctx.shadowBlur=0;
      ctx.strokeStyle=n.kod==='TUR'?'#FFF6F4':'#111923';ctx.lineWidth=2;ctx.stroke();
      let label=n.no;
      if(n.kod==='TUR') label=MT.veri.oyuncu(n.id)?.rozet||'TR';
      let fontSize=Math.max(12,radius*.72);
      ctx.font=`800 ${fontSize}px Sora, sans-serif`;
      const labelWidth=ctx.measureText(String(label)).width;
      if(labelWidth>radius*1.7){
        fontSize=Math.max(12,fontSize*radius*1.7/labelWidth);
        ctx.font=`800 ${fontSize}px Sora, sans-serif`;
      }
      ctx.fillStyle=rgbText(n.kod);ctx.fillText(label,x,y+1,radius*1.7);
      if(ev?.tur==='gol'&&raw>=.45&&!state.reduced&&!state.low&&n.kod===ev.takimKod&&
        (n.id===ev.oyuncuId||ev.formaNo!=null&&n.no===ev.formaNo)){
        ctx.save();ctx.globalAlpha=.55+.45*Math.sin(state.clock/180);
        ctx.strokeStyle='#FFE40C';ctx.lineWidth=3;ctx.shadowColor='#FFE40C';ctx.shadowBlur=14;
        ctx.beginPath();ctx.arc(x,y,radius+5,0,Math.PI*2);ctx.stroke();ctx.restore();
      }
    }
  }
  function drawBall(ctx,p,progress) {
    let x=state.event?state.ballX:state.ambientX,y=state.event?state.ballY:state.ambientY,arc=0;
    if(state.event && ['atak','sut','gol','penalti'].includes(state.event.tur)){
      const t=ease(state.event.tur==='penalti'?clamp((progress-.30)/.45,0,1):progress);
      x=state.startX+(state.endX-state.startX)*t;y=state.startY+(state.endY-state.startY)*t;
      arc=Math.sin(Math.PI*t)*(state.event.tur==='atak'?.018:.07);
    }
    const px=p.x+p.w*x,py=p.y+p.h*y,r=clamp(p.w*.011,7,11);
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(px,py+r*.9,r*1.15,r*.4,0,0,Math.PI*2);ctx.fill();
    ctx.shadowColor='#FFE40C';ctx.shadowBlur=r*2.4;ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(px,py-arc*p.h,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#222';ctx.beginPath();ctx.arc(px,py-arc*p.h,r*.34,0,Math.PI*2);ctx.fill();
  }
  function drawNet(ctx,p,progress) {
    if(state.netWave<=0)return;
    const right=state.endX>.5,gx=right?p.x+p.w:p.x,dir=right?1:-1;
    ctx.save();ctx.strokeStyle=`rgba(255,255,255,${Math.min(.8,state.netWave*.8)})`;ctx.lineWidth=1.4;
    for(let i=0;i<7;i++){
      const yy=p.y+p.h*(.43+i*.14/6),wave=Math.sin(progress*24+i*.9)*state.netWave*p.w*.012;
      ctx.beginPath();ctx.moveTo(gx,yy);ctx.quadraticCurveTo(gx+dir*(p.w*.02+wave),yy+wave,gx+dir*p.w*.035,yy);ctx.stroke();
    }
    ctx.restore();
  }
  function particlesInit() {
    state.particleCount=state.reduced||state.low?0:Math.min(40,MT.veri?.SABITLER?.golEfekt?.parcacik||40);
    for(let i=0;i<state.particleCount;i++){
      const j=i*5;const phase=(i*2.399963229728653)%6.283185307;
      state.particles[j]=state.endX;state.particles[j+1]=state.endY;
      state.particles[j+2]=Math.cos(phase)*(.09+(i%5)*.012);
      state.particles[j+3]=Math.sin(phase)*(.09+(i%7)*.012);
      state.particles[j+4]=1;
    }
  }
  function drawParticles(ctx,p,dt) {
    if(!state.particleCount)return;
    if(state.event?.tur==='penalti'&&eventProgress()<.75)return;
    for(let i=0;i<state.particleCount;i++){
      const j=i*5,q=state.particles;q[j]+=q[j+2]*dt/1000;q[j+1]+=q[j+3]*dt/1000;q[j+4]-=dt/1100;
      if(q[j+4]<=0)continue;
      const x=p.x+p.w*q[j],y=p.y+p.h*q[j+1];ctx.globalAlpha=q[j+4];ctx.fillStyle=i%3?'#FFE40C':'#FFFFFF';ctx.fillRect(x,y,3.5,3.5);
    }
    ctx.globalAlpha=1;
  }
  function kickoff(team){
    state.kickoffUntil=state.ambientTime+SANTRA_MS;state.nextTeam=team;state.chain=null;
    state.ambientX=.5;state.ambientY=.5;state.ballX=.5;state.ballY=.5;
  }
  // Gerçek maçlardan alınmış bir atak zinciri seç: başlangıcı topun şu anki yerine en yakın 10 zincirden biri.
  function startChain(team){
    const kv=KV();if(!kv||!team)return;
    const mirror=teamMirror(team),bx=mirror?1-state.ambientX:state.ambientX,by=mirror?1-state.ambientY:state.ambientY;
    const no=++state.chainNo;
    const near=kv.zincirler.map((c,i)=>[(c[0][0]-bx)**2+(c[0][1]-by)**2,i]).sort((a,b)=>a[0]-b[0]).slice(0,10);
    const h=MT.yardim?.hash32?.(state.match?.tohum||0,state.match?.fiksturNo||0,'zincir',no)??no;
    const c=kv.zincirler[near[h%near.length][1]];
    state.chain=c;state.chainMirror=mirror;state.chainAt=state.ambientTime;state.chainOx=bx-c[0][0];state.chainOy=by-c[0][1];
    if(state.poss!==team){state.poss=team;state.possAt=state.ambientTime;}
  }
  function updateAmbient(dt) {
    if(state.event || !KV())return;
    state.ambientTime+=dt||0;
    if(state.ambientTime<state.kickoffUntil){state.ambientX=.5;state.ambientY=.5;return;}
    if(!state.chain)startChain(state.nextTeam||state.poss||state.match?.takimA);
    const c=state.chain;if(!c)return;
    const step=ADIM_MS*(MT.veri?.SABITLER?.hizSahneCarpani?.[state.hiz]??1)/(hocaOf(state.poss)?.tempo||1);
    const f=(state.ambientTime-state.chainAt)/step,i=Math.floor(f);
    if(i>=c.length-1){state.chain=null;state.nextTeam=otherTeam(state.poss);return;}
    const t=f-i,fade=1-clamp(f/6,0,1);
    const x=clamp(c[i][0]+(c[i+1][0]-c[i][0])*t+state.chainOx*fade,.01,.99);
    const y=clamp(c[i][1]+(c[i+1][1]-c[i][1])*t+state.chainOy*fade,.02,.98);
    state.ambientX=state.chainMirror?1-x:x;state.ambientY=state.chainMirror?1-y:y;
  }
  function drawEventBadge(ctx,p) {
    const ev=state.event;
    if(!ev || !['sari','kirmizi','sakatlik'].includes(ev.tur))return;
    const n=state.nodes.find(x=>x.kod===ev.takimKod && (ev.takimKod==='TUR'?x.id===ev.oyuncuId:x.no===ev.formaNo));
    if(!n)return;
    const x=p.x+p.w*n.x,y=p.y+p.h*n.y,r=badgeR(p),progress=clamp(state.elapsed/state.duration,0,1);
    const color=ev.tur==='sari'?'#FFE40C':ev.tur==='kirmizi'?'#E30A17':'#FFBD59';
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2;
    if(ev.tur==='sakatlik'){
      if(!state.reduced&&!state.low)for(let i=0;i<2;i++){
        const wave=(progress*2+i*.5)%1;
        ctx.globalAlpha=1-wave;ctx.beginPath();ctx.arc(x,y,r+wave*r*1.8,0,Math.PI*2);ctx.stroke();
      }
      ctx.globalAlpha=1;ctx.beginPath();ctx.arc(x,y,r+4,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#FFFFFF';ctx.font=`900 ${Math.max(18,r*1.3)}px Sora, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('+',x,y-r-19);
    }else{
      ctx.beginPath();ctx.arc(x,y,r+4,0,Math.PI*2);ctx.stroke();
      const slide=state.reduced||state.low?0:40*(1-ease(clamp(progress/.25,0,1)));
      const w=r*1.2,h=w*1.35,cy=y-r-23-slide;
      ctx.shadowColor=color;ctx.shadowBlur=14;ctx.fillStyle=color;ctx.fillRect(x-w/2,cy-h/2,w,h);
      ctx.shadowBlur=0;ctx.strokeStyle='rgba(0,0,0,.48)';ctx.strokeRect(x-w/2,cy-h/2,w,h);
    }
    ctx.restore();
  }
  function bandHeight(){return clamp(state.height*.16,72,104);}
  function drawGoalBand(ctx) {
    const ev=state.event,bandH=bandHeight(),w=state.width;
    const color=ev.takimKod==='TUR'?'#E30A17':ev.takimKod==='ITA'?'#0878BB':'#58626E';
    ctx.save();
    if(!state.reduced&&!state.low)ctx.translate(0,-(1-ease(clamp(state.elapsed/220,0,1)))*bandH);
    ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(0,0,w,bandH);
    const teamGradient=ctx.createLinearGradient(0,0,w*.62,0);
    teamGradient.addColorStop(0,color);teamGradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=.88;ctx.fillStyle=teamGradient;ctx.fillRect(0,0,w,bandH);ctx.globalAlpha=1;
    ctx.fillStyle='#FFE40C';ctx.fillRect(0,bandH-3,w,3);
    const gradient=ctx.createLinearGradient(w/2-105,0,w/2+105,0);gradient.addColorStop(0,'#FFE40C');gradient.addColorStop(1,'#F2982D');
    const pop=state.reduced||state.low?1:1+.45*(1-ease(clamp(state.elapsed/260,0,1)));
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.translate(w/2,bandH*.35);ctx.scale(pop,pop);
    ctx.font=`900 ${clamp(bandH*.55,40,64)}px Sora, sans-serif`;ctx.lineWidth=6;ctx.strokeStyle='#10110A';ctx.strokeText('GOL!',0,0);
    ctx.fillStyle=gradient;ctx.fillText('GOL!',0,0);ctx.restore();
    let subtitle;
    if(ev.takimKod==='TUR') subtitle=`KURGU · ${ev.dakika}′ ${MT.veri.oyuncu(ev.oyuncuId)?.kisaAd||'Türkiye'}`;
    else subtitle=`${MT.veri.takim(ev.takimKod)?.ad||ev.takimKod} · ${ev.formaNo} numara`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#FFFFFF';ctx.font='700 18px Sora, sans-serif';
    ctx.fillText(subtitle,w/2,bandH*.75);
    if(state.elapsed/state.duration>.63){
      ctx.font='800 14px Sora, sans-serif';ctx.fillStyle='#FFE40C';ctx.fillText('TEKRAR',w-60,bandH*.5);
    }
    ctx.restore();
  }
  function render(dt) {
    if(!state.ctx)return;
    resize();const ctx=state.ctx,p=geometry(), progress=eventProgress();updateAmbient(dt);
    ctx.clearRect(0,0,state.width,state.height);
    ctx.fillStyle='#0C2B20';ctx.fillRect(0,0,state.width,state.height);
    for(let i=0;i<12;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.018)':'rgba(0,0,0,.055)';ctx.fillRect(state.width*i/12,0,state.width/12,state.height);}
    drawCrowd(ctx,p);
    const vignette=ctx.createRadialGradient(state.width/2,state.height/2,state.height*.2,state.width/2,state.height/2,state.width*.7);
    vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.58)');ctx.fillStyle=vignette;ctx.fillRect(0,0,state.width,state.height);
    const goal=state.event?.tur==='gol';
    const netGoal=goal||state.event?.tur==='penalti'&&state.event.sonuc==='gol';
    ctx.save();
    if(goal){const bandH=bandHeight();ctx.beginPath();ctx.rect(0,bandH,state.width,state.height-bandH);ctx.clip();}
    if(goal && !state.reduced && !state.low && state.elapsed<650){
      const amp=(MT.veri?.SABITLER?.golEfekt?.sarsintiPx||3)*(1-state.elapsed/650);
      ctx.translate(Math.sin(state.elapsed*.15)*amp,Math.cos(state.elapsed*.19)*amp);
    }
    const camera=MT.veri?.SABITLER?.kamera;
    const target=state.event?.tur==='gol'?camera?.gol:state.event?.tur==='penalti'?camera?.net:state.event?.sutTipi==='net'?camera?.net:state.event?.tur==='sut'||state.event?.tur==='atak'?camera?.atak:camera?.normal;
    const ev=state.event,raw=ev&&state.duration?clamp(state.elapsed/state.duration,0,1):0;
    const isGol=ev?.tur==='gol',q=isGol?(raw<.63?raw/.63:(raw-.63)/.37):raw;
    // Golün kısa tekrar bölümünde de kareler arası zoom adımı yumuşak kalsın.
    const kin=isGol?(raw<.63?.18:.27):.20;
    const kout=isGol?(raw<.63?.82:.73):.85;
    const camK=q<kin?ease(q/kin):q>kout?1-ease((q-kout)/(1-kout)):1;
    const zoom=state.reduced||state.low?1:1+((target||100)/100-1)*camK;
    if(zoom>1.001){
      const bx=state.startX+(state.endX-state.startX)*ease(progress),by=state.startY+(state.endY-state.startY)*ease(progress);
      let focusX=state.width/2+(bx-.5)*p.w*.48,focusY=state.height/2+(by-.5)*p.h*.48;
      const hw=state.width/(2*zoom),hh=state.height/(2*zoom);
      const cl=(f,lo,hi,mid)=>lo<=hi?clamp(f,lo,hi):mid;
      focusX=cl(focusX,p.x+hw,p.x+p.w-hw,p.x+p.w/2);
      focusY=cl(focusY,p.y+hh,p.y+p.h-hh,p.y+p.h/2);
      if(state.camX===null || state.camY===null){state.camX=focusX;state.camY=focusY;}
      else{const follow=clamp(dt/160,0,1);state.camX+=(focusX-state.camX)*follow;state.camY+=(focusY-state.camY)*follow;}
      state.camX=cl(state.camX,p.x+hw,p.x+p.w-hw,p.x+p.w/2);
      state.camY=cl(state.camY,p.y+hh,p.y+p.h-hh,p.y+p.h/2);
      ctx.translate(state.width/2,state.height/2);ctx.scale(zoom,zoom);ctx.translate(-state.camX,-state.camY);
    }else{state.camX=null;state.camY=null;}
    drawStands(ctx,p);drawPitch(ctx,p);
    targets(progress);drawTrail(ctx,p,progress);drawPlayers(ctx,p,dt);drawBall(ctx,p,progress);drawEventBadge(ctx,p);
    if(netGoal)drawNet(ctx,p,progress);
    drawParticles(ctx,p,dt);
    ctx.restore();
    if(goal && !state.reduced && !state.low && state.elapsed<Math.min(150,MT.veri?.SABITLER?.golEfekt?.flasMs||150)){
      const tint=state.event.takimKod==='TUR'?'227,10,23':state.event.takimKod==='ITA'?'8,120,187':'246,248,250';
      ctx.fillStyle=`rgba(${tint},${.38*(1-state.elapsed/150)})`;ctx.fillRect(0,0,state.width,state.height);
    }
    if(goal)drawGoalBand(ctx);
    ctx.save();ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.font='700 14px Sora, sans-serif';
    ctx.fillStyle='rgba(255,228,12,.75)';ctx.fillText('KURGU MAÇ',14,state.height-14);ctx.restore();
  }
  function settle(result) {
    const resolve=state.resolve,ev=state.event,lastTeam=ev?.takimKod;state.resolve=null;state.event=null;state.elapsed=0;state.duration=0;state.skip=false;state.particleCount=0;state.netWave=0;
    if(lastTeam)state.lastTeam=lastTeam;
    state.supportIds=[];
    if(ev&&['atak','sut','gol','penalti'].includes(ev.tur)){
      state.ballX=state.endX;state.ballY=state.endY;state.ambientX=state.ballX;state.ambientY=state.ballY;state.chain=null;
      // Şuttan sonra top rakibe geçer (aut, kaleci); golden sonra yiyen takım santra yapar.
      if(ev.tur==='gol'||ev.tur==='penalti'&&ev.sonuc==='gol')kickoff(otherTeam(lastTeam));
      else state.nextTeam=ev.tur==='atak'?lastTeam:otherTeam(lastTeam);
    }
    if(resolve)resolve(result);
  }
  function tick(now) {
    state.raf=g.requestAnimationFrame(tick);
    let dt=state.prev?Math.min(100,Math.max(0,now-state.prev)):16.67;state.prev=now;
    if(state.paused || state.hidden)dt=0;
    else state.clock+=dt;
    if(state.event && dt){
      state.elapsed=Math.min(state.duration,state.elapsed+dt);
      const netGoal=state.event.tur==='gol'||state.event.tur==='penalti'&&state.event.sonuc==='gol';
      const raw=state.elapsed/state.duration;
      state.netWave=netGoal?(state.event.tur==='penalti'?(raw<.70?0:raw<.78?ease((raw-.70)/.08):1-ease(clamp((raw-.78)/.22,0,1))):Math.max(0,1-raw)):0;
      if(state.elapsed>=state.duration){ render(dt);settle('tamam');return; }
    }
    render(dt);
  }
  function baslat(canvas, options) {
    const initialMatch=canvas && canvas.takimA ? canvas : options?.mac;
    if(canvas && !canvas.getContext && typeof canvas==='object'){options=canvas;canvas=null;}
    canvas=canvas?.getContext?canvas:(g.document?.getElementById('match-canvas')||null);
    if(!canvas)return;
    if(state.canvas && state.canvas!==canvas)yokEt();
    state.canvas=canvas;state.ctx=canvas.getContext('2d',{alpha:false});
    state.gradient=null;
    state.reduced=!!g.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    state.low=!!(options?.dusukEfekt||options?.lowEffects);
    state.hidden=!!g.document?.hidden;
    state.paused=false;
    state.supportIds=[];
    state.camX=null;state.camY=null;
    if(initialMatch){state.match=initialMatch;syncNodes(initialMatch);}
    if(!state.raf)state.raf=g.requestAnimationFrame(tick);
    resize();
  }
  function yerlesim(match, options) {
    if(!state.canvas)baslat();
    if(match && match.takimA){state.match=match;syncNodes(match);}
    if(options)state.low=!!(options.dusukEfekt||options.lowEffects);
    resize();render(0);
  }
  function choosePath(ev,m) {
    state.supportIds=[];
    const fromA=ev.takimKod===m?.takimA;
    const attackingRight=m?.takimA==='TUR'||m?.takimB==='TUR'?ev.takimKod==='TUR':fromA;
    state.attackRight=attackingRight;
    if(['atak','sut','gol'].includes(ev.tur)&&state.poss!==ev.takimKod){state.poss=ev.takimKod;state.possAt=state.ambientTime;}
    if(!['atak','sut','gol','penalti'].includes(ev.tur)){state.startX=state.endX=state.ballX=state.ambientX;state.startY=state.endY=state.ballY=state.ambientY;return;}
    if(ev.tur==='penalti'){
      const side=Math.floor((ev.zarlar?.zar||0)*1e6)%2?1:-1;
      state.penSide=side;
      state.startX=attackingRight?.895:.105;state.startY=.5;
      state.endX=attackingRight?.985:.015;
      state.endY=.5+side*(ev.sonuc==='gol'?.04:.085);
      if(ev.sonuc==='gol'){state.netWave=1;particlesInit();}
      return;
    }
    const shooter=state.nodes.find(n=>n.kod===ev.takimKod && (n.id===ev.oyuncuId || ev.formaNo!=null && n.no===ev.formaNo));
    state.startX=shooter?shooter.x:(attackingRight?.60:.40);
    state.startY=shooter?shooter.y:(.25+(ev.sunumVaryanti||0)*.16);
    // Şut/gol rakip yarıdan çıkar: vuran oyuncu gerideyse (ör. stoper) vuruş noktası ceza sahası önüne alınır.
    if(ev.tur==='sut'||ev.tur==='gol'){
      const depth=attackingRight?state.startX:1-state.startX;
      if(depth<.70){const d=.72+((ev.sunumVaryanti||0)%3)*.05;state.startX=attackingRight?d:1-d;state.startY=clamp(.5+(state.startY-.5)*.6,.2,.8);}
    }
    const tip=ev.sutTipi;
    state.endX=ev.tur==='atak'?(attackingRight?.73:.27):(attackingRight?.985:.015);
    state.endY=ev.tur==='atak'?clamp(state.startY+((ev.sunumVaryanti||0)%2?-.14:.14),.12,.88):tip==='uzak'?.40:tip==='net'?.51:.58;
    if(ev.tur==='gol') {state.endY=.50;state.netWave=1;particlesInit();}
    if(ev.tur==='sut')state.lastShot={...ev};
    if(ev.tur==='gol' && state.lastShot?.dakika===ev.dakika && state.lastShot?.takimKod===ev.takimKod){
      state.startX=attackingRight?.72:.28;state.startY=state.lastShot.sutTipi==='uzak'?.40:.5;
    }
    if(ev.tur==='sut'||ev.tur==='gol'){
      state.supportIds=state.nodes.filter(n=>n.kod===ev.takimKod&&
        !(n.id===ev.oyuncuId||ev.formaNo!=null&&n.no===ev.formaNo))
        .sort((a,b)=>{
          const da=(a.x-state.startX)**2+(a.y-state.startY)**2;
          const db=(b.x-state.startX)**2+(b.y-state.startY)**2;
          return da-db||a.id.localeCompare(b.id);
        }).slice(0,2).map(n=>`${n.kod}|${n.id}`);
    }
  }
  function oynat(ev, match, options) {
    if(!state.canvas)baslat();
    if(!state.canvas)return Promise.resolve('iptal');
    if(state.resolve)settle('iptal');
    if(match && match.takimA){state.match=match;syncNodes(match);} else if(match && !options){options=match;}
    if(options?.mac?.takimA){state.match=options.mac;syncNodes(options.mac);}
    const m=state.match;
    if(!ev)return Promise.resolve('tamam');
    const c=MT.veri?.SABITLER, base=ev.tur==='sut'&&ev.sutTipi==='net'?c?.sahneMs?.net:c?.sahneMs?.[ev.tur];
    let duration=options?.sureMs??options?.duration??base??0;
    const speed=options?.hiz||1;state.hiz=speed;
    duration*=c?.hizSahneCarpani?.[speed]??1;
    if(ev.tur==='gol')duration=Math.max(c?.minGolSahnesiMs||1500,duration);
    if(state.reduced||state.low)duration=Math.min(duration,ev.tur==='gol'?1500:500);
    if(duration<=0)return Promise.resolve('tamam');
    state.event=ev;state.elapsed=0;state.duration=duration;state.prev=0;choosePath(ev,m);
    return new Promise(resolve=>{state.resolve=resolve;});
  }
  function duraklat(){state.paused=true;}
  function surdur(){state.paused=false;state.prev=0;}
  function hizAyarla(eski,yeni){
    if(!state.resolve || !state.duration)return;
    const carp=MT.veri?.SABITLER?.hizSahneCarpani || {};
    if(!carp[eski] || !carp[yeni])return;
    const kalan=Math.max(0,state.duration-state.elapsed)*carp[yeni]/carp[eski];
    state.duration=state.elapsed+kalan;
  }
  function atla(){if(state.resolve)state.duration=Math.min(state.duration,state.elapsed+(MT.veri?.SABITLER?.atlaAzamiMs||500));}
  function yokEt(){
    if(state.raf){g.cancelAnimationFrame(state.raf);state.raf=0;}
    if(state.resolve)settle('iptal');
    state.nodes.length=0;state.match=null;state.canvas=null;state.ctx=null;state.gradient=null;state.prev=0;
    state.clock=0;state.passStep=-1;state.lastTeam=null;state.ballX=.5;state.ballY=.5;state.ambientX=.5;state.ambientY=.5;
    state.camX=null;state.camY=null;
    state.supportIds=[];
    state.ambientTime=0;state.poss=null;state.possAt=-1e9;state.nextTeam=null;state.chain=null;state.chainNo=0;state.kickoffUntil=0;
  }
  if(g.document)g.document.addEventListener('visibilitychange',()=>{state.hidden=g.document.hidden;if(state.hidden)state.paused=true;state.prev=0;});
  MT.saha={baslat,yerlesim,oynat,duraklat,surdur,hizAyarla,atla,yokEt};
})(typeof window!=='undefined'?window:globalThis);
