'use strict';
/* ================= الوضع التجريبي المحلي =================
   يعمل عندما يكون config.js فارغاً: قاعدة بيانات وهمية في localStorage بنفس واجهة SupaAPI
   ونفس قواعد الصلاحيات تقريباً (supabase-setup.sql). مخصّص للتجربة والعرض فقط. */
const DEMO_PASSWORD = '123456';
const DemoAPI = {
  mode: 'demo',
  db: null,
  session: store.get('demo_session', null),
  me: null,

  load() {
    this.db = store.get('demo_db', null);
    if (!this.db || this.db.v !== 3) { this.db = demoSeed(); this.save(); }
    if (this.db.settings.announcement === 'التوصيل لكل محافظات العراق — الدفع عند الاستلام') { this.db.settings.announcement = ''; this.save(); }
    if (this.db.settings.tagline === 'أسطوانات وغرامافونات من الزمن الجميل') { this.db.settings.tagline = 'أسطوانات من الزمن الجميل'; this.save(); }
  },
  save() { if (!store.set('demo_db', this.db)) throw new Error('امتلأت ذاكرة المتصفح: احذف بعض الصور التجريبية أو أعد ضبط البيانات'); },
  reset() { store.del('demo_db'); store.del('demo_session'); this.session = null; this.me = null; this.load(); },
  async tick() { await sleep(120); },
  uidNow() { return this.session && this.session.user.id; },
  prof(id) { return this.db.profiles.find(p => p.id === id); },
  role() { const p = this.prof(this.uidNow()); return p ? p.role : null; },
  isStaff() { return this.role() === 'admin'; },                       // متجر واحد: المشرف يدير كل شيء
  canEdit() { return ['owner', 'admin'].includes(this.role()); },       // المنتجات: صاحب المتجر والمشرف
  isAdmin() { return this.role() === 'admin'; },
  approved(id) { const s = this.db.sellers.find(x => x.id === id); const p = this.prof(id); return !!(s && p && s.status === 'approved' && ['seller', 'owner', 'admin'].includes(p.role)); },
  async ensureShop() {
    if (!this.canEdit()) this.deny();
    const me = this.uidNow(), s = this.db.sellers.find(x => x.id === me);
    if (s) s.status = 'approved';
    else this.db.sellers.push({ id: me, shop_name: BRAND, bio: '', status: 'approved', commission_rate: 0, created_at: new Date().toISOString() });
    this.save(); return this.restore();
  },
  deny() { throw new Error('ليست لديك صلاحية لهذه العملية'); },
  clone: x => JSON.parse(JSON.stringify(x)),

  /* ---------- الجلسة والحساب ---------- */
  async restore() {
    const p = this.session && this.prof(this.session.user.id);
    if (!p) { this.session = null; store.del('demo_session'); this.me = null; return null; }
    this.me = { ...this.clone(p), seller: this.clone(this.db.sellers.find(s => s.id === p.id) || null) };
    delete this.me.password;
    return this.me;
  },
  async signIn(phone, password) {
    await this.tick();
    const p = this.db.profiles.find(x => x.phone === normPhone(phone));
    if (!p || p.password !== password) throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة');
    return this.loginAs(p.id);
  },
  loginAs(id) { this.session = { user: { id } }; store.set('demo_session', this.session); return this.restore(); },
  addUser({ phone, password, full_name, want_seller, shop_name }) {
    phone = normPhone(phone);
    if (this.db.profiles.some(x => x.phone === phone)) throw new Error('رقم الهاتف مسجّل مسبقاً');
    if (String(password).length < 6) throw new Error('كلمة المرور قصيرة جداً (6 أحرف على الأقل)');
    const id = uuid(), role = !this.db.profiles.length ? 'admin' : 'customer';
    this.db.profiles.push({ id, phone, full_name, role, password, created_at: new Date().toISOString() });
    if (role === 'seller') this.db.sellers.push({ id, shop_name: shop_name || '', bio: '', status: 'pending', commission_rate: 0, created_at: new Date().toISOString() });
    this.save();
    return id;
  },
  async signUp(d) { await this.tick(); return this.loginAs(this.addUser(d)); },
  async signOut() { this.session = null; this.me = null; store.del('demo_session'); },
  async changePassword(old, pw) {
    if (this.prof(this.uidNow()).password !== old) throw new Error('كلمة المرور القديمة غير صحيحة');
    if (String(pw).length < 6) throw new Error('كلمة المرور قصيرة جداً (6 أحرف على الأقل)');
    this.prof(this.uidNow()).password = pw; this.save();
  },
  async updateMe({ full_name, shop_name, bio }) {
    const p = this.prof(this.uidNow()); if (full_name !== undefined) p.full_name = full_name;
    const s = this.db.sellers.find(x => x.id === p.id);
    if (s) { if (shop_name !== undefined) s.shop_name = shop_name; if (bio !== undefined) s.bio = bio; }
    this.save(); return this.restore();
  },

  /* ---------- إعدادات المتجر والتوصيل ---------- */
  async settings() { return { ...this.db.settings }; },
  async saveSettings(obj) { if (!this.isAdmin()) this.deny(); Object.assign(this.db.settings, obj); this.save(); },
  async saveStoreTheme(id) { await this.tick(); if (!this.canEdit()) this.deny(); this.db.settings.store_theme = id; this.save(); },
  async saveRecordStyle(id) { await this.tick(); if (!this.canEdit()) this.deny(); this.db.settings.record_style = id; this.save(); },
  async fees() { return this.clone(this.db.fees); },
  async saveFees(rows) {
    if (!this.isStaff()) this.deny();
    for (const r of rows) { const f = this.db.fees.find(x => x.governorate === r.governorate); if (f) Object.assign(f, r); else this.db.fees.push(r); }
    this.save();
  },

  /* ---------- المنتجات ---------- */
  photoUrl(path) { return path || ''; },
  withSeller(p) { const s = this.db.sellers.find(x => x.id === p.seller_id); return { ...this.clone(p), seller: s ? { shop_name: s.shop_name, bio: s.bio } : null }; },
  canSee(p) { return (['active', 'sold'].includes(p.status) && this.approved(p.seller_id)) || this.canEdit(); },
  async products(f = {}) {
    await this.tick();
    const t = f.q && normAr(f.q), a = f.artist && normAr(f.artist), kinds = csv(f.kind), genres = csv(f.genre);
    let rows = this.db.products.filter(p => this.canSee(p) && (f.onlyActive ? p.status === 'active' : ['active', 'sold'].includes(p.status))
      && (!kinds.length || kinds.includes(p.kind)) && (!genres.length || genres.includes(p.genre) || (p.kind === 'gramophone' && kinds.includes('gramophone'))) && (!f.condition || p.condition === f.condition)
      && (!f.speed || p.speed == f.speed) && (!f.size || p.size == f.size) && (!f.sellerId || p.seller_id === f.sellerId)
      && (!f.minPrice || p.price >= Number(f.minPrice)) && (!f.maxPrice || p.price <= Number(f.maxPrice))
      && (!a || normAr(p.artist).includes(a))
      && (!t || [p.title, p.artist, p.album, p.brand, p.model, p.genre].some(x => normAr(x).includes(t))));
    const s = { price_asc: (x, y) => x.price - y.price, price_desc: (x, y) => y.price - x.price }[f.sort] || ((x, y) => y.created_at.localeCompare(x.created_at));
    rows.sort((x, y) => (x.status === 'sold') - (y.status === 'sold') || s(x, y));   // المتوفر أولاً
    const off = f.offset || 0, limit = f.limit || 24;
    return { rows: rows.slice(off, off + limit).map(p => this.withSeller(p)), more: rows.length > off + limit };
  },
  async product(id) { await this.tick(); const p = this.db.products.find(x => x.id === id); return p && this.canSee(p) ? this.withSeller(p) : null; },
  async productsByIds(ids) { return this.db.products.filter(p => ids.includes(p.id) && this.canSee(p)).map(p => this.withSeller(p)); },
  async myProducts() { await this.tick(); return this.clone(this.db.products.filter(p => this.canEdit() || p.seller_id === this.uidNow())).sort((x, y) => y.created_at.localeCompare(x.created_at)); },
  async saveProduct(p, photos) {
    await this.tick();
    const me = this.uidNow(), seller = p.seller_id || me;
    if (!this.canEdit() || (!p.id && seller !== me && !this.isStaff())) this.deny();   // منتج جديد يُسجَّل باسم من أضافه
    const paths = [];
    for (const ph of photos) paths.push(ph.path || await blobToDataURL(await compressImage(ph.blob, 720, 0.7)));
    const row = productRow({ ...p, id: p.id || uuid(), seller_id: seller, photos: paths });
    const old = this.db.products.find(x => x.id === row.id);
    const now = new Date().toISOString();
    if (old) { Object.assign(old, row, { seller_id: old.seller_id, updated_at: now }); }
    else this.db.products.push({ ...row, created_at: now, updated_at: now });
    this.save();
    return this.clone(old || this.db.products[this.db.products.length - 1]);
  },
  async deleteProduct(p) {
    const old = this.db.products.find(x => x.id === p.id);
    if (!old || !this.canEdit()) this.deny();
    this.db.products = this.db.products.filter(x => x.id !== p.id);
    for (const i of this.db.order_items) if (i.product_id === p.id) i.product_id = null;
    this.save();
  },

  /* ---------- الطلبات (نفس منطق place_order / set_order_status في SQL) ---------- */
  async placeOrder(d) {
    await this.tick();
    if (!String(d.name || '').trim() || !String(d.address || '').trim()) throw new Error('الاسم والعنوان مطلوبان');
    if (!validPhone(d.phone)) throw new Error('رقم الهاتف غير صحيح');
    const fee = this.db.fees.find(f => f.governorate === d.governorate && f.active);
    if (!fee) throw new Error('التوصيل غير متاح لهذه المحافظة');
    if (!d.items.length) throw new Error('السلة فارغة');
    const lines = d.items.map(it => {
      const p = this.db.products.find(x => x.id === it.id);
      if (!p || p.status !== 'active' || !this.approved(p.seller_id)) throw new Error('منتج غير متوفر: ' + (p ? p.title : ''));
      if (p.stock < it.qty) throw new Error('الكمية غير متوفرة: ' + p.title);
      return { p, qty: Math.max(1, it.qty) };
    });
    let code; do { code = String(10000000 + Math.floor(Math.random() * 90000000)); } while (this.db.orders.some(o => o.code === code));
    const id = uuid(), now = new Date().toISOString();
    let sub = 0;
    for (const { p, qty } of lines) {
      this.db.order_items.push({ id: uuid(), order_id: id, product_id: p.id, seller_id: p.seller_id, title: p.title, price: p.price, qty, commission_amount: 0 });
      p.stock -= qty; if (!p.stock) p.status = 'sold';
      sub += p.price * qty;
    }
    this.db.orders.push({ id, code, customer_id: this.uidNow() || null, name: d.name.trim(), phone: normPhone(d.phone), governorate: d.governorate,
      address: d.address.trim(), notes: (d.notes || '').trim(), subtotal: sub, delivery_fee: fee.fee, total: sub + fee.fee, status: 'new',
      payment_method: 'cod', payment_status: 'unpaid', courier_ref: '', created_at: now, updated_at: now });
    this.db.order_events.push({ id: uid(), order_id: id, status: 'new', note: '', by_user: this.uidNow() || null, created_at: now });
    this.save();
    return { id, code, total: sub + fee.fee };
  },
  full(o) {
    return { ...this.clone(o),
      items: this.db.order_items.filter(i => i.order_id === o.id).map(i => { const s = this.db.sellers.find(x => x.id === i.seller_id); return { ...this.clone(i), seller: s ? { shop_name: s.shop_name } : null }; }),
      events: this.clone(this.db.order_events.filter(e => e.order_id === o.id)) };
  },
  async trackOrder(code, phone) {
    await this.tick();
    const o = this.db.orders.find(x => x.code === String(code).trim().toUpperCase() && x.phone === normPhone(phone));
    if (!o) return null;
    const f = this.full(o); return { order: f, items: f.items, events: f.events };
  },
  async myOrders() { await this.tick(); return this.db.orders.filter(o => o.customer_id === this.uidNow()).map(o => this.full(o)).sort((x, y) => y.created_at.localeCompare(x.created_at)); },
  async setOrderStatus(id, status, note = '', courier_ref = null) {
    await this.tick();
    const o = this.db.orders.find(x => x.id === id);
    if (!o) throw new Error('الطلب غير موجود');
    if (!this.canEdit() && !(o.customer_id === this.uidNow() && o.status === 'new' && status === 'cancelled')) this.deny();
    if (['delivered', 'cancelled'].includes(o.status) && status !== o.status) throw new Error('لا يمكن تغيير طلب مكتمل أو ملغى');
    if (status === 'cancelled' && o.status !== 'cancelled')
      for (const i of this.db.order_items.filter(i => i.order_id === id && i.product_id)) {
        const p = this.db.products.find(x => x.id === i.product_id);
        if (p) { p.stock += i.qty; if (p.status === 'sold') p.status = 'active'; }
      }
    const changed = status !== o.status;
    o.status = status; if (courier_ref != null) o.courier_ref = courier_ref;
    if (status === 'delivered' && o.payment_method === 'cod') o.payment_status = 'paid';
    o.updated_at = new Date().toISOString();
    if (changed || note) this.db.order_events.push({ id: uid(), order_id: id, status, note: note || '', by_user: this.uidNow(), created_at: o.updated_at });
    this.save();
    return { id, status };
  },
  async sellerOrders() {
    await this.tick();
    const me = this.uidNow();
    return this.db.orders.map(o => {
      const items = this.db.order_items.filter(i => i.order_id === o.id && i.seller_id === me);
      return items.length ? { id: o.id, code: o.code, status: o.status, governorate: o.governorate, created_at: o.created_at,
        items: items.map(i => ({ title: i.title, price: i.price, qty: i.qty, product_id: i.product_id })),
        seller_total: items.reduce((s, i) => s + i.price * i.qty, 0) } : null;
    }).filter(Boolean).sort((x, y) => y.created_at.localeCompare(x.created_at));
  },
  async allOrders({ status } = {}) {
    await this.tick(); if (!this.canEdit()) this.deny();   // الطلبات: صاحب المتجر والمشرف
    return this.db.orders.filter(o => !status || o.status === status).map(o => this.full(o)).sort((x, y) => y.created_at.localeCompare(x.created_at));
  },

  /* ---------- البائعون والحسابات ---------- */
  async sellers() {
    await this.tick(); if (!this.isStaff()) this.deny();
    return this.db.sellers.map(s => { const p = this.prof(s.id); return { ...this.clone(s), profile: p ? { phone: p.phone, full_name: p.full_name, role: p.role } : null }; })
      .sort((x, y) => y.created_at.localeCompare(x.created_at));
  },
  async setSellerStatus(id, status) {
    if (!this.isStaff()) this.deny();
    const s = this.db.sellers.find(x => x.id === id); s.status = status; s.reviewed_by = this.uidNow(); s.reviewed_at = new Date().toISOString();
    this.save(); return this.clone(s);
  },
  async users() { await this.tick(); if (!this.isStaff()) this.deny(); return this.db.profiles.map(({ password, ...p }) => this.clone(p)).sort((x, y) => y.created_at.localeCompare(x.created_at)); },
  async setRole(id, role) {
    if (!this.isAdmin()) this.deny();
    const p = this.prof(id);
    if (p.role === 'admin' && role !== 'admin' && !this.db.profiles.some(x => x.role === 'admin' && x.id !== id)) throw new Error('لا يمكن إزالة آخر مشرف تقني');
    p.role = role;
    if (role === 'seller' && !this.db.sellers.some(s => s.id === id))
      this.db.sellers.push({ id, shop_name: p.full_name, bio: '', status: 'pending', commission_rate: 0, created_at: new Date().toISOString() });
    this.save();
  },
  async createUser({ phone, password, full_name, role, shop_name }) {
    if (!this.isAdmin()) this.deny();
    const id = this.addUser({ phone, password, full_name, want_seller: role === 'seller', shop_name: shop_name || full_name });
    if (role !== 'customer' && role !== 'seller') await this.setRole(id, role);
    if (role === 'seller') await this.setSellerStatus(id, 'approved');
    return id;
  }
};

/* ---------- بيانات تجريبية أولية ---------- */
function demoSeed() {
  const ago = d => new Date(Date.now() - d * 864e5).toISOString();
  const P = (id, phone, full_name, role, d) => ({ id, phone, full_name, role, password: DEMO_PASSWORD, created_at: ago(d) });
  const profiles = [
    P('u-admin', '07700000001', 'المشرف التقني', 'admin', 40),
    P('u-owner', '07700000002', 'جون — صاحب المتجر', 'owner', 39),
    P('u-c1', '07700000006', 'زينب كريم', 'customer', 10)
  ];
  const S = (id, shop_name, bio, status, d) => ({ id, shop_name, bio, status, commission_rate: 0, created_at: ago(d) });
  const sellers = [
    S('u-owner', BRAND, '', 'approved', 39)   // متجر واحد: كل المنتجات لصاحب المتجر
  ];
  let n = 0;
  const R = (seller, title, artist, album, year, genre, speed, size, condition, price, d, extra = {}) => ({
    id: 'p-' + (++n), seller_id: seller, kind: 'record', title, description: extra.description || '', price, stock: extra.stock || 1,
    status: extra.status || 'active', condition, photos: [], artist, album, year, genre, speed, size, brand: '', model: '', working: null,
    created_at: ago(d), updated_at: ago(d) });
  const G = (seller, title, brand, model, condition, working, price, d, description) => ({
    id: 'p-' + (++n), seller_id: seller, kind: 'gramophone', title, description, price, stock: 1, status: 'active', condition,
    photos: [], artist: '', album: '', year: null, genre: '', speed: null, size: null, brand, model, working, created_at: ago(d), updated_at: ago(d) });
  const products = [
    R('u-owner', 'أم كلثوم — إنت عمري', 'أم كلثوم', 'إنت عمري', 1964, 'طرب عربي', 33, 12, 'VG+', 85000, 1, { description: 'طبعة صوت القاهرة الأصلية، الغلاف بحالة جيدة جداً.' }),
    R('u-owner', 'فيروز — معرفتي فيك', 'فيروز', 'معرفتي فيك', 1971, 'طرب عربي', 33, 12, 'NM', 95000, 2),
    R('u-owner', 'ناظم الغزالي — فوق النخل', 'ناظم الغزالي', 'أغاني عراقية', 1958, 'تراث وفولكلور', 45, 7, 'VG', 60000, 3),
    R('u-owner', 'عبد الحليم حافظ — قارئة الفنجان', 'عبد الحليم حافظ', 'قارئة الفنجان', 1976, 'طرب عربي', 33, 12, 'VG+', 75000, 4),
    R('u-owner', 'Miles Davis — Kind of Blue', 'Miles Davis', 'Kind of Blue', 1959, 'جاز', 33, 12, 'VG+', 120000, 5, { description: 'طبعة أوروبية من الستينات.' }),
    R('u-owner', 'The Beatles — Abbey Road', 'The Beatles', 'Abbey Road', 1969, 'روك', 33, 12, 'VG', 110000, 6),
    R('u-owner', 'Pink Floyd — The Dark Side of the Moon', 'Pink Floyd', 'The Dark Side of the Moon', 1973, 'روك', 33, 12, 'NM', 150000, 7, { stock: 2 }),
    R('u-owner', 'محمد عبد الوهاب — الجندول', 'محمد عبد الوهاب', 'الجندول', 1941, 'طرب عربي', 78, 10, 'G+', 70000, 8, { description: 'أسطوانة شيلاك 78 لفة — تحتاج غرامافون أو مشغّل يدعم 78.' }),
    R('u-owner', 'يوسف عمر — مقامات', 'يوسف عمر', 'مقامات عراقية', 1965, 'تراث وفولكلور', 33, 12, 'VG', 90000, 9),
    R('u-owner', 'Louis Armstrong — What a Wonderful World', 'Louis Armstrong', 'What a Wonderful World', 1968, 'جاز', 45, 7, 'VG+', 45000, 10),
    G('u-owner', 'غرامافون HMV بوق نحاسي', 'HMV', 'Model 32', 'very_good', true, 650000, 2, 'غرامافون بوق نحاسي أصلي، مُرمَّم بالكامل ويعمل بشكل ممتاز. يأتي مع 10 إبر.'),
    G('u-owner', 'غرامافون حقيبة His Master\'s Voice', 'His Master\'s Voice', 'Model 102', 'good', true, 420000, 5, 'غرامافون محمول بشكل حقيبة من الأربعينات، صوت قوي ونابض.'),
    G('u-owner', 'غرامافون Columbia للزينة', 'Columbia', 'Grafonola', 'needs_repair', false, 250000, 12, 'قطعة ديكور جميلة، النابض يحتاج تبديل.')
  ];
  const orders = [], order_items = [], order_events = [];
  const O = (id, code, cust, name, phone, gov, address, items, status, d, courier_ref = '') => {
    let sub = 0;
    for (const pid of items) {
      const p = products.find(x => x.id === pid);
      order_items.push({ id: 'oi-' + id + pid, order_id: id, product_id: pid, seller_id: p.seller_id, title: p.title, price: p.price, qty: 1, commission_amount: 0 });
      sub += p.price; if (status !== 'cancelled') { p.stock -= 1; if (!p.stock) p.status = 'sold'; }
    }
    const fee = gov === 'بغداد' ? 5000 : 8000;
    orders.push({ id, code, customer_id: cust, name, phone, governorate: gov, address, notes: '', subtotal: sub, delivery_fee: fee, total: sub + fee,
      status, payment_method: 'cod', payment_status: status === 'delivered' ? 'paid' : 'unpaid', courier_ref, created_at: ago(d), updated_at: ago(d) });
    const flow = status === 'cancelled' ? ['new', 'cancelled'] : ORDER_FLOW.slice(0, ORDER_FLOW.indexOf(status) + 1);
    flow.forEach((s, i) => order_events.push({ id: uid() + i, order_id: id, status: s, note: '', by_user: null, created_at: ago(d - i * 0.3) }));
  };
  products.push(R('u-owner', 'كاظم الساهر — عبرت الشط', 'كاظم الساهر', 'عبرت الشط', 1989, 'طرب عربي', 33, 12, 'VG+', 65000, 15));
  products.push(R('u-owner', 'Elvis Presley — Love Me Tender', 'Elvis Presley', 'Love Me Tender', 1956, 'روك', 45, 7, 'VG', 55000, 16));
  const CD = (...a) => ({ ...R(...a), kind: 'cd', speed: null, size: null });
  products.push(CD('u-owner', 'كاظم الساهر — أنا وليلى', 'كاظم الساهر', 'أنا وليلى', 1998, 'طرب عربي', null, null, '', 25000, 0.5, { stock: 3 }));
  products.push(CD('u-owner', 'Queen — Greatest Hits', 'Queen', 'Greatest Hits', 1981, 'روك', null, null, '', 30000, 0.7));
  O('o-1', 'JV4F2A91', 'u-c1', 'زينب كريم', '07700000006', 'بغداد', 'الكرادة، قرب ساحة كهرمانة، بيت 12', ['p-14'], 'delivered', 6, 'CR-10293');
  O('o-2', 'JV7B0C33', 'u-c1', 'زينب كريم', '07700000006', 'بغداد', 'الكرادة، قرب ساحة كهرمانة، بيت 12', ['p-15', 'p-3'], 'with_courier', 1, 'CR-10377');
  O('o-3', 'JV19E5D0', null, 'مصطفى جاسم', '07801234567', 'البصرة', 'العشار، شارع الكويت', ['p-2'], 'new', 0.2);
  const settings = { tagline: 'أسطوانات من الزمن الجميل', announcement: '',
    contact_phone: '07700000002', courier_name: 'شركة التوصيل' };
  const fees = GOVERNORATES.map(g => ({ governorate: g, fee: g === 'بغداد' ? 5000 : ['بابل', 'كربلاء', 'النجف', 'واسط', 'ديالى', 'القادسية'].includes(g) ? 7000 : 8000, active: true }));
  return { v: 3, profiles, sellers, products, orders, order_items, order_events, settings, fees };
}
