/* ========== GLOBAL / CANVAS / VISUALS (unchanged) ========== */
/* Avatar: arc-reactor + RK */
(function avatarArc(){
  const canvas = document.getElementById('avatarCanvas');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let t0 = performance.now();

  function draw(now){
    now = now || performance.now();
    const W = 512, H = 512;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = '100%'; canvas.style.height = '100%';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.clearRect(0,0,W,H);
    const t = (now - t0)/1000;

    // soft vignette
    const rg = ctx.createRadialGradient(W/2, H/2, 10, W/2, H/2, 240);
    rg.addColorStop(0, 'rgba(0,230,255,0.14)');
    rg.addColorStop(0.45, 'rgba(179,75,255,0.08)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(W/2,H/2,220,0,Math.PI*2); ctx.fill();

    // rings
    for(let i=0;i<4;i++){
      ctx.save();
      const spin = t * (0.08 + i*0.04) * (i%2? -1: 1);
      ctx.translate(W/2, H/2);
      ctx.rotate(spin);
      ctx.beginPath();
      const r = 92 + i*26;
      ctx.arc(0, 0, r, 0, Math.PI*2);
      ctx.lineWidth = 1.4 + (3 - i) * 0.7;
      ctx.strokeStyle = `rgba(0,230,255,${0.14 - i*0.02})`;
      ctx.shadowBlur = 10 - i*2;
      ctx.shadowColor = i===0 ? 'rgba(0,230,255,0.95)' : 'rgba(179,75,255,0.48)';
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // spokes
    ctx.save(); ctx.translate(W/2, H/2);
    const spokes = 8;
    for(let i=0;i<spokes;i++){
      const ang = t * 0.6 * (i%2?1:-1) + i*(Math.PI*2/spokes);
      ctx.save(); ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(18, -3); ctx.lineTo(78, -1); ctx.lineTo(78, 1); ctx.lineTo(18, 3);
      ctx.closePath();
      const g = ctx.createLinearGradient(18,0,78,0);
      g.addColorStop(0,'rgba(255,255,255,0.03)');
      g.addColorStop(0.5,'rgba(136,255,230,0.10)');
      g.addColorStop(1,'rgba(179,75,255,0.12)');
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // RK text (kept as-is since you said it's perfect)
    ctx.font = '700 140px Orbitron, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    const offset = Math.sin(t*2.0) * 2.6;
    ctx.save();
    ctx.shadowColor = 'rgba(0,230,255,0.95)'; ctx.shadowBlur = 30;
    const strokeGrad = ctx.createLinearGradient(W/2 - 80, H/2 - 40, W/2 + 80, H/2 + 60);
    strokeGrad.addColorStop(0, '#00e6ff'); strokeGrad.addColorStop(0.5, '#88ffe6'); strokeGrad.addColorStop(1, '#b34bff');
    ctx.strokeStyle = strokeGrad; ctx.strokeText('R K', W/2 - offset, H/2 + 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.strokeText('R K', W/2 + offset*0.6, H/2 + 8);
    const fillGrad = ctx.createLinearGradient(W/2 - 40, H/2 - 20, W/2 + 40, H/2 + 20);
    fillGrad.addColorStop(0, 'rgba(230,255,255,0.98)'); fillGrad.addColorStop(1, 'rgba(200,240,255,0.95)');
    ctx.fillStyle = fillGrad; ctx.fillText('R K', W/2, H/2 + 6);
    ctx.restore();

    // soft motes
    for(let i=0;i<6;i++){
      const ang = t * (0.35 + i*0.12) + i;
      const rx = Math.cos(ang) * (120 + i*12) + W/2;
      const ry = Math.sin(ang) * (96 + i*10) + H/2;
      const rdot = 1.6 + (i%2);
      const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rdot*6);
      grad.addColorStop(0, `rgba(${Math.floor(0 + i*90)},${Math.floor(200 - i*30)},${Math.floor(255 - i*20)},${0.95 - i*0.08})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(rx, ry, rdot, 0, Math.PI*2); ctx.fill();
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  const avatarWrap = document.getElementById('avatar');
  avatarWrap.addEventListener('mousemove', (e)=>{
    const r = avatarWrap.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) - 0.5;
    const py = ((e.clientY - r.top) / r.height) - 0.5;
    avatarWrap.style.transform = `rotateX(${(-py*8)}deg) rotateY(${(px*8)}deg) translateZ(10px)`;
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    if(window.__shaderSetHover) window.__shaderSetHover(cx, cy, 600);
  });
  avatarWrap.addEventListener('mouseleave', ()=> avatarWrap.style.transform = '');
})();

/* Shader background */
(function shaderInit(){
  const canvas = document.getElementById('bg-shader');
  let gl = canvas.getContext('webgl2');
  if(!gl){ gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); if(!gl){ console.warn('WebGL unavailable'); return; } }

  function fit(){ const dpr = Math.max(1, window.devicePixelRatio||1); canvas.width = Math.floor(innerWidth * dpr); canvas.height = Math.floor(innerHeight * dpr); canvas.style.width = innerWidth+'px'; canvas.style.height = innerHeight+'px'; gl.viewport(0,0,canvas.width,canvas.height); }
  fit(); addEventListener('resize', fit);

  function compile(type, src){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.error(gl.getShaderInfoLog(s)); return null; } return s; }

  const vs = `#version 300 es
    precision mediump float;
    in vec2 a_pos; out vec2 v_uv;
    void main(){ v_uv = a_pos*0.5 + 0.5; gl_Position = vec4(a_pos,0.,1.); }`;

  const fs = `#version 300 es
    precision highp float;
    in vec2 v_uv; out vec4 outColor;
    uniform vec2 u_resolution; uniform float u_time; uniform vec2 u_mouse; uniform float u_hover;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
    float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y; }
    float fbm(vec2 p){ float v=0.; float a=0.5; for(int i=0;i<6;i++){ v+=a*noise(p); p*=2.; a*=0.5; } return v; }
    void main(){
      vec2 uv = v_uv;
      vec2 p = uv*2.0 - 1.0;
      p.x *= u_resolution.x / u_resolution.y;
      float t = u_time * 0.45;
      vec2 m = (u_mouse / u_resolution) * 2.0 - 1.0;
      m.x *= u_resolution.x / u_resolution.y;
      float dist = length(p - m);
      vec2 q = p + vec2(sin(t*0.35 + p.y*2.2)*0.012, cos(t*0.27 + p.x*2.2)*0.012);
      q += (p - m) * u_hover * exp(-dist*7.0) * 0.45;
      float n = fbm(q * 1.9 + t*0.08);

      // base + neon
      vec3 base = mix(vec3(0.01,0.01,0.03), vec3(0.02,0.04,0.08), uv.y);
      vec3 neon = mix(vec3(0.02,0.6,0.5), vec3(0.67,0.16,1.0), n);
      vec3 col = base + neon * (n*0.9 + 0.08);

      // grid
      float gx = abs(fract(uv.x * 18.0) - 0.5);
      float gy = abs(fract(uv.y * 18.0) - 0.5);
      float grid = (1.0 - smoothstep(0.495,0.5,gx))*0.16 + (1.0 - smoothstep(0.495,0.5,gy))*0.06;
      col += vec3(0.0,0.24,0.36) * grid * 0.06;

      // hover bloom
      col += 0.28 * exp(-dist*8.0) * vec3(0.6,0.12,1.0) * u_hover;

      // slight chromatic dispersion
      float disp = 0.0025 * (0.5 + 0.5 * sin(t*0.7));
      float r = pow(clamp(col.r,0.,1.), vec3(0.95).r);
      float g = pow(clamp(col.g,0.,1.), vec3(0.95).r);
      float b = pow(clamp(col.b,0.,1.), vec3(0.95).r);
      r += 0.02 * fbm((uv + vec2(disp,0.0))*6.0 + t*0.2);
      g += 0.01 * fbm((uv + vec2(0.0,disp))*6.0 + t*0.2);
      b += 0.015 * fbm((uv - vec2(disp,0.0))*6.0 + t*0.2);

      outColor = vec4(clamp(vec3(r,g,b),0.,1.),1.0);
    }`;

  const a = compile(gl.VERTEX_SHADER, vs);
  const b = compile(gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram(); gl.attachShader(prog, a); gl.attachShader(prog, b); gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  const quad = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog,'a_pos'); gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc,2,gl.FLOAT,false,0,0);

  const uRes = gl.getUniformLocation(prog,'u_resolution');
  const uTime = gl.getUniformLocation(prog,'u_time');
  const uMouse = gl.getUniformLocation(prog,'u_mouse');
  const uHover = gl.getUniformLocation(prog,'u_hover');

  const state = { mouse: [innerWidth/2, innerHeight/2], hover: 0, ts: performance.now() };
  window.addEventListener('mousemove', e => { state.mouse = [e.clientX, innerHeight - e.clientY]; });

  window.__shaderSetHover = (x,y,len=600) => { state.mouse = [x, innerHeight - y]; state.hover = 1.0; setTimeout(()=> state.hover = 0.0, len); };

  function draw(now){
    const t = (now - state.ts)/1000;
    gl.useProgram(prog);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, state.mouse[0] || canvas.width/2, state.mouse[1] || canvas.height/2);
    gl.uniform1f(uHover, state.hover || 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

/* Particles with mouse attraction */
(function particles(){
  const c = document.getElementById('particles'), ctx = c.getContext('2d', { alpha:true });
  let W = innerWidth, H = innerHeight; c.width=W; c.height=H; addEventListener('resize', ()=>{ W=innerWidth; H=innerHeight; c.width=W; c.height=H; build(); });

  let pool = [];
  const mouse = {x: W/2, y: H/2, active: false};
  function build(){ pool = []; const N = Math.floor(Math.min(320, (W*H)/36000)); for(let i=0;i<N;i++) pool.push({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-0.5)*0.8, vy:(Math.random()-0.5)*0.8, r:Math.random()*3.2+0.6, hue: 160 + Math.random()*160 }); }
  build();

  window.addEventListener('mousemove', (e)=>{ mouse.x=e.clientX; mouse.y=e.clientY; mouse.active=true; });
  window.addEventListener('mouseout', ()=>{ mouse.active=false; });

  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.globalCompositeOperation = 'lighter';
    for(const p of pool){
      if(mouse.active){
        const dx = mouse.x - p.x; const dy = mouse.y - p.y; const d2 = dx*dx + dy*dy; const d = Math.sqrt(d2) + 0.001; const force = Math.max(0, Math.min(0.7, 1400 / (d2 + 2600)));
        p.vx += (dx/d) * force * 0.001; p.vy += (dy/d) * force * 0.001;
      }
      p.x += p.vx; p.y += p.vy; p.vx *= 0.994; p.vy *= 0.994;
      if(p.x < -120) p.x = W+120; if(p.x > W+120) p.x = -120; if(p.y < -120) p.y = H+120; if(p.y > H+120) p.y = -120;
      const r = Math.max(0.6, p.r);
      const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*10);
      g.addColorStop(0, `hsla(${p.hue},92%,66%,0.95)`);
      g.addColorStop(0.25, `hsla(${p.hue},86%,46%,0.14)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  window.__particlesRebuild = (n)=> { build(n); };
})();

/* ========== UI (copy, myCard, toast, modal) ========== */
(function UI(){
  const email = 'immraviprakash@gmail.com';
  const toast = document.getElementById('toast');
  const modalRoot = document.getElementById('modalRoot');

  // set email text if present (initial panel)
  const emailTextEl = document.getElementById('emailText'); if(emailTextEl) emailTextEl.textContent = email;

  function pulseAt(x,y,color='rgba(0,230,255,0.12)'){
    const el = document.createElement('div'); el.className = 'copy-pulse'; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = '24px'; el.style.height = '24px'; el.style.background = `radial-gradient(circle, ${color} 0%, transparent 60%)`; el.style.transition = 'transform .6s ease, opacity .6s ease'; document.body.appendChild(el);
    requestAnimationFrame(()=> { el.style.transform = 'translate(-50%,-50%) scale(12)'; el.style.opacity = '0'; }); setTimeout(()=> el.remove(), 700);
  }

  function showToast(msg='Done', opts={}){
    toast.textContent = msg;
    if(opts.glass){
      toast.classList.add('glass');
      toast.classList.add('show');
      if(opts.triggerAt) pulseAt(opts.triggerAt[0], opts.triggerAt[1]);
      setTimeout(()=> { toast.classList.remove('show'); toast.classList.remove('glass'); }, 2200);
    } else {
      toast.classList.remove('glass');
      toast.classList.add('show');
      if(opts.triggerAt) pulseAt(opts.triggerAt[0], opts.triggerAt[1], 'rgba(179,75,255,0.12)');
      setTimeout(()=> toast.classList.remove('show'), 2200);
    }
  }

  async function copyEmailFromElement(el){
    try{
      await navigator.clipboard.writeText(email);
      let cx = Math.round(window.innerWidth/2), cy = Math.round(window.innerHeight/2);
      if(el){ const r = el.getBoundingClientRect(); cx = Math.round(r.left + r.width/2); cy = Math.round(r.top + r.height/2); if(window.__shaderSetHover) window.__shaderSetHover(cx, cy, 700); }
      showToast('Email copied', { glass: true, triggerAt: [cx, cy] });
    } catch(e){
      // fallback
      const ta = document.createElement('textarea'); ta.value = email; document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); showToast('Email copied', { glass: true }); }catch(e2){ alert('Copy: ' + email); }
      ta.remove();
    }
  }

  // myCard generator (keeps behavior)
  async function generateCardPNG(){
    const w = 2700, h = 1500;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');

    // deep background with subtle bluish highlights
    const bg = g.createLinearGradient(0,0,w,h);
    bg.addColorStop(0, '#00060a'); bg.addColorStop(0.45, '#001428'); bg.addColorStop(0.92, '#00060a');
    g.fillStyle = bg; g.fillRect(0,0,w,h);

    // moving scanlines illusion (rendered statically with sin-based jitter)
    g.globalAlpha = 0.02; g.fillStyle = '#bfefff';
    for(let i=0;i<320;i++){
      const y = Math.floor((i/320)*h) + Math.sin(i*0.8)*2.2;
      g.fillRect(0, y, w, 1);
    }
    g.globalAlpha = 1;

    // central RK halo
    const cx = 520, cy = Math.floor(h/2), r = 380;
    const halo = g.createRadialGradient(cx,cy,10,cx,cy,r*1.6);
    halo.addColorStop(0, 'rgba(200,250,255,0.34)');
    halo.addColorStop(0.28, 'rgba(120,210,255,0.12)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(cx,cy,r*1.25,0,Math.PI*2); g.fill();

    // subtle rings
    for(let i=0;i<6;i++){
      g.beginPath(); g.arc(cx,cy, r + i*8, 0, Math.PI*2);
      const alpha = 0.12 - i*0.015; g.strokeStyle = `rgba(160,240,255,${Math.max(0, alpha)})`; g.lineWidth = 2 + (5-i)*0.6; g.stroke();
    }

    // large RK with micro-glow
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 420px Orbitron, sans-serif'; g.shadowColor = 'rgba(0,200,255,0.95)'; g.shadowBlur = 68; g.lineWidth = 10; g.strokeStyle = 'rgba(16,160,200,0.88)'; g.strokeText('R K', cx, cy + 6); g.fillStyle = '#eafcff'; g.fillText('R K', cx, cy + 6); g.restore();

    // right-side profile details
    const px = 1060;
    g.fillStyle = 'rgba(230,245,250,0.98)'; g.font = '800 86px Orbitron'; g.fillText('Ravi Prakash', px, cy - 82);
    g.font = '700 36px "Share Tech Mono", monospace'; g.fillStyle = '#00fff0'; g.fillText('Web · Java · React · ML', px, cy - 28);
    g.fillStyle = 'rgba(190,200,210,0.92)'; g.font = '500 28px "Share Tech Mono", monospace'; g.fillText('immraviprakash@gmail.com', px, cy + 34); g.fillText('+91 6361663390', px, cy + 88);

    g.strokeStyle = 'rgba(255,255,255,0.03)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px-24, cy + 150); g.lineTo(w - 220, cy + 150); g.stroke();

    // small social icons blocks
    const sx = px - 8, sy = cy + 220;
    g.fillStyle = 'rgba(0,230,255,0.06)'; g.fillRect(sx-28, sy-42, 72, 72); g.fillStyle = '#00fff0'; g.font = '700 32px Orbitron'; g.fillText('in', sx+8, sy+14);
    g.fillStyle = 'rgba(179,75,255,0.06)'; g.fillRect(sx + 92, sy-42, 72, 72); g.fillStyle = '#b34bff'; g.fillText('@', sx + 92 + 38, sy+14);
    g.fillStyle = 'rgba(0,230,255,0.06)'; g.fillRect(sx + 188, sy-42, 72, 72); g.fillStyle = '#00fff0'; g.fillText('wa', sx + 188 + 38, sy+14);

    // software profile block
    g.fillStyle = 'rgba(255,255,255,0.02)'; g.fillRect(w - 980, 160, 720, 260);
    g.strokeStyle = 'rgba(0,230,255,0.04)'; g.strokeRect(w - 980, 160, 720, 260);
    g.font = '700 24px "Share Tech Mono"'; g.fillStyle = 'rgba(140,255,240,0.95)'; g.fillText('SOFTWARE PROFILE', w - 640, 200);
    g.fillStyle = 'rgba(200,220,230,0.72)'; g.font = '400 18px "Share Tech Mono"';
    g.fillText('- Frontend engineering — React & performance', w - 860, 238);
    g.fillText('- Web development & APIs (Node, Express)', w - 860, 266);
    g.fillText('- Java & ML prototypes / visualization', w - 860, 294);

    // footer tagline
    g.fillStyle = 'rgba(180,200,210,0.08)'; g.font = '400 18px "Share Tech Mono"'; g.fillText('RK • holographic • myCard', px, h - 64);

    return new Promise((res, rej) => { c.toBlob(blob => { if(!blob) return rej(new Error('export failed')); res(URL.createObjectURL(blob)); }, 'image/png', 0.96); });
  }

  // expose some helpers to the rest of the script
  window.__ui = {
    copyEmailFromElement,
    generateCardPNG,
    showToast,
    pulseAt,
    email
  };

  // Delegated handlers (use one-time persistent delegation so panel swaps don't break behavior)
  document.addEventListener('click', async function deleg(e){
    const target = e.target;
    // copy email button or avatar click
    const copyBtn = target.closest('#copyEmail');
    if(copyBtn){ e.preventDefault(); await copyEmailFromElement(copyBtn); return; }

    // download card
    const dlBtn = target.closest('#downloadCard');
    if(dlBtn){ e.preventDefault();
      try {
        const url = await window.__ui.generateCardPNG();
        const a = document.createElement('a'); a.href = url; a.download = 'myCard_RK.png'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        const r = dlBtn.getBoundingClientRect(); const cx = Math.round(r.left + r.width/2), cy = Math.round(r.top + r.height/2);
        if(window.__shaderSetHover) window.__shaderSetHover(cx, cy, 900);
        window.__ui.showToast('myCard downloaded', { glass: true, triggerAt: [cx, cy] });
      } catch (err) { console.error(err); window.__ui.showToast('Failed to generate card'); }
      return;
    }

    // open email client
    const mailBtn = target.closest('#emailBtn');
    if(mailBtn){ /* allow default if mailto present; we open mailto ourselves */ e.preventDefault();
      const r = mailBtn.getBoundingClientRect(); const cx = Math.round(r.left + r.width/2), cy = Math.round(r.top + r.height/2);
      if(window.__shaderSetHover) window.__shaderSetHover(cx, cy, 700);
      window.location.href = `mailto:${email}`;
      return;
    }

    // intercept internal SPA links (same-origin, not forced download, not anchors to hash, not external)
    const a = target.closest('a');
    if(a && a.hasAttribute('href') && !a.hasAttribute('target') && !a.hasAttribute('download')){
      const href = a.getAttribute('href');
      // skip mailto/tel/external absolute urls
      if(/^mailto:|^tel:|^[a-z]+:/i.test(href)) return;
      // same origin check: if starts with / or doesn't include //, treat as internal
      const url = new URL(href, location.href);
      if(url.origin === location.origin){
        // allow anchors to same page (#something) to proceed
        if(url.hash && url.pathname === location.pathname) return;
        // use SPA navigate — only intercept when link has data-spa or is internal HTML
        if(a.hasAttribute('data-spa') || /\.html$/.test(url.pathname) || a.closest('.panel')){
          e.preventDefault();
          spaNavigate(url.href);
        }
      }
    }
  });

  // terminal form also relies on generateCard and showToast which are exposed later
})();

/* ========== SPA NAVIGATION (in-file) ========== */
(function SPA(){
  const panelSelector = 'section.panel';
  const panel = document.querySelector(panelSelector);

  // small helper respecting reduced-motion
  function prefersReducedMotion(){ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  // find a good focus target inside panel (h2 heading) for accessibility
  function focusPanelHeading(el){
    try{
      const h = el.querySelector('h2') || el.querySelector('[aria-labelledby]');
      if(h){ h.setAttribute('tabindex','-1'); h.focus(); h.removeAttribute('tabindex'); }
    }catch(e){}
  }

  // replace the panel element completely (so aria attributes and structure are preserved)
  async function replacePanelWith(newPanelEl, pushState=true, url=''){
    const oldPanel = document.querySelector(panelSelector);
    if(!oldPanel || !newPanelEl) return;
    // add fade-in class to the incoming element
    newPanelEl.classList.add('panel', 'fade-in');
    // replace DOM node
    oldPanel.replaceWith(newPanelEl);
    // update email text if present
    const emailTextEl = document.getElementById('emailText'); if(emailTextEl) emailTextEl.textContent = window.__ui?.email || 'immraviprakash@gmail.com';
    // small timeout to allow CSS to settle
    requestAnimationFrame(()=> setTimeout(()=> newPanelEl.classList.remove('fade-in'), 320));
    // focus for accessibility
    focusPanelHeading(newPanelEl);
    // update title if the fetched doc previously set it
    if(pushState && url) history.pushState({ spa: true, url: url }, '', url);
  }

  // core SPA fetch + swap
  async function spaNavigate(href){
    // if user prefers reduced motion, fall back to full nav
    if(prefersReducedMotion()){
      location.href = href;
      return;
    }

    // quick UX: show a terminal-ish small delay by animating out the panel
    const oldPanel = document.querySelector(panelSelector);
    if(!oldPanel){ location.href = href; return; }
    oldPanel.classList.add('fade-out');

    // small wait so users can see "redirecting" messages in the terminal
    await new Promise(res => setTimeout(res, 240));

    try{
      // fetch target html
      const resp = await fetch(href, { credentials: 'same-origin' });
      if(!resp.ok) throw new Error('fetch failed: ' + resp.status);
      const text = await resp.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      // get new panel
      const newPanel = doc.querySelector(panelSelector);
      // fallback: if no panel in fetched doc, perform full navigation
      if(!newPanel){
        location.href = href;
        return;
      }

      // copy id/aria attributes from fetched panel to keep a11y
      const cloned = newPanel.cloneNode(true);

      // update document title if present in fetched doc
      if(doc.title) document.title = doc.title;

      // replace old panel with new one and push history
      await replacePanelWith(cloned, true, href);

      // re-run any panel-local initialization (update email text, rebind controls if needed)
      reinitPanelAfterSwap();

    }catch(err){
      console.warn('SPA nav failed, falling back to full nav', err);
      location.href = href;
    } finally {
      // ensure oldPanel removed fade class if still present
      const cur = document.querySelector(panelSelector);
      if(cur) cur.classList.remove('fade-out');
    }
  }

  // handle browser back/forward
  window.addEventListener('popstate', async function (ev){
    if(ev.state && ev.state.url){
      // load that url content and replace panel (do not push a new history entry)
      const href = ev.state.url;
      if(prefersReducedMotion()){
        location.href = href; return;
      }
      const oldPanel = document.querySelector(panelSelector);
      if(oldPanel) oldPanel.classList.add('fade-out');
      try{
        const resp = await fetch(href, { credentials: 'same-origin' });
        if(!resp.ok) { location.href = href; return; }
        const text = await resp.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const newPanel = doc.querySelector(panelSelector);
        if(!newPanel){ location.href = href; return; }
        const cloned = newPanel.cloneNode(true);
        if(doc.title) document.title = doc.title;
        await replacePanelWith(cloned, false, href);
        reinitPanelAfterSwap();
      }catch(e){ location.href = href; }
    }else{
      // if no state, fallback to full reload
      location.reload();
    }
  });

  // expose for use in other scripts (terminal)
  window.spaNavigate = spaNavigate;

  // After the panel is swapped, some panel-specific items may need re-init:
  // - update emailText
  // - re-attach keyboard handlers or focus traps if any panel contains dialogs
  function reinitPanelAfterSwap(){
    // update the email text if newly inserted
    const emailTextEl = document.getElementById('emailText'); if(emailTextEl) emailTextEl.textContent = window.__ui?.email || 'immraviprakash@gmail.com';
    // Ensure terminal output remains visible and input remains focused as expected (no-op)
    // Re-attach avatar hover effect (avatar element moved with panel; shader hover uses global window.__shaderSetHover)
    const avatar = document.getElementById('avatar');
    if(avatar){
      avatar.addEventListener('mousemove', (e)=>{
        const r = avatar.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) - 0.5;
        const py = ((e.clientY - r.top) / r.height) - 0.5;
        avatar.style.transform = `rotateX(${(-py*8)}deg) rotateY(${(px*8)}deg) translateZ(10px)`;
        const cx = r.left + r.width/2, cy = r.top + r.height/2;
        if(window.__shaderSetHover) window.__shaderSetHover(cx, cy, 600);
      });
      avatar.addEventListener('mouseleave', ()=> avatar.style.transform = '');
      avatar.addEventListener('click', ()=> { const cb = document.getElementById('copyEmail'); if(cb) cb.click(); });
    }
    // Ensure form handlers still work — contact form uses delegated submit handler below, so no direct rebind needed.
    // Re-populate any dynamic bits (like mini-hud) if necessary (no-op here).
  }

  // Expose a small debug helper
  window.__spa = { navigate: spaNavigate, reinit: reinitPanelAfterSwap };
})();

/* ========== Terminal (uses spaNavigate for internal pages) ========== */
(function Terminal(){
  const form = document.getElementById('termForm'), input = document.getElementById('termInput'), out = document.getElementById('termOut');
  function append(line){ out.innerHTML += '\n' + line; out.scrollTop = out.scrollHeight; }
  const email = window.__ui?.email || 'immraviprakash@gmail.com';

  function redirectTo(url){ // compatibility helper (keeps a short UX delay)
    if(typeof window.spaNavigate === 'function'){
      // use SPA navigation
      window.spaNavigate(url);
    } else {
      setTimeout(()=> location.href = url, 220);
    }
  }

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const raw = (input.value||'').trim();
    if(!raw) return;
    const v = raw.toLowerCase();
    append('> ' + raw);

    if(v === 'help'){
      append('commands: help, mycard, copy, email, skills, projects, home, status');
      append('typing "skills" → opens skills.html (SPA)');
      append('typing "projects" → opens projects.html (SPA)');
      append('typing "home" or "stud" → opens stud.html (SPA)');
    }
    else if(v === 'mycard'){
      append('generating myCard PNG...');
      try{ 
        // call the delegated UI download
        const dlBtn = document.getElementById('downloadCard');
        if(dlBtn){ dlBtn.click(); append('myCard downloaded.'); } 
        else { await window.__ui.generateCardPNG(); append('myCard ready.'); }
      } catch(e){ append('failed to generate myCard.'); }
    }
    else if(v === 'copy'){
      try{ await navigator.clipboard.writeText(email); append('email copied to clipboard'); }catch(e){ append('copy failed'); }
    }
    else if(v === 'email'){
      append('opening email client...');
      window.location.href = `mailto:${email}`;
    }
    else if(v === 'skills' || v === 'skill'){
      append('Skills: Web · Java · React · ML · Performance');
      append('redirecting to skills.html');
      redirectTo('skills.html');
    }
    else if(v === 'projects' || v === 'project'){
      append('redirecting to projects.html');
      redirectTo('projects.html');
    }
    else if(v === 'home' || v === 'stud' || v === 'stud.html'){
      append('redirecting to home (stud.html)');
      redirectTo('stud.html');
    }
    else if(v === 'status'){
      append('visuals: shader + particles active');
    }
    else {
      append('unknown command — type help');
    }
    input.value = '';
  });

  input.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') input.blur(); });
})();

/* ========== Contact form submit + modal (delegated-friendly) ========== */
(function ContactFormDelegation(){
  const modalRoot = document.getElementById('modalRoot');
  const toast = document.getElementById('toast');

  function openSendModal(name, em, msg){
    modalRoot.innerHTML = ''; modalRoot.setAttribute('aria-hidden','false');
    const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop'; backdrop.tabIndex = -1;
    const modal = document.createElement('div'); modal.className = 'modal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
    const h = document.createElement('h3'); h.textContent = 'Confirm message — RK';
    const body = document.createElement('div'); body.className = 'body'; body.textContent = `Name: ${name}\nEmail: ${em}\n\n${msg}`;
    const actions = document.createElement('div'); actions.className = 'm-actions';
    const cancel = document.createElement('button'); cancel.className = 'btn cancel'; cancel.textContent = 'Cancel';
    const send = document.createElement('button'); send.className = 'btn send'; send.textContent = 'Send Message';
    cancel.addEventListener('click', ()=> { closeModal(); });
    send.addEventListener('click', ()=> {
      const rct = send.getBoundingClientRect(); const cx = Math.round(rct.left + rct.width/2), cy = Math.round(rct.top + rct.height/2);
      if(window.__shaderSetHover) window.__shaderSetHover(cx, cy, 900);
      window.__ui.pulseAt(cx, cy);
      const subject = encodeURIComponent('Portfolio message from ' + name);
      const bodyEnc = encodeURIComponent(`Name: ${name}\nEmail: ${em}\n\n${msg}`);
      closeModal(); window.__ui.showToast('Opening email client', { triggerAt: [cx, cy] });
      window.location.href = `mailto:${window.__ui.email}?subject=${subject}&body=${bodyEnc}`;
    });
    actions.appendChild(cancel); actions.appendChild(send);
    modal.appendChild(h); modal.appendChild(body); modal.appendChild(actions); backdrop.appendChild(modal); modalRoot.appendChild(backdrop);
    function escClose(e){ if(e.key === 'Escape') closeModal(); }
    function closeModal(){ modalRoot.innerHTML = ''; modalRoot.setAttribute('aria-hidden','true'); document.removeEventListener('keydown', escClose); }
    backdrop.addEventListener('click', (ev)=> { if(ev.target === backdrop) closeModal(); });
    document.addEventListener('keydown', escClose);
    send.focus();
  }

  // delegated submit: catch form submit events at document level
  document.addEventListener('submit', function delegatedForm(e){
    const form = e.target;
    if(!form || !form.matches) return;
    if(!form.matches('#contactForm')) return;
    e.preventDefault();
    const n = (form.querySelector('#name')?.value || '').trim();
    const em = (form.querySelector('#email')?.value || '').trim();
    const m = (form.querySelector('#message')?.value || '').trim();
    if(!n || !em || !m){
      const sendBtnEl = document.getElementById('sendBtn');
      let cx = window.innerWidth/2, cy = window.innerHeight/2;
      if(sendBtnEl){ const r = sendBtnEl.getBoundingClientRect(); cx = Math.round(r.left + r.width/2); cy = Math.round(r.top + r.height/2); if(window.__shaderSetHover) window.__shaderSetHover(cx, cy, 700); }
      window.__ui.showToast('Please fill all fields', { glass: true, triggerAt: [cx, cy] });
      return;
    }
    openSendModal(n, em, m);
  });
})();

/* Reduced-motion fallback */
(function safety(){ const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; if(reduced){ try{ document.getElementById('bg-shader').style.display='none'; document.getElementById('particles').style.display='none'; document.querySelector('.scanlines').style.display='none'; }catch(e){} } })();
