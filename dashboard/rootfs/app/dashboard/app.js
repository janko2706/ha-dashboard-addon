/**
 * Floor plan dashboard — app.js
 */

// ── Scale 1920×1080 canvas to fill whatever screen size the browser reports ──
// The Pi may boot at 640×800 if HDMI is not detected in time (display and Pi
// share the same power rail). This scales the fixed-size body down to fit
// rather than clipping or zooming. The permanent fix is hdmi_force_hotplug=1
// in /boot/firmware/config.txt — see the add-on documentation.
(function fitToScreen() {
  function apply() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.body.style.transform = 'scale(' + s + ')';
  }
  apply();
  window.addEventListener('resize', apply);
})();

// ── Room layout ────────────────────────────────────────────────────────────
// climate.temp/hum: SVG source coordinates used to position Chart.js gauge widgets.
const ROOMS = {
  wohnzimmer: {
    highlight:   { shape: 'rect', x: 190, y: 87, w: 58, h: 43 },
    bulb:        { cx: 219, cy: 99 },
    climate:     { temp: { svgCx: 204, svgCy: 121 }, hum: { svgCx: 234, svgCy: 121 } },
    wallGroupId: 'Wohnzimmer',
  },
  schlafzimmer: {
    highlight:   { shape: 'polygon', pts: '281,87 340,87 340,129 296,129 296,115 281,115' },
    bulb:        { cx: 310, cy: 95 },
    climate:     { temp: { svgCx: 295, svgCy: 115 }, hum: { svgCx: 322, svgCy: 115 } },
    wallGroupId: 'Schlafzimmer',
  },
  flur: {
    highlight:   { shape: 'polygon', pts: '249,115 296,115 296,140 281,140 281,191 249,191' },
    bulb:        { cx: 263, cy: 165 },
    presence:    { type: 'dot', cx: 264, cy: 128 },
    wallGroupId: 'Flur',
  },
  toilette: {
    highlight:   null,
    bulb:        null,
    presence:    { type: 'text', cx: 289, cy: 152 },
    wallGroupId: 'Toilette',
  },
  badezimmer: {
    highlight:   { shape: 'rect', x: 296, y: 129, w: 43, h: 36 },
    bulb:        null,
    climate:     { temp: { svgCx: 308, svgCy: 152 }, hum: { svgCx: 329, svgCy: 152 } },
    wallGroupId: 'Badezimmer',
  },
};

// ── Runtime state ──────────────────────────────────────────────────────────
let haUrl             = '';
let haToken           = '';
let humidityThreshold = 70;
let entityConfig      = {};
let entityLookup      = {};
const haStates        = {};
const gaugeCharts     = {};   // 'room-which' → Chart instance

let ws    = null;
let msgId = 1;
const pending = {};

function nextId() { return msgId++; }

// ── Clock ──────────────────────────────────────────────────────────────────
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 10_000);
updateClock();

// ── Status bar ─────────────────────────────────────────────────────────────
function setStatus(text, cls = '') {
  const el = document.getElementById('ws-status');
  el.textContent = text;
  el.className = 'topbar__status' + (cls ? ' ' + cls : '');
}

// ── SVG helpers ────────────────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

// ── SVG → screen coordinate conversion ────────────────────────────────────
// ViewBox and floorplan div dimensions must stay in sync with loadFloorplan().
const VB_X = 158, VB_Y = 83, VB_W = 214, VB_H = 114;
const FP_W = 1920, FP_H = 1024;  // 1080 - 56px topbar

function svgToScreen(svgX, svgY) {
  return {
    x: (svgX - VB_X) / VB_W * FP_W,
    y: (svgY - VB_Y) / VB_H * FP_H,
  };
}

// ── Chart.js threshold-line plugin ────────────────────────────────────────
// Draws a radial line from inner to outer radius at the threshold angle.
const thresholdPlugin = {
  id: 'gaugeThreshold',
  afterDraw(chart) {
    const thresh = chart.config.options._threshold;
    if (thresh == null) return;
    const arc = chart.getDatasetMeta(0).data[0];
    if (!arc) return;
    const { ctx } = chart;
    // rotation=180°, circumference=180° clockwise → from left through TOP to right.
    // At progress=0 → angle π (left), 0.5 → 3π/2 (top), 1 → 2π=0 (right).
    const angle = Math.PI * (1 + thresh);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(arc.x + arc.innerRadius * Math.cos(angle), arc.y + arc.innerRadius * Math.sin(angle));
    ctx.lineTo(arc.x + arc.outerRadius * Math.cos(angle), arc.y + arc.outerRadius * Math.sin(angle));
    ctx.strokeStyle = '#cc3333';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();
  },
};

// ── Gauge widget (Chart.js) ────────────────────────────────────────────────
const GAUGE_W = 130, GAUGE_H = 80;

function createGaugeWidget(room, which, svgCx, svgCy, unit, thresholdP) {
  const sc = svgToScreen(svgCx, svgCy);

  const wrap = document.createElement('div');
  wrap.className = 'gauge-wrap';
  // Position so the arc's flat edge (bottom of the half-circle) aligns with svgCy on screen.
  // Arc center in canvas is at (GAUGE_W/2, GAUGE_H * 0.78).
  wrap.style.left = `${Math.round(sc.x - GAUGE_W / 2)}px`;
  wrap.style.top  = `${Math.round(sc.y - GAUGE_H * 0.78)}px`;

  const canvas = document.createElement('canvas');
  canvas.width  = GAUGE_W;
  canvas.height = GAUGE_H;
  wrap.appendChild(canvas);

  const label = document.createElement('div');
  label.className = 'gauge-label';
  label.textContent = which === 'temp' ? '°C' : '%';
  wrap.appendChild(label);

  const valDiv = document.createElement('div');
  valDiv.className = 'gauge-val';
  valDiv.id = `gval-${room}-${which}`;
  valDiv.textContent = '--';
  wrap.appendChild(valDiv);

  document.getElementById('floorplan').appendChild(wrap);

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [0.001, 0.999],
        backgroundColor: ['#3a86c8', '#1c1c1c'],
        borderWidth: 0,
        borderRadius: 3,
      }],
    },
    options: {
      rotation: 180,
      circumference: 180,
      cutout: '68%',
      responsive: false,
      animation: { duration: 400 },
      plugins: {
        legend:  { display: false },
        tooltip: { enabled: false },
        gaugeThreshold: {},
        _threshold: thresholdP,
      },
      _threshold: thresholdP,
    },
    plugins: [thresholdPlugin],
  });

  gaugeCharts[`${room}-${which}`] = chart;
}

function initGauges() {
  const humP  = Math.max(0, Math.min(1, humidityThreshold / 100));
  const tempP = (25 - (-10)) / 60;  // fixed comfort threshold at 25°C

  for (const [room, cfg] of Object.entries(ROOMS)) {
    if (!cfg.climate) continue;
    createGaugeWidget(room, 'temp', cfg.climate.temp.svgCx, cfg.climate.temp.svgCy, '°C', tempP);
    createGaugeWidget(room, 'hum',  cfg.climate.hum.svgCx,  cfg.climate.hum.svgCy,  '%',  humP);
  }
}

// ── Floor plan setup ───────────────────────────────────────────────────────
let svgRoot  = null;
let overlayG = null;

async function loadFloorplan() {
  const resp = await fetch('/floorplan.svg');
  const text = await resp.text();
  const container = document.getElementById('floorplan');
  container.innerHTML = text;

  svgRoot = container.querySelector('svg');
  svgRoot.setAttribute('viewBox', `${VB_X} ${VB_Y} ${VB_W} ${VB_H}`);
  svgRoot.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgRoot.style.cssText = 'width:100%;height:100%;display:block;position:absolute;top:0;left:0;';

  adaptColors(svgRoot);
  addGlowFilter(svgRoot);

  overlayG = svgEl('g', { id: 'ha-overlays' });
  svgRoot.appendChild(overlayG);

  fixDoubleWalls();
  buildOverlays();
}

function adaptColors(svg) {
  svg.querySelectorAll('rect').forEach(el => {
    if (el.getAttribute('width') === '562' && el.getAttribute('height') === '364')
      el.setAttribute('fill', '#0d0d0d');
  });
  svg.querySelectorAll('path[mask]').forEach(el => {
    if (el.getAttribute('fill') === 'black') el.setAttribute('fill', '#686868');
  });
  svg.querySelectorAll('path[fill="white"]').forEach(el => {
    if (!el.closest('mask')) el.setAttribute('fill', '#0d0d0d');
  });
  svg.querySelectorAll('rect[stroke="black"]').forEach(el => {
    el.setAttribute('stroke', '#686868');
    el.setAttribute('fill', 'none');
  });
  svg.querySelectorAll('[id$="_2"]').forEach(el => {
    el.setAttribute('fill', '#4a4a4a');
  });
}

// Cover confirmed double-wall overlaps with background-color separators.
function fixDoubleWalls() {
  const bg  = '#0d0d0d';
  const sep = svgEl('g', { id: 'wall-sep' });
  // HWR bottom + Flur top both draw at y≈115–116
  sep.appendChild(svgEl('rect', { x: 249,   y: 115,   width: 32,  height: 1.2, fill: bg }));
  // Toilette right + Badezimmer left both draw at x≈296–297
  sep.appendChild(svgEl('rect', { x: 295.8, y: 140,   width: 1.5, height: 26,  fill: bg }));
  svgRoot.appendChild(sep);
}

function addGlowFilter(svg) {
  let defs = svg.querySelector('defs');
  if (!defs) { defs = svgEl('defs'); svg.insertBefore(defs, svg.firstChild); }
  const f     = svgEl('filter', { id: 'glow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
  const blur  = svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '1.5', result: 'blur' });
  const merge = svgEl('feMerge');
  merge.appendChild(svgEl('feMergeNode', { in: 'blur' }));
  merge.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
  f.appendChild(blur); f.appendChild(merge);
  defs.appendChild(f);
}

// ── Build SVG overlays (bulb, presence, highlights) ────────────────────────
function buildOverlays() {
  for (const [room, cfg] of Object.entries(ROOMS)) {

    if (cfg.highlight) {
      let el;
      if (cfg.highlight.shape === 'rect') {
        el = svgEl('rect', {
          x: cfg.highlight.x, y: cfg.highlight.y,
          width: cfg.highlight.w, height: cfg.highlight.h,
          fill: '#ff2222', 'fill-opacity': '0',
          class: 'room-hl', id: `hl-${room}`,
        });
      } else {
        el = svgEl('polygon', {
          points: cfg.highlight.pts,
          fill: '#ff2222', 'fill-opacity': '0',
          class: 'room-hl', id: `hl-${room}`,
        });
      }
      overlayG.appendChild(el);
    }

    if (cfg.bulb) {
      const g = svgEl('g', {
        id: `bulb-${room}`,
        transform: `translate(${cfg.bulb.cx},${cfg.bulb.cy})`,
      });
      g.appendChild(svgEl('circle', { cx: '0', cy: '-2', r: '2.8', id: `globe-${room}`, fill: '#484848' }));
      g.appendChild(svgEl('rect', { x: '-1.5', y: '0.8',  width: '3',   height: '1.2', rx: '0.3', class: 'bulb-base' }));
      g.appendChild(svgEl('rect', { x: '-1.1', y: '2.1',  width: '2.2', height: '0.9', rx: '0.3', class: 'bulb-base' }));
      overlayG.appendChild(g);
    }

    if (cfg.presence) {
      if (cfg.presence.type === 'dot') {
        overlayG.appendChild(svgEl('circle', {
          id: `presence-${room}`,
          cx: cfg.presence.cx, cy: cfg.presence.cy, r: '2.2',
          class: 'pres-dot pres-dot--off',
        }));
      } else {
        // Toilet: always-visible text
        const t = svgEl('text', {
          id: `presence-${room}`,
          x: cfg.presence.cx, y: cfg.presence.cy,
          'text-anchor': 'middle',
          'font-size': '2.4',
          'font-family': 'DejaVu Sans, sans-serif',
          'font-weight': 'bold',
          fill: '#22cc22',
        });
        t.textContent = 'Free';
        overlayG.appendChild(t);
      }
    }
  }
}

// ── State renderers ────────────────────────────────────────────────────────

function updateWallColor(room, isOn) {
  const gid = ROOMS[room].wallGroupId;
  if (!gid || !svgRoot) return;
  const group = svgRoot.querySelector(`[id="${gid}"]`);
  if (!group) return;
  const color = isOn ? '#c8c8c8' : '#686868';
  group.querySelectorAll('path[mask]').forEach(el => el.setAttribute('fill', color));
  group.querySelectorAll('rect[stroke]').forEach(el => {
    if (!el.closest('mask')) el.setAttribute('stroke', color);
  });
}

function updateBulb(room, state) {
  const globe = document.getElementById(`globe-${room}`);
  const isOn  = state && state.state === 'on';
  updateWallColor(room, isOn);
  if (!globe) return;

  if (!state || state.state === 'unavailable') {
    globe.setAttribute('fill', '#2a2a2a');
    globe.removeAttribute('filter');
    return;
  }
  if (isOn) {
    const brightness = (state.attributes.brightness ?? 255) / 255;
    const rgb = state.attributes.rgb_color;
    let fill;
    if (rgb) {
      fill = `rgb(${Math.round(rgb[0]*brightness)},${Math.round(rgb[1]*brightness)},${Math.round(rgb[2]*brightness)})`;
    } else {
      const v = Math.round(120 + brightness * 130);
      fill = `rgb(${v},${Math.round(v*0.88)},${Math.round(v*0.46)})`;
    }
    globe.setAttribute('fill', fill);
    globe.setAttribute('filter', 'url(#glow)');
  } else {
    globe.setAttribute('fill', '#484848');
    globe.removeAttribute('filter');
  }
}

function updatePresence(room, state) {
  const el     = document.getElementById(`presence-${room}`);
  if (!el) return;
  const active = state && state.state === 'on';

  if (ROOMS[room].presence.type === 'dot') {
    el.classList.toggle('pres-dot--on',  active);
    el.classList.toggle('pres-dot--off', !active);
  } else {
    el.textContent = active ? 'Occupied' : 'Free';
    el.setAttribute('fill', active ? '#ff6666' : '#22cc22');
  }
}

function updateClimate(room, tempState, humState) {
  if (!ROOMS[room].climate) return;
  const hlEl = document.getElementById(`hl-${room}`);

  if (tempState) {
    const v = parseFloat(tempState.state);
    if (!isNaN(v)) {
      const p     = Math.max(0.001, Math.min(0.999, (v - (-10)) / 60));
      const chart = gaugeCharts[`${room}-temp`];
      if (chart) {
        chart.data.datasets[0].data = [p, 1 - p];
        chart.update('none');
      }
      const el = document.getElementById(`gval-${room}-temp`);
      if (el) el.textContent = v.toFixed(1);
    }
  }

  if (humState) {
    const v = parseFloat(humState.state);
    if (!isNaN(v)) {
      const p     = Math.max(0.001, Math.min(0.999, v / 100));
      const alert = v > humidityThreshold;
      const chart = gaugeCharts[`${room}-hum`];
      if (chart) {
        chart.data.datasets[0].backgroundColor[0] = alert ? '#ee4444' : '#3a86c8';
        chart.data.datasets[0].data = [p, 1 - p];
        chart.update('none');
      }
      const el = document.getElementById(`gval-${room}-hum`);
      if (el) {
        el.textContent   = Math.round(v).toString();
        el.style.color   = alert ? '#ff6666' : '#c0c0c0';
      }
      if (hlEl) hlEl.classList.toggle('room-hl--active', alert);
    }
  }
}

// ── Entity lookup ──────────────────────────────────────────────────────────

function buildEntityLookup() {
  entityLookup = {};
  for (const [room, ents] of Object.entries(entityConfig)) {
    for (const [role, id] of Object.entries(ents)) {
      if (id) entityLookup[id] = { room, role };
    }
  }
}

function processUpdate(entityId, state) {
  const info = entityLookup[entityId];
  if (!info) return;
  const { room, role } = info;
  if (role === 'light')    { updateBulb(room, state);     return; }
  if (role === 'presence') { updatePresence(room, state); return; }
  const ents = entityConfig[room] ?? {};
  updateClimate(
    room,
    ents.temperature ? (haStates[ents.temperature] ?? null) : null,
    ents.humidity    ? (haStates[ents.humidity]    ?? null) : null,
  );
}

function renderAll() {
  for (const [room, ents] of Object.entries(entityConfig)) {
    if (ents.light)    updateBulb(room, haStates[ents.light] ?? null);
    if (ents.presence) updatePresence(room, haStates[ents.presence] ?? null);
    if (ents.temperature || ents.humidity) {
      updateClimate(
        room,
        ents.temperature ? (haStates[ents.temperature] ?? null) : null,
        ents.humidity    ? (haStates[ents.humidity]    ?? null) : null,
      );
    }
  }
}

// ── WebSocket ──────────────────────────────────────────────────────────────

function connect() {
  const wsUrl = haUrl.replace(/^http/, 'ws') + '/api/websocket';
  setStatus('Connecting…');
  ws = new WebSocket(wsUrl);
  ws.onopen    = () => setStatus('Authenticating…');
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onerror   = () => setStatus('Connection error', 'status--error');
  ws.onclose   = () => { setStatus('Reconnecting…', 'status--warn'); setTimeout(connect, 5000); };
}

function onMessage(msg) {
  switch (msg.type) {
    case 'auth_required':
      ws.send(JSON.stringify({ type: 'auth', access_token: haToken }));
      break;
    case 'auth_ok':
      setStatus('Connected', 'status--ok');
      fetchStates();
      subscribeEvents();
      break;
    case 'auth_invalid':
      setStatus('Invalid token — check add-on config', 'status--error');
      break;
    case 'result':
      if (pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
      break;
    case 'event':
      if (msg.event.event_type === 'state_changed') {
        const { entity_id, new_state } = msg.event.data;
        if (new_state) haStates[entity_id] = new_state; else delete haStates[entity_id];
        processUpdate(entity_id, new_state);
      }
      break;
  }
}

function fetchStates() {
  const id = nextId();
  ws.send(JSON.stringify({ id, type: 'get_states' }));
  pending[id] = (r) => {
    if (!r.success) return;
    r.result.forEach(s => { haStates[s.entity_id] = s; });
    renderAll();
  };
}

function subscribeEvents() {
  ws.send(JSON.stringify({ id: nextId(), type: 'subscribe_events', event_type: 'state_changed' }));
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

async function bootstrap() {
  try {
    const r = await fetch('/config');
    if (!r.ok) throw new Error(`/config returned ${r.status}`);
    const cfg = await r.json();

    if (!cfg.ha_url || !cfg.ha_token) {
      setStatus('Set ha_url + ha_token in add-on options', 'status--error');
      document.getElementById('floorplan').innerHTML =
        '<p class="cfg-error">Configure <strong>ha_url</strong> and <strong>ha_token</strong> in add-on options, then restart.</p>';
      return;
    }

    haUrl             = cfg.ha_url;
    haToken           = cfg.ha_token;
    humidityThreshold = cfg.humidity_threshold ?? 70;
    entityConfig      = cfg.entities ?? {};
    buildEntityLookup();

    await loadFloorplan();
    initGauges();
    connect();
  } catch (err) {
    setStatus('Boot error: ' + err.message, 'status--error');
    console.error('[dashboard] bootstrap error:', err);
    setTimeout(bootstrap, 10_000);
  }
}

bootstrap();
