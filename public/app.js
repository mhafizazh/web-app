(function () {
  'use strict';

  const SEED = window.EVE_SEED;
  const DAY = 24 * 60 * 60 * 1000;
  const TODAY = new Date(SEED.today);
  TODAY.setHours(12, 0, 0, 0);

  const STORAGE_KEY = 'eve_web_state_v1';

  const state = {
    theme: 'light',
    onboarded: false,
    onboardStep: 0,
    tab: 'map',
    range: 'week',
    mapFilter: 'all',
    showCommunity: false,
    momentsFilter: 'all',
    storyChapter: 0,
    selectedPlaceId: null,
    selectedMomentPlace: null,
    routeOpen: false,
    routeChoice: 'calmer',
    moments: [], // seed + simulated (with edits)
    helpful: {}, // spotId -> bool
    thanks: {}, // spotId -> presetId
    devOpen: false,
    pendingSpike: null,
  };

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.theme) state.theme = saved.theme;
      if (typeof saved.onboarded === 'boolean') state.onboarded = saved.onboarded;
      if (Array.isArray(saved.moments)) state.moments = saved.moments;
      if (saved.helpful) state.helpful = saved.helpful;
      if (saved.thanks) state.thanks = saved.thanks;
      if (typeof saved.showCommunity === 'boolean') state.showCommunity = saved.showCommunity;
    } catch (_) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        theme: state.theme,
        onboarded: state.onboarded,
        moments: state.moments,
        helpful: state.helpful,
        thanks: state.thanks,
        showCommunity: state.showCommunity,
      }));
    } catch (_) {}
  }

  function initMoments() {
    if (state.moments && state.moments.length) {
      // ensure seed baseline present? keep saved as-is (includes simulated/edits)
      return;
    }
    state.moments = clone(SEED.moments);
  }

  // --- Time helpers ---
  function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  function inRange(ts, range) {
    const t = new Date(ts);
    if (range === 'day') {
      return startOfDay(t).getTime() === startOfDay(TODAY).getTime();
    }
    if (range === 'week') {
      const start = startOfDay(TODAY).getTime() - 6 * DAY;
      const end = startOfDay(TODAY).getTime() + DAY - 1;
      return ts >= start && ts <= end;
    }
    if (range === 'month') {
      return t.getFullYear() === TODAY.getFullYear() && t.getMonth() === TODAY.getMonth();
    }
    return true;
  }

  function timeOfDayBucket(ts) {
    const h = new Date(ts).getHours();
    if (h >= 5 && h < 11) return 'Morning';
    if (h >= 11 && h < 14) return 'Midday';
    if (h >= 14 && h < 18) return 'Afternoon';
    return 'Evening';
  }

  function fmtDateShort(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function fmtDayTime(ts) {
    const d = new Date(ts);
    const day = d.toLocaleDateString([], { weekday: 'short' });
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    return day + ' ' + time;
  }
  function fmtKicker() {
    return 'Eve · ' + TODAY.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function typeLabel(tag) {
    if (tag === 'good') return 'Good stress';
    if (tag === 'bad') return 'Bad stress';
    if (tag === 'unsafe') return 'Felt unsafe';
    return 'Untagged';
  }

  // --- Data derivations ---
  function momentsInRange(range) {
    return state.moments.filter(m => inRange(m.ts, range) && m.tag !== 'untagged');
  }
  function taggedInRange(range, tag) {
    return momentsInRange(range).filter(m => tag === 'all' ? true : m.tag === tag);
  }

  function clusterPlaces(moments, filterTag) {
    const filtered = filterTag && filterTag !== 'all' ? moments.filter(m => m.tag === filterTag) : moments;
    const byPlace = {};
    filtered.forEach(m => {
      const sp = SEED.places[m.placeId] || {};
      if (!byPlace[m.placeId]) byPlace[m.placeId] = {
        placeId: m.placeId,
        name: m.placeName || sp.name,
        lat: sp.lat,
        lng: sp.lng,
        moments: []
      };
      byPlace[m.placeId].moments.push(m);
    });
    return Object.values(byPlace).map(p => {
      const counts = { good: 0, bad: 0, unsafe: 0 };
      p.moments.forEach(mm => { if (counts[mm.tag] != null) counts[mm.tag]++; });
      let majority = 'good';
      if (counts.unsafe > 0) majority = 'unsafe'; // unsafe always wins
      else if (counts.bad >= counts.good) majority = 'bad';
      p.count = p.moments.length;
      p.counts = counts;
      p.majority = majority;
      p.latest = p.moments.slice().sort((a,b)=>b.ts-a.ts)[0];
      return p;
    }).sort((a,b)=>b.count-a.count);
  }

  function summary(range) {
    const ms = momentsInRange(range);
    const total = ms.length;
    const good = ms.filter(m=>m.tag==='good').length;
    const bad = ms.filter(m=>m.tag==='bad').length;
    const unsafe = ms.filter(m=>m.tag==='unsafe').length;
    const pct = (n)=> total ? Math.round(n*100/total) : 0;
    return { total, good, bad, unsafe, goodPct: pct(good), badPct: pct(bad), unsafePct: pct(unsafe) };
  }

  function whenHappened(range) {
    const buckets = ['Morning','Midday','Afternoon','Evening'].map(name => ({ name, good:0,bad:0,unsafe:0,total:0 }));
    momentsInRange(range).forEach(m => {
      const b = buckets.find(x=>x.name===timeOfDayBucket(m.ts));
      if (b && b[m.tag] != null) { b[m.tag]++; b.total++; }
    });
    const max = Math.max(1, ...buckets.map(b=>b.total));
    return { buckets, max };
  }

  function momentsInsight(range, filter) {
    const ms = taggedInRange(range, filter === 'all' ? 'all' : filter);
    if (!ms.length) return 'No moments yet in this range.';
    const byBucket = {};
    const byPlace = {};
    ms.forEach(m => {
      const b = timeOfDayBucket(m.ts);
      byBucket[b] = (byBucket[b]||0)+1;
      byPlace[m.placeName] = (byPlace[m.placeName]||0)+1;
    });
    const topBucket = Object.entries(byBucket).sort((a,b)=>b[1]-a[1])[0][0];
    const topPlace = Object.entries(byPlace).sort((a,b)=>b[1]-a[1])[0][0];
    const timeText = topBucket === 'Morning' ? 'before 11 am' : topBucket === 'Midday' ? 'around midday' : topBucket === 'Afternoon' ? 'in the afternoon' : 'in the evening';
    if (filter === 'good') return `Your joy mostly shows up at ${topPlace} ${timeText === 'before 11 am' ? 'before 9 am' : timeText}.`;
    if (filter === 'bad') return `Most draining moments happen at ${topPlace}, ${timeText}.`;
    if (filter === 'unsafe') return `You felt most alert near ${topPlace}, ${timeText}. Take care and choose what feels right.`;
    return `Most moments happen ${timeText}, often around ${topPlace}.`;
  }

  // --- DOM helpers ---
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._tm);
    toast._tm = setTimeout(()=>t.classList.add('hidden'), 2600);
  }

  // --- Theme ---
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    $('#metaThemeColor').setAttribute('content', theme === 'light' ? '#F8F1F4' : '#8E2C55');
    $$('.seg[data-theme-choice]').forEach(b => b.classList.toggle('active', b.dataset.themeChoice === theme));
    saveState();
  }

  // --- Onboarding ---
  const ONBOARD_STEPS = [
    { title: 'Live fully. Eve has your back.', body: 'Eve turns your body\'s signals into a calm, private map of your days: where you feel joy, where you feel drained, and where you feel unsafe.', primary: 'Get started' },
    { title: 'Create your account', body: 'Choose how you\'d like to sign in. (Demo: this is a local prototype.)', options: ['Email magic link','Sign in with Apple','Sign in with Google'], primary: 'Continue' },
    { title: 'Pair your watch', body: 'Install the Eve Connect IQ app and confirm your connection so gentle check-ins can reach you.', status: 'Watch connected', primary: 'Continue' },
    { title: 'Permissions', body: 'Location helps place moments on your map. "Always" can place moments even when the app is in the background (you can change this anytime). Notifications let Eve check in kindly.', options: ['Allow location (While using & Always)','Allow notifications'], primary: 'Continue' },
    { title: 'Privacy setup', body: 'Home and work areas stay private and are never shared. Choose how often Eve checks in.', options: ['Hide home & work areas (set)', 'Check-ins: Gentle (default)','Check-ins: Normal'], primary: 'Continue' },
    { title: 'Optional', body: 'Add trusted friends (up to 5), turn on cycle insights, or skip for now.', options: ['Add trusted friends','Cycle insights (off by default)','Skip for now'], primary: 'Continue' },
    { title: 'Choose your look', body: 'Pick Light or Berry. You can switch anytime from Home or Me → Look.', themePick: true, primary: 'Finish' },
  ];

  function renderOnboarding() {
    const wrap = $('#onboarding');
    const card = $('#onboardCard');
    if (state.onboarded) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    const i = state.onboardStep;
    const s = ONBOARD_STEPS[i];
    const steps = ONBOARD_STEPS.map((_, idx) => `<span class="${idx <= i ? 'done' : ''}"></span>`).join('');
    let inner = `<div class="onboard-steps">${steps}</div>`;
    inner += `<h2>${esc(s.title)}</h2><p>${esc(s.body)}</p>`;
    if (s.status) inner += `<div class="pill mt8" style="margin-bottom:12px;">⌚ ${esc(s.status)}</div>`;
    if (s.options) {
      inner += `<div class="option-grid">` + s.options.map((o,idx)=>`<button type="button" class="option raised onboard-opt ${idx===0?'sel':''}" data-opt="${idx}">${esc(o)}</button>`).join('') + `</div>`;
    }
    if (s.themePick) {
      inner += `<div class="option-grid"><button type="button" class="option raised onboard-opt ${state.theme==='light'?'sel':''}" data-pick-theme="light">Light <small>Soft, airy surfaces</small></button><button type="button" class="option raised onboard-opt ${state.theme==='berry'?'sel':''}" data-pick-theme="berry">Berry <small>Deep, confident berry</small></button></div>`;
    }
    inner += `<div class="stack mt12"><button type="button" class="btn btn-primary btn-block" id="onboardNext">${esc(s.primary)}</button>${i>0?'<button type="button" class="btn btn-secondary btn-block" id="onboardBack">Back</button>':''}</div>`;
    card.innerHTML = inner;

    $$('.onboard-opt', card).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.pickTheme) { applyTheme(b.dataset.pickTheme); renderOnboarding(); return; }
      $$('.onboard-opt', card).forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');
    }));
    $('#onboardNext').addEventListener('click', () => {
      if (i < ONBOARD_STEPS.length - 1) { state.onboardStep++; renderOnboarding(); }
      else { state.onboarded = true; saveState(); renderOnboarding(); renderApp(); }
    });
    const back = $('#onboardBack');
    if (back) back.addEventListener('click', () => { state.onboardStep = Math.max(0, i-1); renderOnboarding(); });
  }

  // --- Map rendering (Leaflet + OpenStreetMap) ---
  let mainMap = null;
  let mainMarkersLayer = null;
  let mainZonesLayer = null;
  let routeMap = null;

  function ensureMainMap() {
    if (mainMap || typeof L === 'undefined') return;
    const area = $('#mapArea');
    if (!area) return;
    area.innerHTML = '';
    mainMap = L.map(area, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mainMap);
    mainMarkersLayer = L.layerGroup().addTo(mainMap);
    mainZonesLayer = L.layerGroup().addTo(mainMap);
    mainMap.setView([51.046, -114.065], 13);
  }

  function placeIcon(majority, count) {
    if (majority === 'unsafe') {
      return L.divIcon({
        className: 'eve-marker',
        html: `<div class="eve-pin unsafe"><span>${esc(String(count))}</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
    }
    return L.divIcon({
      className: 'eve-marker',
      html: `<div class="eve-pin ${majority}"><span>${esc(String(count))}</span></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }

  function renderMap() {
    const range = state.range;
    const filter = state.mapFilter;
    ensureMainMap();

    // range & filters active states
    $$('.range-control .seg').forEach(b => b.classList.toggle('active', b.dataset.range === range));
    $$('#mapFilters .chip').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
    const sw = $('#communityToggle');
    if (sw) {
      sw.classList.toggle('on', state.showCommunity);
      sw.setAttribute('aria-checked', state.showCommunity ? 'true' : 'false');
    }

    const places = clusterPlaces(momentsInRange(range), filter === 'all' ? null : filter)
      .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');

    if (mainMarkersLayer) mainMarkersLayer.clearLayers();
    if (mainZonesLayer) mainZonesLayer.clearLayers();

    const bounds = [];
    if (mainMap && mainMarkersLayer) {
      places.forEach(p => {
        const marker = L.marker([p.lat, p.lng], { icon: placeIcon(p.majority, p.count) });
        marker.on('click', () => {
          state.selectedPlaceId = p.placeId;
          renderPinDetail();
        });
        marker.addTo(mainMarkersLayer);
        bounds.push([p.lat, p.lng]);
      });

      if (state.showCommunity) {
        SEED.communityZones.forEach(z => {
          if (typeof z.lat !== 'number' || typeof z.lng !== 'number') return;
          const circle = L.circle([z.lat, z.lng], {
            radius: z.radius || 160,
            color: 'rgba(212,67,46,0.7)',
            weight: 2,
            dashArray: '6 6',
            fillColor: 'rgba(212,67,46,0.10)',
            fillOpacity: 1,
          });
          circle.bindTooltip(`${z.reporters} women flagged · ${z.peak}`, { direction: 'top', offset: [0, -4] });
          circle.addTo(mainZonesLayer);
          bounds.push([z.lat, z.lng]);
        });
      }

      // Keep Calgary context visible; fit to data when present.
      if (bounds.length) {
        mainMap.fitBounds(L.latLngBounds(bounds).pad(0.25), { maxZoom: 15 });
      } else {
        mainMap.setView([51.046, -114.065], 13);
      }

      setTimeout(() => { if (mainMap) mainMap.invalidateSize(); }, 60);
    }

    renderPinDetail();
    renderSummary();
    renderWhen();
  }

  function renderPinDetail() {
    const box = $('#pinDetail');
    const pid = state.selectedPlaceId;
    if (!pid) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    const places = clusterPlaces(momentsInRange(state.range), state.mapFilter === 'all' ? null : state.mapFilter);
    const p = places.find(x=>x.placeId===pid) || clusterPlaces(momentsInRange(state.range)).find(x=>x.placeId===pid);
    if (!p) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const latest = p.latest ? fmtDayTime(p.latest.ts) + (p.latest.note ? ' · ' + esc(p.latest.note) : '') : '';
    box.innerHTML = `<h3>${esc(p.name)}</h3><p><strong>${p.count}</strong> moments here (${state.range}). ${latest ? 'Latest: ' + latest : ''}</p>`;
  }

  function renderSummary() {
    const s = summary(state.range);
    $('#summaryCard').innerHTML = `
      <h3>Summary</h3>
      <div class="summary-total">${s.total} moments</div>
      <div class="bar3" aria-label="Good ${s.goodPct}%, Bad ${s.badPct}%, Unsafe ${s.unsafePct}%">
        <div class="seg" style="width:${s.goodPct}%;background:var(--good)"></div>
        <div class="seg" style="width:${s.badPct}%;background:var(--bad)"></div>
        <div class="seg" style="width:${s.unsafePct}%;background:var(--unsafe)"></div>
      </div>
      <div class="tiles">
        <div class="tile raised good"><div class="pct">${s.goodPct}%</div><div class="tl">Good · lifted you</div></div>
        <div class="tile raised bad"><div class="pct">${s.badPct}%</div><div class="tl">Bad · drained you</div></div>
        <div class="tile raised unsafe"><div class="pct">${s.unsafePct}%</div><div class="tl">Felt unsafe · take care</div></div>
      </div>`;
  }

  function renderWhen() {
    const w = whenHappened(state.range);
    $('#whenCard').innerHTML = `<h3>When they happened</h3>` + w.buckets.map(b => {
      const g = (b.good/w.max)*100, ba = (b.bad/w.max)*100, u = (b.unsafe/w.max)*100;
      return `<div class="when-row"><span>${b.name}</span><div class="when-bar" aria-label="${b.name}: ${b.total}"><div style="width:${g}%;background:var(--good)"></div><div style="width:${ba}%;background:var(--bad)"></div><div style="width:${u}%;background:var(--unsafe)"></div></div><span class="n">${b.total}</span></div>`;
    }).join('');
  }

  // --- Moments ---
  function renderMoments() {
    const range = 'week'; // spec shows week counts/tabs context
    const counts = {
      all: taggedInRange(range,'all').length,
      good: taggedInRange(range,'good').length,
      bad: taggedInRange(range,'bad').length,
      unsafe: taggedInRange(range,'unsafe').length,
    };
    const tabs = [
      { id:'all', label:`All ${counts.all}` }, { id:'good', label:`Good ${counts.good}` },
      { id:'bad', label:`Bad ${counts.bad}` }, { id:'unsafe', label:`Unsafe ${counts.unsafe}` }
    ];
    $('#momentsTabs').innerHTML = tabs.map(t=>`<button type="button" class="seg ${state.momentsFilter===t.id?'active':''}" data-mfilter="${t.id}" role="tab" aria-selected="${state.momentsFilter===t.id}">${t.label}</button>`).join('');
    $$('#momentsTabs .seg').forEach(b=>b.addEventListener('click',()=>{ state.momentsFilter=b.dataset.mfilter; renderMoments(); }));
    $('#momentsInsight').textContent = momentsInsight(range, state.momentsFilter);

    const filter = state.momentsFilter;
    const types = filter === 'all' ? ['good','bad','unsafe'] : [filter];
    let html = '';
    types.forEach(type => {
      const clusters = clusterPlaces(taggedInRange(range,'all'), type);
      if (!clusters.length) return;
      const top = clusters[0].count || 1;
      html += `<h3 class="section-title"><span class="shape ${type==='unsafe'?'diamond':'circle'} ${type}"></span> ${typeLabel(type)}</h3>`;
      clusters.forEach(c => {
        const latest = c.latest ? `Latest: ${fmtDayTime(c.latest.ts)}${c.latest.note ? ' · ' + esc(c.latest.note) : ''}` : '';
        const barPct = Math.round((c.count/top)*100);
        const showCalmer = type === 'unsafe';
        html += `<div class="card raised place-card">
          <h4>${esc(c.name)}</h4>
          <div class="place-meta">${c.count} moment${c.count===1?'':'s'}</div>
          <div class="mini-bar"><div style="width:${barPct}%;background:var(--${type})"></div></div>
          <p class="place-latest">${latest}</p>
          <div class="row-actions">
            ${showCalmer ? `<button type="button" class="btn btn-primary btn-sm" data-open-route="1">See a calmer route</button>` : ''}
            <button type="button" class="btn btn-secondary btn-sm" data-place-detail="${esc(c.placeId)}" data-place-type="${type}">Details</button>
          </div>
        </div>`;
      });
    });
    if (!html) html = `<div class="card raised"><p class="muted">No moments in this view.</p></div>`;
    $('#momentsContent').innerHTML = html;
    $$('[data-open-route]', $('#momentsContent')).forEach(b=>b.addEventListener('click', openCalmerRoute));
    $$('[data-place-detail]', $('#momentsContent')).forEach(b=>b.addEventListener('click', ()=> openPlaceDetail(b.dataset.placeDetail, b.dataset.placeType)));
  }

  function openPlaceDetail(placeId, type) {
    const range = 'week';
    const ms = taggedInRange(range, type || 'all').filter(m=>m.placeId===placeId).sort((a,b)=>b.ts-a.ts);
    const name = SEED.places[placeId]?.name || (ms[0] && ms[0].placeName) || 'Place';
    const rows = ms.map(m => `<div class="setting-item"><div><strong>${fmtDayTime(m.ts)}</strong><span class="sub">${typeLabel(m.tag)}${m.note?' · '+esc(m.note):''} · HR ${m.hrPeak||'—'}</span></div><span class="shape ${m.tag==='unsafe'?'diamond':'circle'} ${m.tag}"></span></div>`).join('') || '<p class="muted">No moments.</p>';
    openOverlay(`<div class="sheet-header"><h2>${esc(name)}</h2><button type="button" class="close-btn raised" data-close aria-label="Close">×</button></div><div class="settings-list">${rows}</div><p class="small muted mt12">You can review every moment here. (Editing/deleting is available in the full app; this demo shows your history.)</p>`);
  }

  // --- Safety ---
  function renderSafety() {
    const route = SEED.routes.homeFromOffice;
    const helpful = SEED.impact.helpfulCount;
    const spots = SEED.impact.spotsShared;
    const thanks = SEED.impact.thanksReceived;
    const spotsFeed = SEED.communitySpots.map(s => {
      const helped = !!state.helpful[s.id];
      const thankedPreset = state.thanks[s.id];
      const helpCount = s.helpful + (helped ? 1 : 0);
      return `<div class="card raised feed-item">
        <h4>${esc(s.name)}</h4>
        <div class="feed-meta">${esc(s.reason)} · ${esc(s.timeAgo)} · ${esc(s.distance)}</div>
        <div class="row-actions">
          <button type="button" class="btn ${helped?'btn-primary':'btn-secondary'} btn-sm" data-helpful="${s.id}">Helpful · ${helpCount}</button>
          <button type="button" class="btn ${thankedPreset?'btn-primary':'btn-secondary'} btn-sm" data-thanks="${s.id}">${thankedPreset?'Thanks sent':'Say thanks'}</button>
        </div>
      </div>`;
    }).join('');

    $('#safetyContent').innerHTML = `
      <div class="safety-section">
        <h3>Where you felt unsafe</h3>
        <div class="card raised route-card">
          <h4>${esc(route.name)}</h4>
          <p class="muted small">3 unsafe moments · all after 8 pm</p>
          <div class="route-line"><span>Office</span><div class="line"><span class="diamond"></span></div><span>Home</span></div>
          <div class="row-actions">
            <button type="button" class="btn btn-primary btn-sm" id="tryCalmer">Try the calmer route</button>
            <button type="button" class="btn btn-secondary btn-sm" id="shareTrip">Share my trip with a friend</button>
          </div>
        </div>
      </div>
      <div class="safety-section">
        <h3>Your shares are helping</h3>
        <div class="card raised">
          <p class="muted">You helped ${helpful} women feel safer getting around this month.</p>
          <div class="impact-grid">
            <div class="impact-stat raised inset"><div class="n">${spots}</div><div class="l">Spots shared</div></div>
            <div class="impact-stat raised inset"><div class="n">${thanks}</div><div class="l">Thank-yous</div></div>
            <div class="impact-stat raised inset"><div class="n">${helpful}</div><div class="l">Found helpful</div></div>
          </div>
          <div class="thanks-note raised inset">“${esc(SEED.impact.latestNote)}”</div>
        </div>
      </div>
      <div class="safety-section">
        <h3>Shared by women near you</h3>
        ${spotsFeed}
      </div>`;

    $('#tryCalmer').addEventListener('click', openCalmerRoute);
    $('#shareTrip').addEventListener('click', ()=>toast('A trip share link is ready for your friend. (Demo)'));
    $$('[data-helpful]', $('#safetyContent')).forEach(b=>b.addEventListener('click',()=>{
      state.helpful[b.dataset.helpful] = !state.helpful[b.dataset.helpful]; saveState(); renderSafety();
      toast(state.helpful[b.dataset.helpful] ? 'Marked helpful. Thank you.' : 'Helpful removed.');
    }));
    $$('[data-thanks]', $('#safetyContent')).forEach(b=>b.addEventListener('click',()=> openThanksPicker(b.dataset.thanks)));
  }

  function openThanksPicker(spotId) {
    if (state.thanks[spotId]) { toast('Thanks already sent.'); return; }
    const opts = SEED.thankYouPresets.map(p=>`<button type="button" class="option raised" data-preset="${p.id}">${esc(p.text)}</button>`).join('');
    openOverlay(`<div class="sheet-header"><h2>Say thanks</h2><button type="button" class="close-btn raised" data-close aria-label="Close">×</button></div><p class="muted">Choose a kind note (no free text). It’s shared anonymously.</p><div class="option-grid">${opts}</div>`);
    $$('[data-preset]', $('#overlaySheet')).forEach(b=>b.addEventListener('click',()=>{
      state.thanks[spotId]=b.dataset.preset; saveState(); closeOverlay(); renderSafety();
      toast('Thanks sent. Someone will see your kindness.');
    }));
  }

  // --- Calmer route ---
  function renderRouteMap(choice) {
    const r = SEED.routes.homeFromOffice;
    const el = document.getElementById('routeMap');
    if (!el || typeof L === 'undefined') return;

    if (routeMap) {
      try { routeMap.remove(); } catch (_) {}
      routeMap = null;
    }

    routeMap = L.map(el, { zoomControl: false, scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(routeMap);

    const usualStyle = {
      color: choice === 'usual' ? '#6E1A43' : '#b8a8ae',
      weight: choice === 'usual' ? 5 : 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    };
    const calmerStyle = {
      color: choice === 'calmer' ? '#6E1A43' : '#b8a8ae',
      weight: choice === 'calmer' ? 5 : 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    };

    L.polyline(r.usual.path, usualStyle).addTo(routeMap);
    L.polyline(r.calmer.path, calmerStyle).addTo(routeMap);

    L.circle([r.flaggedZone.lat, r.flaggedZone.lng], {
      radius: r.flaggedZone.radius || 140,
      color: 'rgba(212,67,46,0.7)',
      weight: 2,
      dashArray: '6 6',
      fillColor: 'rgba(212,67,46,0.12)',
      fillOpacity: 1,
    }).addTo(routeMap);

    const start = r.usual.path[0];
    const end = r.usual.path[r.usual.path.length - 1];
    L.circleMarker(start, { radius: 6, color: '#2B1F25', weight: 2, fillColor: '#FFFFFF', fillOpacity: 1 }).bindTooltip('Office', { direction: 'top', offset: [0, -4] }).addTo(routeMap);
    L.circleMarker(end, { radius: 6, color: '#2B1F25', weight: 2, fillColor: '#FFFFFF', fillOpacity: 1 }).bindTooltip('Home', { direction: 'top', offset: [0, -4] }).addTo(routeMap);

    const bounds = L.latLngBounds([].concat(r.usual.path, r.calmer.path));
    routeMap.fitBounds(bounds.pad(0.22));
    setTimeout(() => { if (routeMap) routeMap.invalidateSize(); }, 80);
  }

  function openCalmerRoute() {
    const r = SEED.routes.homeFromOffice;
    state.routeChoice = state.routeChoice || 'calmer';
    const choice = state.routeChoice;
    openOverlay(`
      <div class="sheet-header"><h2>Calmer route</h2><button type="button" class="close-btn raised" data-close aria-label="Close">×</button></div>
      <div class="alert-box raised inset">Heads up, a spot on your usual way was flagged. We found a calmer way. The choice is always yours.</div>
      <div id="routeMap" class="route-map" aria-label="Route map"></div>
      <div class="route-options">
        <button type="button" class="route-option raised ${choice==='calmer'?'selected':''}" data-route-choice="calmer">
          <h4>Calmer route</h4>
          <p><strong>${r.calmer.timeMin} min</strong> · ${r.calmer.delta} · ${esc(r.calmer.why)}</p>
        </button>
        <button type="button" class="route-option raised ${choice==='usual'?'selected':''}" data-route-choice="usual">
          <h4>Usual route</h4>
          <p><strong>${r.usual.timeMin} min</strong> · ${esc(r.usual.note)}</p>
        </button>
      </div>
      <div class="card raised" style="margin-bottom:12px;">
        <h3 style="margin:0 0 6px;font-size:18px;">What women shared here</h3>
        <div class="reason-chips"><span class="reason-chip">Poor lighting · 7</span><span class="reason-chip">Nobody around · 5</span></div>
        <p class="small muted" style="margin:0;">12 women flagged this spot in the last 30 days, mostly after 8 pm.</p>
      </div>
      <div class="stack">
        <button type="button" class="btn btn-primary btn-block" id="takeRoute">Take the calmer route</button>
        <button type="button" class="btn btn-secondary btn-block" id="shareRoute">Share with a friend</button>
        <button type="button" class="btn btn-secondary btn-block" id="guideWatch">Guide me on watch</button>
      </div>
    `);
    $$('[data-route-choice]', $('#overlaySheet')).forEach(b=>b.addEventListener('click',()=>{ state.routeChoice=b.dataset.routeChoice; openCalmerRoute(); }));
    $('#takeRoute').addEventListener('click', ()=>{ toast('Calmer route selected. Take care.'); closeOverlay(); });
    $('#shareRoute').addEventListener('click', ()=>toast('Trip shared with your friend. (Demo)'));
    $('#guideWatch').addEventListener('click', ()=>toast('Route sent to your watch. Gentle buzzes ahead. (Demo)'));

    setTimeout(() => renderRouteMap(choice), 0);
  }

  // --- Me ---
  function storyChapters() {
    const s = summary('month');
    return [
      { title: 'Overview', body: `This month you logged ${s.total} moments: ${s.goodPct}% joy, ${s.badPct}% drained, ${s.unsafePct}% felt unsafe. You kept showing up for yourself, one step at a time.` },
      { title: 'Where you light up', body: `Your joy shows up most at Bow River pathway and Riverside gym, especially in the morning. Those moments lifted you.` },
      { title: 'What drains you', body: `Downtown office and the 17 Ave bus stop felt most draining, often midday to late afternoon. Noticing this is a kind of care.` },
      { title: 'Where you stayed alert', body: `You felt unsafe ${s.unsafe} times this month, mostly near 9th Ave underpass after 8 pm. When you chose a calmer way, things felt easier.` },
      { title: 'Your next chapter', body: `If it feels right, keep those morning moments by the river and try the calmer route home on late evenings. You trusted yourself, and it worked.` },
    ];
  }

  function renderMe() {
    const chapters = storyChapters();
    const idx = Math.max(0, Math.min(chapters.length-1, state.storyChapter));
    state.storyChapter = idx;
    const ch = chapters[idx];
    const progress = chapters.map((_,i)=>`<span class="${i<idx?'done':i===idx?'active':''}"></span>`).join('');
    const s = summary('month');
    const settings = [
      { label: 'Trusted friends', sub: 'Up to 5 contacts' },
      { label: 'Cycle insights', sub: 'Off (optional, phase 3)', toggle: 'cycle' },
      { label: 'Hide home & work', sub: 'On · never shared', toggle: 'hide', on: true },
      { label: 'Share anonymously', sub: 'On for chosen unsafe moments', toggle: 'share', on: true },
      { label: 'Watch check-ins', sub: 'Gentle (default)' },
      { label: 'Watch & sensors', sub: 'Connected' },
      { label: 'Look (Light/Berry)', sub: 'Switch theme', action: 'look' },
      { label: 'Export my data', sub: 'JSON + CSV (demo)' },
      { label: 'Delete everything', sub: 'Removes personal data (demo)' },
    ];
    $('#meContent').innerHTML = `
      <div class="card raised profile-header">
        <div class="avatar">J</div>
        <div><h3>Jane</h3><div class="pill">⌚ Watch connected</div></div>
      </div>
      <div class="card raised story-card">
        <h3 style="margin:0 0 8px;font-size:20px;">Your story</h3>
        <div class="story-progress">${progress}</div>
        <div class="story-chapter"><h4>${esc(ch.title)}</h4><p>${esc(ch.body)}</p></div>
        <div class="row-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="storyBack">Back</button>
          <button type="button" class="btn btn-primary btn-sm" id="storyNext">Next</button>
        </div>
      </div>
      <div class="card raised feeling-card">
        <h3 style="margin:0 0 6px;font-size:20px;">How you've been feeling</h3>
        <p class="small muted" style="margin:0 0 8px;">This month</p>
        ${feelingRow('Joy', s.goodPct, s.good, 'good')}
        ${feelingRow('Drained', s.badPct, s.bad, 'bad')}
        ${feelingRow('Unsafe', s.unsafePct, s.unsafe, 'unsafe')}
      </div>
      <div class="card raised">
        <h3 style="margin:0 0 6px;font-size:20px;">Profile & privacy</h3>
        <div class="settings-list">${settings.map(it => settingRow(it)).join('')}</div>
      </div>`;

    $('#storyBack').addEventListener('click', ()=>{ state.storyChapter=Math.max(0, idx-1); renderMe(); });
    $('#storyNext').addEventListener('click', ()=>{ state.storyChapter=Math.min(chapters.length-1, idx+1); renderMe(); });
    $$('[data-setting="look"]', $('#meContent')).forEach(b=>b.addEventListener('click',()=>{ applyTheme(state.theme==='light'?'berry':'light'); toast('Look updated.'); }));
    $$('[data-setting="export"]', $('#meContent')).forEach(b=>b.addEventListener('click',()=>toast('Export prepared (demo): JSON + CSV.')));
    $$('[data-setting="delete"]', $('#meContent')).forEach(b=>b.addEventListener('click',()=>toast('In the full app this removes personal data. (Demo)')));
  }

  function feelingRow(label, pct, count, type) {
    return `<div class="feeling-row"><div class="feeling-label"><span class="shape ${type==='unsafe'?'diamond':'circle'} ${type}"></span>${label}</div><div><strong>${pct}%</strong> <span class="muted small">· ${count}</span></div><div class="feeling-bar"><div style="width:${pct}%;background:var(--${type})"></div></div></div>`;
  }
  function settingRow(it) {
    const right = it.toggle ? `<button type="button" class="switch ${it.on!==false?'on':''}" role="switch" aria-checked="${it.on!==false}" data-toggle="${it.toggle}"><span class="knob"></span></button>`
      : it.action ? `<button type="button" class="btn btn-secondary btn-sm" data-setting="${it.action}">Open</button>`
      : it.label.startsWith('Export') ? `<button type="button" class="btn btn-secondary btn-sm" data-setting="export">Export</button>`
      : it.label.startsWith('Delete') ? `<button type="button" class="btn btn-secondary btn-sm" data-setting="delete">Delete</button>`
      : `<span class="muted">›</span>`;
    return `<div class="setting-item"><div>${esc(it.label)}${it.sub?`<span class="sub">${esc(it.sub)}</span>`:''}</div>${right}</div>`;
  }

  // --- Overlay helpers ---
  function openOverlay(html) {
    $('#overlaySheet').innerHTML = html;
    $('#overlay').classList.remove('hidden');
    $('#overlay').setAttribute('aria-hidden','false');
    $$('[data-close]', $('#overlaySheet')).forEach(b=>b.addEventListener('click', closeOverlay));
  }
  function closeOverlay() {
    if (routeMap) {
      try { routeMap.remove(); } catch (_) {}
      routeMap = null;
    }
    $('#overlay').classList.add('hidden');
    $('#overlay').setAttribute('aria-hidden','true');
    $('#overlaySheet').innerHTML = '';
  }

  // --- Simulate watch ---
  function renderDevPanel() {
    const panel = $('#devPanel');
    if (!state.devOpen) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    const placeOpts = Object.values(SEED.places).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    panel.innerHTML = `
      <h4>Simulate watch</h4>
      <p class="small muted">Send fake spike, tag, and share_decision messages (Phase 1).</p>
      <label>Place</label><select id="simPlace">${placeOpts}</select>
      <label>Tag</label><select id="simTag"><option value="good">Good stress</option><option value="bad">Bad stress</option><option value="unsafe">Felt unsafe</option></select>
      <label>Share if unsafe?</label><select id="simShare"><option value="true">Yes (anonymous)</option><option value="false">No (private)</option></select>
      <label>Unsafe reason</label><select id="simReason"><option value="followed">Being followed</option><option value="harassment">Harassment</option><option value="lighting">Poor lighting</option><option value="isolated">Nobody around</option></select>
      <div class="row mt12">
        <button type="button" class="btn btn-primary btn-sm" id="simSend">Send event</button>
        <button type="button" class="btn btn-secondary btn-sm" id="simSpike">Spike only</button>
      </div>`;
    $('#simSend').addEventListener('click', () => {
      const placeId = $('#simPlace').value;
      const tag = $('#simTag').value;
      const share = $('#simShare').value === 'true';
      const reason = $('#simReason').value;
      const place = SEED.places[placeId];
      const ts = Date.now();
      const moment = {
        id: 'sim-' + ts, spikeId: 'w-sim-' + ts, tag,
        placeId, placeName: place.name, lat: place.lat, lng: place.lng,
        ts, note: tag === 'unsafe' ? ({followed:'being followed',harassment:'harassment',lighting:'poor lighting',isolated:'nobody around'}[reason]) : '',
        shareReason: tag === 'unsafe' ? reason : null,
        shared: tag === 'unsafe' ? share : false,
        hrPeak: tag === 'good' ? 116 : tag === 'bad' ? 122 : 130,
      };
      state.moments.push(moment);
      saveState();
      renderCurrentTab();
      toast(tag === 'unsafe' ? (share ? 'Felt unsafe shared anonymously. Thank you.' : 'Got it. Saved just for you.') : 'Got it. Saved just for you on your map.');
    });
    $('#simSpike').addEventListener('click', () => {
      const place = SEED.places[$('#simPlace').value];
      toast(`Spike detected near ${place.name}. Check-in ready on watch. (Demo)`);
    });
  }

  // --- Tabs & app ---
  function switchTab(tab) {
    state.tab = tab;
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
    $$('.tab-screen').forEach(s => s.classList.add('hidden'));
    $('#tab-' + tab).classList.remove('hidden');
    renderCurrentTab();
    if (tab === 'map' && mainMap) {
      setTimeout(() => mainMap.invalidateSize(), 80);
    }
  }

  function renderCurrentTab() {
    $('#kicker').textContent = fmtKicker();
    if (state.tab === 'map') renderMap();
    else if (state.tab === 'moments') renderMoments();
    else if (state.tab === 'safety') renderSafety();
    else if (state.tab === 'me') renderMe();
  }

  function renderApp() {
    if (!state.onboarded) { $('#app').classList.add('hidden'); return; }
    $('#app').classList.remove('hidden');
    applyTheme(state.theme);
    renderCurrentTab();
  }

  function bindEvents() {
    // theme toggles in header
    $$('.seg[data-theme-choice]').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.themeChoice)));
    // nav
    $$('.nav-item').forEach(n => n.addEventListener('click', () => switchTab(n.dataset.tab)));
    // map controls
    $$('.range-control .seg').forEach(b => b.addEventListener('click', () => { state.range = b.dataset.range; renderMap(); }));
    $$('#mapFilters .chip').forEach(c => c.addEventListener('click', () => { state.mapFilter = c.dataset.filter; renderMap(); }));
    $('#communityToggle').addEventListener('click', () => { state.showCommunity = !state.showCommunity; saveState(); renderMap(); });
    // watch status
    $('#watchStatusBtn').addEventListener('click', ()=>toast('Watch connected. Eve is ready.'));
    // overlay backdrop close
    $('#overlay').addEventListener('click', (e)=>{ if (e.target.id === 'overlay') closeOverlay(); });
    // dev
    $('#devFab').addEventListener('click', ()=>{ state.devOpen=!state.devOpen; renderDevPanel(); });
  }

  function init() {
    loadState();
    initMoments();
    if (!state.onboarded) {
      $('#app').classList.add('hidden');
    }
    applyTheme(state.theme || 'light');
    bindEvents();
    renderOnboarding();
    renderApp();
    renderDevPanel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
