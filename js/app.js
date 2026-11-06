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
      Themes.apply(this.settings.store_theme);   // شعار وألوان المتجر كما اختارها صاحب المتجر أو المشرف
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
      cart: () => this.buyer() ? Shop.cart(view) : this.go('#/'), checkout: () => this.buyer() ? Shop.checkout(view) : this.go('#/'), done: () => Shop.done(view, seg[1]),
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
  // صاحب المتجر لا يشتري: لا سلة ولا زر «أضف إلى السلة» ولا إتمام طلب
  buyer() { return !(API.me && API.me.role === 'owner'); },
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
    $('#tbCart').classList.toggle('hidden', !this.buyer());
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
      // صاحب المتجر: «الطلبات» مكان السلة، و«المنتجات» مكان «لوحتي»
      ...(this.buyer() ? [['#/cart', 'السلة', 'cart', p === '/cart' || p === '/checkout']]
        : [['#/owner', 'الطلبات', 'receipt', p === '/owner'], ['#/seller', 'المنتجات', 'package', p === '/seller']]),
      ...(dash && this.buyer() ? [[dash[0], 'لوحتي', dash[2], p === dash[0].slice(1)]] : []),
      ...(staff ? [] : [['#/track', 'تتبّع طلب', 'truck', p === '/track']])
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
      <div class="auth-head"><img src="${Themes.list[Themes.current()].logo}" data-logo alt="" width="96" height="96" style="margin:0 auto 6px"><h1>${signup ? 'حساب جديد' : 'دخول الإدارة'}</h1>
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
      <div class="card"><h3>كلمة المرور</h3><form id="pwForm" class="stack">
        <input class="input" id="pw0" type="password" dir="ltr" autocomplete="current-password" placeholder="كلمة المرور القديمة" required>
        <input class="input" id="pw1" type="password" dir="ltr" autocomplete="new-password" placeholder="كلمة المرور الجديدة (6 على الأقل)" required>
        <input class="input" id="pw2" type="password" dir="ltr" autocomplete="new-password" placeholder="تأكيد كلمة المرور الجديدة" required>
        <button class="btn btn-ghost" type="submit">تغيير كلمة المرور</button></form></div>
      ${this.themeCard()}
      ${['owner', 'admin'].includes(me.role) ? this.storeThemeCard() : ''}
      <div class="card"><div class="stack">
        <button class="btn btn-danger" id="logout">${icon('logout')} تسجيل الخروج</button>
        ${API.mode === 'demo' ? '<button class="btn btn-ghost btn-sm" id="resetDemo">إعادة ضبط البيانات التجريبية</button>' : ''}
      </div></div></div></div>`;
    this.bindTheme(view);
    this.bindStoreTheme(view);
    $('#pwForm').onsubmit = async e => {
      e.preventDefault(); const old = $('#pw0').value, pw = $('#pw1').value;
      if (!old) return toast('اكتب كلمة المرور القديمة');
      if (pw.length < 6) return toast('كلمة المرور الجديدة 6 أحرف على الأقل');
      if (pw !== $('#pw2').value) return toast('تأكيد كلمة المرور غير مطابق');
      busy(true); try { await API.changePassword(old, pw); ['#pw0', '#pw1', '#pw2'].forEach(q => $(q).value = ''); toast('تم تغيير كلمة المرور'); } catch (err) { toast(err.message); } finally { busy(false); }
    };
    $('#logout').onclick = async () => { await API.signOut(); toast('تم تسجيل الخروج'); this.go('#/'); };
    const rd = $('#resetDemo'); if (rd) rd.onclick = async () => { if (await confirmBox('حذف كل التغييرات التجريبية والعودة للبيانات الأولى؟', 'إعادة الضبط', true)) { DemoAPI.reset(); Cart.clear(); this.go('#/'); } };
    const bs = $('[data-become-seller]', view);
    if (bs) bs.onclick = e => { e.preventDefault(); openSheet(`<h2>البيع في المتجر</h2><p>لعرض منتجاتك تحتاج حساب بائع. تواصل مع صاحب المتجر${this.settings.contact_phone ? ` على الرقم <b class="num">${esc(this.settings.contact_phone)}</b>` : ''} ليحوّل حسابك إلى بائع، أو أنشئ حساب بائع جديد برقم آخر.</p>`); };
  },
  // الوضع الداكن: مفتاح يخص هذا المستخدم وهذا الجهاز فقط (لا يتغيّر عند الآخرين)
  isDark() {
    const t = store.get('theme', 'auto');
    return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  },
  themeCard() {
    return `<div class="card"><label class="switch-row"><span><b>Dark Mode</b><span class="muted small" style="display:block">المظهر الداكن لك أنت فقط</span></span>
      <input type="checkbox" id="darkSw" ${this.isDark() ? 'checked' : ''}><i class="switch"></i></label></div>`;
  },
  // شعار وألوان المتجر: يختارها صاحب المتجر أو المشرف وتظهر لكل الزبائن
  storeThemeCard() {
    const cur = Themes.current();
    return `<div class="card"><h3>شعار وألوان المتجر</h3><p class="muted small">يتغيّر الشعار وألوان الموقع لكل الزبائن فور الاختيار.</p>
      <div class="store-themes">${Object.entries(Themes.list).map(([id, t]) => `<button type="button" class="st-opt ${id === cur ? 'on' : ''}" data-store-theme="${id}">
        <img src="${t.logo}" alt=""><b>${esc(t.name)}</b><span class="muted small">${esc(t.note)}</span>
        <span class="sw">${t.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span></button>`).join('')}</div></div>`;
  },
  bindStoreTheme(view) {
    $$('[data-store-theme]', view).forEach(b => b.onclick = async () => {
      const id = b.dataset.storeTheme, prev = Themes.current();
      if (id === prev) return;
      Themes.apply(id); $$('[data-store-theme]', view).forEach(x => x.classList.toggle('on', x === b));
      try { await API.saveStoreTheme(id); this.settings.store_theme = id; toast('تم تغيير شعار وألوان المتجر'); }
      catch (e) { Themes.apply(prev); $$('[data-store-theme]', view).forEach(x => x.classList.toggle('on', x.dataset.storeTheme === prev)); toast(e.message); }
    });
  },
  bindTheme(view) {
    $('#darkSw', view).onchange = e => {
      const v = e.target.checked ? 'dark' : 'light';
      store.set('theme', v); document.documentElement.dataset.theme = v;
    };
  }
};

App.start();
