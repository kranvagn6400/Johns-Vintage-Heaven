'use strict';
/* ================= واجهة الزبون: الرئيسية، المتجر، المنتج، السلة، الطلب، التتبع ================= */
const Shop = {
  /* ---------- الرئيسية ---------- */
  async home(view) {
    const s = App.settings;
    view.innerHTML = `<section class="hero">
        <div><h1><span>Johns</span> <span>Vintage</span> <span>Heaven</span></h1><p>${esc(s.tagline || 'أسطوانات وغرامافونات من الزمن الجميل')}</p></div>
        <div class="hero-art">${UI.art({ id: 'hero', kind: 'record', label: 'var(--gold-2)' }, true)}</div>
      </section>
      <form class="searchbar" id="homeSearch"><input class="input" id="hq" type="search" placeholder="ابحث عن فنان أو أغنية…" enterkeyhint="search">
        <button class="btn btn-primary" type="submit" aria-label="بحث">${icon('search')}</button></form>
      <div id="kinds">${UI.loading()}</div>
      <div class="dash-grid" style="margin-top:26px">
        <div class="card"><h3>${icon('truck')} توصيل لكل العراق</h3><p class="muted small">التوصيل لكل المحافظات عبر شركة توصيل معتمدة، والدفع نقداً عند الاستلام.</p></div>
      </div>
      ${this.footer()}`;
    $('#homeSearch').onsubmit = e => { e.preventDefault(); App.go('#/shop?q=' + encodeURIComponent($('#hq').value.trim())); };
    try {
      // «وصل حديثاً» لكل قسم (القسم الفارغ لا يظهر)
      const kinds = ['record', 'cd', 'gramophone'];
      const per = await Promise.all(kinds.map(kind => API.products({ kind, limit: 4 })));
      $('#kinds').innerHTML = kinds.map((k, i) => per[i].rows.length ? `<div class="section"><h2>${KIND_PLURAL[k]} — وصل حديثاً</h2><a href="#/shop?kind=${k}">عرض الكل</a></div>
        <div class="grid">${per[i].rows.map(p => UI.card(p)).join('')}</div>` : '').join('')
        || UI.empty('disc', 'لا توجد منتجات بعد', 'ستظهر هنا المنتجات فور إضافتها.');
    } catch (e) { $('#kinds').innerHTML = UI.error(e); }
  },
  footer() {
    const s = App.settings;
    return `<footer class="foot"><div class="latin">${BRAND}</div>
      <div>${s.contact_phone ? `للتواصل: <span class="num">${esc(s.contact_phone)}</span>` : ''}</div></footer>`;
  },

  /* ---------- المتجر: بحث وتصفية ---------- */
  filters() {
    const p = App.params, f = {};
    for (const k of ['kind', 'q', 'genre', 'sort']) if (p.get(k)) f[k] = p.get(k);
    return f;
  },
  setFilters(f) {
    const q = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
    App.go('#/shop' + (q.toString() ? '?' + q : ''));
  },
  async list(view) {
    const f = this.filters();
    const kinds = csv(f.kind), genres = csv(f.genre);
    const title = kinds.length === 1 ? KIND_PLURAL[kinds[0]] : 'كل المنتجات';
    // شرائح التصفية: كل نوع منتج أو نوع موسيقى مختار له شريحة تُزال بلمسة
    const chips = [...(kinds.length > 1 ? kinds.map(v => ['kind', v, KIND_PLURAL[v]]) : []), ...genres.map(v => ['genre', v, v])];
    view.innerHTML = `<div class="page-head"><h1>${title}</h1></div>
      <div class="tabs">${[['', 'الكل'], ['record', 'أسطوانات'], ['cd', 'أقراص CD'], ['gramophone', 'غرامافونات']].map(([k, l]) =>
        `<a class="tab ${(f.kind || '') === k ? 'on' : ''}" href="#" data-kind="${k}">${l}</a>`).join('')}</div>
      <form class="shop-tools" id="sForm"><input class="input" id="sq" type="search" value="${esc(f.q || '')}" placeholder="ابحث عن فنان أو أغنية…" enterkeyhint="search">
        <button class="btn btn-ghost" type="button" id="openFilters">${icon('filter')} تصفية</button></form>
      ${chips.length ? `<div class="chips">${chips.map(([k, v, l]) => `<button class="chip" data-rm="${k}" data-v="${esc(v)}">${esc(l)} ${icon('x')}</button>`).join('')}</div>` : ''}
      <div id="results">${UI.loading()}</div>`;
    if (App.params.get('focus')) $('#sq').focus();
    $$('[data-kind]', view).forEach(a => a.onclick = e => { e.preventDefault(); this.setFilters({ ...f, kind: a.dataset.kind }); });
    $$('[data-rm]', view).forEach(b => b.onclick = () => {
      const k = b.dataset.rm; this.setFilters({ ...f, [k]: csv(f[k]).filter(v => v !== b.dataset.v).join(',') }); });
    $('#sForm').onsubmit = e => { e.preventDefault(); this.setFilters({ ...f, q: $('#sq').value.trim() }); };
    $('#openFilters').onclick = () => this.filterSheet(f);
    this.page = 0; this.loadPage(f, true);
  },
  async loadPage(f, first) {
    const box = $('#results'), limit = 24;
    try {
      const r = await API.products({ ...f, limit, offset: this.page * limit });
      if (first && !r.rows.length) { box.innerHTML = UI.empty('search', 'لا توجد نتائج', 'جرّب كلمات أخرى أو أزل بعض عوامل التصفية.'); return; }
      if (first) box.innerHTML = '<div class="grid" id="pgrid"></div><div id="more" style="text-align:center;margin-top:16px"></div>';
      $('#pgrid').insertAdjacentHTML('beforeend', r.rows.map(p => UI.card(p)).join(''));
      $('#more').innerHTML = r.more ? '<button class="btn btn-ghost" id="moreBtn">عرض المزيد</button>' : '';
      if (r.more) $('#moreBtn').onclick = () => { this.page++; $('#more').innerHTML = UI.loading(); this.loadPage(f, false); };
    } catch (e) { box.innerHTML = UI.error(e); }
  },
  // التصفية بمربعات اختيار فقط (بدون كتابة): نوع المنتج ونوع الموسيقى، ويمكن اختيار أكثر من واحد
  filterSheet(f) {
    const kinds = csv(f.kind), genres = csv(f.genre);
    const box = (name, v, label, on) => `<label class="check fbox"><input type="checkbox" name="${name}" value="${esc(v)}" ${on ? 'checked' : ''}> ${esc(label)}</label>`;
    openSheet(`<h2>تصفية النتائج</h2><form id="fForm" class="stack">
      <fieldset class="fgroup"><legend class="lbl">نوع المنتج</legend><div class="fboxes">
        ${['record', 'cd', 'gramophone'].map(k => box('kind', k, KIND_PLURAL[k], kinds.includes(k))).join('')}</div></fieldset>
      <fieldset class="fgroup"><legend class="lbl">نوع الموسيقى</legend><div class="fboxes">
        ${GENRES.map(g => box('genre', g, g, genres.includes(g))).join('')}</div></fieldset>
      <div class="row-btns"><button class="btn btn-primary" type="submit">عرض النتائج</button><button class="btn btn-ghost" type="button" id="fClear">مسح الكل</button></div>
    </form>`);
    const picked = name => $$(`#fForm input[name="${name}"]:checked`).map(x => x.value).join(',');
    $('#fForm').onsubmit = e => { e.preventDefault(); this.setFilters({ ...f, kind: picked('kind'), genre: picked('genre') }); };
    $('#fClear').onclick = () => this.setFilters({ q: f.q });
  },

  /* ---------- صفحة المنتج ---------- */
  async product(view, id) {
    view.innerHTML = UI.loading();
    let p;
    try { p = await API.product(id); } catch (e) { view.innerHTML = UI.error(e); return; }
    if (!p) { view.innerHTML = UI.empty('disc', 'المنتج غير موجود', 'ربما بيع أو أُزيل.', '<a class="btn btn-primary" href="#/shop">تصفّح المتجر</a>'); return; }
    const sold = p.status !== 'active' || p.stock < 1;
    const rec = isMusic(p.kind);   // أسطوانة أو CD: لهما مطرب وأغنية
    const specs = rec ? [['المطرب', p.artist], [p.kind === 'cd' ? 'الأغنية / الألبوم' : 'الأغنية', p.album], ['السنة', p.year], ['النوع', p.genre],
      ['السرعة', p.speed && p.speed + ' لفة'], ['الحجم', p.size && p.size + ' إنش']]
      : [['الماركة', p.brand], ['الموديل', p.model]];
    const photos = p.photos || [];
    view.innerHTML = `<div class="page-head"><button class="back-btn" onclick="history.length > 1 ? history.back() : App.go('#/shop')" aria-label="رجوع">${icon('back')}</button>
        <span class="muted small">${KIND_NAMES[p.kind]}</span></div>
      <div class="pd">
        <div><div class="gallery-main" id="gMain">${UI.photo(p, 0)}</div>
          ${photos.length > 1 ? `<div class="gallery-thumbs">${photos.map((ph, i) => `<button class="${i ? '' : 'on'}" data-g="${i}"><img src="${esc(API.photoUrl(ph))}" alt=""></button>`).join('')}</div>` : ''}</div>
        <div class="pd-info">
          <h1>${esc(p.title)}</h1>
          <p class="muted">${UI.meta(p)}</p>
          <div class="pd-price">${fmtIQD(p.price)}</div>
          ${sold ? '<div class="notice bad">' + icon('info') + '<span>نفذت الكمية.</span></div>' : `
            <div class="row-btns" style="align-items:center">
              ${p.stock > 1 ? `<div class="qty"><button type="button" data-q="1" aria-label="زيادة">${icon('plus')}</button><span id="pq">1</span><button type="button" data-q="-1" aria-label="إنقاص">${icon('minus')}</button></div>` : ''}
              <button class="btn btn-primary" id="addCart" style="flex:1">${icon('cart')} أضف إلى السلة</button></div>`}
          <div class="pd-specs">${specs.filter(x => x[1]).map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
          ${p.description ? `<h3 style="font-size:15px;margin-bottom:6px">الوصف</h3><p style="white-space:pre-line">${esc(p.description)}</p>` : ''}
          
        </div></div>
      <div id="related"></div>`;
    $$('[data-g]', view).forEach(b => b.onclick = () => { $('#gMain').innerHTML = UI.photo(p, +b.dataset.g); $$('[data-g]', view).forEach(x => x.classList.toggle('on', x === b)); });
    let q = 1;
    $$('[data-q]', view).forEach(b => b.onclick = () => { q = Math.max(1, Math.min(p.stock, q + +b.dataset.q)); $('#pq').textContent = q; });
    const add = $('#addCart');
    if (add) add.onclick = () => {
      if (Cart.qty(p.id) + q > p.stock) { toast('وصلت للحد المتوفر من هذه القطعة'); return; }
      Cart.add(p.id, q, p.stock);
      openSheet(`<div style="text-align:center;padding:6px 0"><div class="success" style="padding:8px"><div class="seal">${icon('check')}</div>
        <h2 style="padding:0">أُضيف إلى السلة</h2><p class="muted">${esc(p.title)}</p></div>
        <div class="row-btns"><a class="btn btn-primary" href="#/cart">إتمام الطلب</a><a class="btn btn-ghost" href="#/shop?kind=${p.kind}">متابعة التسوّق</a></div></div>`, 'sheet-sm');
    };
    try {
      const r = await API.products({ kind: p.kind, ...(rec && p.artist ? { artist: p.artist } : {}), limit: 5 });
      let rows = r.rows.filter(x => x.id !== p.id);
      if (rows.length < 2) rows = (await API.products({ kind: p.kind, limit: 5 })).rows.filter(x => x.id !== p.id);
      if (rows.length) $('#related').innerHTML = `<div class="section"><h2>قد يعجبك أيضاً</h2></div><div class="grid">${rows.slice(0, 4).map(x => UI.card(x)).join('')}</div>`;
    } catch {}
  },

  /* ---------- السلة ---------- */
  async cartLines() {
    const ids = Cart.items.map(i => i.id);
    const prods = await API.productsByIds(ids);
    const lines = [], gone = [];
    for (const it of Cart.items) {
      const p = prods.find(x => x.id === it.id);
      if (!p || p.status !== 'active' || p.stock < 1) { gone.push(p ? p.title : 'منتج'); Cart.set(it.id, 0); continue; }
      if (it.qty > p.stock) Cart.set(p.id, p.stock);
      lines.push({ p, qty: Math.min(it.qty, p.stock) });
    }
    if (gone.length) toast('أُزيل من السلة لأنه لم يعد متوفراً: ' + gone.join('، '), 4500);
    return lines;
  },
  async cart(view) {
    view.innerHTML = `<div class="page-head"><h1>السلة</h1></div>${UI.loading()}`;
    let lines;
    try { lines = await this.cartLines(); } catch (e) { view.innerHTML = UI.error(e); return; }
    if (!lines.length) { view.innerHTML = `<div class="page-head"><h1>السلة</h1></div>` + UI.empty('cart', 'سلتك فارغة', 'تصفّح المتجر وأضف ما يعجبك.', '<a class="btn btn-primary" href="#/shop">تصفّح المتجر</a>'); return; }
    const sub = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const sellers = new Set(lines.map(l => l.p.seller_id)).size;
    view.innerHTML = `<div class="page-head"><h1>السلة</h1><span class="sp"></span><span class="muted small">${Cart.count()} قطعة</span></div>
      <div class="cart-layout"><div class="list">${lines.map(({ p, qty }) => `
        <div class="row"><a class="thumb" href="#/p/${p.id}">${UI.photo(p)}</a>
          <div class="grow"><h4>${esc(p.title)}</h4><div class="sub">${p.seller ? esc(p.seller.shop_name) + ' · ' : ''}${fmtIQD(p.price)}</div>
            ${p.stock > 1 ? `<div class="qty" style="margin-top:6px"><button data-inc="${p.id}" aria-label="زيادة">${icon('plus')}</button><span>${qty}</span><button data-dec="${p.id}" aria-label="إنقاص">${icon('minus')}</button></div>` : ''}</div>
          <button class="icon-btn" data-del="${p.id}" aria-label="حذف">${icon('trash')}</button></div>`).join('')}
        ${sellers > 1 ? `<p class="hint">${icon('info')} طلبك من ${sellers} بائعين، ويصلك في شحنة واحدة عبر شركة التوصيل.</p>` : ''}</div>
      <div class="card summary"><h3>ملخص الطلب</h3>
        <div class="sum-line"><span>المجموع</span><span>${fmtIQD(sub)}</span></div>
        <div class="sum-line muted"><span>التوصيل</span><span>يُحسب حسب المحافظة</span></div>
        <a class="btn btn-primary btn-block" href="#/checkout" style="margin-top:12px">متابعة الطلب</a></div></div>`;
    const stock = id => lines.find(l => l.p.id === id).p.stock;
    $$('[data-inc]', view).forEach(b => b.onclick = () => { const id = b.dataset.inc; Cart.set(id, Math.min(stock(id), Cart.qty(id) + 1)); this.cart(view); });
    $$('[data-dec]', view).forEach(b => b.onclick = () => { const id = b.dataset.dec; Cart.set(id, Math.max(1, Cart.qty(id) - 1)); this.cart(view); });
    $$('[data-del]', view).forEach(b => b.onclick = () => { Cart.set(b.dataset.del, 0); this.cart(view); });
  },

  /* ---------- إتمام الطلب ---------- */
  async checkout(view) {
    view.innerHTML = `<div class="page-head"><h1>إتمام الطلب</h1></div>${UI.loading()}`;
    let lines, fees;
    try { [lines, fees] = await Promise.all([this.cartLines(), App.getFees(true)]); } catch (e) { view.innerHTML = UI.error(e); return; }
    if (!lines.length) return App.go('#/cart');
    const me = API.me, last = store.get('last_address', {});
    const sub = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    view.innerHTML = `<div class="page-head"><a class="back-btn" href="#/cart" aria-label="رجوع">${icon('back')}</a><h1>إتمام الطلب</h1></div>
      <div class="cart-layout"><form id="coForm" class="stack" novalidate>
        <div class="card stack"><h3 style="margin:0">معلومات التوصيل</h3>
          <div><label class="lbl" for="cName">الاسم الكامل <span class="req">*</span></label><input class="input" id="cName" autocomplete="name" value="${esc(last.name || (me && me.full_name) || '')}" required></div>
          <div><label class="lbl" for="cPhone">رقم الهاتف <span class="req">*</span></label><input class="input num" id="cPhone" type="tel" inputmode="numeric" dir="ltr" placeholder="07XXXXXXXXX" maxlength="11" autocomplete="tel" value="${esc(last.phone || (me && me.phone) || '')}" required>
            <p class="hint">سيتصل بك المندوب على هذا الرقم.</p></div>
          <div><label class="lbl" for="cGov">المحافظة <span class="req">*</span></label>${UI.govSelect('cGov', last.governorate, fees)}</div>
          <div><label class="lbl" for="cAddr">العنوان بالتفصيل <span class="req">*</span></label><textarea class="input" id="cAddr" placeholder="المنطقة، الشارع، أقرب نقطة دالة" required>${esc(last.address || '')}</textarea></div>
          <div><label class="lbl" for="cNotes">ملاحظات (اختياري)</label><input class="input" id="cNotes" placeholder="مثال: الاتصال قبل الوصول"></div>
        </div>
        <div class="card stack"><h3 style="margin:0">طريقة الدفع</h3>
          <div class="pay-opt on">${icon('receipt')}<div><b>${PAYMENT_METHODS.cod}</b><small>ادفع نقداً للمندوب عند استلام طلبك</small></div></div>
          <div class="pay-opt off">${icon('phone')}<div><b>الدفع الإلكتروني</b><small>زين كاش · فاست باي · كي كارد — قريباً</small></div></div>
        </div>
        <p class="hint">${icon('info')} لا تحتاج حساباً. بعد الطلب يظهر لك رمز الطلب، احتفظ به لتتبّع طلبك.</p>
      </form>
      <div class="card summary"><h3>طلبك</h3>
        ${lines.map(({ p, qty }) => `<div class="sum-line"><span>${esc(p.title)}${qty > 1 ? ` × ${qty}` : ''}</span><span>${fmtIQD(p.price * qty)}</span></div>`).join('')}
        <div class="divider" style="margin:8px 0"></div>
        <div class="sum-line"><span>المجموع</span><span>${fmtIQD(sub)}</span></div>
        <div class="sum-line"><span>التوصيل</span><span id="feeTxt">اختر المحافظة</span></div>
        <div class="sum-line total"><span>الإجمالي</span><span id="totalTxt">${fmtIQD(sub)}</span></div>
        <button class="btn btn-primary btn-block" id="placeBtn" style="margin-top:12px">${icon('check')} تأكيد الطلب</button>
        <p class="hint" style="text-align:center">سيتواصل معك فريق المتجر لتأكيد الطلب.</p></div></div>`;
    const feeOf = g => { const f = fees.find(x => x.governorate === g); return f && f.active ? f.fee : null; };
    const upd = () => { const fee = feeOf($('#cGov').value); $('#feeTxt').textContent = fee == null ? 'اختر المحافظة' : fmtIQD(fee); $('#totalTxt').textContent = fmtIQD(sub + (fee || 0)); };
    $('#cGov').onchange = upd; upd();
    $('#cPhone').oninput = e => { e.target.value = normPhone(e.target.value).slice(0, 11); };
    const place = async () => {
      const d = { name: $('#cName').value.trim(), phone: $('#cPhone').value, governorate: $('#cGov').value, address: $('#cAddr').value.trim(), notes: $('#cNotes').value.trim(),
        items: lines.map(l => ({ id: l.p.id, qty: l.qty })) };
      if (!d.name) return toast('اكتب اسمك');
      if (!validPhone(d.phone)) return toast('اكتب رقم هاتف صحيح من 11 رقماً يبدأ بـ 07');
      if (!d.governorate) return toast('اختر المحافظة');
      if (!d.address) return toast('اكتب العنوان');
      busy(true, 'جارٍ إرسال الطلب…');
      try {
        const r = await API.placeOrder(d);
        store.set('last_address', { name: d.name, phone: normPhone(d.phone), governorate: d.governorate, address: d.address });
        store.set('last_order', { code: r.code, phone: normPhone(d.phone) });
        Cart.clear();
        App.go('#/done/' + r.code);
      } catch (e) { toast(e.message, 4500); }
      finally { busy(false); }
    };
    $('#placeBtn').onclick = place;
    $('#coForm').onsubmit = e => { e.preventDefault(); place(); };
  },
  done(view, code) {
    view.innerHTML = `<div class="card success" style="max-width:520px;margin:10px auto">
      <div class="seal">${icon('check')}</div><h1 style="font-size:22px">شكراً لك! وصل طلبك</h1>
      <p class="muted">رمز طلبك:</p><div class="code-box">${esc(code)}</div>
      <p class="muted small">احتفظ بهذا الرمز لتتبّع طلبك. سيتصل بك فريق المتجر لتأكيد الطلب، والدفع نقداً عند الاستلام.</p>
      <div class="row-btns" style="margin-top:18px"><a class="btn btn-primary" href="#/track">تتبّع الطلب</a><a class="btn btn-ghost" href="#/shop">متابعة التسوّق</a></div></div>`;
  },

  /* ---------- تتبع طلب (بدون حساب) ---------- */
  track(view) {
    const last = store.get('last_order', {});
    view.innerHTML = `<div class="page-head"><h1>تتبّع طلب</h1></div>
      <div class="dash-grid"><div class="card"><form id="tForm" class="stack">
        <div><label class="lbl" for="tCode">رمز الطلب</label><input class="input num" id="tCode" dir="ltr" inputmode="numeric" placeholder="مثال: 48213957" value="${esc(last.code || '')}"></div>
        <div><label class="lbl" for="tPhone">رقم الهاتف المستخدم في الطلب</label><input class="input num" id="tPhone" type="tel" inputmode="numeric" dir="ltr" maxlength="11" value="${esc(last.phone || '')}"></div>
        <button class="btn btn-primary" type="submit">${icon('search')} عرض حالة الطلب</button></form></div>
      <div id="tResult"></div></div>`;
    const run = async () => {
      const code = toLatinDigits($('#tCode').value).trim(), phone = $('#tPhone').value;
      if (!code || !validPhone(phone)) return toast('اكتب رمز الطلب ورقم الهاتف');
      $('#tResult').innerHTML = UI.loading();
      try {
        const r = await API.trackOrder(code, phone);
        $('#tResult').innerHTML = r && r.order ? this.orderCard({ ...r.order, items: r.items, events: r.events }) : UI.empty('search', 'لم نجد طلباً بهذه البيانات', 'تأكد من الرمز ورقم الهاتف.');
      } catch (e) { $('#tResult').innerHTML = UI.error(e); }
    };
    $('#tForm').onsubmit = e => { e.preventDefault(); run(); };
    if (last.code && last.phone) run();
  },
  orderCard(o, opts = {}) {
    return `<div class="card"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <h3 style="margin:0" class="num">${esc(o.code)}</h3>${UI.orderPill(o.status)}</div>
      <div class="order-items">${(o.items || []).map(i => `<div><span>${esc(i.title)}${i.qty > 1 ? ` × ${i.qty}` : ''}</span><span>${fmtIQD(i.price * i.qty)}</span></div>`).join('')}
        <div class="muted"><span>التوصيل (${esc(o.governorate)})</span><span>${fmtIQD(o.delivery_fee)}</span></div>
        <div style="font-weight:800"><span>الإجمالي · ${PAYMENT_METHODS[o.payment_method]}</span><span>${fmtIQD(o.total)}</span></div></div>
      ${UI.timeline(o, o.events || [])}
      ${opts.cancel && o.status === 'new' ? `<button class="btn btn-danger btn-sm" data-cancel="${o.id}">إلغاء الطلب</button>` : ''}</div>`;
  },
  async myOrders(view) {
    view.innerHTML = `<div class="page-head"><h1>طلباتي</h1></div>${UI.loading()}`;
    try {
      const rows = await API.myOrders();
      view.innerHTML = `<div class="page-head"><h1>طلباتي</h1></div>` + (rows.length ? rows.map(o => this.orderCard(o, { cancel: true })).join('')
        : UI.empty('receipt', 'لا توجد طلبات بعد', 'الطلبات التي ترسلها وأنت مسجّل الدخول تظهر هنا.', '<a class="btn btn-primary" href="#/shop">تصفّح المتجر</a>'));
      $$('[data-cancel]', view).forEach(b => b.onclick = async () => {
        if (!await confirmBox('إلغاء هذا الطلب؟', 'إلغاء الطلب', true)) return;
        busy(true); try { await API.setOrderStatus(b.dataset.cancel, 'cancelled', 'ألغاه الزبون'); toast('أُلغي الطلب'); this.myOrders(view); } catch (e) { toast(e.message); } finally { busy(false); }
      });
    } catch (e) { view.innerHTML = UI.error(e); }
  }
};
