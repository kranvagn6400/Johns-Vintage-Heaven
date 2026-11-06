'use strict';
/* ================= أدوات عامة ================= */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const toLatinDigits = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const normPhone = s => toLatinDigits(s).replace(/\D/g, '');
const validPhone = s => /^07\d{9}$/.test(normPhone(s));   // رقم عراقي: 11 رقماً يبدأ بـ 07
const pad = n => String(n).padStart(2, '0');
const fmtDate = ts => { const d = new Date(ts); return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDay = ts => fmtDate(ts).slice(0, 10);
const fmtNum = n => Number(n || 0).toLocaleString('en-US');
const fmtIQD = n => `${fmtNum(n)} د.ع`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k, d) { try { const v = localStorage.getItem('jvh_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('jvh_' + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem('jvh_' + k); } catch {} }
};
// تحويل النص إلى صيغة موحّدة للبحث (همزات، تاء مربوطة، تشكيل، أرقام)
const normAr = s => toLatinDigits(String(s || '')).toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
const hashNum = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

function toast(msg, ms = 2800) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
function busy(on, text) { $('#busyText').textContent = text || 'لحظة من فضلك…'; $('#busy').classList.toggle('open', !!on); }
function openSheet(html, cls = '') {
  const m = $('#sheet'); $('#sheetBody').innerHTML = html; m.className = 'sheet open ' + cls;
  $('#sheetBody').scrollTop = 0; document.body.classList.add('no-scroll');
  if (window.UI) UI.hydrate($('#sheetBody'));
}
function closeSheet() { $('#sheet').classList.remove('open'); document.body.classList.remove('no-scroll'); }
function confirmBox(msg, okText = 'تأكيد', danger = false) {
  return new Promise(resolve => {
    openSheet(`<div class="confirm"><p>${esc(msg)}</p><div class="row-btns">
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>
      <button class="btn btn-ghost" data-no>رجوع</button></div></div>`, 'sheet-sm');
    $('#sheetBody [data-ok]').onclick = () => { closeSheet(); resolve(true); };
    $('#sheetBody [data-no]').onclick = () => { closeSheet(); resolve(false); };
  });
}
// تصغير الصورة قبل الرفع (JPEG بعرض أقصى max)
async function compressImage(file, max = 1280, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', quality));
  } finally { URL.revokeObjectURL(url); }
}
const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

/* ================= ثوابت المتجر ================= */
const BRAND = 'Johns Vintage Heaven';
const ROLE_NAMES = { admin: 'المشرف التقني', owner: 'صاحب المتجر', seller: 'بائع', customer: 'زبون', disabled: 'موقوف' };
const SELLER_STATUS = { pending: 'بانتظار الموافقة', approved: 'معتمد', rejected: 'مرفوض', suspended: 'موقوف' };
const KIND_NAMES = { record: 'أسطوانة', cd: 'CD', gramophone: 'غرامافون' };
const KIND_PLURAL = { record: 'أسطوانات', cd: 'أقراص CD', gramophone: 'غرامافونات' };
const isMusic = k => k === 'record' || k === 'cd';   // أنواع لها مطرب وأغنية
const PRODUCT_STATUS = { active: 'معروض', hidden: 'مخفي', sold: 'نفذت الكمية' };

// حالات الطلب بالترتيب (cancelled خارج المسار)
const ORDER_FLOW = ['new', 'confirmed', 'with_courier', 'delivered'];
const ORDER_STATUS = { new: 'جديد', confirmed: 'مؤكَّد', with_courier: 'مع المندوب', delivered: 'تم التسليم', cancelled: 'ملغى' };
const PAYMENT_METHODS = { cod: 'الدفع عند الاستلام', zaincash: 'زين كاش', fastpay: 'فاست باي', qi: 'كي كارد' };
const PAYMENT_STATUS = { unpaid: 'غير مدفوع', pending: 'قيد الدفع', paid: 'مدفوع', refunded: 'مُسترجع', failed: 'فشل الدفع' };

// تقييم حالة الأسطوانة (مقياس Goldmine المعروف عالمياً)
const RECORD_GRADES = {
  M: 'Mint — جديدة لم تُشغَّل', NM: 'Near Mint — شبه جديدة', 'VG+': 'Very Good Plus — آثار خفيفة جداً',
  VG: 'Very Good — آثار استعمال واضحة', 'G+': 'Good Plus — خدوش مسموعة قليلاً', G: 'Good — تُشغَّل مع ضجيج',
  F: 'Fair — متعبة', P: 'Poor — للزينة أو القطع'
};
const GRAMO_GRADES = { excellent: 'ممتاز', very_good: 'جيد جداً', good: 'جيد', fair: 'مقبول', needs_repair: 'يحتاج صيانة' };
const gradeName = p => p.kind === 'record' ? (p.condition ? p.condition : '—') : (GRAMO_GRADES[p.condition] || '—');
const gradeLong = p => p.kind === 'record' ? (RECORD_GRADES[p.condition] || '—') : (GRAMO_GRADES[p.condition] || '—');
const GENRES = ['طرب عربي', 'تراث وفولكلور', 'كلاسيك', 'جاز', 'بلوز', 'روك', 'بوب', 'سول وفانك', 'ديسكو',
  'ريغي', 'إلكتروني', 'موسيقى أفلام', 'أطفال', 'أخرى'];
const SPEEDS = [33, 45, 78];
const SIZES = [7, 10, 12];

/* ---------- محافظات العراق (19) ---------- */
const GOVERNORATES = ['بغداد', 'البصرة', 'نينوى', 'أربيل', 'السليمانية', 'دهوك', 'كركوك', 'الأنبار', 'ديالى', 'صلاح الدين',
  'بابل', 'كربلاء', 'النجف', 'واسط', 'ميسان', 'ذي قار', 'المثنى', 'القادسية', 'حلبجة'];

/* ---------- السلة (في المتصفح) ----------
   لكل حساب سلّته على نفس الجهاز: الزائر بدون حساب ← jvh_cart، ومن سجّل الدخول ← jvh_cart_<id>.
   فلا يرى صاحب المتجر أو المشرف سلة زبون استخدم نفس المتصفح، والعكس. */
const Cart = {
  _key: null, _items: [],   // [{id, qty}]
  get key() { return (typeof API !== 'undefined' && API.me) ? 'cart_' + API.me.id : 'cart'; },
  get items() { if (this._key !== this.key) { this._key = this.key; this._items = store.get(this._key, []); } return this._items; },
  set items(v) { this.items; this._items = v; },
  save() { store.set(this.key, this._items); document.dispatchEvent(new CustomEvent('cart')); },
  count() { return this.items.reduce((s, x) => s + x.qty, 0); },
  qty(id) { const x = this.items.find(i => i.id === id); return x ? x.qty : 0; },
  add(id, qty = 1, max = 99) {
    const x = this.items.find(i => i.id === id);
    if (x) x.qty = Math.min(max, x.qty + qty); else this.items.push({ id, qty: Math.min(max, qty) });
    this.save();
  },
  set(id, qty) { this.items = qty > 0 ? this.items.map(i => i.id === id ? { id, qty } : i) : this.items.filter(i => i.id !== id); this.save(); },
  clear() { this.items = []; this.save(); }
};
