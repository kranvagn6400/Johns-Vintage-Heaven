'use strict';
/* ================= عناصر الواجهة المشتركة ================= */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20.5" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  package: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  back: '<path d="m9 6 6 6-6 6"/>',
  next: '<path d="m15 6-6 6 6 6"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
  map: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 1.5 4.7 4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8" r="1.5"/>',
  gramophone: '<path d="M4 20h10v-4H4z"/><path d="M9 16v-3l3-3"/><path d="M12 10 20 3c1.5 3.5 1 8-2 10.5S12 14 12 10Z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
};
const icon = (name, cls = '') => (typeof Pixel !== 'undefined' && Pixel.on() && Pixel.icons[name]) ? Pixel.icon(name, cls) : `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// ألوان دافئة لملصقات الأسطوانات عندما لا توجد صورة
const LABEL_COLORS = ['#8c2f39', '#b5832f', '#2f5d50', '#5a3e7a', '#a3542b', '#26496b', '#7a6a2f', '#6b2f4f'];

const UI = {
  hydrate(root = document) { $$('[data-i]', root).forEach(el => { el.outerHTML = icon(el.dataset.i, el.className); }); },

  // رسم بديل للمنتج بدون صورة: أسطوانة أو غرامافون
  art(p, bare) {
    if (typeof Pixel !== 'undefined' && Pixel.on()) return Pixel.art(p);
    const c = p.label || LABEL_COLORS[hashNum(p.id || p.title) % LABEL_COLORS.length];   // label: لون ملصق محدد (مثل أسطوانة الواجهة)
    // قرص CD فضي بلمعة قوس قزح
    if (p.kind === 'cd') return `<svg class="art" viewBox="0 0 200 200" aria-hidden="true">
      ${bare ? '' : '<rect width="200" height="200" fill="var(--art-bg)"/>'}
      <defs><linearGradient id="cdShine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eceef3"/><stop offset=".3" stop-color="#c7d6f2"/>
        <stop offset=".45" stop-color="#f4d6e6"/><stop offset=".6" stop-color="#d6f1da"/><stop offset=".78" stop-color="#f3ecc8"/><stop offset="1" stop-color="#b9bec8"/></linearGradient></defs>
      <circle cx="100" cy="100" r="84" fill="url(#cdShine)" stroke="#9097a3" stroke-width="1.5"/>
      <path d="M44 62 A70 70 0 0 1 96 30" stroke="rgba(255,255,255,.75)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <circle cx="100" cy="100" r="30" fill="${c}" opacity=".9"/>
      <circle cx="100" cy="100" r="15" fill="#e8ecf1" stroke="#9097a3" stroke-width="1"/>
      <circle cx="100" cy="100" r="7" fill="${bare ? '#17110c' : 'var(--art-bg)'}"/></svg>`;
    if (p.kind === 'gramophone') return `<svg class="art" viewBox="0 0 200 200" aria-hidden="true">
      <rect width="200" height="200" fill="var(--art-bg)"/>
      <rect x="44" y="132" width="86" height="40" rx="4" fill="${c}"/><rect x="44" y="132" width="86" height="8" fill="rgba(0,0,0,.18)"/>
      <ellipse cx="87" cy="130" rx="38" ry="6" fill="#2a1d14"/>
      <path d="M100 126 L100 112 L116 98" stroke="#c9a253" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M112 102 L150 40 C178 52 186 88 168 112 C156 124 128 120 112 102Z" fill="#c9a253"/>
      <path d="M150 40 C178 52 186 88 168 112" stroke="#8a6a2a" stroke-width="3" fill="none"/>
      <path d="M118 100 L152 48" stroke="rgba(255,255,255,.35)" stroke-width="3"/></svg>`;
    return `<svg class="art" viewBox="0 0 200 200" aria-hidden="true">
      ${bare ? '' : '<rect width="200" height="200" fill="var(--art-bg)"/>'}
      <circle cx="100" cy="100" r="84" fill="#17110c"/>
      ${[74, 66, 58, 50, 42].map(r => `<circle cx="100" cy="100" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1.2"/>`).join('')}
      <path d="M46.3 46.3 A76 76 0 0 1 100 24" stroke="rgba(255,255,255,.16)" stroke-width="8" fill="none" stroke-linecap="round"/>
      ${p.logo
        // أسطوانة الواجهة: شعار المتجر هو الملصق (يتبدّل مع ثيم المتجر عبر data-logo)
        ? `<image href="${esc(p.logo)}" data-logo x="58" y="58" width="84" height="84" preserveAspectRatio="xMidYMid meet"/>`
        : `<circle cx="100" cy="100" r="30" fill="${c}"/><circle cx="100" cy="100" r="30" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1"/>`}
      <circle cx="100" cy="100" r="${p.logo ? 2.5 : 3.5}" fill="#f3e8d2"/></svg>`;
  },
  // أسطوانة الواجهة: 10 أشكال يختار منها صاحب المتجر أو المشرف (settings.record_style)، والشعار ملصقها.
  // الألوان من ثيم المتجر (--wine و--gold-2 و--paper)، فتتغيّر مع الثيم. الذهبية والكلاسيكية ثابتتان.
  DISCS: {
    classic: 'كلاسيكية سوداء', color: 'ملوّنة شفافة', splatter: 'مرشوشة', gold: 'ذهبية', split: 'نصفين بلونين',
    sunburst: 'أشعة الشمس', swirl: 'رخامية', clear: 'شفافة', shellac: 'حافة نحاسية', bands: 'حلقات ملوّنة'
  },
  disc(style, logo) {
    const C = 'cx="100" cy="100"';
    const rings = (op, col = '#fff', list = [76, 68, 60, 52, 46]) => list.map(r => `<circle ${C} r="${r}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="1.2"/>`).join('');
    const shine = op => `<path d="M46.3 46.3 A76 76 0 0 1 100 24" stroke="#fff" stroke-opacity="${op}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
    const wedges = n => Array.from({ length: n }, (_, i) => {
      const a1 = i * 2 * Math.PI / n, a2 = (i + 1) * 2 * Math.PI / n, pt = a => `${(100 + 84 * Math.cos(a)).toFixed(1)} ${(100 + 84 * Math.sin(a)).toFixed(1)}`;
      return `<path d="M100 100 L${pt(a1)} A84 84 0 0 1 ${pt(a2)}Z" fill="${i % 2 ? 'var(--wine)' : 'var(--gold-2)'}"/>`; }).join('');
    const body = {
      classic: `<circle ${C} r="84" fill="#17110c"/>${rings(.07)}${shine(.16)}`,
      color: `<circle ${C} r="84" fill="var(--wine)" fill-opacity=".88"/>${rings(.12)}${shine(.35)}`,
      splatter: `<circle ${C} r="84" fill="#17110c"/>${[[56, 70, 9, 'gold-2'], [150, 58, 7, 'wine'], [158, 128, 10, 'gold-2'], [84, 160, 8, 'wine'], [38, 122, 6, 'paper'], [118, 30, 5, 'paper'], [128, 162, 4, 'paper'], [44, 52, 4, 'wine'], [170, 96, 4, 'paper'], [70, 130, 3, 'gold-2'], [140, 92, 3, 'wine']]
        .map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--${c})"/>`).join('')}${rings(.07, '#fff', [70, 56])}`,
      gold: `<circle ${C} r="84" fill="#c9a253"/><circle ${C} r="82" fill="none" stroke="#8a6a2a" stroke-width="2.5"/>${rings(.45, '#8a6a2a', [74, 64, 54, 47])}${shine(.7).replace('#fff', '#fff4d6')}`,
      split: `<circle ${C} r="84" fill="var(--gold-2)"/><path d="M100 16 A84 84 0 0 0 100 184Z" fill="var(--wine)"/>${rings(.15, '#fff', [72, 58])}`,
      sunburst: `${wedges(12)}${rings(.18, '#000', [78, 70, 62, 54, 47])}`,
      swirl: `<circle ${C} r="84" fill="var(--wine)"/><path d="M100 18 C150 22 176 70 150 100 C126 128 80 110 76 84 C72 60 104 52 116 70" stroke="var(--gold-2)" stroke-width="14" fill="none" stroke-linecap="round" stroke-opacity=".85"/>
        <path d="M30 120 C40 160 90 186 130 170" stroke="var(--paper)" stroke-width="9" fill="none" stroke-linecap="round" stroke-opacity=".7"/>${rings(.12)}`,
      clear: `<circle ${C} r="84" fill="#efe9dd" fill-opacity=".55" stroke="#fff" stroke-opacity=".5"/>${rings(.18, '#000')}${shine(.6)}`,
      shellac: `<circle ${C} r="84" fill="#17110c"/><circle ${C} r="81" fill="none" stroke="var(--gold)" stroke-width="6"/><circle ${C} r="76" fill="none" stroke="var(--gold-2)" stroke-opacity=".5"/>${rings(.06, '#fff', [70, 64, 58, 52, 47])}${shine(.14)}`,
      bands: `<circle ${C} r="84" fill="var(--wine)"/><circle ${C} r="72" fill="var(--gold-2)"/><circle ${C} r="62" fill="#17110c"/><circle ${C} r="54" fill="var(--paper)"/><circle ${C} r="48" fill="var(--wine)"/>${rings(.12, '#000', [80, 68, 58])}`
    }[style] || '';
    return `<svg class="art" viewBox="0 0 200 200" aria-hidden="true">${body || this.disc('classic', logo).replace(/^<svg[^>]*>|<\/svg>$/g, '')}
      ${body ? `<image href="${esc(logo)}" data-logo x="58" y="58" width="84" height="84" preserveAspectRatio="xMidYMid meet"/><circle ${C} r="2.5" fill="#f3e8d2"/>` : ''}</svg>`;
  },
  photo(p, i = 0) {
    const path = p.photos && p.photos[i];
    return path ? `<img src="${esc(API.photoUrl(path))}" alt="${esc(p.title)}" loading="lazy">` : this.art(p);
  },
  meta(p) {
    if (isMusic(p.kind)) return [p.artist, p.genre, p.year].filter(Boolean).map(x => '<bdi>' + esc(x) + '</bdi>').join(' · ');
    return [p.brand, p.model].filter(Boolean).map(x => '<bdi>' + esc(x) + '</bdi>').join(' · ');
  },
  card(p) {
    const sold = p.status === 'sold' || p.stock < 1;
    return `<a class="pcard ${sold ? 'is-sold' : ''}" href="#/p/${esc(p.id)}">
      <div class="pcard-img">${this.photo(p)}${sold ? '<span class="sold-tag">نفذت الكمية</span>' : ''}</div>
      <div class="pcard-body">
        <span class="kind">${KIND_NAMES[p.kind]}</span>
        <h3>${esc(p.title)}</h3>
        <p class="meta">${this.meta(p)}</p>
        <div class="price">${fmtIQD(p.price)}</div>
      </div></a>`;
  },
  orderPill(s) { return `<span class="pill st-${s}">${ORDER_STATUS[s] || s}</span>`; },
  // مسار حالة الطلب (للزبون)
  timeline(o, events = []) {
    if (o.status === 'cancelled') return `<div class="timeline cancelled">${icon('x')} أُلغي هذا الطلب</div>`;
    const at = ORDER_FLOW.indexOf(o.status);
    return `<ol class="timeline">${ORDER_FLOW.map((s, i) => {
      return `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><span class="dot">${i <= at ? icon('check') : ''}</span>
        <b>${ORDER_STATUS[s]}</b></li>`;
    }).join('')}</ol>`;
  },
  empty(ic, title, sub = '', action = '') {
    return `<div class="empty">${icon(ic)}<h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}${action}</div>`;
  },
  loading() { return '<div class="loading"><span class="spin-disc"></span></div>'; },
  error(e) { return this.empty('info', 'تعذّر التحميل', e && e.message ? e.message : String(e), '<button class="btn btn-ghost" onclick="App.route()">إعادة المحاولة</button>'); },
  options(list, sel, labels) {
    return list.map(v => `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(labels ? labels[v] ?? v : v)}</option>`).join('');
  },
  govSelect(id, sel, fees) {
    const act = fees ? GOVERNORATES.filter(g => (fees.find(f => f.governorate === g) || {}).active !== false) : GOVERNORATES;
    return `<select class="input" id="${id}" required><option value="">اختر المحافظة</option>${this.options(act, sel)}</select>`;
  }
};
