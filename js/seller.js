'use strict';
/* ================= المنتجات: صاحب المتجر والمشرف يضيفان ويعدّلان ويحذفان المنتجات وصورها ================= */
const Seller = {
  staff: () => ['owner', 'admin'].includes(API.me.role),
  async route(view, seg) {
    if (this.staff() && !(API.me.seller && API.me.seller.status === 'approved')) {
      view.innerHTML = UI.loading();
      try { await API.ensureShop(); } catch (e) { view.innerHTML = UI.error(e); return; }
    }
    const s = API.me.seller;
    if (!s || s.status !== 'approved') return this.waiting(view, s);
    if (seg[0] === 'new') return this.form(view, null);
    if (seg[0] === 'edit') return this.form(view, seg[1]);
    if (seg[0] === 'orders' && !this.staff()) return this.orders(view);   // صاحب المتجر والمشرف: الطلبات من «إدارة المتجر»
    return this.home(view);
  },
  async waiting(view, s) {
    try { await API.restore(); s = API.me.seller; if (s && s.status === 'approved') return this.home(view); } catch {}
    const st = s ? s.status : 'pending';
    view.innerHTML = `<div class="auth"><div class="card" style="text-align:center">
      <div class="seal" style="width:76px;height:76px;margin:0 auto 12px;border-radius:50%;background:var(--warn-soft);color:var(--warn);display:flex;align-items:center;justify-content:center">${icon(st === 'pending' ? 'clock' : 'info', 'big')}</div>
      <h2>${st === 'pending' ? 'طلبك قيد المراجعة' : st === 'rejected' ? 'لم تتم الموافقة على طلبك' : 'حساب البائع موقوف'}</h2>
      <p class="muted" style="margin:8px 0 16px">${st === 'pending' ? 'سيراجع صاحب المتجر طلب انضمامك كبائع. بعد الموافقة تستطيع إضافة منتجاتك من هنا.'
        : 'تواصل مع صاحب المتجر لمعرفة التفاصيل.'}</p>
      ${s ? `<p class="small">اسم المتجر: <b>${esc(s.shop_name || '—')}</b></p>` : ''}
      <button class="btn btn-ghost" style="margin-top:14px" onclick="App.route()">تحديث الحالة</button></div></div>`;
  },
  head(active) {
    return `<div class="page-head"><h1>${this.staff() ? 'المنتجات' : 'لوحة البائع'}</h1><span class="sp"></span><a class="btn btn-primary btn-sm" href="#/seller/new">${icon('plus')} منتج جديد</a></div>
      <div class="tabs"><a class="tab ${active === 'products' ? 'on' : ''}" href="#/seller">${this.staff() ? 'المنتجات' : 'منتجاتي'}</a>${this.staff() ? `<a class="tab" href="#/owner">${icon('receipt')} الطلبات</a>` : `<a class="tab ${active === 'orders' ? 'on' : ''}" href="#/seller/orders">طلبات منتجاتي</a>`}</div>`;
  },
  async home(view) {
    view.innerHTML = this.head('products') + UI.loading();
    let rows;
    try { rows = await API.myProducts(); } catch (e) { view.innerHTML = this.head('products') + UI.error(e); return; }
    const count = s => rows.filter(p => p.status === s).length;
    const shop = API.me.seller;
    view.innerHTML = this.head('products') + `
      <div class="stats"><div class="stat"><small>معروض</small><b>${count('active')}</b></div><div class="stat"><small>مُباع</small><b>${count('sold')}</b></div>
        <div class="stat"><small>مخفي</small><b>${count('hidden')}</b></div><div class="stat"><small>متجري</small><b style="font-size:15px">${esc(shop.shop_name || '—')}</b></div></div>
      ${rows.length ? `<div class="list">${rows.map(p => `<div class="row">
          <a class="thumb" href="#/seller/edit/${p.id}">${UI.photo(p)}</a>
          <a class="grow" href="#/seller/edit/${p.id}"><h4>${esc(p.title)}</h4><div class="sub">${KIND_NAMES[p.kind]} · ${fmtIQD(p.price)}${p.stock > 1 ? ` · ${p.stock} قطع` : ''}</div>
            <span class="pill st-${p.status}">${PRODUCT_STATUS[p.status]}</span></a>
          <button class="icon-btn" data-vis="${p.id}" aria-label="إظهار/إخفاء" title="${p.status === 'hidden' ? 'إظهار' : 'إخفاء'}" ${p.status === 'sold' ? 'disabled style="opacity:.4"' : ''}>${icon(p.status === 'hidden' ? 'eye' : 'eyeOff')}</button>
        </div>`).join('')}</div>`
      : UI.empty('disc', 'لا توجد منتجات بعد', 'أضف أول أسطوانة أو غرامافون.', '<a class="btn btn-primary" href="#/seller/new">إضافة منتج</a>')}`;
    $$('[data-vis]', view).forEach(b => b.onclick = async () => {
      const p = rows.find(x => x.id === b.dataset.vis);
      busy(true);
      try { await API.saveProduct({ ...p, status: p.status === 'hidden' ? 'active' : 'hidden' }, (p.photos || []).map(path => ({ path }))); this.home(view); }
      catch (e) { toast(e.message); } finally { busy(false); }
    });
  },

  async form(view, id) {
    let p = { kind: 'record', title: '', price: '', stock: 1, status: 'active', condition: '', photos: [] };
    if (id) {
      view.innerHTML = UI.loading();
      try { const rows = await API.myProducts(); p = rows.find(x => x.id === id); } catch (e) { view.innerHTML = UI.error(e); return; }
      if (!p) { view.innerHTML = UI.empty('disc', 'المنتج غير موجود'); return; }
    }
    // الصور: [{path}] موجودة أو [{blob, url}] جديدة
    let photos = (p.photos || []).map(path => ({ path, url: API.photoUrl(path) }));
    const yearNow = new Date().getFullYear();
    view.innerHTML = `<div class="page-head"><a class="back-btn" href="#/seller" aria-label="رجوع">${icon('back')}</a><h1>${id ? 'تعديل منتج' : 'منتج جديد'}</h1></div>
      <form id="pForm" class="stack" style="max-width:720px" novalidate>
        <div class="seg">${['record', 'cd', 'gramophone'].map(k => `<label><input type="radio" name="kind" value="${k}" ${p.kind === k ? 'checked' : ''}>${KIND_NAMES[k]}</label>`).join('')}</div>
        <fieldset><legend>الصور</legend><div class="photos-edit" id="phs"></div><p class="hint">الصورة الأولى هي صورة الغلاف. حتى 8 صور.</p></fieldset>
        <fieldset><legend>الأساسيات</legend>
          <div data-for="gramophone"><label class="lbl" for="pTitle">اسم المنتج <span class="req">*</span></label><input class="input" id="pTitle" value="${esc(p.kind === 'gramophone' ? p.title : '')}" placeholder="مثال: غرامافون HMV بوق نحاسي"></div>
          <div class="grid2" data-for="record cd"><div><label class="lbl" for="pArtist">المطرب <span class="req">*</span></label><input class="input" id="pArtist" value="${esc(p.artist || '')}" placeholder="مثال: فيروز"></div>
            <div><label class="lbl" for="pAlbum" id="pAlbumLbl">اسم الأغنية <span class="req">*</span></label><input class="input" id="pAlbum" value="${esc(p.album || '')}" placeholder="مثال: معرفتي فيك"></div></div>
          <div class="grid2"><div><label class="lbl" for="pPrice">السعر (د.ع) <span class="req">*</span></label><input class="input num" id="pPrice" inputmode="numeric" value="${esc(p.price)}"></div>
            <div><label class="lbl" for="pStock">الكمية المتوفرة</label><input class="input num" id="pStock" inputmode="numeric" value="${esc(p.stock)}"></div></div>
          <div class="grid2" data-for="gramophone"><div><label class="lbl" for="pBrand">الماركة <span class="req">*</span></label><input class="input" id="pBrand" value="${esc(p.brand || '')}" placeholder="HMV، Columbia…"></div>
            <div><label class="lbl" for="pModel">الموديل</label><input class="input" id="pModel" value="${esc(p.model || '')}"></div></div>
          <div class="grid2" data-for="record cd"><div><label class="lbl" for="pYear">سنة الإصدار <span class="muted">(اختياري)</span></label><input class="input num" id="pYear" inputmode="numeric" maxlength="4" value="${esc(p.year || '')}"></div>
            <div><label class="lbl" for="pGenre">النوع الموسيقي <span class="muted">(اختياري)</span></label><select class="input" id="pGenre"><option value="">—</option>${UI.options(GENRES, p.genre)}</select></div></div>
          <div class="grid2" data-for="record"><div><label class="lbl" for="pSpeed">السرعة <span class="muted">(اختياري)</span></label><select class="input" id="pSpeed"><option value="">—</option>${UI.options(SPEEDS, p.speed, { 33: '33 لفة', 45: '45 لفة', 78: '78 لفة' })}</select></div>
            <div><label class="lbl" for="pSize">الحجم <span class="muted">(اختياري)</span></label><select class="input" id="pSize"><option value="">—</option>${UI.options(SIZES, p.size, { 7: '7 إنش', 10: '10 إنش', 12: '12 إنش' })}</select></div></div>
        </fieldset>
        <fieldset><legend>الوصف</legend><textarea class="input" id="pDesc" placeholder="الطبعة، حالة الغلاف، ملاحظات مهمة للمشتري…">${esc(p.description || '')}</textarea>
          <label class="check"><input type="checkbox" id="pHidden" ${p.status === 'hidden' ? 'checked' : ''}> إخفاء من المتجر مؤقتاً</label></fieldset>
        <div class="row-btns"><button class="btn btn-primary" type="submit">${icon('check')} حفظ</button>
          ${id ? `<button class="btn btn-danger" type="button" id="pDel">${icon('trash')} حذف</button>` : ''}</div>
      </form>`;
    const kind = () => $('input[name=kind]:checked').value;
    // كل صف يظهر لأنواع المنتجات المكتوبة في data-for فقط
    const syncKind = () => {
      const k = kind();
      $$('[data-for]', $('#pForm')).forEach(el => el.classList.toggle('hidden', !el.dataset.for.split(' ').includes(k)));
      $('#pAlbumLbl').innerHTML = (k === 'cd' ? 'اسم الأغنية أو الألبوم' : 'اسم الأغنية') + ' <span class="req">*</span>';
    };
    $$('input[name=kind]').forEach(r => r.onchange = syncKind); syncKind();
    ['pPrice', 'pStock', 'pYear'].forEach(i => $('#' + i).oninput = e => { e.target.value = toLatinDigits(e.target.value).replace(/\D/g, ''); });
    const drawPhotos = () => {
      $('#phs').innerHTML = photos.map((ph, i) => `<div class="ph"><img src="${esc(ph.url)}" alt=""><button type="button" class="rm" data-rm="${i}" aria-label="حذف الصورة">${icon('x')}</button>${i ? '' : '<span class="first">الغلاف</span>'}</div>`).join('')
        + (photos.length < 8 ? `<label class="ph-add">${icon('image')}<span>إضافة صور</span><input type="file" accept="image/*" multiple id="phIn"></label>` : '');
      $$('[data-rm]', $('#phs')).forEach(b => b.onclick = () => { photos.splice(+b.dataset.rm, 1); drawPhotos(); });
      const inp = $('#phIn');
      if (inp) inp.onchange = async () => {
        busy(true, 'تجهيز الصور…');
        try { for (const f of [...inp.files].slice(0, 8 - photos.length)) { const blob = await compressImage(f); photos.push({ blob, url: URL.createObjectURL(blob) }); } }
        catch { toast('تعذّر قراءة إحدى الصور'); } finally { busy(false); drawPhotos(); }
      };
    };
    drawPhotos();
    $('#pForm').onsubmit = async e => {
      e.preventDefault();
      const k = kind(), stock = Number($('#pStock').value || 0);
      const music = k !== 'gramophone';
      const d = { ...p, kind: k, price: $('#pPrice').value, stock, condition: p.condition || '', description: $('#pDesc').value.trim(),
        artist: $('#pArtist').value.trim(), album: $('#pAlbum').value.trim(), year: $('#pYear').value, genre: $('#pGenre').value, speed: $('#pSpeed').value, size: $('#pSize').value,
        brand: $('#pBrand').value.trim(), model: $('#pModel').value.trim(), working: null };
      // اسم المنتج: للأسطوانة والـ CD يُكوَّن من المطرب والأغنية، وللغرامافون يُكتب يدوياً
      d.title = music ? [d.artist, d.album].filter(Boolean).join(' — ') : $('#pTitle').value.trim();
      d.status = $('#pHidden').checked ? 'hidden' : stock < 1 ? 'sold' : 'active';
      if (music && !d.artist) return toast('اكتب اسم المطرب');
      if (music && !d.album) return toast(k === 'cd' ? 'اكتب اسم الأغنية أو الألبوم' : 'اكتب اسم الأغنية');
      if (!music && !d.title) return toast('اكتب اسم المنتج');
      if (!(Number(d.price) > 0)) return toast('اكتب السعر');
      if (!music && !d.brand) return toast('اكتب ماركة الغرامافون');
      if (d.year && (d.year < 1890 || d.year > yearNow)) return toast('سنة الإصدار غير صحيحة');
      if (!photos.length && !await confirmBox('لا توجد صور. المنتجات بصور حقيقية تُباع أسرع. الحفظ بدون صور؟', 'حفظ بدون صور')) return;
      busy(true, 'جارٍ الحفظ…');
      try { await API.saveProduct(d, photos.map(ph => ph.path ? { path: ph.path } : { blob: ph.blob })); toast('تم الحفظ'); App.go('#/seller'); }
      catch (err) { toast(err.message, 4500); } finally { busy(false); }
    };
    const del = $('#pDel');
    if (del) del.onclick = async () => {
      if (!await confirmBox('حذف هذا المنتج نهائياً؟ الطلبات السابقة تبقى محفوظة.', 'حذف', true)) return;
      busy(true); try { await API.deleteProduct(p); toast('حُذف المنتج'); App.go('#/seller'); } catch (err) { toast(err.message); } finally { busy(false); }
    };
  },

  async orders(view) {
    view.innerHTML = this.head('orders') + UI.loading();
    try {
      const rows = await API.sellerOrders();
      const live = rows.filter(o => o.status !== 'cancelled');
      const sum = st => live.filter(o => st.includes(o.status)).reduce((s, o) => s + o.seller_total, 0);
      view.innerHTML = this.head('orders') + `
        <div class="stats"><div class="stat"><small>طلبات</small><b>${live.length}</b></div><div class="stat"><small>قيد التوصيل</small><b>${live.filter(o => o.status !== 'delivered').length}</b></div>
          <div class="stat"><small>مبيعات مُسلَّمة</small><b style="font-size:16px">${fmtIQD(sum(['delivered']))}</b></div><div class="stat"><small>قيد التنفيذ</small><b style="font-size:16px">${fmtIQD(sum(['new', 'confirmed', 'with_courier']))}</b></div></div>
        <p class="notice">${icon('info')}<span>صاحب المتجر يتابع كل طلب مع شركة التوصيل. جهّز القطع المطلوبة عند تأكيد الطلب.</span></p>
        <div class="list" style="margin-top:12px">${rows.length ? rows.map(o => `<div class="card" style="margin:0">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b class="num">${esc(o.code)}</b>${UI.orderPill(o.status)}<span style="flex:1"></span><span class="muted small">${fmtDate(o.created_at)} · ${esc(o.governorate)}</span></div>
          <div class="order-items">${o.items.map(i => `<div><span>${esc(i.title)}${i.qty > 1 ? ` × ${i.qty}` : ''}</span><span>${fmtIQD(i.price * i.qty)}</span></div>`).join('')}</div></div>`).join('')
          : UI.empty('receipt', 'لا توجد طلبات بعد', 'عندما يطلب زبون أحد منتجاتك يظهر الطلب هنا.')}</div>`;
    } catch (e) { view.innerHTML = this.head('orders') + UI.error(e); }
  }
};
