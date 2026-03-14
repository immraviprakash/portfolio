/* =========================
   Shared colors / helpers
   ========================= */
const COLORS = { cyan:'#00e6ff', magenta:'#b34bff', accent:'#88ffe6' };
function el(tag, attrs={}, children=[]){ const d = document.createElement(tag); for(const k in attrs) { if(k.startsWith('on') && typeof attrs[k] === 'function') d.addEventListener(k.slice(2), attrs[k]); else if(k === 'html') d.innerHTML = attrs[k]; else d.setAttribute(k, attrs[k]); } (Array.isArray(children)?children:[children]).forEach(c=>{ if(!c) return; if(typeof c === 'string') d.appendChild(document.createTextNode(c)); else d.appendChild(c); }); return d; }

/* =========================
   Projects data (demo)
   Replace with your real projects
   ========================= */
const PROJECTS = [
  { id:'p1', title:'Music Player', tags:['web'], desc:'Custom lofi music player with reactive visuals, playlist management and offline caching.', progress:90, screenshot:'' },
  { id:'p2', title:'Smart Vending Machine', tags:['iot'], desc:'IoT vending prototype with REST API, telemetry and admin dashboard.', progress:72, screenshot:'' },
  { id:'p3', title:'Business Website', tags:['web'], desc:'Responsive interior decor site with CMS integration and animations.', progress:82, screenshot:'' },
  { id:'p4', title:'ML Classifier', tags:['ml'], desc:'Prototype model for image classification and insights dashboard.', progress:60, screenshot:'' },
  { id:'p5', title:'Realtime Chat', tags:['web'], desc:'Low-latency chat with WebRTC and presence features.', progress:76, screenshot:'' },
];

/* =========================
   Shader background (WebGL2 preferred)
   Exposes window.__shaderSetHover & __shaderSetTimeScale for cross-page sync
   ========================= */
(function shaderInit(){
  const canvas = document.getElementById('bg-shader');
  let gl = canvas.getContext('webgl2');
  if(!gl){ gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); if(!gl){ document.getElementById('perf').textContent = 'no WebGL'; return; } }

  function fit(){ const dpr = Math.max(1, window.devicePixelRatio||1); canvas.width = Math.floor(innerWidth * dpr); canvas.height = Math.floor(innerHeight * dpr); canvas.style.width = innerWidth+'px'; canvas.style.height = innerHeight+'px'; gl.viewport(0,0,canvas.width,canvas.height); }
  fit(); addEventListener('resize', fit);

  function compile(type, src){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.error(gl.getShaderInfoLog(s)); return null; } return s; }

  const vs = `#version 300 es
    precision mediump float;
    in vec2 a_pos; out vec2 v_uv;
    void main(){ v_uv = a_pos*0.5 + 0.5; gl_Position = vec4(a_pos,0.0,1.0); }`;

  const fs = `#version 300 es
    precision highp float;
    in vec2 v_uv; out vec4 outColor;
    uniform vec2 u_resolution; uniform float u_time; uniform vec2 u_mouse; uniform float u_hover; uniform float u_audio;
    // hash / noise
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y; }
    float fbm(vec2 p){ float v=0.; float a=0.5; for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.; a *= 0.5; } return v; }
    void main(){
      vec2 uv = v_uv; vec2 p = uv*2.0 - 1.0; p.x *= u_resolution.x/u_resolution.y;
      float t = u_time * 0.55;
      vec2 m = (u_mouse / u_resolution) * 2.0 - 1.0; m.x *= u_resolution.x/u_resolution.y;
      float dist = length(p - m);
      vec2 q = p + vec2(sin(t*0.35 + p.y*2.2)*0.012, cos(t*0.27 + p.x*2.2)*0.012);
      q += (p - m) * u_hover * exp(-dist*8.0) * 0.45;
      float n = fbm(q * (1.6 + u_audio*1.0) + t*0.06);
      vec3 base = mix(vec3(0.01,0.01,0.03), vec3(0.02,0.04,0.08), uv.y);
      vec3 neon = mix(vec3(0.02,0.6,0.5), vec3(0.65,0.18,1.0), n*0.6);
      vec3 col = base + neon * (n*0.8 + 0.06) * (0.9 + u_audio*0.65);

      float gx = abs(fract(uv.x * (12.0 + u_audio*8.0)) - 0.5);
      float gy = abs(fract(uv.y * (12.0 + u_audio*8.0)) - 0.5);
      float grid = (1.0 - smoothstep(0.495,0.5,gx))*0.18 + (1.0 - smoothstep(0.495,0.5,gy))*0.08;
      col += vec3(0.0,0.22,0.32) * grid * 0.06;

      // pointer bloom
      col += 0.35 * exp(-dist*8.0) * vec3(0.6,0.12,1.0) * u_hover;

      col = pow(clamp(col,0.,1.), vec3(0.95));
      outColor = vec4(col,1.0);
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
  const uMouse = gl.getUniformLocation(prog,'u_mouse');
  const uHover = gl.getUniformLocation(prog,'u_hover');
  const uAudio = gl.getUniformLocation(prog,'u_audio');

  let start = performance.now();
  const state = { mouse:[innerWidth/2, innerHeight/2], hover:0, timeScale:1.0, targetTimeScale:1.0, audio:0 };

  window.addEventListener('mousemove', e => { state.mouse = [e.clientX, innerHeight - e.clientY]; });

  // Exposed API for other pages / interactions
  window.__shaderSetHover = (x,y, len=700) => { state.mouse = [x, innerHeight - y]; state.hover = 1.0; setTimeout(()=> state.hover = 0.0, len); };
  window.__shaderSetTimeScale = (v) => { state.targetTimeScale = Math.max(0.0001, Math.min(1, v)); };
  window.__shaderSetAudio = (v) => { state.audio = Math.max(0, Math.min(1, v)); };

  function render(now){
    const t = (now - start)/1000;
    state.timeScale += (state.targetTimeScale - state.timeScale) * 0.08;
    gl.useProgram(prog);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t * state.timeScale);
    gl.uniform2f(uMouse, state.mouse[0] || canvas.width/2, state.mouse[1] || canvas.height/2);
    gl.uniform1f(uHover, state.hover || 0.0);
    gl.uniform1f(uAudio, state.audio || 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();

/* =========================
   Particles engine (neon orbs, audio-reactive)
   Exposes window.__particlesSetSpeed for other pages
   ========================= */
const particles = (function(){
  const canvas = document.getElementById('particles'); const ctx = canvas.getContext('2d', { alpha:true });
  let W=innerWidth, H=innerHeight; function fit(){ W=innerWidth; H=innerHeight; canvas.width=W; canvas.height=H; canvas.style.width=W+'px'; canvas.style.height=H+'px'; }
  fit(); addEventListener('resize', fit);

  let pool = []; function build(n=120){ pool=[]; for(let i=0;i<n;i++){ pool.push({ x:Math.random()*W, y:Math.random()*H, vx:(Math.random()-0.5)*0.6, vy:(Math.random()-0.5)*0.6, r:Math.random()*2.4+0.6, hue: 160 + Math.random()*160 }); } }
  build(120);

  let speedTarget=1, speed=1; window.__particlesSetSpeed = v => { speedTarget = Math.max(0.02, Math.min(1.0, v)); };

  function draw(){
    speed += (speedTarget - speed) * 0.12;
    ctx.clearRect(0,0,W,H);
    ctx.globalCompositeOperation = 'lighter';
    const audio = (window.__audioLevel || 0);
    for(const p of pool){
      p.x += p.vx * (1 + audio * 1.6) * speed;
      p.y += p.vy * (1 + audio * 1.6) * speed;
      if(p.x < -60) p.x = W + 60; if(p.x > W + 60) p.x = -60;
      if(p.y < -60) p.y = H + 60; if(p.y > H + 60) p.y = -60;
      const r = Math.max(0.6, p.r * (0.9 + audio*1.6));
      const grd = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*10);
      grd.addColorStop(0, `hsla(${p.hue},92%,66%,${0.95 - (0.25 * audio)})`);
      grd.addColorStop(0.25, `hsla(${p.hue},82%,46%,${0.14 + audio*0.18})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  return { rebuild: (n)=> build(n) };
})();

/* =========================
   UI: populate project cards, filters, modal
   ========================= */
(function UI(){
  const grid = document.getElementById('projectsGrid');
  const chips = Array.from(document.querySelectorAll('.chip'));
  let activeTag = 'all';

  function renderList(list){
    grid.innerHTML = '';
    list.forEach((p, idx)=>{
      const card = el('a', { href:'#', class:'card', tabindex:0, 'data-id':p.id });
      const h = el('h3', {}, p.title);
      const desc = el('p', {}, p.desc);
      // gauge SVG
      const gauge = document.createElementNS('http://www.w3.org/2000/svg','svg');
      gauge.setAttribute('class','gauge'); gauge.setAttribute('viewBox','0 0 100 100'); gauge.setAttribute('aria-hidden','true');
      gauge.innerHTML = `<defs><linearGradient id="grad-${p.id}" x1="0%" x2="100%"><stop offset="0%" stop-color="${COLORS.cyan}"/><stop offset="100%" stop-color="${COLORS.magenta}"/></linearGradient></defs>
        <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.06)" stroke-width="10" fill="none"></circle>
        <circle class="gauge-fill" cx="50" cy="50" r="40" stroke="url(#grad-${p.id})" stroke-width="10" stroke-linecap="round" fill="none" stroke-dasharray="${2*Math.PI*40}" stroke-dashoffset="${2*Math.PI*40}"></circle>`;

      const metaLeft = el('div', { class:'meta-left' }, [
        el('div', { class:'tag' }, p.tags.join(', ').toUpperCase())
      ]);
      const meta = el('div', { class:'meta' }, [ metaLeft, gauge ]);
      card.appendChild(h); card.appendChild(desc); card.appendChild(meta);

      // interactions: hover ripple to shader
      card.addEventListener('mouseenter', (e) => {
        const r = card.getBoundingClientRect(); const cx = r.left + r.width/2; const cy = r.top + r.height/2;
        window.__shaderSetHover?.(cx, cy, 500);
        card.classList.add('hover');
        // tiny tilt
        card.style.transform = 'translateY(-10px) rotateX(1deg)';
        // occasional streak
        if(Math.random()>0.82) { card.closest('.page')?.classList.add('streak'); setTimeout(()=> card.closest('.page')?.classList.remove('streak'),420); }
      });
      card.addEventListener('mouseleave', () => { card.classList.remove('hover'); card.style.transform=''; });

      // open modal
      card.addEventListener('click', (ev) => { ev.preventDefault(); openModal(p); });

      grid.appendChild(card);

      // stagger reveal
      setTimeout(()=> card.classList.add('revealed'), 120 + idx * 90);
    });

    // animate gauge fills
    document.querySelectorAll('.gauge-fill').forEach((g, i) => {
      const p = list[i];
      const circ = 2*Math.PI*40;
      const target = circ * (1 - (p.progress||70)/100);
      g.style.transition = 'stroke-dashoffset 900ms cubic-bezier(.2,.9,.25,1)';
      requestAnimationFrame(()=> g.style.strokeDashoffset = target);
    });
  }

  renderList(PROJECTS);

  // chips
  chips.forEach(ch => ch.addEventListener('click', ()=> {
    chips.forEach(c => c.classList.remove('active'));
    ch.classList.add('active');
    activeTag = ch.dataset.tag;
    applyFilters();
  }));
  // default activate "All"
  document.querySelector('.chip[data-tag="all"]').classList.add('active');

  function applyFilters(){
    // search removed — only filter by tag now
    const q = '';
    const filtered = PROJECTS.filter(p=>{
      const tagOk = activeTag === 'all' ? true : p.tags.includes(activeTag);
      const textOk = p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.tags.join(' ').includes(q);
      return tagOk && textOk;
    });
    renderList(filtered);
  }

  // modal viewer
  const modalWrap = document.getElementById('modalWrap');
  function openModal(p){
    modalWrap.innerHTML = '';
    modalWrap.style.display = 'flex'; modalWrap.setAttribute('aria-hidden','false');
    const back = el('div',{ class:'modal-back', onclick: closeModal });
    const modal = el('div',{ class:'modal', role:'dialog', tabindex:0 });
    const h = el('h2', {}, p.title);
    const media = el('div', { class:'media' }, '— screenshot / demo placeholder —');
    const desc = el('p', {}, p.desc);
    const actions = el('div', {}, [
      el('a', { href:'#', class:'chip', onclick:(ev)=>{ ev.preventDefault(); closeModal(); }}, 'Close'),
      el('a', { href:'#', class:'chip', onclick:(ev)=>{ ev.preventDefault(); alert("Open demo (replace link)"); }}, 'Open Demo'),
      el('a', { href:'#', class:'chip', onclick:(ev)=>{ ev.preventDefault(); alert("Open code (replace link)"); }}, 'View Code')
    ]);
    modal.appendChild(h); modal.appendChild(media); modal.appendChild(desc); modal.appendChild(el('div', {}, actions));
    back.appendChild(modal); modalWrap.appendChild(back);
    back.addEventListener('click', (ev) => { if(ev.target === back) closeModal(); });
    document.addEventListener('keydown', onEsc);
  }
  function closeModal(){ modalWrap.style.display='none'; modalWrap.innerHTML=''; modalWrap.setAttribute('aria-hidden','true'); document.removeEventListener('keydown', onEsc); }
  function onEsc(e){ if(e.key === 'Escape') closeModal(); }

})();

/* =========================
   Terminal mini
   ========================= */
(function Terminal(){
  const form = document.getElementById('termForm'), input = document.getElementById('termInput'), out = document.getElementById('termOut');
  function append(line){ out.innerHTML += '<div>'+line+'</div>'; out.scrollTop = out.scrollHeight; }
  form.addEventListener('submit', e=>{
    e.preventDefault();
    const v = (input.value||'').trim().toLowerCase();
    if(!v) return;
    append('&gt; '+v);
    if(v === 'help') append('commands: projects, skills, contact, status');
    else if(v === 'projects'){ append('opening projects...'); location.href='projects.html'; }
    else if(v === 'skills'){ append('opening skills...'); location.href='skills.html'; }
    else if(v === 'contact'){ append('opening contact...'); location.href='contact.html'; }
    else if(v === 'status'){ append('visual status: shader+particles active'); }
    else append('unknown command — type help');
    input.value = '';
  });
})();

/* =========================
   Audio analyser hook (optional)
   Connect your analyser and update window.__audioLevel to drive visuals
   Example sets window.__audioLevel = 0..1
   ========================= */
window.__audioLevel = 0.0; // external code can write here (skills page uses similar pattern)

/* =========================
   quick bindings
   ========================= */
document.getElementById('resetBtn').addEventListener('click', ()=> location.reload());

/* =========================
   Auto-tune & boot messages
   ========================= */
(function Boot(){
  // tune particle counts based on deviceMemory
  const mem = navigator.deviceMemory || 4;
  if(mem <= 1){ particles.rebuild(28); document.getElementById('perf').textContent='low-power'; }
  else if(mem <= 2){ particles.rebuild(64); document.getElementById('perf').textContent='balanced'; }
  else { particles.rebuild(140); document.getElementById('perf').textContent='max visuals'; }
})();
