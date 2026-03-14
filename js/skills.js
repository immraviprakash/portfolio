/* -------------------------
   SHADER: subtle neon FBM background with hover bloom control
   - uses u_timeScale and a small u_hover to gently highlight under the pointer
   - falls back to not crashing if WebGL unavailable
   ------------------------- */
(function shaderInit(){
  const canvas = document.getElementById('bg-shader');
  let gl = canvas.getContext('webgl2');
  if(!gl){ gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); if(!gl){ document.getElementById('perf').textContent = 'no WebGL'; return; } }

  function fit(){ const dpr = Math.max(1, window.devicePixelRatio || 1); canvas.width = Math.floor(innerWidth * dpr); canvas.height = Math.floor(innerHeight * dpr); canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px'; gl.viewport(0,0,canvas.width, canvas.height); }
  fit(); addEventListener('resize', fit);

  function compile(type, src){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.error(gl.getShaderInfoLog(s)); return null; } return s; }

  const vs = `#version 300 es
    precision mediump float;
    in vec2 a_pos; out vec2 v_uv;
    void main(){ v_uv = a_pos*0.5 + 0.5; gl_Position = vec4(a_pos,0.0,1.0); }`;

  const fs = `#version 300 es
    precision highp float;
    in vec2 v_uv; out vec4 outColor;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_timeScale;
    uniform vec2 u_mouse; // pixels
    uniform float u_hover; // 0..1
    // hash / noise
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
      vec2 u = f*f*(3. - 2.*f);
      return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
    }
    float fbm(vec2 p){
      float v = 0.0; float a = 0.5;
      for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }
    void main(){
      vec2 uv = v_uv;
      vec2 p = uv*2.0 - 1.0;
      p.x *= u_resolution.x/u_resolution.y;
      float t = u_time * u_timeScale * 0.5;
      vec2 q = p + vec2(sin(t*0.35 + p.y*2.2)*0.012, cos(t*0.27 + p.x*2.2)*0.012);
      float n = fbm(q * 1.6 + t*0.06);
      vec3 base = mix(vec3(0.01,0.01,0.03), vec3(0.02,0.04,0.08), uv.y);
      vec3 neon = mix(vec3(0.02,0.6,0.52), vec3(0.7,0.16,1.0), n*0.6);
      vec3 col = base + neon * (n*0.8 + 0.08);

      // subtle grid lines
      float gx = abs(fract(uv.x * 14.0) - 0.5);
      float gy = abs(fract(uv.y * 14.0) - 0.5);
      float grid = (1.0 - smoothstep(0.495,0.5,gx))*0.22 + (1.0 - smoothstep(0.495,0.5,gy))*0.1;
      col += vec3(0.0,0.28,0.36) * grid * 0.06;

      // pointer bloom (small)
      vec2 m = u_mouse / u_resolution;
      vec2 mc = m*2.0 - 1.0; mc.x *= u_resolution.x/u_resolution.y;
      float dist = length(p - mc);
      col += 0.35 * exp(-dist*8.0) * vec3(0.6,0.12,1.0) * u_hover;

      col = pow(clamp(col,0.,1.), vec3(0.95));
      outColor = vec4(col, 1.0);
    }`;

  const vsS = compile(gl.VERTEX_SHADER, vs);
  const fsS = compile(gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram(); gl.attachShader(prog, vsS); gl.attachShader(prog, fsS); gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ console.error(gl.getProgramInfoLog(prog)); document.getElementById('perf').textContent='shader fail'; return; }
  gl.useProgram(prog);

  const pos = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog,'a_pos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);

  const uRes = gl.getUniformLocation(prog,'u_resolution');
  const uTime = gl.getUniformLocation(prog,'u_time');
  const uTimeScale = gl.getUniformLocation(prog,'u_timeScale');
  const uMouse = gl.getUniformLocation(prog,'u_mouse');
  const uHover = gl.getUniformLocation(prog,'u_hover');

  let start = performance.now();
  let mouse = [innerWidth/2, innerHeight/2];
  let hover = 0.0;
  let timeScale = 1.0, targetTimeScale = 1.0;

  window.addEventListener('mousemove', e => { mouse = [e.clientX, innerHeight - e.clientY]; });

  // small API to allow other code to nudge shader (e.g. freeze)
  window.__shaderSetHover = (x,y) => { mouse = [x, innerHeight - y]; hover = 1.0; setTimeout(()=> hover = 0.0, 380); };
  window.__shaderSetTimeScale = (v) => { targetTimeScale = Math.max(0.0001, Math.min(1, v)); };

  function render(now){
    const t = (now - start) / 1000;
    timeScale += (targetTimeScale - timeScale) * 0.08;
    gl.useProgram(prog);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform1f(uTimeScale, timeScale);
    gl.uniform2f(uMouse, mouse[0], mouse[1]);
    gl.uniform1f(uHover, hover);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();

/* -------------------------
   Particles: soft drifting glows
   ------------------------- */
(function particles(){
  const c = document.getElementById('particles'), ctx = c.getContext('2d', { alpha:true });
  let W = innerWidth, H = innerHeight; c.width=W; c.height=H;
  addEventListener('resize', ()=>{ W=innerWidth; H=innerHeight; c.width=W; c.height=H; });

  const N = Math.floor(Math.min(240, (W*H)/30000)); // tuned density
  const pool = [];
  for(let i=0;i<N;i++){
    pool.push({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-0.5)*0.6, vy: (Math.random()-0.5)*0.6,
      r: Math.random()*2.6+0.6, hue: 180 + Math.random()*140
    });
  }

  let speed = 1.0, target = 1.0;
  window.__particlesSetSpeed = v => { target = Math.max(0.02, Math.min(1.0, v)); };

  function draw(){
    speed += (target - speed) * 0.12;
    ctx.clearRect(0,0,W,H);
    ctx.globalCompositeOperation = 'lighter';
    for(const p of pool){
      p.x += p.vx * speed; p.y += p.vy * speed;
      if (p.x < -60) p.x = W + 60; if (p.x > W + 60) p.x = -60;
      if (p.y < -60) p.y = H + 60; if (p.y > H + 60) p.y = -60;
      const r = Math.max(0.6, p.r * (0.9 + (speed-1)*0.4));
      const grd = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*10);
      grd.addColorStop(0, `hsla(${p.hue},92%,66%,${0.9})`);
      grd.addColorStop(0.25, `hsla(${p.hue},86%,46%,${0.12})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

/* -------------------------
   Dial: simple smooth rotation, freeze per-skill
   - keeps behavior minimal & robust
   ------------------------- */
(function simpleDial() {
  const dial = document.getElementById('dial');
  const skills = Array.from(document.querySelectorAll('.skill'));

  let angle = 0;
  const speed = 12; // deg/sec
  let last = performance.now();
  let freezeCounter = 0;

  function apply() { dial.style.transform = `rotate(${angle}deg)`; }

  function freezeOn(){ freezeCounter = Math.max(0, freezeCounter + 1); window.__shaderSetTimeScale?.(0.9); window.__particlesSetSpeed?.(0.9); }
  function freezeOff(){ freezeCounter = Math.max(0, freezeCounter - 1); window.__shaderSetTimeScale?.(1.0); window.__particlesSetSpeed?.(1.0); }
  function isFrozen(){ return freezeCounter > 0; }

  skills.forEach(s => {
    s.addEventListener('pointerenter', (e) => {
      freezeOn();
      // inform shader of localized hover
      const r = s.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      window.__shaderSetHover?.(cx, cy);
      // slight visual buzz for the skill circle
      s.classList.add('zoom');
      // optional streak visual on big interactions
      if(Math.random() > 0.84) s.closest('.dial')?.classList.add('streak');
      setTimeout(()=> s.closest('.dial')?.classList.remove('streak'), 420);
    });
    s.addEventListener('pointerleave', (e) => {
      freezeOff();
      s.classList.remove('zoom');
    });
    s.addEventListener('focus', () => { freezeOn(); });
    s.addEventListener('blur',  () => { freezeOff(); });
  });

  function tick(now){
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if(!isFrozen()){
      angle = (angle + speed * dt) % 360;
      apply();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* -------------------------
   Skill UI: ring fill + tilt
   ------------------------- */
(function skillsUI(){
  const skills = Array.from(document.querySelectorAll('.skill'));
  skills.forEach(skill => {
    const lvl = parseInt(skill.dataset.level || '80', 10);
    const ring = skill.querySelector('.anim-fill');
    const gauge = skill.querySelector('.gauge-tip .progress-fill');
    const gaugeText = skill.querySelector('.gauge-tip text');
    const ringCirc = 2*Math.PI*44, gaugeCirc = 2*Math.PI*40;
    if(ring) ring.style.strokeDashoffset = String(ringCirc);
    if(gauge){ gauge.style.strokeDasharray = String(gaugeCirc); gauge.style.strokeDashoffset = String(gaugeCirc); }
    if(gaugeText) gaugeText.textContent = lvl;

    skill.addEventListener('mouseenter', e=>{
      if(ring){ ring.style.transition = 'stroke-dashoffset 720ms cubic-bezier(.2,.9,.25,1)'; ring.style.strokeDashoffset = String(ringCirc * (1 - lvl/100)); }
      if(gauge){ gauge.style.transition = 'stroke-dashoffset 720ms cubic-bezier(.2,.9,.25,1)'; gauge.style.strokeDashoffset = String(gaugeCirc * (1 - lvl/100)); }
    });
    skill.addEventListener('mouseleave', e=>{
      if(ring){ ring.style.transition = 'stroke-dashoffset 520ms ease'; ring.style.strokeDashoffset = String(ringCirc); }
      if(gauge){ gauge.style.transition = 'stroke-dashoffset 520ms ease'; gauge.style.strokeDashoffset = String(gaugeCirc); }
    });

    // micro tilt
    const logoWrap = skill.querySelector('.logoWrap');
    skill.addEventListener('mousemove', ev=>{
      const r = skill.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
      const rx = (py - 0.5) * -6, ry = (px - 0.5) * 8;
      if(logoWrap) logoWrap.style.transform = `translateZ(20px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.03)`;
    });
    skill.addEventListener('mouseleave', ()=>{ if(logoWrap) logoWrap.style.transform = ''; });
    skill.addEventListener('focus', ()=> skill.dispatchEvent(new Event('mouseenter')));
    skill.addEventListener('blur', ()=> skill.dispatchEvent(new Event('mouseleave')));
  });
})();

/* -------------------------
   HUD & Terminal
   ------------------------- */
(function HUD(){
  document.getElementById('resetBtn').addEventListener('click', ()=> location.reload());
  document.getElementById('coreBtn').addEventListener('click', e=>{ e.currentTarget.animate([{transform:'translateY(0)'},{transform:'translateY(-6px) scale(1.02)'},{transform:'translateY(0)'}], {duration:320}); document.getElementById('perf').textContent = 'core ping'; });
  document.getElementById('ovrBtn').addEventListener('click', e=>{ const root=document.documentElement; const cur = getComputedStyle(root).getPropertyValue('--placement-radius').trim(); root.style.setProperty('--placement-radius', cur ? '' : 'calc(var(--dial-radius) * 0.85)'); document.getElementById('perf').textContent = 'override toggled'; });
})();
(function Terminal(){
  const form = document.getElementById('termForm'), out = document.getElementById('termOut'), input = document.getElementById('termInput');
  const welcomeEl = document.getElementById('welcome');
  function appendLine(html){ const d=document.createElement('div'); d.innerHTML=html; out.appendChild(d); out.scrollTop = out.scrollHeight; return d; }
  function showHelp(){ appendLine('&gt; commands: <strong>projects</strong> — <a href="#" data-target="projects.html">open</a> | <strong>skills</strong> — <a href="#" data-target="skills.html">open</a> | <strong>contact</strong> — <a href="#" data-target="contact.html">open</a>'); out.querySelectorAll('a[data-target]').forEach(a=>a.addEventListener('click',ev=>{ev.preventDefault(); window.location.href=a.getAttribute('data-target');})); }
  welcomeEl.addEventListener('click', showHelp);
  welcomeEl.addEventListener('keydown', e=> { if(e.key==='Enter' || e.key===' ') { e.preventDefault(); showHelp(); } });
  form.addEventListener('submit', ev=>{ ev.preventDefault(); const v=(input.value||'').trim().toLowerCase(); if(!v) return; appendLine('&gt; '+escapeHTML(v)); if(v==='help') showHelp(); else if(v==='projects'){ appendLine('redirecting to projects...'); window.location.href='projects.html'; } else if(v==='skills'){ appendLine('redirecting to skills...'); window.location.href='skills.html'; } else if(v==='contact'){ appendLine('redirecting to contact...'); window.location.href='contact.html'; } else if(v==='status'){ appendLine('visuals: neon fbm + particles; rotation: smooth'); } else appendLine('unknown command — type <strong>help</strong>'); input.value=''; });
  function escapeHTML(s){ return s.replace(/[&<>"]/g, ch=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
})();
