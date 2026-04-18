(function(){
  const canvas=document.getElementById("particles-canvas"); if(!canvas) return;
  const ctx=canvas.getContext("2d"), dpr=Math.min(window.devicePixelRatio||1,2);
  let W=0,H=0, particles=[], raf=0, cursor={x:-9999,y:-9999};
  const conf={densityBase:.0001,maxSpeed:.35,size:[1.2,2.4],linkDist:110,linkAlpha:.12};

  function rand(a,b){return a+Math.random()*(b-a)}
  function resize(){
    const w=window.innerWidth, h=window.innerHeight;
    W=canvas.width=Math.floor(w*dpr); H=canvas.height=Math.floor(h*dpr);
    canvas.style.width=w+"px"; canvas.style.height=h+"px";
    const n=Math.floor(W*H*conf.densityBase/(dpr*dpr));
    particles.length=0;
    for(let i=0;i<n;i++){
      particles.push({x:Math.random()*W,y:Math.random()*H,vx:rand(-conf.maxSpeed,conf.maxSpeed),vy:rand(-conf.maxSpeed,conf.maxSpeed),r:rand(conf.size[0],conf.size[1])*dpr});
    }
  }
  function step(){
    ctx.clearRect(0,0,W,H);
    for(const p of particles){
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0||p.x>W) p.vx*=-1;
      if(p.y<0||p.y>H) p.vy*=-1;
      const dx=p.x-cursor.x, dy=p.y-cursor.y, dd=dx*dx+dy*dy;
      if(dd<19600*dpr*dpr){const ax=-.0008*dx; p.vx+=ax*dx; p.vy+=ax*dy;}
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,2*Math.PI); ctx.fillStyle="rgba(255,255,255,0.6)"; ctx.fill();
    }
    for(let i=0;i<particles.length;i++){
      const a=particles[i];
      for(let j=i+1;j<particles.length;j++){
        const b=particles[j], dx=a.x-b.x, dy=a.y-b.y, d=Math.hypot(dx,dy);
        if(d<conf.linkDist*dpr){
          const alpha=(1-d/(conf.linkDist*dpr))*conf.linkAlpha;
          ctx.strokeStyle=`rgba(${window.themeRGB || '0, 229, 255'},${alpha})`; ctx.lineWidth=.7*dpr;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    raf=requestAnimationFrame(step);
  }
  function move(e){
    if(e.touches&&e.touches[0]){cursor.x=e.touches[0].clientX*dpr; cursor.y=e.touches[0].clientY*dpr;}
    else{cursor.x=(e.clientX??-9999)*dpr; cursor.y=(e.clientY??-9999)*dpr;}
  }
  function leave(){cursor.x=cursor.y=-9999}

  window.addEventListener("resize",resize,{passive:true});
  window.addEventListener("mousemove",move,{passive:true});
  window.addEventListener("touchmove",move,{passive:true});
  window.addEventListener("mouseleave",leave,{passive:true});
  resize(); cancelAnimationFrame(raf); raf=requestAnimationFrame(step);
})();

document.addEventListener("DOMContentLoaded",function(){
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  const configToggle=$("#config-toggle"), luxToggle=$("#lux-toggle"), modeSelect=$("#mode-select"), dpiSelect=$("#dpi-select");
  const fixRungToggle=$("#fix-rung-toggle"), nheTamToggle=$("#nhe-tam-toggle"), lockDauToggle=$("#lock-dau-toggle");
  const cnMasterToggle=$("#cn-master-toggle"), antiRungProToggle=$("#anti-rung-pro"), aimAssistPlusToggle=$("#aim-assist-plus");

  const store={
    get(k,def){try{const v=localStorage.getItem(k);return v===null?def:JSON.parse(v)}catch(e){return def}},
    set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
  };

  const RETICLE_CLASS="hide-center-reticle";
  function ensureReticleStyle(){
    if(document.getElementById("reticle-style")) return;
    const style=document.createElement("style"); style.id="reticle-style";
    style.textContent="."+RETICLE_CLASS+" #ui_center_lock_nudge{display:none!important;}";
    document.head.appendChild(style);
  }
  let reticleObserver=null;
  
  function hideCenterReticleFallback(){
    const el=document.getElementById("ui_center_lock_nudge");
    if(el){el.style.display="none"; return;}
    
    const cx=window.innerWidth/2, cy=window.innerHeight/2;
    document.querySelectorAll("body *").forEach((node)=>{
      if(!(node instanceof HTMLElement)) return;
      if(node.closest('#main-panel, #home-intro, #vgGate, #login-loading-modal, #cyber-booster-modal, #aimlock-modal, .action-toast, aside, nav, header')) return;
      if(node.id === "space-canvas" || node.id === "particles-canvas" || node.classList.contains("dynamic-bg") || node.id === "virtual-crosshair") return;
      
      const rect=node.getBoundingClientRect();
      if(rect.width>80||rect.height>80||rect.width<4||rect.height<4) return;
      const dx=Math.abs((rect.left+rect.width/2)-cx);
      const dy=Math.abs((rect.top+rect.height/2)-cy);
      if(dx>3||dy>3) return;
      const cs=getComputedStyle(node);
      if(cs.position!=="fixed"&&cs.position!=="absolute") return;
      node.style.display="none";
    });
  }
  
  function setCenterReticleHidden(on){
    ensureReticleStyle(); document.body.classList.toggle(RETICLE_CLASS,!!on);
    if(on){
      hideCenterReticleFallback();
      if(!reticleObserver){
        reticleObserver=new MutationObserver(()=>hideCenterReticleFallback());
        reticleObserver.observe(document.body,{childList:true,subtree:true});
      }
    }else if(reticleObserver){ reticleObserver.disconnect(); reticleObserver=null; }
  }

  function reflect(){
    $$(".toggle-input").forEach(input => {
      const card = input.closest(".horizontal-card") || input.closest(".func-card");
      if(card) { if(input.checked) { card.classList.add("active-card"); } else { card.classList.remove("active-card"); } }
    });
  }
  
  function runAction(key,on){
    const actions=window.PanelActions||{}; const entry=actions[key];
    if(!entry) return; const fn=on?entry.on:entry.off;
    if(typeof fn==="function") fn();
  }
  
  function applyMode(v){document.body.dataset.mode=v}
  function applyDpi(v){document.body.dataset.dpi=v}

  function restore(){
    const ce=store.get("config-enabled",false), le=store.get("lux-enabled",false), m=store.get("mode","muot-ma"), d=store.get("dpi","1.0");
    const fr=store.get("fix-rung-enabled",false), nt=store.get("nhe-tam-enabled",false), ld=store.get("lock-dau-enabled",false);
    const cm=store.get("cn-master-enabled",false), ar=store.get("anti-rung-pro-enabled",false), ap=store.get("aim-assist-plus-enabled",false);
    
    if(configToggle) configToggle.checked=!!ce; if(luxToggle) luxToggle.checked=!!le; if(fixRungToggle) fixRungToggle.checked=!!fr;
    if(nheTamToggle) nheTamToggle.checked=!!nt; if(lockDauToggle) lockDauToggle.checked=!!ld;
    if(cnMasterToggle) cnMasterToggle.checked=!!cm; if(antiRungProToggle) antiRungProToggle.checked=!!ar; if(aimAssistPlusToggle) aimAssistPlusToggle.checked=!!ap;
    
    applyMode(m); applyDpi(d); reflect();
    if(configToggle) runAction("config",configToggle.checked); if(luxToggle) runAction("lux",luxToggle.checked);
    if(fixRungToggle) runAction("fixRung",fixRungToggle.checked); if(nheTamToggle) runAction("nheTam",nheTamToggle.checked);
    if(lockDauToggle) runAction("lockDau",lockDauToggle.checked); if(nheTamToggle) setCenterReticleHidden(nheTamToggle.checked);
  }

  $$(".toggle-input").forEach(input=>{ 
      input.addEventListener("change", (e) => {
          reflect();
          const id = e.target.id;
          if(id && id !== 'crosshair-toggle') {
              store.set(id.replace('-toggle', '-enabled').replace('-pro', '-pro-enabled'), e.target.checked);
          }
      }); 
  });
  
  restore();
});

// LOGIC SYSTEM MONITOR (4 BIỂU ĐỒ)
(function(){
  const $=(id)=>document.getElementById(id);
  const consoleEl=$("cm-console");
  
  const cpuCanvas=$("cm-cpu-canvas"); const ramCanvas=$("cm-ram-canvas");
  const gpuCanvas=$("cm-gpu-canvas"); const pingCanvas=$("cm-ping-canvas");
  
  const cpuCtx=cpuCanvas?cpuCanvas.getContext("2d"):null; const ramCtx=ramCanvas?ramCanvas.getContext("2d"):null;
  const gpuCtx=gpuCanvas?gpuCanvas.getContext("2d"):null; const pingCtx=pingCanvas?pingCanvas.getContext("2d"):null;
  
  const hasPerfMem=!!(performance&&performance.memory&&performance.memory.usedJSHeapSize);
  if($("cm-ram-src")) $("cm-ram-src").textContent="Auto";

  function fmtMB(bytes){
    if(typeof bytes!=="number"||!isFinite(bytes)) return "--";
    return (bytes/(1024*1024)).toFixed(1)+" MB";
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
  function nowTime(){
    const d=new Date(); const hh=String(d.getHours()).padStart(2,"0"); const mm=String(d.getMinutes()).padStart(2,"0"); const ss=String(d.getSeconds()).padStart(2,"0");
    return `${hh}:${mm}:${ss}`;
  }
  function log(msg,level="t"){
    if(!consoleEl) return;
    const line=document.createElement("div"); line.className="cm-logline cm-"+level;
    const time=document.createElement("span"); time.className="cm-time"; time.textContent=`[${nowTime()}] `;
    const text=document.createElement("span"); text.className="cm-msg"; text.textContent=msg;
    line.appendChild(time); line.appendChild(text); consoleEl.appendChild(line);
    consoleEl.scrollTop=consoleEl.scrollHeight; return line;
  }
  function setLineText(line,msg){
    if(!line) return;
    const time=line.querySelector(".cm-time"); const text=line.querySelector(".cm-msg");
    if(!time||!text){ line.textContent=`[${nowTime()}] ${msg}`; return; }
    time.textContent=`[${nowTime()}] `; text.textContent=msg;
  }

  let junk=[]; let busyWorkEnabled=false; let lockedFps=false;
  const targetFps=30; let cleanCpuStart=0; let cleanRamStart=0; const cleanEffectMs=3200;
  
  const N=180; 
  const cpuSeries=Array(N).fill(0); const ramSeries=Array(N).fill(0);
  const gpuSeries=Array(N).fill(0); const pingSeries=Array(N).fill(0);

  function drawWave(ctx,series,colorStroke,labelY){
    if(!ctx) return;
    const w=ctx.canvas.width, h=ctx.canvas.height;
    ctx.clearRect(0,0,w,h); 
    ctx.strokeStyle="rgba(255,255,255,0.08)"; ctx.lineWidth=1; ctx.beginPath();
    for(let i=1;i<=5;i++){ const y=(h*i)/6; ctx.moveTo(0,y); ctx.lineTo(w,y); }
    for(let i=1;i<=10;i++){ const x=(w*i)/11; ctx.moveTo(x,0); ctx.lineTo(x,h); }
    ctx.stroke();
    
    ctx.strokeStyle=colorStroke; ctx.lineWidth=2; ctx.beginPath();
    for(let i=0;i<series.length;i++){
      const x=(w*i)/(series.length-1); const y=h-(series[i]*(h-10))-5;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.font="bold 10px ui-monospace, monospace"; ctx.fillText(labelY,10,18);
  }

  let lastFrame=performance.now(); let fps=0; let fpsSMA=0; let frameCount=0; let fpsWindowStart=performance.now();
  function estimateCpuLoadFromDelta(deltaMs){ const ideal=16.67; const ratio=deltaMs/ideal; return clamp((ratio-0.9)/2.0,0,1); }
  function waveJitter(base,t,amp1,amp2,f1,f2,phase){ const n=amp1*Math.sin(t*f1+phase)+amp2*Math.sin(t*f2+phase*0.6); return clamp(base+n,0,1); }
  function applyCleanEffect(value,t,startedAt){
    if(!startedAt) return value;
    const p=clamp((t-startedAt)/cleanEffectMs,0,1); if(p>=1) return value;
    const dip=p<0.3?0.05:0.05+(p-0.3)/0.7*(value-0.05); return clamp(dip,0,1);
  }
  function getRamValue01(t){
    if(hasPerfMem){
      const used=performance.memory.usedJSHeapSize; const limit=performance.memory.jsHeapSizeLimit||(used*1.2);
      if($("cm-heap-used")) $("cm-heap-used").textContent=fmtMB(used); 
      if($("cm-heap-limit")) $("cm-heap-limit").textContent=fmtMB(limit);
      return waveJitter(clamp(used/limit,0,1),t,0.03,0.015,1.7,4.3,0.9);
    }
    if($("cm-heap-used")) $("cm-heap-used").textContent="N/A"; 
    if($("cm-heap-limit")) $("cm-heap-limit").textContent="N/A";
    return clamp(0.38+0.22*Math.sin(t*1.2+0.5)+0.08*Math.sin(t*2.9+1.1),0,1);
  }

  let progressTimer=0;
  function getProgressDurationMs(){ return 5000; }
  const codeLines={
    ram:["mem::scan_pages()","heap::compact()","vm::gc_step()","cache::drop_unused()","mem::reclaim_blocks()"],
    cpu:["cpu::stabilize_clock()","core::scheduler_tick()","thread::rebalance()","cpu::cooldown_profile()","core::boost_limits()"],
    fps:["render::lock_vsync()","frame::cap_rate()","gfx::present_sync()","timing::set_budget()","frame::stable_clock()"]
  };
  function randFrom(list){return list[Math.floor(Math.random()*list.length)]}
  function hex(n=4){return Math.floor(Math.random()*Math.pow(16,n)).toString(16).padStart(n,"0")}
  function genCodeLine(type){
    const list=codeLines[type]||codeLines.ram; const base=randFrom(list);
    if(Math.random()<0.4) return `${base} => DONE`;
    if(Math.random()<0.75) return `[0x${hex(3)}] process ${type} OK`;
    return `op.${type} -> SUCCESS`;
  }
  function pickRamLevel(){ const levels=["g","w","e"]; return randFrom(levels); }
  function runProgress(label,type,opts={}){
    const lineLevel=opts.lineLevel||"g"; const codeLevel=opts.codeLevel||"g";
    if(progressTimer) clearInterval(progressTimer);
    const line=log(`${label}: [--------------------] 0%`,lineLevel);
    const duration=getProgressDurationMs(); const start=performance.now();
    const spins=["|","/","-","\\"]; let si=0; let tick=0;
    progressTimer=setInterval(()=>{
      const elapsed=performance.now()-start; const pct=clamp(elapsed/duration,0,1);
      const p=Math.round(pct*100); const filled=Math.round(pct*20);
      const bar="["+"#".repeat(filled)+"-".repeat(20-filled)+"]"; const spin=spins[si++%spins.length];
      setLineText(line,`${label} ${spin} ${bar} ${p}%`); if(consoleEl) consoleEl.scrollTop=consoleEl.scrollHeight;
      log(genCodeLine(type), typeof codeLevel==="function"?codeLevel():codeLevel); tick++;
      if(p>=100){ clearInterval(progressTimer); progressTimer=0; setLineText(line,`${label} o" ${bar} 100%`); }
    },100);
  }
  
  if($("cm-btn-ram")) $("cm-btn-ram").addEventListener("click",()=>{
    const before=junk.length; junk=[]; cpuSeries.fill(0); ramSeries.fill(0); cleanRamStart=performance.now();
    log(`Dọn RAM: đã xoá ${before} khối dữ liệu giả lập.`,"i"); runProgress("Dọn RAM","ram",{codeLevel:pickRamLevel});
  });
  if($("cm-btn-cpu")) $("cm-btn-cpu").addEventListener("click",()=>{
    busyWorkEnabled=false; cleanCpuStart=performance.now();
    log("Dọn CPU: tắt tác vụ giả lập gây tải CPU.","i"); runProgress("Dọn CPU","cpu",{codeLevel:pickRamLevel});
  });
  if($("cm-btn-fps")) $("cm-btn-fps").addEventListener("click",()=>{
    lockedFps=!lockedFps; $("cm-btn-fps").textContent=`Lock FPS: ${lockedFps?"ON":"OFF"}`; $("cm-btn-fps").classList.toggle("is-on",lockedFps);
    if($("cm-mode-now")) $("cm-mode-now").textContent=lockedFps?`Locked ${targetFps}`:"Unlocked";
    log(lockedFps?`Bật lock FPS ở ${targetFps} FPS.`:"Tắt lock FPS.","i"); runProgress(lockedFps?"Lock FPS":"Unlock FPS","fps",{codeLevel:pickRamLevel});
  });

  let lastTick=performance.now();
  function loop(t){
    const delta=t-lastFrame; lastFrame=t; frameCount++; const elapsed=t-fpsWindowStart;
    if(elapsed>=500){ fps=(frameCount*1000)/elapsed; fpsWindowStart=t; frameCount=0; fpsSMA=fpsSMA?(fpsSMA*0.7+fps*0.3):fps; if($("cm-fps-now")) $("cm-fps-now").textContent=fpsSMA.toFixed(1); }
    
    if(t-lastTick>=50){
      lastTick=t; const tSec=t/1000;
      
      let cpuLoad=waveJitter(estimateCpuLoadFromDelta(delta),tSec,0.05,0.02,2.6,6.2,0.2); cpuLoad=applyCleanEffect(cpuLoad,t,cleanCpuStart); cpuSeries.push(cpuLoad); cpuSeries.shift();
      let ramV=getRamValue01(tSec); ramV=applyCleanEffect(ramV,t,cleanRamStart); ramSeries.push(ramV); ramSeries.shift();
      let gpuLoad = waveJitter(cpuLoad*1.2, tSec+10, 0.08, 0.04, 3.1, 5.5, 0.5); gpuSeries.push(gpuLoad); gpuSeries.shift();
      let pingVal = 35 + waveJitter(0, tSec, 15, 5, 0.5, 1.2, 0)*100; if(Math.random()<0.02) pingVal += 40; 
      pingSeries.push(clamp((pingVal-20)/100, 0, 1)); pingSeries.shift();

      if($("cm-cpu-text")) $("cm-cpu-text").textContent=`${(cpuLoad*100).toFixed(0)}%`; 
      if($("cm-ram-text")) $("cm-ram-text").textContent=`${(ramV*100).toFixed(0)}%`;
      if($("cm-gpu-text")) $("cm-gpu-text").textContent=`${(gpuLoad*100).toFixed(0)}%`;
      if($("cm-ping-text")) $("cm-ping-text").textContent=`${pingVal.toFixed(0)} ms`;
      
      const dynamicColor = `rgba(${window.themeRGB || '0, 229, 255'}, 0.95)`;
      drawWave(cpuCtx,cpuSeries,dynamicColor,"CPU MHz"); drawWave(ramCtx,ramSeries,dynamicColor,"RAM VRAM"); drawWave(gpuCtx,gpuSeries,dynamicColor,"GPU Load"); drawWave(pingCtx,pingSeries,"rgba(255, 0, 80, 0.95)","Ping ms"); 

      if($("ft-fps-val")) $("ft-fps-val").textContent = fpsSMA.toFixed(0);
      if($("ft-cpu-val")) $("ft-cpu-val").textContent = (cpuLoad*100).toFixed(0);
      if($("ft-gpu-val")) $("ft-gpu-val").textContent = (gpuLoad*100).toFixed(0);
      if($("ft-ping-val")) $("ft-ping-val").textContent = pingVal.toFixed(0);
      
      if($("ft-perf-val")) {
          const perf = Math.round(100 - (cpuLoad * 40) - (gpuLoad * 20)); 
          const finalPerf = clamp(perf, 50, 99);
          $("ft-perf-val").textContent = finalPerf + "%";
          const ring = document.querySelector(".ft-ring-fill");
          if(ring) {
              const offset = 251.2 - (251.2 * finalPerf / 100);
              ring.style.strokeDashoffset = offset;
          }
      }
    }
    
    if(lockedFps){ const interval=1000/targetFps; setTimeout(()=>requestAnimationFrame(loop),Math.max(0,interval-(performance.now()-t))); }else{ requestAnimationFrame(loop); }
  }
  
  log("Khởi động hệ thống theo dõi Telemetry.","t");
  requestAnimationFrame(loop);
})();