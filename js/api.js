'use strict';
/* ================= الاتصال بـ Supabase (REST مباشر، بدون مكتبات) =================
   واجهة واحدة يستعملها التطبيق كله. نفس الدوال موجودة في demo.js (الوضع التجريبي المحلي)،
   فإذا غيّرت دالة هنا غيّرها هناك أيضاً. */
const CFG = window.JVH_CONFIG || {};
const SupaAPI = {
  mode: 'supabase',
  base: String(CFG.SUPABASE_URL || '').replace(/\/+$/, ''),
  session: store.get('session', null),   // {access_token, refresh_token, expires_at, user:{id}}
  me: store.get('me', null),

  emailOf(phone) { return `${normPhone(phone)}@${CFG.EMAIL_DOMAIN || 'johnsvintageheaven.app'}`; },

  async req(path, { method = 'GET', body, headers = {}, auth = true, raw = false } = {}) {
    if (auth) await this.ensureFresh();
    const h = { apikey: CFG.SUPABASE_KEY, ...headers };
    h.Authorization = 'Bearer ' + (auth && this.session ? this.session.access_token : CFG.SUPABASE_KEY);
    if (body !== undefined && !(body instanceof Blob) && !h['Content-Type']) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    let res;
    try { res = await fetch(this.base + path, { method, headers: h, body }); }
    catch { throw new Error(navigator.onLine ? 'تعذّر الاتصال بالخادم' : 'لا يوجد اتصال بالإنترنت'); }
    if (raw && res.ok) return res;
    const text = await res.text();
    let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) {
      const msg = (j && (j.msg || j.message || j.error_description || j.error)) || res.statusText || 'خطأ في الخادم';
      const e = new Error(this.translate(String(msg))); e.status = res.status; throw e;
    }
    return j;
  },
  translate(m) {
    if (/invalid login credentials/i.test(m)) return 'رقم الهاتف أو كلمة المرور غير صحيحة';
    if (/already registered|already exists/i.test(m)) return 'رقم الهاتف مسجّل مسبقاً';
    if (/password should be at least/i.test(m)) return 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)';
    if (/email not confirmed/i.test(m)) return 'الحساب غير مفعّل: يجب تعطيل "Confirm email" في إعدادات Supabase';
    if (/row-level security|violates row-level/i.test(m)) return 'ليست لديك صلاحية لهذه العملية';
    if (/JWT expired/i.test(m)) return 'انتهت الجلسة، سجّل الدخول مجدداً';
    return m;
  },

  /* ---------- الجلسة والحساب ---------- */
  setSession(s) {
    this.session = s ? { access_token: s.access_token, refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: { id: s.user.id } } : null;
    s ? store.set('session', this.session) : store.del('session');
  },
  async ensureFresh() {
    const s = this.session;
    if (!s || s.expires_at - 60 > Date.now() / 1000) return;
    const j = await this.req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: s.refresh_token } })
      .catch(e => { if (e.status === 400 || e.status === 401) { this.setSession(null); this.setMe(null); throw new Error('انتهت الجلسة، سجّل الدخول مجدداً'); } throw e; });
    this.setSession(j);
  },
  setMe(p) { this.me = p; p ? store.set('me', p) : store.del('me'); },
  async restore() {
    if (!this.session) { this.setMe(null); return null; }
    const r = await this.req(`/rest/v1/profiles?id=eq.${this.session.user.id}&select=*,seller:sellers!sellers_id_fkey(*)`);
    const p = r[0] || null;
    if (p) p.seller = Array.isArray(p.seller) ? p.seller[0] || null : p.seller;
    this.setMe(p);
    return p;
  },
  async signIn(phone, password) {
    const j = await this.req('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email: this.emailOf(phone), password } });
    this.setSession(j);
    return this.restore();
  },
  async rawSignUp({ phone, password, full_name, want_seller = false, shop_name = '' }) {
    const j = await this.req('/auth/v1/signup', { method: 'POST', auth: false,
      body: { email: this.emailOf(phone), password, data: { phone: normPhone(phone), full_name, want_seller, shop_name } } });
    const id = j && (j.user ? j.user.id : j.id);
    if (!id || (j.user && Array.isArray(j.user.identities) && !j.user.identities.length)) throw new Error('رقم الهاتف مسجّل مسبقاً');
    return { id, session: j.access_token ? j : null };
  },
  async signUp(data) {
    const { session } = await this.rawSignUp(data);
    if (!session) return this.signIn(data.phone, data.password);
    this.setSession(session);
    return this.restore();
  },
  async signOut() {
    try { if (this.session) await this.req('/auth/v1/logout', { method: 'POST' }); } catch {}
    this.setSession(null); this.setMe(null);
  },
  changePassword(password) { return this.req('/auth/v1/user', { method: 'PUT', body: { password } }); },
  async updateMe({ full_name, shop_name, bio }) {
    const id = this.me.id;
    if (full_name !== undefined) await this.patch('profiles', `id=eq.${id}`, { full_name });
    if (this.me.seller && (shop_name !== undefined || bio !== undefined))
      await this.patch('sellers', `id=eq.${id}`, { ...(shop_name !== undefined ? { shop_name } : {}), ...(bio !== undefined ? { bio } : {}) });
    return this.restore();
  },

  /* ---------- أدوات PostgREST ---------- */
  get(table, query) { return this.req(`/rest/v1/${table}?${query}`); },
  async patch(table, filter, body) {
    const r = await this.req(`/rest/v1/${table}?${filter}`, { method: 'PATCH', body, headers: { Prefer: 'return=representation' } });
    if (!r || !r.length) throw new Error('ليست لديك صلاحية لهذه العملية');
    return r[0];
  },
  rpc(name, args = {}) { return this.req(`/rest/v1/rpc/${name}`, { method: 'POST', body: args }); },

  /* ---------- إعدادات المتجر والتوصيل ---------- */
  async settings() { const r = await this.get('settings', 'select=*'); return Object.fromEntries(r.map(x => [x.key, x.value])); },
  saveSettings(obj) {
    return this.req('/rest/v1/settings', { method: 'POST', body: Object.entries(obj).map(([key, value]) => ({ key, value: String(value) })),
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  },
  fees() { return this.get('delivery_fees', 'select=*'); },
  saveFees(rows) {
    return this.req('/rest/v1/delivery_fees', { method: 'POST', body: rows, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  },

  /* ---------- المنتجات ---------- */
  photoUrl(path) {
    if (!path) return '';
    if (/^(data:|https?:)/.test(path)) return path;
    return `${this.base}/storage/v1/object/public/product-photos/${path.split('/').map(encodeURIComponent).join('/')}`;
  },
  async products(f = {}) {
    const q = ['select=*,seller:sellers(shop_name)'];
    q.push(f.includeSold ? 'status=in.(active,sold)' : 'status=eq.active');
    if (f.kind) q.push('kind=eq.' + f.kind);
    for (const k of ['genre', 'condition', 'speed', 'size']) if (f[k]) q.push(`${k}=eq.${encodeURIComponent(f[k])}`);
    if (f.sellerId) q.push('seller_id=eq.' + f.sellerId);
    if (f.minPrice) q.push('price=gte.' + Number(f.minPrice));
    if (f.maxPrice) q.push('price=lte.' + Number(f.maxPrice));
    if (f.artist) q.push('artist=ilike.' + encodeURIComponent(`*${clean(f.artist)}*`));
    if (f.q) {
      const t = encodeURIComponent(`*${clean(f.q)}*`);
      q.push(`or=(title.ilike.${t},artist.ilike.${t},album.ilike.${t},brand.ilike.${t},model.ilike.${t},genre.ilike.${t})`);
    }
    q.push('order=' + ({ price_asc: 'price.asc', price_desc: 'price.desc' }[f.sort] || 'created_at.desc'));
    const limit = f.limit || 24;
    q.push(`limit=${limit + 1}`, `offset=${f.offset || 0}`);
    const rows = await this.get('products', q.join('&'));
    return { rows: rows.slice(0, limit), more: rows.length > limit };
  },
  async product(id) { const r = await this.get('products', `id=eq.${id}&select=*,seller:sellers(shop_name,bio)`); return r[0] || null; },
  async productsByIds(ids) {
    if (!ids.length) return [];
    return this.get('products', `id=in.(${ids.join(',')})&select=*,seller:sellers(shop_name)`);
  },
  myProducts() { return this.get('products', `seller_id=eq.${this.me.id}&select=*&order=created_at.desc`); },
  // photos: [{path}] للصور الموجودة أو [{blob}] للجديدة، بالترتيب المطلوب
  async saveProduct(p, photos) {
    const isNew = !p.id; const id = p.id || uuid(); const seller = p.seller_id || this.me.id;
    const paths = [];
    for (const ph of photos) {
      if (ph.path) { paths.push(ph.path); continue; }
      const path = `${seller}/${id}/${uid()}.jpg`;
      await this.req(`/storage/v1/object/product-photos/${path}`, { method: 'POST', body: ph.blob,
        headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'cache-control': '31536000' } });
      paths.push(path);
    }
    const row = productRow({ ...p, id, seller_id: seller, photos: paths });
    let saved;
    if (isNew) saved = (await this.req('/rest/v1/products', { method: 'POST', body: row, headers: { Prefer: 'return=representation' } }))[0];
    else { const { id: _, seller_id, ...rest } = row; saved = await this.patch('products', `id=eq.${id}`, rest); }
    const removed = (p.photos || []).filter(x => !paths.includes(x));
    if (removed.length) this.req('/storage/v1/object/product-photos', { method: 'DELETE', body: { prefixes: removed } }).catch(() => {});
    return saved;
  },
  async deleteProduct(p) {
    await this.req(`/rest/v1/products?id=eq.${p.id}`, { method: 'DELETE' });
    if (p.photos && p.photos.length) this.req('/storage/v1/object/product-photos', { method: 'DELETE', body: { prefixes: p.photos } }).catch(() => {});
  },

  /* ---------- الطلبات ---------- */
  placeOrder(d) {
    return this.rpc('place_order', { p_name: d.name, p_phone: d.phone, p_governorate: d.governorate, p_address: d.address,
      p_notes: d.notes || '', p_items: d.items.map(i => ({ product_id: i.id, qty: i.qty })) });
  },
  async trackOrder(code, phone) { return this.rpc('track_order', { p_code: code, p_phone: phone }); },
  myOrders() { return this.get('orders', `customer_id=eq.${this.me.id}&select=*,items:order_items(*),events:order_events(*)&order=created_at.desc`); },
  setOrderStatus(id, status, note = '', courier_ref = null) {
    return this.rpc('set_order_status', { p_order: id, p_status: status, p_note: note, p_courier_ref: courier_ref });
  },
  sellerOrders() { return this.rpc('seller_orders'); },
  allOrders({ status } = {}) {
    return this.get('orders', `select=*,items:order_items(*,seller:sellers(shop_name)),events:order_events(*)${status ? '&status=eq.' + status : ''}&order=created_at.desc&limit=500`);
  },

  /* ---------- البائعون والحسابات ---------- */
  sellers() { return this.get('sellers', 'select=*,profile:profiles!sellers_id_fkey(phone,full_name,role)&order=created_at.desc'); },
  setSellerStatus(id, status) { return this.patch('sellers', `id=eq.${id}`, { status }); },
  users() { return this.get('profiles', 'select=*&order=created_at.desc'); },
  setRole(id, role) { return this.patch('profiles', `id=eq.${id}`, { role }); },
  // المشرف ينشئ حساباً لغيره دون أن تتغير جلسته
  async createUser({ phone, password, full_name, role, shop_name }) {
    const { id } = await this.rawSignUp({ phone, password, full_name, want_seller: role === 'seller', shop_name: shop_name || full_name });
    if (role !== 'customer' && role !== 'seller') await this.setRole(id, role);
    if (role === 'seller') await this.setSellerStatus(id, 'approved');
    return id;
  }
};

// إزالة الرموز التي تكسر صيغة فلاتر PostgREST
function clean(s) { return String(s).replace(/[,()*%\\"]/g, ' ').trim(); }
// الأعمدة المسموح إرسالها للجدول
function productRow(p) {
  const rec = p.kind === 'record';
  const num = v => (v === '' || v == null ? null : Number(v));
  return {
    id: p.id, seller_id: p.seller_id, kind: p.kind, title: p.title.trim(), description: p.description || '',
    price: Math.round(Number(p.price) || 0), stock: Math.max(0, Math.round(Number(p.stock) || 0)),
    status: p.status || 'active', condition: p.condition || '', photos: p.photos || [],
    artist: rec ? p.artist || '' : '', album: rec ? p.album || '' : '', year: rec ? num(p.year) : null,
    genre: rec ? p.genre || '' : '', speed: rec ? num(p.speed) : null, size: rec ? num(p.size) : null,
    brand: rec ? '' : p.brand || '', model: rec ? '' : p.model || '', working: rec ? null : (p.working == null ? null : !!p.working)
  };
}
