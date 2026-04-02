'use strict';

/* ─────────────────────────────────────────
   DATABASE  (starts empty, filled by uploads)
───────────────────────────────────────── */
let DB      = [];   // regular videos
let ShortsDB = [];  // shorts

const CAT_LABELS = {
  russian:'Русские', orgy:'Оргии', anal:'Анал', orgasm:'Жен. оргазмы',
  beautiful:'Красивый секс', homemade:'Домашнее', cheating:'Измена', rough:'Жёсткий',
  milf:'Мамочки и зрелые', alt:'Альтушки', sibling:'Брат и сестра',
  bigboobs:'Большие сиськи', creampie:'Кончают внутрь', teen:'Молодые 18+',
  lesbian:'Лесби', bdsm:'BDSM', erotic:'Эротика', couples:'Couples',
  amateur:'Amateur', art:'Art & Beauty',
};

const POPULAR_TAGS = [
  'Оргазм','Русское домашнее','Большие члены','Азиатки','Полненькие',
  'Мамочки','Зрелые','Упругие попки','Большие сиськи','Секс вайф',
  'Красотка','Анал','Минет','Куни','Лесби','Инцест','Студентки','Офис',
];

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
let currentView   = 'home';
let currentCat    = 'all';
let currentSort   = 'new';
let videoPage     = 1;
let autoplay      = true;
let currentVidId  = null;
let watchHistory  = [];
let comments      = {};       // { videoId: [{name,text,likes,ago}] }
let uploadFile    = null;
let uploadObjUrl  = null;
let uploadThumbs  = [];
let selectedThumb = 0;
let editingId     = null;
let currentUser   = null;     // { username, email } when logged in

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initAgeGate();
});

function initAgeGate() {
  const gate = document.getElementById('age-gate');
  const app  = document.getElementById('app');
  if (sessionStorage.getItem('vx-age')) {
    gate.style.display = 'none';
    app.classList.remove('hidden');
    initApp();
    return;
  }
  document.getElementById('age-yes').onclick = () => {
    sessionStorage.setItem('vx-age', '1');
    gate.style.transition = 'opacity .35s';
    gate.style.opacity = '0';
    setTimeout(() => { gate.style.display = 'none'; app.classList.remove('hidden'); initApp(); }, 340);
  };
  document.getElementById('age-no').onclick = () => { window.location.href = 'https://google.com'; };
}

function initApp() {
  // Restore login session
  try { const s = sessionStorage.getItem('vx-user'); if (s) currentUser = JSON.parse(s); } catch {}
  initFirebase();

  renderGrid();
  renderShorts();
  initCatNav();
  initSidebarCats();
  initSearch();
  initPlayerControls();
  startAmbient();
  initUpload();
  initAutoplay();
  initSortBtns();
  initSubcatNav();
  initTagsBar();
  initMoodStrip();
  initStreamsCatFilter();
  updateAuthUI();

  document.getElementById('go-home').onclick = e => { e.preventDefault(); navigate('all'); };
  document.getElementById('open-upload').onclick = () => openModal('upload-modal');
  document.getElementById('load-more').onclick = () => { videoPage++; renderGrid(true); };

  document.getElementById('burger').onclick = () => {
    document.querySelector('.hdr__right').classList.toggle('open');
  };
}

/* ─────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────── */
function navigate(cat) {
  document.querySelectorAll('.cnav').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  document.querySelectorAll('.scnav').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  if (cat === 'partners') { showView('partners'); return; }
  if (cat === 'contact')  { showView('contact');  return; }
  if (cat === 'shorts')   { openShortsViewer(null); return; }
  if (cat === 'streams')  { showView('streams'); renderStreams(); return; }
  currentCat = cat;
  videoPage  = 1;
  showView('home');
  const titles = { all:'Все видео', ...Object.fromEntries(Object.entries(CAT_LABELS).map(([k,v])=>[k,v])) };
  document.getElementById('grid-title').textContent = titles[cat] || 'Видео';
  renderGrid();
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + name)?.classList.remove('hidden');
  currentView = name;
  window.scrollTo(0, 0);
}

function initCatNav() {
  document.querySelectorAll('.cnav').forEach(b => b.onclick = () => navigate(b.dataset.cat));
}
function initSidebarCats() {
  document.querySelectorAll('.sb-cats button').forEach(b => b.onclick = () => navigate(b.dataset.cat));
}
function initSubcatNav() {
  document.querySelectorAll('.scnav').forEach(b => b.onclick = () => navigate(b.dataset.cat));
}
function initSortBtns() {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.onclick = () => {
      currentSort = btn.dataset.sort;
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      videoPage = 1;
      renderGrid();
    };
  });
}
function initTagsBar() {
  const el = document.getElementById('tags-bar');
  if (!el) return;
  el.innerHTML = POPULAR_TAGS.map(t =>
    `<button class="tbar-tag" onclick="searchTag('${t}')">${t}</button>`
  ).join('');
}

/* ─────────────────────────────────────────
   MOOD FILTER
───────────────────────────────────────── */
const MOOD_CATS = {
  all:      null,
  romantic: ['erotic','beautiful','art'],
  passion:  ['anal','orgy','rough'],
  home:     ['homemade','russian','amateur'],
  couple:   ['couples','beautiful'],
  wild:     ['rough','bdsm','orgy'],
  role:     ['sibling','cheating'],
  mature:   ['milf'],
  lesbian:  ['lesbian'],
};

let currentMood = 'all';

function initMoodStrip() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.onclick = () => {
      currentMood = btn.dataset.mood;
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      videoPage = 1;
      renderGrid();
    };
  });
}

/* ─────────────────────────────────────────
   PRIVACY MODE
───────────────────────────────────────── */
let privacyMode = false;

function togglePrivacy() {
  privacyMode = !privacyMode;
  document.body.classList.toggle('privacy-mode', privacyMode);
  const btn = document.getElementById('btn-privacy');
  btn.classList.toggle('active', privacyMode);
  const ico = document.getElementById('privacy-ico');
  ico.innerHTML = privacyMode
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  showPrivacyBanner(privacyMode ? '🔒 Режим приватности включён — превью скрыты' : '👁 Режим приватности выключен');
}

function showPrivacyBanner(msg) {
  let b = document.getElementById('privacy-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'privacy-banner';
    b.className = 'privacy-banner';
    document.body.appendChild(b);
  }
  b.textContent = msg;
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('show'), 2200);
}

/* ─────────────────────────────────────────
   AMBIENT GLOW
───────────────────────────────────────── */
let _ambientInterval = null;
const _ambientCanvas = document.createElement('canvas');
_ambientCanvas.width = 48; _ambientCanvas.height = 27;
const _ambientCtx = _ambientCanvas.getContext('2d');

function startAmbient() {
  const video  = document.getElementById('vp-video');
  const player = document.getElementById('vplayer');
  if (!video || !player) return;

  function sample() {
    try {
      _ambientCtx.drawImage(video, 0, 0, 48, 27);
      const d = _ambientCtx.getImageData(0, 0, 48, 27).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 20) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
      r = r/n|0; g = g/n|0; b = b/n|0;
      // Boost saturation a bit for more dramatic glow
      const max = Math.max(r,g,b) || 1;
      const boost = 1.4;
      r = Math.min(255, r/max*255*boost|0);
      g = Math.min(255, g/max*255*boost|0);
      b = Math.min(255, b/max*255*boost|0);
      player.style.boxShadow =
        `0 0 60px 8px rgba(${r},${g},${b},.45),`+
        `0 0 120px 20px rgba(${r},${g},${b},.18),`+
        `0 0 4px 1px rgba(${r},${g},${b},.6)`;
    } catch {}
  }

  video.addEventListener('play', () => {
    clearInterval(_ambientInterval);
    _ambientInterval = setInterval(sample, 220);
  });
  video.addEventListener('pause', () => {
    clearInterval(_ambientInterval);
    player.style.boxShadow = '';
  });
  video.addEventListener('ended', () => {
    clearInterval(_ambientInterval);
    player.style.boxShadow = '';
  });
}

function stopAmbient() {
  clearInterval(_ambientInterval);
  const player = document.getElementById('vplayer');
  if (player) player.style.boxShadow = '';
}

/* ─────────────────────────────────────────
   GRID RENDER
───────────────────────────────────────── */
function getFiltered() {
  let list = [...DB];
  // Mood filter
  const moodCats = MOOD_CATS[currentMood];
  if (moodCats) list = list.filter(v => moodCats.includes(v.cat));
  // Category filter
  if (!['all', 'new', 'top', '_search'].includes(currentCat))
    list = list.filter(v => v.cat === currentCat);
  if (currentSort === 'trend')
    list.sort((a, b) => (b.viewsN * 0.6 + b.likesN * 0.4) - (a.viewsN * 0.6 + a.likesN * 0.4));
  else if (currentSort === 'likes') list.sort((a, b) => b.likesN  - a.likesN);
  else if (currentSort === 'views') list.sort((a, b) => b.viewsN - a.viewsN);
  else if (currentSort === 'dur')   list.sort((a, b) => b.durSec - a.durSec);
  else list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

function renderGrid(append = false) {
  const grid = document.getElementById('vgrid');
  if (!append) grid.innerHTML = '';

  const all     = getFiltered();
  const perPage = 20;
  const slice   = all.slice(0, videoPage * perPage);
  const start   = append ? (videoPage - 1) * perPage : 0;

  if (all.length === 0) {
    grid.innerHTML = buildEmptyState();
    document.getElementById('load-more').classList.add('hidden');
    return;
  }

  for (let i = start; i < slice.length; i++) grid.insertAdjacentHTML('beforeend', buildCard(slice[i]));
  document.getElementById('load-more').classList.toggle('hidden', slice.length >= all.length);
}

function buildEmptyState() {
  return `
    <div class="empty-state">
      <svg width="64" height="64" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" style="color:var(--text3)">
        <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.914L15 14M4 8h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"/>
      </svg>
      <h3>Здесь пока пусто</h3>
      <p>Лучшие видео уже на пути — скоро они появятся здесь</p>
    </div>`;
}

function buildCard(v) {
  const thumbStyle = `background:url(${v.thumb}) center/cover no-repeat`;
  const badges = [];
  if (v.is4k)  badges.push('<span class="vcard__badge badge--4k">4K</span>');
  else if (v.isHD) badges.push('<span class="vcard__badge badge--hd">HD</span>');

  const modelsHtml = (v.models && v.models.length)
    ? `<div class="vcard__models">${v.models.map(m => `<a onclick="event.stopPropagation();searchTag('${m}')">${m}</a>`).join(', ')}</div>`
    : '';

  const liveHtml = '';

  return `
    <div class="vcard" data-id="${v.id}">
      <div class="vcard__thumb"
        onmouseenter="startPreview(this,${v.id})"
        onmouseleave="stopPreview(this)"
        onclick="openWatch(${v.id})">
        <div class="vcard__bg" style="${thumbStyle}"></div>
        ${badges.join('')}
        <span class="vcard__dur">${v.dur}</span>
        <div class="vcard__hover"><div class="play-btn-sm"><svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>
        <div class="vcard__rbar"><div class="vcard__rbar-fill" style="width:${v.ratingPct}%"></div></div>
      </div>
      <div class="vcard__info" onclick="openWatch(${v.id})">
        <div class="vcard__title">${v.title}</div>
        <div class="vcard__meta">
          <span class="vm-ico"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${fmtCount(v.viewsN)}</span>
          <span class="vm-sep">·</span>
          <span class="vm-ico"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${v.dur}</span>
          <span class="vm-sep">·</span>
          <span>${CAT_LABELS[v.cat] || v.cat}</span>
          ${liveHtml}
        </div>
        ${modelsHtml}
      </div>
    </div>`;
}

/* ─────────────────────────────────────────
   HOVER PREVIEW
───────────────────────────────────────── */
const _prevTimers = new Map();
const _prevVideos = new Map();

function startPreview(thumbEl, id) {
  const v = DB.find(x => x.id === id);
  if (!v || !v.src) return;
  const t = setTimeout(() => {
    if (_prevVideos.has(thumbEl)) return;
    const vid = document.createElement('video');
    vid.src = v.src;
    vid.muted = true; vid.autoplay = true; vid.loop = true; vid.playsInline = true;
    vid.className = 'vcard__preview';
    vid.currentTime = v.previewStart || 2;
    thumbEl.appendChild(vid);
    vid.play().catch(() => {});
    requestAnimationFrame(() => vid.classList.add('showing'));
    _prevVideos.set(thumbEl, vid);
  }, 600);
  _prevTimers.set(thumbEl, t);
}

function stopPreview(thumbEl) {
  clearTimeout(_prevTimers.get(thumbEl));
  _prevTimers.delete(thumbEl);
  const vid = _prevVideos.get(thumbEl);
  if (vid) { vid.classList.remove('showing'); setTimeout(() => vid.remove(), 300); _prevVideos.delete(thumbEl); }
}

/* ─────────────────────────────────────────
   SHORTS
───────────────────────────────────────── */
function renderShorts() {
  const row = document.getElementById('shorts-row');
  if (ShortsDB.length === 0) {
    row.innerHTML = `
      <div class="empty-shorts">
        <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color:var(--text3)"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M10 8l6 4-6 4V8z"/></svg>
        <p>Shorts скоро появятся</p>
      </div>`;
    return;
  }
  row.innerHTML = ShortsDB.map(s => `
    <div class="scard" onclick="openShortsViewer(${s.id})">
      <div class="scard__bg" style="background:url(${s.thumb}) center/cover no-repeat"></div>
      <div class="scard__ov2"></div>
      <div class="scard__play"><div class="play-btn-sm"><svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>
      <div class="scard__info">
        <p class="scard__title">${s.title}</p>
      </div>
    </div>`).join('');
}

/* ─────────────────────────────────────────
   SHORTS VIEWER  (TikTok style)
───────────────────────────────────────── */
let _svObserver = null;
let _svIdx      = 0;
let _svMuted    = false;

function openShortsViewer(startId) {
  const overlay = document.getElementById('view-shorts');
  const feed    = document.getElementById('sv-feed');

  if (ShortsDB.length === 0) {
    feed.innerHTML = `<div class="sv-empty"><svg width="52" height="52" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24" style="color:#444"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M10 8l6 4-6 4V8z"/></svg><h3>Shorts пока нет</h3><p>Загрузите первый шортс в своём профиле</p></div>`;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    return;
  }

  // Build feed
  feed.innerHTML = ShortsDB.map((s, i) => `
    <div class="sv-item" data-id="${s.id}" data-idx="${i}">
      <video class="sv-video" src="${s.src}" loop playsinline${_svMuted ? ' muted' : ''}></video>
      <div class="sv-grad"></div>
      <div class="sv-taphint"><div class="sv-paused-ico"><svg width="28" height="28" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>
      <div class="sv-info">
        <div class="sv-title">${s.title}</div>
        <div class="sv-meta">${fmtCount(s.viewsN)} просм. · ${s.dur}</div>
      </div>
      <div class="sv-actions">
        <button class="sv-act${s.liked ? ' liked' : ''}" onclick="shortsLike(${s.id}, this)">
          <svg fill="${s.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span id="sl-${s.id}">${fmtCount(s.likesN)}</span>
        </button>
        <button class="sv-act" onclick="shareVideo()">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          <span>Поделиться</span>
        </button>
      </div>
    </div>`).join('');

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Jump to the tapped short
  const startIdx = startId ? ShortsDB.findIndex(s => s.id === startId) : 0;
  _svIdx = Math.max(0, startIdx);

  if (_svObserver) { _svObserver.disconnect(); _svObserver = null; }

  // Tap to pause/play
  feed.querySelectorAll('.sv-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.sv-act')) return;
      const vid = item.querySelector('.sv-video');
      if (!vid) return;
      if (vid.paused) { vid.play(); item.classList.remove('paused'); }
      else            { vid.pause(); item.classList.add('paused'); }
    });
  });

  // IntersectionObserver — auto-play visible, pause others
  _svObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const vid = entry.target.querySelector('.sv-video');
      if (!vid) return;
      if (entry.isIntersecting) {
        vid.muted = _svMuted;
        vid.play().catch(() => {});
        entry.target.classList.remove('paused');
        _svIdx = +entry.target.dataset.idx;
        updateShortsCounter();
      } else {
        vid.pause();
        vid.currentTime = 0;
      }
    });
  }, { threshold: 0.6 });

  feed.querySelectorAll('.sv-item').forEach(el => _svObserver.observe(el));

  // Scroll to start item
  requestAnimationFrame(() => {
    const items = feed.querySelectorAll('.sv-item');
    if (items[_svIdx]) items[_svIdx].scrollIntoView({ behavior: 'instant' });
  });
}

function closeShortsViewer() {
  const overlay = document.getElementById('view-shorts');
  const feed    = document.getElementById('sv-feed');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
  feed.querySelectorAll('.sv-video').forEach(v => { v.pause(); v.src = ''; });
  if (_svObserver) { _svObserver.disconnect(); _svObserver = null; }
  feed.innerHTML = '';
}

function shortsScrollTo(dir) {
  const feed  = document.getElementById('sv-feed');
  const items = feed.querySelectorAll('.sv-item');
  const next  = Math.max(0, Math.min(items.length - 1, _svIdx + dir));
  items[next]?.scrollIntoView({ behavior: 'smooth' });
}

function updateShortsCounter() {
  const el = document.getElementById('sv-counter');
  if (el) el.textContent = (_svIdx + 1) + ' / ' + ShortsDB.length;
}

function shortsMuteToggle() {
  _svMuted = !_svMuted;
  document.querySelectorAll('.sv-video').forEach(v => v.muted = _svMuted);
  const ico = document.getElementById('sv-mute-ico');
  if (ico) ico.innerHTML = _svMuted
    ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="none"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'
    : '<path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>';
}

function shortsLike(id, btn) {
  const s = ShortsDB.find(x => x.id === id);
  if (!s) return;
  s.liked  = !s.liked;
  s.likesN += s.liked ? 1 : -1;
  btn.classList.toggle('liked', s.liked);
  btn.querySelector('svg').setAttribute('fill', s.liked ? 'currentColor' : 'none');
  const cnt = document.getElementById('sl-' + id);
  if (cnt) cnt.textContent = fmtCount(s.likesN);
}

// Close shorts viewer on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.getElementById('view-shorts').classList.contains('hidden'))
    closeShortsViewer();
  if (e.key === 'ArrowUp'   && !document.getElementById('view-shorts').classList.contains('hidden')) shortsScrollTo(-1);
  if (e.key === 'ArrowDown' && !document.getElementById('view-shorts').classList.contains('hidden')) shortsScrollTo(1);
});

/* ─────────────────────────────────────────
   WATCH
───────────────────────────────────────── */
function openWatch(id) {
  const pool = [...DB, ...ShortsDB];
  const v = pool.find(x => x.id === id);
  if (!v) return;
  currentVidId = id;

  // Track views
  if (DB.find(x => x.id === id)) DB.find(x => x.id === id).viewsN++;

  // Add to history
  watchHistory = watchHistory.filter(x => x.id !== id);
  watchHistory.unshift(v);
  if (watchHistory.length > 8) watchHistory.pop();
  renderHistory();

  // Fill meta
  document.getElementById('w-title').textContent  = v.title;
  document.getElementById('w-views').textContent  = fmtCount(v.viewsN) + ' просмотров';
  document.getElementById('w-date').textContent   = v.ago;
  document.getElementById('w-cat').textContent    = CAT_LABELS[v.cat] || v.cat;
  document.getElementById('w-likes-n').textContent = fmtCount(v.likesN);

  // Rating bar
  document.getElementById('rating-fill').style.width = v.ratingPct + '%';
  document.getElementById('rating-like-pct').textContent  = '👍 ' + v.ratingPct + '%';
  document.getElementById('rating-dis-pct').textContent   = '👎 ' + (100 - v.ratingPct) + '%';

  // Tags
  document.getElementById('w-tags').innerHTML =
    (v.tags || []).map(t => `<button class="watch-tag" onclick="searchTag('${t}')">${t}</button>`).join('');

  // Description
  document.getElementById('w-desc').textContent = v.desc || '';

  // Owner buttons (edit/delete) — only when logged in
  document.getElementById('w-edit').style.display   = currentUser ? 'inline-flex' : 'none';
  document.getElementById('w-delete').style.display = currentUser ? 'inline-flex' : 'none';
  document.getElementById('w-edit').onclick   = () => openEdit(id);
  document.getElementById('w-delete').onclick = () => deleteVideo(id);

  // Download
  document.getElementById('w-download').onclick = () => {
    const a = document.createElement('a');
    a.href = v.src; a.download = v.title + '.mp4'; a.click();
  };

  // Load video
  const video = document.getElementById('vp-video');
  document.getElementById('vp-src').src = v.src;
  video.load();
  resetPlayer();

  // Comments
  if (!comments[id]) comments[id] = [];
  renderComments(id);

  // Related
  renderRelated(id);

  showView('watch');
}

/* ─────────────────────────────────────────
   RELATED
───────────────────────────────────────── */
function renderRelated(exceptId) {
  const list = DB.filter(v => v.id !== exceptId);
  const el   = document.getElementById('related-list');
  if (list.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:.82rem;padding:8px 0">Других видео пока нет</p>';
    return;
  }
  el.innerHTML = list.map(v => `
    <div class="rcard" onclick="openWatch(${v.id})">
      <div class="rcard__thumb">
        <div class="rcard__bg" style="background:url(${v.thumb}) center/cover no-repeat"></div>
        <span class="rcard__dur">${v.dur}</span>
      </div>
      <div class="rcard__info">
        <div class="rcard__title">${v.title}</div>
        <div class="rcard__meta">${fmtCount(v.viewsN)} просм. · ${v.ago}</div>
      </div>
    </div>`).join('');
}

/* ─────────────────────────────────────────
   HISTORY
───────────────────────────────────────── */
function renderHistory() {
  const el = document.getElementById('history-list');
  if (!el) return;
  if (watchHistory.length === 0) { el.innerHTML = '<p class="sb-empty">Пока ничего нет</p>'; return; }
  el.innerHTML = watchHistory.map(v => `
    <div class="history-item" onclick="openWatch(${v.id})">
      <div class="history-thumb" style="background:url(${v.thumb}) center/cover no-repeat;width:48px;height:27px;border-radius:4px;flex-shrink:0;"></div>
      <div class="history-title">${v.title}</div>
    </div>`).join('');
}

/* ─────────────────────────────────────────
   COMMENTS
───────────────────────────────────────── */
function renderComments(id) {
  const list = comments[id] || [];
  document.getElementById('comments-count').textContent = `Комментарии (${list.length})`;
  document.getElementById('comments-list').innerHTML = list.length === 0
    ? '<p style="color:var(--text3);font-size:.82rem;padding:12px 0">Будьте первым, кто оставит комментарий</p>'
    : list.map((c, i) => `
        <div class="comment-item">
          <div class="comment-ava" style="background:hsl(${c.hue},55%,35%)">${c.name[0].toUpperCase()}</div>
          <div style="flex:1">
            <div class="ci-name">${c.name} <span>${c.ago}</span></div>
            <div class="ci-text">${c.text}</div>
            <div class="ci-actions">
              <button class="ci-action ${c.liked?'liked':''}" onclick="likeComment(${i})">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg>
                ${c.likes}
              </button>
              <button class="ci-action">Ответить</button>
            </div>
          </div>
        </div>`).join('');
}

function addComment(e) {
  e.preventDefault();
  const input = document.getElementById('comment-input');
  const text  = input.value.trim();
  if (!text) return;
  if (!comments[currentVidId]) comments[currentVidId] = [];
  comments[currentVidId].unshift({ name:'Вы', text, likes:0, ago:'Только что', hue:340, liked:false });
  renderComments(currentVidId);
  input.value = '';
  document.getElementById('comment-btns').classList.add('hidden');
  showToast('Комментарий добавлен!');
}

function likeComment(idx) {
  const list = comments[currentVidId];
  if (!list) return;
  list[idx].liked = !list[idx].liked;
  list[idx].likes += list[idx].liked ? 1 : -1;
  renderComments(currentVidId);
}

function sortComments(val) {
  const list = comments[currentVidId];
  if (!list) return;
  if (val === 'top') list.sort((a, b) => b.likes - a.likes);
  else list.sort((a, b) => (a.ago === 'Только что' ? -1 : 1));
  renderComments(currentVidId);
}

function cancelComment() {
  document.getElementById('comment-input').value = '';
  document.getElementById('comment-btns').classList.add('hidden');
}

document.addEventListener('click', e => {
  if (e.target === document.getElementById('comment-input'))
    document.getElementById('comment-btns').classList.remove('hidden');
});

/* ─────────────────────────────────────────
   EDIT / DELETE
───────────────────────────────────────── */
function openEdit(id) {
  const v = DB.find(x => x.id === id);
  if (!v) return;
  editingId = id;
  document.getElementById('edit-title').value = v.title;
  document.getElementById('edit-desc').value  = v.desc || '';
  document.getElementById('edit-cat').value   = v.cat;
  document.getElementById('edit-tags').value  = (v.tags || []).join(', ');
  openModal('edit-modal');
}

function saveEdit(e) {
  e.preventDefault();
  const v = DB.find(x => x.id === editingId);
  if (!v) return;
  v.title = document.getElementById('edit-title').value.trim();
  v.desc  = document.getElementById('edit-desc').value.trim();
  v.cat   = document.getElementById('edit-cat').value;
  v.tags  = document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  closeModal('edit-modal');
  // Refresh UI
  document.getElementById('w-title').textContent = v.title;
  document.getElementById('w-cat').textContent   = CAT_LABELS[v.cat] || v.cat;
  document.getElementById('w-tags').innerHTML    = v.tags.map(t => `<button class="watch-tag" onclick="searchTag('${t}')">${t}</button>`).join('');
  document.getElementById('w-desc').textContent  = v.desc;
  renderGrid(); renderRelated(editingId);
  showToast('Изменения сохранены');
}

function deleteVideo(id) {
  if (!confirm('Удалить это видео?')) return;
  DB = DB.filter(v => v.id !== id);
  renderGrid(); renderShorts(); renderHistory();
  showView('home');
  navigate('all');
  showToast('Видео удалено');
}

/* ─────────────────────────────────────────
   SEARCH
───────────────────────────────────────── */
function initSearch() {
  const form  = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const sug   = document.getElementById('search-suggestions');

  form.onsubmit = e => { e.preventDefault(); doSearch(input.value.trim()); sug.classList.remove('open'); };

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q || q.length < 2) { sug.classList.remove('open'); return; }
    const pool = [...new Set([
      ...DB.map(v => v.title),
      ...DB.flatMap(v => v.tags || []),
      ...Object.values(CAT_LABELS),
    ])].filter(s => s.toLowerCase().includes(q)).slice(0, 7);
    sug.innerHTML = pool.map(s => `<div class="sug-item" onclick="selectSug('${s.replace(/'/g,"\\'")}')">${s}</div>`).join('');
    sug.classList.toggle('open', pool.length > 0);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-bar')) sug.classList.remove('open');
    if (!e.target.closest('#profile-menu')) closeProfileMenu();
  });
}

function selectSug(s) {
  document.getElementById('search-input').value = s;
  document.getElementById('search-suggestions').classList.remove('open');
  doSearch(s);
}

function doSearch(q) {
  if (!q) return;
  const ql = q.toLowerCase();
  const results = DB.filter(v =>
    v.title.toLowerCase().includes(ql) ||
    (v.tags || []).some(t => t.toLowerCase().includes(ql)) ||
    (CAT_LABELS[v.cat] || '').toLowerCase().includes(ql)
  );
  currentCat = '_search'; videoPage = 1;
  showView('home');
  document.querySelectorAll('.cnav').forEach(b => b.classList.remove('active'));
  document.getElementById('grid-title').textContent = `Поиск: "${q}" (${results.length})`;
  const grid = document.getElementById('vgrid');
  grid.innerHTML = results.length
    ? results.map(v => buildCard(v)).join('')
    : '<p style="color:var(--text3);padding:20px;grid-column:1/-1">Ничего не найдено</p>';
  document.getElementById('load-more').classList.add('hidden');
}

function searchTag(tag) {
  document.getElementById('search-input').value = tag;
  doSearch(tag);
}

/* ─────────────────────────────────────────
   SIDEBAR TAGS  (динамически из загруженных видео)
───────────────────────────────────────── */
function refreshTags() {
  const tags = [...new Set(DB.flatMap(v => v.tags || []))].slice(0, 15);
  const el = document.getElementById('sb-tags');
  if (!el) return;
  el.innerHTML = tags.length
    ? tags.map(t => `<button class="stag" onclick="searchTag('${t}')">${t}</button>`).join('')
    : '<p class="sb-empty">Теги появятся после загрузки видео</p>';
}

/* ─────────────────────────────────────────
   VIDEO PLAYER
───────────────────────────────────────── */
function resetPlayer() {
  document.getElementById('vp-overlay').classList.remove('hide');
  document.getElementById('vp-fill').style.width  = '0%';
  document.getElementById('vp-thumb').style.left  = '0%';
  document.getElementById('vp-cur').textContent = '0:00';
  document.getElementById('vp-dur').textContent = '0:00';
  setPlayIco('play');
  document.getElementById('w-like').classList.remove('liked');
  document.getElementById('w-dislike').classList.remove('active');
  document.getElementById('w-fav').classList.remove('active');
}

function initPlayerControls() {
  const video   = document.getElementById('vp-video');
  const overlay = document.getElementById('vp-overlay');
  const bigPlay = document.getElementById('vp-bigplay');
  const ctrlPl  = document.getElementById('vc-play');
  const fill    = document.getElementById('vp-fill');
  const buf     = document.getElementById('vp-buf');
  const thumb   = document.getElementById('vp-thumb');
  const prog    = document.getElementById('vp-progress');
  const curEl   = document.getElementById('vp-cur');
  const durEl   = document.getElementById('vp-dur');
  const vol     = document.getElementById('vp-vol');

  function togglePlay() {
    if (video.paused) { video.play(); overlay.classList.add('hide'); setPlayIco('pause'); }
    else              { video.pause(); overlay.classList.remove('hide'); setPlayIco('play'); }
  }

  bigPlay.onclick = togglePlay;
  ctrlPl.onclick  = togglePlay;
  document.getElementById('vp-screen').addEventListener('click', e => {
    if (e.target === document.getElementById('vp-screen') || e.target === video) togglePlay();
  });

  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const p = video.currentTime / video.duration * 100;
    fill.style.width = p + '%';
    thumb.style.left = p + '%';
    curEl.textContent = fmtTime(video.currentTime);
  });
  video.addEventListener('loadedmetadata', () => { durEl.textContent = fmtTime(video.duration); });
  video.addEventListener('progress', () => {
    if (video.duration && video.buffered.length)
      buf.style.width = (video.buffered.end(video.buffered.length - 1) / video.duration * 100) + '%';
  });
  video.addEventListener('ended', () => {
    overlay.classList.remove('hide'); setPlayIco('play');
    if (autoplay) {
      const idx  = DB.findIndex(v => v.id === currentVidId);
      const next = DB[(idx + 1) % DB.length];
      if (next && DB.length > 1) setTimeout(() => openWatch(next.id), 1500);
    }
  });

  // Seek
  let seeking = false;
  const seek  = e => { const r = prog.getBoundingClientRect(); video.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (video.duration || 0); };
  prog.addEventListener('mousedown', e => { seeking = true; seek(e); });
  addEventListener('mousemove',  e => { if (seeking) seek(e); });
  addEventListener('mouseup',    () => { seeking = false; });
  prog.addEventListener('touchstart', e => seek(e.touches[0]), { passive: true });
  prog.addEventListener('touchmove',  e => seek(e.touches[0]), { passive: true });

  // Volume
  video.volume = .8;
  vol.addEventListener('input', () => { video.volume = vol.value / 100; video.muted = +vol.value === 0; updateVolIco(); });
  document.getElementById('vc-mute').onclick = () => { video.muted = !video.muted; vol.value = video.muted ? 0 : video.volume * 100; updateVolIco(); };

  // Fullscreen
  document.getElementById('vc-fs').onclick = () => {
    const box = document.getElementById('vplayer');
    document.fullscreenElement ? document.exitFullscreen() : box.requestFullscreen?.();
  };

  // Theater
  document.getElementById('vc-theater').onclick = () => document.getElementById('watch-wrap').classList.toggle('theater');

  // PiP
  document.getElementById('vc-pip').onclick = async () => {
    try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await video.requestPictureInPicture(); }
    catch { showToast('PiP недоступен в этом браузере'); }
  };

  // Double-click skip
  const skipB = document.getElementById('skip-back');
  const skipF = document.getElementById('skip-fwd');
  function flash(el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 500); }

  document.getElementById('vp-screen').addEventListener('dblclick', e => {
    const x = e.clientX - document.getElementById('vp-screen').getBoundingClientRect().left;
    const w = document.getElementById('vp-screen').offsetWidth;
    if (x < w * .35) { video.currentTime = Math.max(0, video.currentTime - 10); flash(skipB); }
    else if (x > w * .65) { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); flash(skipF); }
    else togglePlay();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (currentView !== 'watch') return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space')      { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); flash(skipF); }
    if (e.code === 'ArrowLeft')  { video.currentTime = Math.max(0, video.currentTime - 10); flash(skipB); }
    if (e.code === 'ArrowUp')    { video.volume = Math.min(1, video.volume + .1); vol.value = video.volume * 100; updateVolIco(); }
    if (e.code === 'ArrowDown')  { video.volume = Math.max(0, video.volume - .1); vol.value = video.volume * 100; updateVolIco(); }
    if (e.code === 'KeyF')       document.getElementById('vc-fs').click();
    if (e.code === 'KeyT')       document.getElementById('vc-theater').click();
    if (e.code === 'KeyM')       { video.muted = !video.muted; vol.value = video.muted ? 0 : video.volume * 100; updateVolIco(); }
  });

  // Like / dislike / save
  document.getElementById('w-like').onclick = function () {
    this.classList.toggle('liked');
    const v = DB.find(x => x.id === currentVidId);
    if (v) { v.likesN += this.classList.contains('liked') ? 1 : -1; document.getElementById('w-likes-n').textContent = fmtCount(v.likesN); }
    showToast(this.classList.contains('liked') ? 'Понравилось!' : 'Оценка убрана');
  };
  document.getElementById('w-dislike').onclick = function () { this.classList.toggle('active'); };
  document.getElementById('w-fav').onclick = function () {
    this.classList.toggle('active');
    showToast(this.classList.contains('active') ? 'Сохранено в избранное' : 'Удалено из избранного');
  };
}

function setPlayIco(state) {
  const ico = document.getElementById('vc-play-ico');
  if (!ico) return;
  ico.innerHTML = state === 'pause'
    ? '<rect x="6" y="4" width="4" height="16" rx="1" fill="white"/><rect x="14" y="4" width="4" height="16" rx="1" fill="white"/>'
    : '<path d="M8 5v14l11-7z" fill="white"/>';
  ico.setAttribute('viewBox', '0 0 24 24');
}

function updateVolIco() {
  const video = document.getElementById('vp-video');
  const ico   = document.getElementById('vc-vol-ico');
  if (!ico) return;
  const m = video.muted || video.volume === 0;
  ico.innerHTML = m
    ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="white" stroke-width="2" fill="none"/><line x1="23" y1="9" x2="17" y2="15" stroke="white" stroke-width="2"/><line x1="17" y1="9" x2="23" y2="15" stroke="white" stroke-width="2"/>'
    : '<path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="white" stroke-width="2" fill="none"/>';
}

/* ─────────────────────────────────────────
   AUTOPLAY TOGGLE
───────────────────────────────────────── */
function initAutoplay() {
  updateAutoplayUI();
  document.getElementById('vc-autoplay').onclick = toggleAutoplay;
}

function toggleAutoplay() {
  autoplay = !autoplay;
  updateAutoplayUI();
  showToast('Автоплей ' + (autoplay ? 'включён' : 'выключён'));
}

function updateAutoplayUI() {
  document.getElementById('toggle-sw')?.classList.toggle('on', autoplay);
  document.getElementById('ap-dot')?.classList.toggle('on', autoplay);
}

/* ─────────────────────────────────────────
   UPLOAD SYSTEM  — canvas thumbnail extraction
───────────────────────────────────────── */
function initUpload() {
  const dz    = document.getElementById('drop-zone');
  const input = document.getElementById('up-file');

  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('video/')) processFile(f);
    else showToast('Пожалуйста, выберите видеофайл');
  });
  input.addEventListener('change', () => { if (input.files[0]) processFile(input.files[0]); });
}

function processFile(file) {
  uploadFile = file;
  document.getElementById('dz-content').classList.add('hidden');
  document.getElementById('up-progress').classList.remove('hidden');

  const bar = document.getElementById('up-prog-fill');
  const lbl = document.getElementById('up-prog-label');
  const steps = [[15,'Загружаем файл...'],[40,'Анализируем видео...'],[70,'Извлекаем превью...'],[90,'Почти готово...'],[100,'Готово!']];
  let si = 0;
  const run = () => {
    if (si >= steps.length) return;
    const [p, m] = steps[si++];
    bar.style.width = p + '%'; lbl.textContent = m;
    if (si < steps.length) setTimeout(run, 350 + Math.random() * 250);
    else setTimeout(() => extractThumbs(file), 200);
  };
  setTimeout(run, 150);
}

async function extractThumbs(file) {
  uploadObjUrl = URL.createObjectURL(file);
  const video  = document.createElement('video');
  video.src    = uploadObjUrl;
  video.muted  = true;
  video.preload = 'metadata';

  await new Promise(res => video.addEventListener('loadedmetadata', res, { once: true }));
  const dur = video.duration || 30;

  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 360;
  const ctx = canvas.getContext('2d');
  const thumbs = [];
  const count  = 4;

  for (let i = 0; i < count; i++) {
    const t = (dur / (count + 1)) * (i + 1);
    await new Promise(res => {
      video.currentTime = t;
      video.addEventListener('seeked', () => {
        ctx.drawImage(video, 0, 0, 640, 360);
        thumbs.push(canvas.toDataURL('image/jpeg', .85));
        res();
      }, { once: true });
    });
  }

  uploadThumbs   = thumbs;
  selectedThumb  = 0;

  // Show step 2
  document.getElementById('up-s1').classList.add('hidden');
  document.getElementById('up-s2').classList.remove('hidden');
  document.getElementById('up-thumb-img').src = thumbs[0];
  document.getElementById('up-thumbs').innerHTML = thumbs.map((url, i) => `
    <div class="up-thumb-opt ${i === 0 ? 'selected' : ''}" onclick="pickThumb(${i})">
      <img src="${url}"/>
    </div>`).join('');

  // Suggest title from filename
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[_\-\.]/g, ' ').trim();
  if (name.length > 2) document.getElementById('up-title').value = name;

  // Store duration string
  video.uploadDurSec = dur;
  window._uploadDurSec = dur;
}

function pickThumb(idx) {
  selectedThumb = idx;
  document.getElementById('up-thumb-img').src = uploadThumbs[idx];
  document.querySelectorAll('.up-thumb-opt').forEach((el, i) => el.classList.toggle('selected', i === idx));
}

async function publishVideo(e) {
  e.preventDefault();
  const title = document.getElementById('up-title').value.trim();
  const desc  = document.getElementById('up-desc').value.trim();
  const cat   = document.getElementById('up-cat').value;
  const tags  = document.getElementById('up-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const isShort = document.querySelector('input[name="up-type"]:checked')?.value === 'short';
  const durSec  = window._uploadDurSec || 0;

  const newV = {
    id:        Date.now(),
    title:     title || 'Без названия',
    desc,
    thumb:     uploadThumbs[selectedThumb],
    src:       uploadObjUrl,
    previewStart: Math.floor((window._uploadDurSec || 30) * 0.15),
    cat,
    tags,
    dur:       fmtTime(durSec),
    durSec,
    viewsN:    0,
    likesN:    0,
    ratingPct: 100,
    ago:       'Только что',
    is4k:      false, isHD: true,
    type:      isShort ? 'short' : 'video',
    createdAt: Date.now(),
  };

  if (isShort) ShortsDB.unshift(newV);
  else          DB.unshift(newV);

  renderGrid();
  renderShorts();
  refreshTags();

  document.getElementById('up-s2').classList.add('hidden');
  document.getElementById('up-s3').classList.remove('hidden');

  // Upload to cloud in background (non-blocking)
  if (cloudOn() && uploadFile) {
    try {
      // Show upload progress
      const progWrap = document.getElementById('up-progress');
      const progFill = document.getElementById('up-prog-fill');
      progWrap.classList.remove('hidden');
      document.getElementById('dz-content').classList.add('hidden');

      const cloudUrl = await uploadFileCloud(uploadFile, pct => {
        progFill.style.width = pct + '%';
      });
      const thumbUrl = await uploadThumbCloud(uploadThumbs[selectedThumb]);

      newV.src   = cloudUrl;
      newV.thumb = thumbUrl;
      newV.id    = String(newV.id);

      await saveVideoCloud(newV);
    } catch(err) {
      console.warn('Cloud upload failed, video kept locally:', err);
    }
  }
}

function resetUpload() {
  uploadFile = null; uploadObjUrl = null; uploadThumbs = []; selectedThumb = 0;
  document.getElementById('up-s1').classList.remove('hidden');
  document.getElementById('up-s2').classList.add('hidden');
  document.getElementById('up-s3').classList.add('hidden');
  document.getElementById('up-progress').classList.add('hidden');
  document.getElementById('dz-content').classList.remove('hidden');
  document.getElementById('up-prog-fill').style.width = '0%';
  document.getElementById('up-file').value = '';
}

/* ─────────────────────────────────────────
   SHARE
───────────────────────────────────────── */
function shareVideo() {
  if (navigator.clipboard) navigator.clipboard.writeText(location.href);
  showToast('Ссылка скопирована!');
}

/* ─────────────────────────────────────────
   MODALS
───────────────────────────────────────── */
function openModal(id)   { const m = document.getElementById(id); if (!m) return; m.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id)  { const m = document.getElementById(id); if (!m) return; m.classList.remove('open'); document.body.style.overflow = ''; }
function switchModal(a, b) { closeModal(a); setTimeout(() => openModal(b), 180); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!document.getElementById('view-shorts').classList.contains('hidden')) return; // handled by shorts listener
    document.querySelectorAll('.modal.open').forEach(m => closeModal(m.id));
  }
});

/* ─────────────────────────────────────────
   FORMS
───────────────────────────────────────── */
function handleLogin(e) {
  e.preventDefault();
  const login = document.getElementById('l-login').value.trim();
  const pass  = document.getElementById('lp').value;
  const users = JSON.parse(localStorage.getItem('vx-users') || '[]');
  const user  = users.find(u => (u.username === login || u.email === login) && u.password === pass);
  if (!user) { showToast('Неверный логин или пароль'); return; }
  currentUser = { username: user.username, email: user.email };
  sessionStorage.setItem('vx-user', JSON.stringify(currentUser));
  updateAuthUI();
  closeModal('login-modal');
  showToast('Добро пожаловать, ' + user.username + '!');
}

function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('r-username').value.trim();
  const email    = document.getElementById('r-email').value.trim();
  const pass1    = document.getElementById('rp1').value;
  const pass2    = document.getElementById('rp2').value;
  if (pass1 !== pass2) { showToast('Пароли не совпадают!'); return; }
  const users = JSON.parse(localStorage.getItem('vx-users') || '[]');
  if (users.find(u => u.username === username)) { showToast('Имя пользователя уже занято'); return; }
  if (users.find(u => u.email === email))       { showToast('Email уже используется'); return; }
  users.push({ username, email, password: pass1, createdAt: Date.now() });
  localStorage.setItem('vx-users', JSON.stringify(users));
  currentUser = { username, email };
  sessionStorage.setItem('vx-user', JSON.stringify(currentUser));
  updateAuthUI();
  closeModal('register-modal');
  showToast('Аккаунт создан! Добро пожаловать, ' + username + '!');
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem('vx-user');
  updateAuthUI();
  closeProfileMenu();
  showToast('Вы вышли из аккаунта');
}

function updateAuthUI() {
  const out = document.getElementById('auth-out');
  const inp = document.getElementById('auth-in');
  if (!out || !inp) return;
  if (currentUser) {
    out.classList.add('hidden');
    inp.classList.remove('hidden');
    const letter = (currentUser.username || '?')[0].toUpperCase();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('profile-ava',  letter);
    set('profile-name', currentUser.username);
    set('pd-ava',       letter);
    set('pd-uname',     currentUser.username);
    set('pd-email',     currentUser.email);
  } else {
    out.classList.remove('hidden');
    inp.classList.add('hidden');
  }
}

function toggleProfileMenu() {
  document.getElementById('profile-dropdown').classList.toggle('hidden');
}

function closeProfileMenu() {
  const dd = document.getElementById('profile-dropdown');
  if (dd) dd.classList.add('hidden');
}

function handlePartner(e) { e.preventDefault(); showToast('Заявка отправлена!'); closeModal('partner-modal'); }
function togglePass(id)   { const el = document.getElementById(id); el.type = el.type === 'password' ? 'text' : 'password'; }

/* ─────────────────────────────────────────
   CLOUD: Firebase (Firestore) + Cloudinary (Storage)
   Firestore  — метаданные видео и стримы (бесплатно)
   Cloudinary — хранение файлов (25 GB free)
───────────────────────────────────────── */
let _fbDB        = null;
const cloudOn    = () => !!_fbDB;
const storageOn  = () => !!(window.CLOUDINARY_CONFIG?.cloudName && window.CLOUDINARY_CONFIG?.uploadPreset);

let _videosUnsub = null;

function initFirebase() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || typeof firebase === 'undefined') return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    _fbDB = firebase.firestore();
    listenVideosCloud();
    listenStreamsCloud();
  } catch(e) { console.warn('Firebase init failed:', e); }
}

function listenVideosCloud() {
  if (!cloudOn()) return;
  if (_videosUnsub) _videosUnsub();
  _videosUnsub = _fbDB.collection('videos')
    .orderBy('createdAt', 'desc').limit(120)
    .onSnapshot(snap => {
      const cloudIds = new Set(snap.docs.map(d => d.id));
      DB       = DB.filter(v => !cloudIds.has(String(v.id)));
      ShortsDB = ShortsDB.filter(v => !cloudIds.has(String(v.id)));
      snap.forEach(doc => {
        const d = { id: doc.id, ...doc.data() };
        if (d.createdAt?.toMillis) d.createdAt = d.createdAt.toMillis();
        if (d.type === 'short') ShortsDB.unshift(d);
        else DB.unshift(d);
      });
      renderGrid(); renderShorts(); refreshTags();
    }, e => console.warn('videos listener:', e));
}

// Cloudinary unsigned upload (видеофайл)
async function uploadFileCloud(file, onProgress) {
  if (!storageOn()) return null;
  const { cloudName, uploadPreset } = window.CLOUDINARY_CONFIG;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', uploadPreset);
  fd.append('folder', 'velvetx/videos');
  fd.append('resource_type', 'video');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        resolve(res.secure_url || null);
      } catch { reject(new Error('Cloudinary parse error')); }
    };
    xhr.onerror = () => reject(new Error('Cloudinary upload failed'));
    xhr.send(fd);
  });
}

// Cloudinary unsigned upload (превью)
async function uploadThumbCloud(dataUrl) {
  if (!storageOn()) return dataUrl;
  try {
    const { cloudName, uploadPreset } = window.CLOUDINARY_CONFIG;
    const blob = await (await fetch(dataUrl)).blob();
    const fd   = new FormData();
    fd.append('file', blob, 'thumb.jpg');
    fd.append('upload_preset', uploadPreset);
    fd.append('folder', 'velvetx/thumbs');
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: fd }
    );
    const json = await res.json();
    return json.secure_url || dataUrl;
  } catch { return dataUrl; }
}

async function saveVideoCloud(data) {
  if (!_fbDB) return null;
  const ref = await _fbDB.collection('videos').add({
    ...data,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/* ─────────────────────────────────────────
   STREAMS
───────────────────────────────────────── */

const CHAT_POOL = [
  {name:'Виктор',      msg:'🔥🔥🔥'},
  {name:'анон_777',    msg:'красота!'},
  {name:'Маша',        msg:'привет всем!'},
  {name:'bigfan',      msg:'лайк поставил'},
  {name:'Кирилл',      msg:'давно тебя не видел!'},
  {name:'ночной_волк', msg:'огонь! ❤️'},
  {name:'Алина',       msg:'красавица 😍'},
  {name:'zxcvbn',      msg:'хаха))'},
  {name:'Дмитрий',     msg:'сколько тут народу 😮'},
  {name:'crazy_fan',   msg:'Топ стримерша!'},
  {name:'Иван',        msg:'❤️❤️'},
  {name:'player_99',   msg:'откуда ты?'},
  {name:'Вася',        msg:'пошли куда-нибудь)'},
  {name:'super_user',  msg:'✨✨✨'},
  {name:'Катя',        msg:'смотрю каждый день'},
  {name:'MrFan',       msg:'+1 подписка'},
  {name:'тихий_чел',   msg:'просто наблюдаю 👀'},
  {name:'Олег',        msg:'ЛАЙК'},
];

let currentStreamId    = null;
let streamChatInterval = null;
let streamViewInterval = null;
let _chatUnsub         = null;   // Firestore chat listener
let streamFollowing    = {};
let activeStreamCat    = 'all';
let _cloudStreams       = [];
let _cloudStreamsUnsub  = null;
let _localStream       = null;   // Streamer's media (camera / screen)
let _activeStreamId    = null;   // Firestore doc ID of own active stream
let _isOwnStream       = false;
let _micMuted          = false;

// ── Cloud stream listing ──────────────────
function listenStreamsCloud() {
  if (!cloudOn()) return;
  if (_cloudStreamsUnsub) _cloudStreamsUnsub();
  _cloudStreamsUnsub = _fbDB.collection('streams')
    .where('active', '==', true)
    .onSnapshot(snap => {
      _cloudStreams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (currentView === 'streams') renderStreams();
    }, e => console.warn('streams listener:', e));
}

async function createStreamCloud(data) {
  if (!_fbDB) return null;
  const ref = await _fbDB.collection('streams').add({
    ...data, active: true, viewers: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function endStreamCloud(id) {
  if (!_fbDB || !id || id.startsWith('local-')) return;
  try { await _fbDB.collection('streams').doc(id).update({ active: false }); } catch(e) {}
}

function getAllStreams() {
  if (cloudOn()) return _cloudStreams;
  return JSON.parse(sessionStorage.getItem('vx-user-streams') || '[]')
    .filter(s => s.active !== false);
}

// ── Render grid ───────────────────────────
function renderStreams(cat) {
  if (cat !== undefined) activeStreamCat = cat;
  const all      = getAllStreams();
  const filtered = activeStreamCat === 'all' ? all : all.filter(s => s.cat === activeStreamCat);

  const count = document.getElementById('streams-online-count');
  if (count) count.textContent = filtered.length + ' ' + pluralStreams(filtered.length);

  document.querySelectorAll('.scf-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === activeStreamCat)
  );

  const grid = document.getElementById('streams-grid');
  if (!filtered.length) {
    grid.innerHTML = `<div class="streams-empty">
      <svg width="52" height="52" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24" style="color:var(--text3)"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg>
      <h3>Стримов пока нет</h3>
      <p>Будьте первым, кто выйдет в прямой эфир</p>
      <button class="btn btn--primary btn--sm" onclick="openStartStream()">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg>
        Начать стрим
      </button>
    </div>`;
    return;
  }
  grid.innerHTML = filtered.map(s => `
    <div class="stream-card" onclick="openStream('${s.id}')">
      <div class="sc-thumb" style="--sc-color:${s.color || '#e91e8c'}">
        <div class="sc-bg-anim"></div>
        <div class="sc-ava-overlay">${s.ava || '?'}</div>
        <div class="sc-live-badge"><span class="stream-live-dot"></span> LIVE</div>
        <div class="sc-viewers">
          <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${fmtCount(s.viewers || 0)}
        </div>
      </div>
      <div class="sc-info">
        <div class="sc-ava-sm" style="background:${s.color || '#e91e8c'}">${s.ava || '?'}</div>
        <div class="sc-text">
          <div class="sc-title">${s.title}</div>
          <div class="sc-name">${s.streamer}</div>
          <div class="sc-tags">${(s.tags || []).map(t => `<span class="sc-tag">${t}</span>`).join('')}</div>
        </div>
      </div>
    </div>`).join('');
}

function pluralStreams(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'стрим онлайн';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'стрима онлайн';
  return 'стримов онлайн';
}

function initStreamsCatFilter() {
  const cats = [
    {k:'all',v:'Все'},{k:'erotic',v:'Эротика'},{k:'homemade',v:'Домашнее'},
    {k:'milf',v:'MILF'},{k:'lesbian',v:'Лесби'},{k:'couples',v:'Пары'},
    {k:'rough',v:'Жёсткий'},{k:'teen',v:'Молодые'},
  ];
  const el = document.getElementById('streams-cat-filter');
  if (!el) return;
  el.innerHTML = cats.map(c =>
    `<button class="scf-btn${c.k === 'all' ? ' active' : ''}" data-cat="${c.k}">${c.v}</button>`
  ).join('');
  el.querySelectorAll('.scf-btn').forEach(b => b.onclick = () => renderStreams(b.dataset.cat));
}

// ── Open stream (viewer) ──────────────────
function openStream(id) {
  const s = getAllStreams().find(x => x.id === id);
  if (!s) return;
  _isOwnStream    = s.streamer === currentUser?.username;
  currentStreamId = id;
  _activeStreamId = id;
  _fillStreamOverlay(s);

  document.getElementById('sw-stream-ctrl').classList.toggle('hidden', !_isOwnStream);
  document.getElementById('stream-watch-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  document.getElementById('sw-chat-msgs').innerHTML = '';
  stopStreamIntervals();
  addChatMessage('', '🎉 Добро пожаловать в трансляцию!', 'system');
  listenChat(id);
}

function _fillStreamOverlay(s) {
  document.getElementById('sw-topbar-title').textContent  = s.streamer;
  document.getElementById('sw-stream-title').textContent  = s.title;
  document.getElementById('sw-streamer-name').textContent = s.streamer;
  document.getElementById('sw-cat-badge').textContent     = CAT_LABELS[s.cat] || s.cat;
  document.getElementById('sw-viewers').textContent       = fmtCount(s.viewers || 0);
  document.getElementById('sw-chat-count').textContent    = fmtCount(Math.round((s.viewers || 0) * 0.12)) + ' в чате';
  const ava = document.getElementById('sw-ava');
  ava.textContent = s.ava || '?';
  ava.style.background = s.color || '#e91e8c';
  document.getElementById('sw-stream-tags').innerHTML =
    (s.tags || []).map(t => `<span class="watch-tag">${t}</span>`).join('');
  const c = s.color || '#e91e8c';
  document.getElementById('sw-bg-anim').style.background =
    `radial-gradient(ellipse at 30% 40%,${c}55 0%,transparent 60%),radial-gradient(ellipse at 72% 65%,${c}33 0%,transparent 55%),var(--bg)`;
  updateFollowBtn(streamFollowing[s.id]);
}

function closeStreamWatch() {
  const vid = document.getElementById('sw-video');
  if (vid) { vid.srcObject = null; vid.style.display = 'none'; }
  document.getElementById('sw-bg-anim').style.display = '';
  document.getElementById('stream-watch-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  stopStreamIntervals();
  if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
  currentStreamId = null;
  _isOwnStream    = false;
}

function stopStreamIntervals() {
  clearInterval(streamChatInterval); clearInterval(streamViewInterval);
  streamChatInterval = null; streamViewInterval = null;
}

// ── Camera / Screen capture ───────────────
async function switchStreamSource(source) {
  if (_localStream) { _localStream.getTracks().forEach(t => t.stop()); _localStream = null; }
  try {
    _localStream = source === 'camera'
      ? await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      : await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    if (source === 'screen')
      _localStream.getVideoTracks()[0].addEventListener('ended', stopMyStream);
    _showStreamVideo(_localStream);
    document.querySelectorAll('.swc-btn[data-src]').forEach(b =>
      b.classList.toggle('swc-btn--active', b.dataset.src === source)
    );
  } catch(err) { showToast('Нет доступа: ' + (err.message || err)); }
}

function _showStreamVideo(stream) {
  const v = document.getElementById('sw-video');
  if (!v) return;
  v.srcObject = stream;
  v.style.display = 'block';
  document.getElementById('sw-bg-anim').style.display = 'none';
  v.play().catch(() => {});
}

function toggleStreamMic() {
  if (!_localStream) return;
  const track = _localStream.getAudioTracks()[0];
  if (!track) return;
  _micMuted = !_micMuted;
  track.enabled = !_micMuted;
  document.getElementById('swc-mic')?.classList.toggle('swc-btn--muted', _micMuted);
  showToast(_micMuted ? '🔇 Микрофон выключён' : '🎤 Микрофон включён');
}

async function stopMyStream() {
  if (_localStream) { _localStream.getTracks().forEach(t => t.stop()); _localStream = null; }
  await endStreamCloud(_activeStreamId);
  const ls = JSON.parse(sessionStorage.getItem('vx-user-streams') || '[]');
  sessionStorage.setItem('vx-user-streams',
    JSON.stringify(ls.map(s => s.id === _activeStreamId ? { ...s, active: false } : s))
  );
  _activeStreamId = null;
  closeStreamWatch();
  navigate('streams');
  showToast('Трансляция завершена');
}

// ── Source selector (in modal) ────────────
function selectStreamSrc(btn) {
  document.querySelectorAll('.ss-src').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById('ss-obs-panel');
  if (!panel) return;
  panel.classList.toggle('hidden', btn.dataset.src !== 'obs');
  if (btn.dataset.src === 'obs') {
    const el = document.getElementById('ss-stream-key');
    if (el) el.textContent = _genKey();
  }
}

function _genKey() {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({length: 24}, () => c[Math.floor(Math.random() * c.length)]).join('');
}

function copyText(txt) {
  navigator.clipboard?.writeText(txt).catch(() => {});
  showToast('Скопировано!');
}

// ── Start stream ─────────────────────────
function openStartStream() {
  if (!currentUser) { openModal('login-modal'); showToast('Войдите, чтобы начать стрим'); return; }
  document.querySelectorAll('.ss-src').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.getElementById('ss-obs-panel')?.classList.add('hidden');
  openModal('start-stream-modal');
}

async function goLive(e) {
  e.preventDefault();
  if (!currentUser) { openModal('login-modal'); return; }

  const title  = document.getElementById('ss-title').value.trim();
  const cat    = document.getElementById('ss-cat').value;
  const tags   = document.getElementById('ss-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const source = document.querySelector('.ss-src.active')?.dataset.src || 'camera';

  closeModal('start-stream-modal');

  let media = null;
  if (source === 'camera' || source === 'screen') {
    try {
      media = source === 'camera'
        ? await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    } catch(err) { showToast('Нет доступа: ' + (err.message || err)); return; }
  }

  _localStream = media;
  _isOwnStream = true;
  _micMuted    = false;

  const streamData = {
    streamer: currentUser.username,
    title:    title || 'Прямой эфир',
    cat, tags: tags.length ? tags : ['Прямой эфир'],
    ava: currentUser.username[0].toUpperCase(),
    color: '#e91e8c', source, viewers: 0, active: true,
  };

  let streamId;
  if (cloudOn()) {
    streamId = await createStreamCloud(streamData);
  } else {
    streamId = 'local-' + Date.now();
    const ls = JSON.parse(sessionStorage.getItem('vx-user-streams') || '[]');
    ls.unshift({ id: streamId, ...streamData });
    sessionStorage.setItem('vx-user-streams', JSON.stringify(ls));
  }

  _activeStreamId = streamId;
  currentStreamId = streamId;
  _fillStreamOverlay({ id: streamId, ...streamData });

  document.getElementById('sw-stream-ctrl').classList.remove('hidden');
  document.getElementById('sw-chat-msgs').innerHTML = '';
  stopStreamIntervals();
  addChatMessage('', '🔴 Вы вышли в эфир!', 'system');
  document.getElementById('stream-watch-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  if (media) {
    _showStreamVideo(media);
    if (source === 'screen') media.getVideoTracks()[0].addEventListener('ended', stopMyStream);
  } else {
    const key = document.getElementById('ss-stream-key')?.textContent || _genKey();
    addChatMessage('', `📡 OBS Stream Key: ${key}`, 'system');
    addChatMessage('', 'RTMP URL: rtmp://stream.velvetx.app/live', 'system');
  }

  document.getElementById('ss-title').value = '';
  showToast('🔴 Вы в эфире!');
}

// ── Chat ──────────────────────────────────
function listenChat(streamId) {
  if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }

  if (!cloudOn() || !streamId || streamId.startsWith('local-')) return;

  _chatUnsub = _fbDB
    .collection('streams').doc(streamId)
    .collection('messages')
    .orderBy('ts', 'asc')
    .limitToLast(120)
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const d    = change.doc.data();
        const ownName = currentUser?.username || 'Гость';
        const type = d.name === ownName ? 'user' : 'other';
        addChatMessage(d.name, d.msg, type);
      });
    }, e => console.warn('chat listener:', e));
}

function addChatMessage(name, msg, type) {
  const el = document.getElementById('sw-chat-msgs');
  if (!el) return;
  const div = document.createElement('div');
  div.className = 'chat-msg'
    + (type === 'system' ? ' chat-msg--system' : '')
    + (type === 'user'   ? ' chat-msg--own'    : '');
  // Sanitize to avoid XSS
  const safeName = name.replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const safeMsg  = msg.replace(/</g,'&lt;').replace(/>/g,'&gt;');
  div.innerHTML = type === 'system'
    ? `<span class="chat-msg-text">${safeMsg}</span>`
    : `<span class="chat-msg-name">${safeName}</span><span class="chat-msg-text">${safeMsg}</span>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  while (el.children.length > 120) el.removeChild(el.firstChild);
}

async function sendChatMsg(e) {
  e.preventDefault();
  const input = document.getElementById('sw-chat-input');
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = '';

  const name = currentUser?.username || 'Гость';

  // Сохранить в Firestore (покажется всем через onSnapshot)
  if (cloudOn() && currentStreamId && !currentStreamId.startsWith('local-')) {
    try {
      await _fbDB
        .collection('streams').doc(currentStreamId)
        .collection('messages').add({
          name,
          msg,
          ts: firebase.firestore.FieldValue.serverTimestamp(),
        });
      return; // onSnapshot сам добавит сообщение в UI
    } catch(err) { console.warn('chat send:', err); }
  }

  // Fallback — только локально
  addChatMessage(name, msg, 'user');
}

// ── Follow ────────────────────────────────
function updateFollowBtn(isFollowing) {
  const btn = document.getElementById('sw-follow-btn');
  if (!btn) return;
  btn.innerHTML = isFollowing
    ? '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Подписан'
    : '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Подписаться';
  btn.classList.toggle('btn--outline', !!isFollowing);
  btn.classList.toggle('btn--primary', !isFollowing);
}

function followStreamer() {
  if (!currentUser) { openModal('login-modal'); return; }
  streamFollowing[currentStreamId] = !streamFollowing[currentStreamId];
  updateFollowBtn(streamFollowing[currentStreamId]);
  showToast(streamFollowing[currentStreamId] ? '✅ Подписка оформлена!' : 'Подписка отменена');
}

function shareStream() { showToast('Ссылка скопирована!'); }

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function fmtTime(s) { if (isNaN(s)) return '0:00'; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
function fmtCount(n) { if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return n; }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
