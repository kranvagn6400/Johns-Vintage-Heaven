'use strict';
/* ================= هيكل التطبيق: التوجيه، الحساب، الدخول ================= */
// config.js فارغ ← الوضع التجريبي المحلي. مملوء ← Supabase الحقيقي.
const API = (CFG.SUPABASE_URL && CFG.SUPABASE_KEY) ? SupaAPI : DemoAPI;

const App = {
  settings: {},
  fees: null,
  path: '/',
  params: new URLSearchParams(),

  async start() {
    UI.hydrate();
    if (API.mode === 'demo') {
      DemoAPI.load();
    }
    try { await API.restore(); if (API.me && API.me.role === 'disabled') await API.signOut(); } catch (e) { console.warn(e); }
    this.loadSettings();
    document.addEventListener('cart', () => this.badges());
    window.addEventListener('hashchange', () => this.route());
    this.route();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  },
  async loadSettings() {
    try {
      this.settings = await API.settings();
      const a = $('#announce'); a.textContent = this.settings.announcement || ''; a.classList.toggle('hidden', !this.settings.announcement);
    } catch (e) { console.warn(e); }
  },
  async getFees(force) { if (!this.fees || force) this.fees = await API.fees(); return this.fees; },

  /* ---------- التوجيه ---------- */
  go(h) { if (location.hash === h) this.route(); else location.hash = h; },
  route() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    this.path = path; this.params = new URLSearchParams(qs || '');
    closeSheet();
    const seg = path.split('/').filter(Boolean);
    const view = $('#app');
    window.scrollTo(0, 0);
    this.nav();
    const r = {
      '': () => Shop.home(view), shop: () => Shop.list(view), p: () => Shop.product(view, seg[1]),
      cart: () => Shop.cart(view), checkout: () => Shop.checkout(view), done: () => Shop.done(view, seg[1]),
      track: () => Shop.track(view), orders: () => this.go('#/track'),   // لا حسابات للزبائن: التتبع برمز الطلب
      login: () => this.auth(view, 'login'), signup: () => this.auth(view, 'signup'), account: () => this.account(view),
      seller: () => this.need(['owner', 'admin']) && Seller.route(view, seg.slice(1)),
      owner: () => this.need(['owner', 'admin']) && Owner.route(view),   // صاحب المتجر: تبويب الطلبات فقط
      admin: () => this.need(['admin']) && Admin.route(view)
    }[seg[0] || ''];
    try { (r || (() => { view.innerHTML = UI.empty('disc', 'الصفحة غير موجودة', '', '<a class="btn btn-primary" href="#/">العودة للرئيسية</a>'); }))(); }
    catch (e) { console.error(e); view.innerHTML = UI.error(e); }
  },
  need(roles) {
    const me = API.me;
    if (!me) { store.set('after_login', location.hash); this.go('#/login'); return false; }
    if (!roles.includes(me.role)) { $('#app').innerHTML = UI.empty('shield', 'هذه الصفحة ليست لحسابك', 'سجّل الدخول بحساب له الصلاحية المناسبة.', '<a class="btn btn-ghost" href="#/account">حسابي</a>'); return false; }
    return true;
  },
  dashLink() {
    const r = API.me && API.me.role;
    return r === 'owner' ? ['#/owner', 'الطلبات', 'receipt'] : r === 'admin' ? ['#/admin', 'لوحة المشرف', 'shield'] : null;
  },
  nav() {
    const p = '/' + (this.path.split('/')[1] || ''), kind = this.params.get('kind');
    const on = (cond) => cond ? 'on' : '';
    const dash = this.dashLink();
    // زر «حسابي» للإدارة فقط (صاحب المتجر والمشرف)؛ الزبون يتسوّق بدون حساب
    const staff = !!(API.me && ['owner', 'admin'].includes(API.me.role));
    $('#tbAccount').classList.toggle('hidden', !staff);
    $('#tbNav').innerHTML = [
      ['#/', 'الرئيسية', p === '/'], ['#/shop?kind=record', 'الأسطوانات', p === '/shop' && kind === 'record'],
      ['#/shop?kind=cd', 'أقراص CD', p === '/shop' && kind === 'cd'],
      ['#/shop?kind=gramophone', 'الغرامافونات', p === '/shop' && kind === 'gramophone'], ['#/track', 'تتبّع طلب', p === '/track'],
      ...(dash ? [[dash[0], dash[1], p === dash[0].slice(1)]] : []),
      ...(API.me && API.me.role === 'admin' ? [['#/owner', 'إدارة المتجر', p === '/owner']] : []),
      ...(API.me && API.me.role === 'owner' ? [['#/seller', 'المنتجات', p === '/seller']] : [])
    ].map(([h, t, o]) => `<a href="${h}" class="${on(o)}">${t}</a>`).join('');
    $('#bottomnav').innerHTML = [
      ['#/', 'الرئيسية', 'home', p === '/'], ['#/shop', 'المتجر', 'disc', p === '/shop' || p === '/p'],
      ['#/cart', 'السلة', 'cart', p === '/cart' || p === '/checkout'],
      ...(dash ? [[dash[0], 'لوحتي', dash[2], p === dash[0].slice(1)]] : []),
      staff ? ['#/account', 'حسابي', 'user', ['/account', '/login', '/signup'].includes(p)] : ['#/track', 'تتبّع طلب', 'truck', p === '/track']
    ].map(([h, t, ic, o]) => `<a href="${h}" class="${on(o)}">${icon(ic)}<span>${t}</span>${ic === 'cart' ? '<span class="badge hidden" data-cart></span>' : ''}</a>`).join('');
    this.badges();
  },
  badges() {
    const n = Cart.count();
    [$('#cartBadge'), $('#bottomnav [data-cart]')].forEach(b => { if (b) { b.textContent = n; b.classList.toggle('hidden', !n); } });
  },

  /* ---------- الدخول وإنشاء الحساب ---------- */
  auth(view, mode) {
    if (API.me) return this.go('#/account');
    const signup = mode === 'signup', asSeller = this.params.get('seller') === '1';
    view.innerHTML = `<div class="auth"><div class="card">
      <div class="auth-head"><img src="icon.svg" alt="" width="64" height="64" style="margin:0 auto 6px"><h1>${signup ? 'حساب جديد' : 'دخول الإدارة'}</h1>
        <p class="muted small">${signup ? 'تسوّق وتتبّع طلباتك' : 'لصاحب المتجر والمشرف فقط'}</p></div>
      <form id="authForm" class="stack" novalidate>
        ${signup ? `<div><label class="lbl" for="fName">الاسم الكامل <span class="req">*</span></label><input class="input" id="fName" autocomplete="name" required></div>` : ''}
        <div><label class="lbl" for="fPhone">رقم الهاتف</label><input class="input num" id="fPhone" type="tel" inputmode="numeric" dir="ltr" autocomplete="tel" placeholder="07XXXXXXXXX" maxlength="14" required></div>
        <div><label class="lbl" for="fPass">كلمة المرور</label><input class="input" id="fPass" type="password" dir="ltr" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required>
          ${signup ? '<p class="hint">6 أحرف أو أرقام على الأقل.</p>' : ''}</div>
        <button class="btn btn-primary btn-block" type="submit">${signup ? 'إنشاء الحساب' : 'دخول'}</button>
        <p class="small muted" style="text-align:center">${signup ? 'لديك حساب؟ <a href="#/login" style="color:var(--wine);font-weight:700">سجّل الدخول</a>' : 'الزبائن لا يحتاجون حساباً: تسوّق واطلب مباشرة، وتابع طلبك من <a href="#/track" style="color:var(--wine);font-weight:700">تتبّع طلب</a>.'}</p>
      </form>
      ${!signup && API.mode === 'demo' ? `<div class="divider"></div><p class="small muted">الوضع التجريبي — ادخل مباشرة بأحد الأدوار:</p>
        <div class="demo-logins">
          <button class="btn btn-ghost" data-demo="u-owner">صاحب المتجر</button><button class="btn btn-ghost" data-demo="u-admin">المشرف التقني</button></div>
        <p class="hint">أو بالهاتف: المشرف 07700000001 · صاحب المتجر 07700000002، وكلمة المرور ${DEMO_PASSWORD}</p>` : ''}
    </div></div>`;
    $('#fPhone').oninput = e => { e.target.value = normPhone(e.target.value).slice(0, 11); };
    $$('[data-demo]', view).forEach(b => b.onclick = async () => {
      await DemoAPI.loginAs(b.dataset.demo === 'u-customer' ? 'u-c1' : b.dataset.demo);
      this.afterLogin();
    });
    $('#authForm').onsubmit = async e => {
      e.preventDefault();
      const phone = $('#fPhone').value, password = $('#fPass').value;
      if (!validPhone(phone)) return toast('اكتب رقم هاتف عراقي صحيح من 11 رقماً يبدأ بـ 07');
      if (password.length < 6) return toast('كلمة المرور 6 أحرف على الأقل');
      let data;
      if (signup) {
        data = { phone, password, full_name: $('#fName').value.trim() };
        if (!data.full_name) return toast('اكتب اسمك');
      }
      busy(true, signup ? 'جارٍ إنشاء الحساب…' : 'جارٍ الدخول…');
      try { signup ? await API.signUp(data) : await API.signIn(phone, password); this.afterLogin(); }
      catch (err) { toast(err.message); }
      finally { busy(false); }
    };
  },
  afterLogin() {
    const me = API.me; if (!me) return;
    if (me.role === 'disabled') { API.signOut(); return toast('هذا الحساب موقوف'); }
    toast('أهلاً ' + (me.full_name || ''));
    const back = store.get('after_login', null); store.del('after_login');
    this.go(back || (me.role === 'owner' ? '#/owner' : me.role === 'admin' ? '#/admin' : '#/account'));
  },

  /* ---------- حسابي ---------- */
  account(view) {
    const me = API.me;
    if (!me) return this.go('#/login');   // «حسابي» للإدارة فقط
    const dash = this.dashLink();
    const seller = me.role === 'seller' ? me.seller : null;   // اسم المتجر ونبذته لا يخصّان صاحب المتجر والمشرف
    view.innerHTML = `<div class="page-head"><h1>حسابي</h1></div>
      <div class="dash-grid"><div>
      <div class="card"><div style="display:flex;gap:12px;align-items:center">
        <div class="thumb" style="display:flex;align-items:center;justify-content:center;color:var(--wine)">${icon('user')}</div>
        <div class="grow"><h3 style="margin:0">${esc(me.full_name || '—')}</h3><div class="muted small num">${esc(me.phone)}</div>
          <span class="pill">${ROLE_NAMES[me.role] || me.role}</span>
          ${seller && me.role === 'seller' ? ` <span class="pill st-${seller.status}">${SELLER_STATUS[seller.status]}</span>` : ''}</div></div></div>
      <div class="card"><div class="list">
        ${dash ? `<a class="row row-click" href="${dash[0]}">${icon(dash[2])}<span class="grow"><b>${dash[1]}</b></span>${icon('next')}</a>` : ''}
        ${me.role === 'admin' ? `<a class="row row-click" href="#/owner">${icon('chart')}<span class="grow"><b>إدارة المتجر</b><div class="sub">الطلبات، رسوم التوصيل، المبيعات</div></span>${icon('next')}</a>` : ''}
        <a class="row row-click" href="#/track">${icon('truck')}<span class="grow"><b>تتبّع طلب برمزه</b></span>${icon('next')}</a>
        ${['owner', 'admin'].includes(me.role) ? `<a class="row row-click" href="#/seller">${icon('disc')}<span class="grow"><b>المنتجات</b><div class="sub">أضف وعدّل منتجات المتجر وصورها</div></span>${icon('next')}</a>` : ''}
      </div></div></div><div>
      <div class="card"><h3>بياناتي</h3><form id="meForm" class="stack">
        <div><label class="lbl" for="mName">الاسم</label><input class="input" id="mName" value="${esc(me.full_name)}"></div>
        ${seller ? `<div><label class="lbl" for="mShop">اسم المتجر</label><input class="input" id="mShop" value="${esc(seller.shop_name)}"></div>
          <div><label class="lbl" for="mBio">نبذة عن متجرك</label><textarea class="input" id="mBio" placeholder="تظهر للزبائن في صفحات منتجاتك">${esc(seller.bio)}</textarea></div>` : ''}
        <button class="btn btn-ghost" type="submit">حفظ</button></form></div>
      <div class="card"><h3>كلمة المرور</h3><form id="pwForm" class="stack">
        <input class="input" id="pw1" type="password" dir="ltr" autocomplete="new-password" placeholder="كلمة مرور جديدة (6 على الأقل)">
        <button class="btn btn-ghost" type="submit">تغيير كلمة المرور</button></form></div>
      ${this.themeCard()}
      <div class="card"><div class="stack">
        <button class="btn btn-danger" id="logout">${icon('logout')} تسجيل الخروج</button>
        ${API.mode === 'demo' ? '<button class="btn btn-ghost btn-sm" id="resetDemo">إعادة ضبط البيانات التجريبية</button>' : ''}
      </div></div></div></div>`;
    this.bindTheme(view);
    $('#meForm').onsubmit = async e => {
      e.preventDefault(); busy(true);
      try { await API.updateMe({ full_name: $('#mName').value.trim(), ...(seller ? { shop_name: $('#mShop').value.trim(), bio: $('#mBio').value.trim() } : {}) }); toast('تم الحفظ'); }
      catch (err) { toast(err.message); } finally { busy(false); }
    };
    $('#pwForm').onsubmit = async e => {
      e.preventDefault(); const pw = $('#pw1').value;
      if (pw.length < 6) return toast('كلمة المرور 6 أحرف على الأقل');
      busy(true); try { await API.changePassword(pw); $('#pw1').value = ''; toast('تم تغيير كلمة المرور'); } catch (err) { toast(err.message); } finally { busy(false); }
    };
    $('#logout').onclick = async () => { await API.signOut(); toast('تم تسجيل الخروج'); this.go('#/'); };
    const rd = $('#resetDemo'); if (rd) rd.onclick = async () => { if (await confirmBox('حذف كل التغييرات التجريبية والعودة للبيانات الأولى؟', 'إعادة الضبط', true)) { DemoAPI.reset(); Cart.clear(); this.go('#/'); } };
    const bs = $('[data-become-seller]', view);
    if (bs) bs.onclick = e => { e.preventDefault(); openSheet(`<h2>البيع في المتجر</h2><p>لعرض منتجاتك تحتاج حساب بائع. تواصل مع صاحب المتجر${this.settings.contact_phone ? ` على الرقم <b class="num">${esc(this.settings.contact_phone)}</b>` : ''} ليحوّل حسابك إلى بائع، أو أنشئ حساب بائع جديد برقم آخر.</p>`); };
  },
  themeCard() {
    const t = store.get('theme', 'auto');
    return `<div class="card"><h3>المظهر</h3><div class="seg" id="themeSeg">
      ${[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${t === v ? 'checked' : ''}>${l}</label>`).join('')}</div></div>`;
  },
  bindTheme(view) {
    $$('input[name=theme]', view).forEach(r => r.onchange = () => {
      store.set('theme', r.value);
      if (r.value === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = r.value;
    });
  }
};

App.start();
