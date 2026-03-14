/* =========================
   GLOBAL CONFIG & HELPERS
   ========================= */
const cfg = {
  particleMax: 220,        // max particle count (canvas)
  particleBase: 120,       // base for balanced mode
  shaderQuality: 'high',   // affects internal shader uniforms if needed
  audioEnabled: false,
};

const ui = {
  perf: document.getElementById('perf'),
  modeSelect: document.getElementById('modeSelect'),
  micBtn: document.getElementById('micBtn'),
  demoAudioBtn: document.getElementById('demoAudioBtn'),
  resetBtn: document.getElementById('resetBtn'),
};

ui.modeSelect.addEventListener('change', () => {
  const v = ui.modeSelect.value;
  if (v === 'max') { cfg.particleCount = cfg.particleMax; cfg.shaderQuality = 'high'; setPerf('mode: max'); }
  if (v === 'balanced') { cfg.particleCount = cfg.particleBase; cfg.shaderQuality = 'med'; setPerf('mode: balanced'); }
  if (v === 'low') { cfg.particleCount = Math.floor(cfg.particleBase/2); cfg.shaderQuality = 'low'; setPerf('mode: low'); }
  particles.rebuild(); // update particle pool
});

ui.resetBtn.addEventListener('click', () => location.reload());

function setPerf(s){ ui.perf.textContent = `perf: ${s}`; }

 /* respect prefers-reduced-motion */
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) { ui.modeSelect.value = 'low'; ui.modeSelect.dispatchEvent(new Event('change')); }

/* =========================
   WebAudio: analyser -> values
   ========================= */
let audioCtx = null;
let analyser = null;
let audioSource = null;
let audioBins = null;
let audioLevel = 0.0;
let audioStream = null;
let demoOscillator = null;

async function enableMic() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioStream = stream;
    if (audioSource) audioSource.disconnect();
    audioSource = audioCtx.createMediaStreamSource(stream);
    setupAnalyser();
    audioSource.connect(analyser);
    cfg.audioEnabled = true;
    ui.micBtn.textContent = 'Mic ON';
    setPerf('mic enabled');
  } catch (e) {
    console.warn('mic failed', e);
    ui.micBtn.textContent = 'Mic failed';
  }
}

function startDemoAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (demoOscillator) { demoOscillator.stop(); demoOscillator = null; ui.demoAudioBtn.textContent = 'Demo Audio'; return; }
  demoOscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  demoOscillator.type = 'sine';
  demoOscillator.frequency.value = 110; // base
  demoOscillator.connect(gain);
  gain.gain.value = 0.04;
  gain.connect(audioCtx.destination);
  demoOscillator.start();
  // connect analyser if available
  if (!analyser) setupAnalyser();
  const node = audioCtx.createOscillator();
  // Instead of creating multiple, simply use demoOscillator through a MediaStreamDestination? Simpler: connect analyser to destination via Gain node
  // For demo, create an internal oscillator -> analyser via ScriptProcessor alternative:
  const dest = audioCtx.createMediaStreamDestination();
  // Not necessary — simpler approach: use Oscillator + analyser via a gain node
  const demoGain = audioCtx.createGain();
  demoOscillator.disconnect(); demoOscillator.connect(demoGain);
  demoGain.connect(analyser);
  demoGain.connect(audioCtx.destination);
  ui.demoAudioBtn.textContent = 'Demo ON';
  setPerf('demo audio');
}

function setupAnalyser() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = analyser || audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  audioBins = new Uint8Array(analyser.frequencyBinCount);
}

/* simple audio sampling loop */
function audioTick() {
  if (!analyser) return;
  analyser.getByteFrequencyData(audioBins);
  // compute normalized avg (rough)
  let sum = 0;
  let len = audioBins.length;
  for (let i = 0; i < len; i++) sum += audioBins[i];
  const avg = sum / (len * 255);
  audioLevel = Math.min(1.0, Math.max(0.0, (avg * 1.8)));
  // also compute a small low-frequency/bass indicator
  let bass = 0;
  for (let i = 0; i < 8; i++) bass += audioBins[i];
  bass /= (8 * 255);
  audioLevel = Math.max(audioLevel, bass * 1.6);
  requestAnimationFrame(audioTick);
}

/* UI binding */
ui.micBtn.addEventListener('click', async () => {
  if (cfg.audioEnabled) {
    // turn off
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
      audioStream = null;
    }
    ui.micBtn.textContent = 'Enable Mic';
    cfg.audioEnabled = false;
    setPerf('mic off');
  } else {
    await enableMic();
    audioTick();
  }
});
ui.demoAudioBtn.addEventListener('click', () => {
  if (demoOscillator) {
    demoOscillator.stop(); demoOscillator = null; ui.demoAudioBtn.textContent = 'Demo Audio';
  } else {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (!analyser) setupAnalyser();
    // quick demo: play a pulsing oscillator using setInterval to modulate freq
    demoOscillator = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    demoOscillator.type = 'sine'; demoOscillator.frequency.value = 220;
    g.gain.value = 0.02;
    demoOscillator.connect(g); g.connect(analyser); g.connect(audioCtx.destination);
    demoOscillator.start();
    ui.demoAudioBtn.textContent = 'Demo ON';
    audioTick();
    setPerf('demo audio running');
  }
});

/* =========================
   WEBGL shader background
   Lightweight multi-uniform shader:
   - u_time
   - u_resolution
   - u_mouse
   - u_audio (float 0..1)
   - u_hover (0..1)
   ========================= */
(function initShader() {
  const canvas = document.getElementById('bg-shader');
  let gl = canvas.getContext('webgl2'); // prefer webgl2
  const isWebGL2 = !!gl;
  if (!isWebGL2) {
    // fallback to webgl1; use earlier simpler shader path
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      console.warn('No WebGL available; background shader disabled.');
      return;
    }
  }

  // resize
  function fit() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  fit(); addEventListener('resize', fit);

  // compile helper
  function compile(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('shader compile error:', gl.getShaderInfoLog(s));
      console.log(source);
      return null;
    }
    return s;
  }

  // vertex shader: full-screen quad
  const vertexSrc = `#version 300 es
    precision mediump float;
    in vec2 a_pos;
    out vec2 v_uv;
    void main(){
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

  // fragment shader (WebGL2) - fbm + grid + audio-reactive warp + subtle bloom-ish feel
  const fragmentSrc = `#version 300 es
    precision highp float;
    out vec4 outColor;
    in vec2 v_uv;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;
    uniform float u_audio; // 0..1
    uniform float u_hover; // 0..1

    // hash / noise
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
    float noise(in vec2 p){
      vec2 i=floor(p);vec2 f=fract(p);
      float a=hash(i), b=hash(i+vec2(1.0,0.0));
      float c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
      vec2 u=f*f*(3.0-2.0*f);
      return mix(a,b,u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
    }
    float fbm(vec2 p){
      float v=0.0, a=0.5;
      for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }

    void main(){
      vec2 uv = v_uv;
      vec2 p = uv*2.0 - 1.0;
      p.x *= u_resolution.x / u_resolution.y;

      // audio-driven intensity
      float audio = clamp(u_audio, 0.0, 1.0);
      float t = u_time * 0.6;

      // mouse (NDC)
      vec2 m = (u_mouse / u_resolution);
      vec2 mc = m * 2.0 - 1.0;
      mc.x *= u_resolution.x / u_resolution.y;
      float dist = length(p - mc);

      // layered fbm
      vec2 q = p + vec2(sin(t*0.35 + p.y*3.0)*0.02, cos(t*0.27 + p.x*3.0)*0.02);
      q += (p - mc) * u_hover * exp(-dist * 6.0) * 0.45;
      float n = fbm(q * (1.6 + audio*0.9) + t*0.06);

      // base gradient + neon mix
      vec3 base = mix(vec3(0.01,0.01,0.03), vec3(0.02,0.04,0.08), uv.y);
      vec3 neon = mix(vec3(0.0,0.92,0.9), vec3(0.67,0.18,1.0), n);
      vec3 col = base + neon * (n*0.9 + 0.15) * (0.9 + audio*0.65);

      // grid lines - crisp
      float gx = abs(fract(uv.x * (12.0 + audio*8.0)) - 0.5);
      float gy = abs(fract(uv.y * (12.0 + audio*8.0)) - 0.5);
      float grid = (1.0 - smoothstep(0.495,0.5,gx)) * 0.5 + (1.0 - smoothstep(0.495,0.5,gy)) * 0.25;
      col += vec3(0.0,0.36,0.5) * grid * 0.18;

      // rippled radial glows around audio
      col += 0.35 * exp(-dist*8.0) * vec3(0.8, 0.15, 1.0) * u_hover;

      // scanlines & film grain driven by audio
      float scan = sin((uv.y + t*0.02) * 900.0) * 0.02 * (0.7 + audio*0.8);
      col += scan;

      // subtle vignette
      vec2 center = vec2(0.5);
      float v = smoothstep(0.9, 0.2, length(uv - center));
      col *= 1.0 - 0.6*(1.0 - v);

      // final tone & tiny color grading
      col = pow(clamp(col, 0.0, 1.0), vec3(0.92));
      outColor = vec4(col, 1.0);
    }`;

  // compile & link (WebGL2 path)
  let program, aPosLoc, uResLoc, uTimeLoc, uMouseLoc, uAudioLoc, uHoverLoc;
  try {
    const vs = compile(gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    program = gl.createProgram();
    gl.attachShader(program, vs); gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('program link error', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    // attributes/uniforms
    aPosLoc = gl.getAttribLocation(program, 'a_pos');
    uResLoc = gl.getUniformLocation(program, 'u_resolution');
    uTimeLoc = gl.getUniformLocation(program, 'u_time');
    uMouseLoc = gl.getUniformLocation(program, 'u_mouse');
    uAudioLoc = gl.getUniformLocation(program, 'u_audio');
    uHoverLoc = gl.getUniformLocation(program, 'u_hover');
  } catch (e) {
    console.error('shader init error', e);
    return;
  }

  // full screen quad buffer
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

  // enable attribute
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

  // uniforms initial
  const state = { mouseX: canvas.width/2, mouseY: canvas.height/2, hover: 0 };

  // hook mouse & hover interactions (used to create local holographic ripples)
  window.addEventListener('mousemove', e => {
    state.mouseX = e.clientX;
    state.mouseY = canvas.height - e.clientY; // invert Y for shader path (matches earlier shader assumption)
  });

  // connect card hover to produce stronger hover ripple
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mouseenter', e => {
      const r = card.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      state.mouseX = cx;
      state.mouseY = canvas.height - cy;
      state.hover = 1.0;
      setTimeout(()=> state.hover = 0.0, 900);
    });
    card.addEventListener('mousemove', e => {
      state.mouseX = e.clientX;
      state.mouseY = canvas.height - e.clientY;
      state.hover = 1.0;
      clearTimeout(card._ht);
      card._ht = setTimeout(()=> state.hover = 0.0, 700);
    });
  });

  // animation loop
  let start = performance.now();
  function loop(now) {
    const t = (now - start) / 1000;
    gl.useProgram(program);
    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.uniform1f(uTimeLoc, t);
    // pass mouse in canvas pixel coordinates (matching the shader expectation)
    const mx = state.mouseX || (canvas.width/2);
    const my = (canvas.height) - (state.mouseY || (canvas.height/2)); // map back if needed
    gl.uniform2f(uMouseLoc, mx, my);
    gl.uniform1f(uAudioLoc, audioLevel || 0.0);
    gl.uniform1f(uHoverLoc, state.hover || 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

/* =========================
   Canvas particles (additive neon orbs)
   - audio-reactive: audioLevel controls intensity and size
   - performance toggle via cfg.particleCount
   ========================= */
const particles = (function ParticleEngine() {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d', { alpha: true });
  let W = innerWidth, H = innerHeight;
  let pool = [];
  function fit() { W = innerWidth; H = innerHeight; canvas.width = W; canvas.height = H; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
  fit(); addEventListener('resize', fit);

  // build pool
  function rebuild() {
    pool = [];
    const target = cfg.particleCount || cfg.particleBase;
    const N = Math.max(16, Math.min(1000, Math.floor(target)));
    for (let i = 0; i < N; i++) {
      pool.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2.6 + 0.6,
        hue: Math.random() * 360,
        life: Math.random() * 1.0
      });
    }
  }

  // initial counts depend on mode
  cfg.particleCount = cfg.particleBase;
  rebuild();

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const intensity = 0.6 + (audioLevel || 0) * 1.6;
    const baseScale = 0.6 + (audioLevel || 0) * 2.4;
    for (const p of pool) {
      p.x += p.vx * (1 + audioLevel*1.5);
      p.y += p.vy * (1 + audioLevel*1.5);
      // wrap
      if (p.x < -60) p.x = W + 60; if (p.x > W + 60) p.x = -60;
      if (p.y < -60) p.y = H + 60; if (p.y > H + 60) p.y = -60;

      const hue = (p.hue + (Math.sin((p.x + p.y) / 200) * 30)) | 0;
      const r = Math.max(0.6, p.r * baseScale);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 10);
      g.addColorStop(0, `hsla(${hue},92%,66%,${0.95 * intensity})`);
      g.addColorStop(0.25, `hsla(${hue},85%,55%,${0.28 * intensity})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  return { rebuild, setCount: (n) => { cfg.particleCount = n; rebuild(); } };
})();

/* =========================
   UI interactions: reveal cards, gauge animations
   ========================= */
(function UI() {
  const cards = Array.from(document.querySelectorAll('.card'));
  cards.forEach((c, i) => setTimeout(() => c.classList.add('revealed'), 160 + i * 140));

  // animate SVG gauge fills
  document.querySelectorAll('.card').forEach(card => {
    const fill = card.querySelector('.gauge-fill');
    const pct = parseInt(card.getAttribute('data-progress') || '75', 10);
    if (fill) {
      const circumference = 2 * Math.PI * 40;
      const target = circumference * (1 - pct / 100);
      fill.style.transition = 'stroke-dashoffset 900ms cubic-bezier(.2,.9,.25,1)';
      requestAnimationFrame(() => fill.style.strokeDashoffset = target);
    }
  });

  // small glitch on hover
  document.querySelectorAll('a.card').forEach(c => {
    const h = c.querySelector('h3');
    c.addEventListener('mouseenter', () => {
      h.dataset.text = h.textContent;
      h.style.transition = 'transform 160ms ease';
      h.style.transform = 'translate3d(6px,-3px,0) skewX(-2deg)';
      setTimeout(() => { h.style.transform = ''; }, 140);
    });
  });

  // typewriter about text
  const aboutLines = [
    "I am a B.E. student in Computer Science and Engineering (CSE), passionate about web development.",
    "I love building user-friendly websites and improving my skills in front-end technologies like HTML, CSS, and JavaScript.",
    "My goal is to work on meaningful projects that make a difference and help me grow as a developer."
  ];
  const container = document.getElementById('about-text');
  let li = 0;
  function typeNext() {
    if (li >= aboutLines.length) return;
    const div = document.createElement('div'); container.appendChild(div);
    let k = 0;
    function step() {
      if (k < aboutLines[li].length) { div.textContent += aboutLines[li].charAt(k++); setTimeout(step, reduced ? 0 : 28); }
      else { li++; setTimeout(typeNext, reduced ? 0 : 420); }
    }
    step();
  }
  typeNext();
})();

/* =========================
   Terminal mini
   ========================= */
(function Terminal() {
  const form = document.getElementById('termForm');
  const input = document.getElementById('termInput');
  const out = document.getElementById('termOut');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value.trim().toLowerCase();
    if (!v) return;
    out.innerHTML += '<div>> ' + escapeHTML(v) + '</div>';
    if (v === 'help') {
      out.innerHTML += '<div>commands: <strong>projects</strong>, <strong>skills</strong>, <strong>contact</strong>, <strong>status</strong></div>';
    } else if (v === 'projects') {
      // use SPA navigation if available to avoid white flash
      const t = 'projects.html';
      if (window.spaNavigate) window.spaNavigate(t); else location.href = t;
    }
    else if (v === 'skills') {
      const t = 'skills.html';
      if (window.spaNavigate) window.spaNavigate(t); else location.href = t;
    }
    else if (v === 'contact') {
      const t = 'contact.html';
      if (window.spaNavigate) window.spaNavigate(t); else location.href = t;
    }
    else if (v === 'status') { out.innerHTML += `<div>audio:${cfg.audioEnabled?'on':'off'} audioLevel:${(audioLevel||0).toFixed(2)}</div>`; }
    else { out.innerHTML += '<div>unknown command</div>'; }
    input.value = ''; out.scrollTop = out.scrollHeight;
  });

  function escapeHTML(s) { return s.replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));}
})();

/* =========================
   Boot / startup tuning
   - Set default mode
   - Start audio tick loop if demo enabled
   ========================= */
(function Boot(){
  // sensible default based on device
  const cores = navigator.hardwareConcurrency || 4;
  if (cores >= 8) ui.modeSelect.value = 'max';
  else if (cores >= 4) ui.modeSelect.value = 'balanced';
  else ui.modeSelect.value = 'low';
  ui.modeSelect.dispatchEvent(new Event('change'));

  // start audio tick loop if analyser exists
  if (analyser) requestAnimationFrame(audioTick);

  // small perf message
  setPerf('ready — visual engine loaded');

  // ensure particles rebuilt with initial cfg
  particles.rebuild?.();
})();

/* =========================
   Safety: respect reduced motion & power saver
   - if low-power device or reduced motion, lower counts
   ========================= */
(function Autotune() {
  const mem = navigator.deviceMemory || 4;
  if (mem <= 1) {
    // very low memory devices: switch to low
    ui.modeSelect.value = 'low';
    ui.modeSelect.dispatchEvent(new Event('change'));
    setPerf('auto low-memory mode');
  }
  const mobile = /Mobi|Android/i.test(navigator.userAgent);
  if (mobile) {
    ui.modeSelect.value = 'low';
    ui.modeSelect.dispatchEvent(new Event('change'));
    setPerf('mobile mode');
  }
})();

/* =========================
   SPA navigation + overlay
   - intercepts same-origin internal links
   - falls back to normal navigation on failure or reduced motion
   - swaps `section.panel` or `.page` region (so canvases + top UI stay persistent)
   ========================= */
(function(){
  const overlay = document.getElementById('spa-overlay') || (function(){ const d=document.createElement('div'); d.id='spa-overlay'; document.body.appendChild(d); return d; })();
  function prefersReducedMotion(){ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function showOverlay(){ overlay.classList.add('show'); }
  function hideOverlay(){ overlay.classList.remove('show'); }

  const PANEL_SELECTOR = 'section.panel, .page';

  function findPanel(doc){ return doc.querySelector(PANEL_SELECTOR); }

  async function swapPanel(newPanelNode, url, pushState=true){
    if(!newPanelNode) return false;
    const oldPanel = document.querySelector(PANEL_SELECTOR);
    if(!oldPanel) return false;

    // ensure classes for animation
    newPanelNode.classList.add(...(newPanelNode.classList.contains('page')? ['page','spa-fade-in'] : ['panel','spa-fade-in']));

    try{
      oldPanel.parentNode.insertBefore(newPanelNode, oldPanel.nextSibling);
      requestAnimationFrame(()=>{
        oldPanel.classList.add('spa-fade-out');
        setTimeout(()=>{ try{ oldPanel.remove(); }catch(e){}; newPanelNode.classList.remove('spa-fade-in'); }, 300);
      });
    }catch(e){
      oldPanel.replaceWith(newPanelNode);
    }

    // update title from fetched document (if present)
    try{ if(newPanelNode.ownerDocument && newPanelNode.ownerDocument.title) document.title = newPanelNode.ownerDocument.title; }catch(e){}

    if(pushState && url){
      try{ history.pushState({spa:true,url:url}, '', url); }catch(e){}
    }

    // minimal re-init after swap
    reinitAfterSwap();
    return true;
  }

  async function spaNavigate(href){
    if(prefersReducedMotion()){ location.href = href; return; }
    showOverlay();
    // let overlay paint
    await new Promise(r => requestAnimationFrame(r));
    try{
      const resp = await fetch(href, { credentials: 'same-origin' });
      if(!resp.ok) throw new Error('fetch failed ' + resp.status);
      const text = await resp.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const newPanel = findPanel(doc);
      if(!newPanel){ location.href = href; return; }
      const cloned = newPanel.cloneNode(true);
      if(doc.title) document.title = doc.title;
      await swapPanel(cloned, href, true);
      setTimeout(()=> hideOverlay(), 120);
    }catch(err){
      console.warn('SPA navigation failed', err);
      location.href = href;
    }
  }

  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('a');
    if(!a || !a.href) return;
    if(a.hasAttribute('data-no-spa')) return;
    if(a.target && a.target !== '') return;
    if(a.hasAttribute('download')) return;
    const hrefAttr = a.getAttribute('href') || '';
    if(/^(mailto:|tel:|https?:\/\/)/i.test(hrefAttr) && (hrefAttr.indexOf(location.origin) !== 0)) return;
    const url = new URL(a.href, location.href);
    if(url.origin !== location.origin) return;
    if(url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    spaNavigate(url.href);
  });

  window.spaNavigate = spaNavigate;

  window.addEventListener('popstate', async function(ev){
    const href = location.href;
    if(prefersReducedMotion()){ location.href = href; return; }
    showOverlay();
    try{
      const resp = await fetch(href, { credentials: 'same-origin' });
      if(!resp.ok) throw new Error('fetch failed');
      const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
      const newPanel = findPanel(doc);
      if(!newPanel){ location.href = href; return; }
      const cloned = newPanel.cloneNode(true);
      if(doc.title) document.title = doc.title;
      await swapPanel(cloned, href, false);
      setTimeout(()=> hideOverlay(), 120);
    }catch(e){
      location.href = href;
    }
  });

  function reinitAfterSwap(){
    // update particles if available
    try{ if(window.particles && typeof window.particles.rebuild === 'function') window.particles.rebuild(); }catch(e){}
    // focus a main heading for accessibility
    try{
      const p = document.querySelector(PANEL_SELECTOR);
      if(p){
        const heading = p.querySelector('h2, h1, .title');
        if(heading){ heading.setAttribute('tabindex','-1'); heading.focus(); heading.removeAttribute('tabindex'); }
      }
    }catch(e){}
    // small delay to allow page scripts to re-run if they self-init (they won't auto-run on fetch)
    // (We intentionally avoid heavy re-initialization to keep this non-invasive.)
  }
})();
