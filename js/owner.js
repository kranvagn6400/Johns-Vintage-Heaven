'use strict';
/* ================= إدارة المتجر (صاحب المتجر، والمشرف للدعم): الطلبات، البائعون، التوصيل، المبيعات ================= */
const Owner = {
  orders: [],
  route(view) {
    const tab = App.params.get('tab') || 'orders';
    const head = `<div class="page-head"><h1>إدارة المتجر</h1></div>
      <div class="tabs">${[['orders', 'الطلبات', 'receipt'], ['sellers', 'البائعون', 'users'], ['fees', 'رسوم التوصيل', 'truck'], ['sales', 'المبيعات', 'chart']]
        .map(([k, l, ic]) => `<a class="tab ${tab === k ? 'on' : ''}" href="#/owner?tab=${k}">${icon(ic)} ${l}<span class="n hidden" data-n="${k}"></span></a>`).join('')}</div><div id="ownerBody">${UI.loading()}</div>`;
    view.innerHTML = head;
    const body = $('#ownerBody');
    ({ orders: () => this.ordersTab(body), sellers: () => this.sellersTab(body), fees: () => this.feesTab(body), sales: () => this.salesTab(body) }[tab] || (() => this.ordersTab(body)))();
    this.pendingCounts();
  },
  async pendingCounts() {
    try {
      const [o, s] = await Promise.all([API.allOrders({ status: 'new' }), API.sellers()]);
      const set = (k, n) => { const el = $(`[data-n="${k}"]`); if (el) { el.textContent = n; el.classList.toggle('hidden', !n); } };
      set('orders', o.length); set('sellers', s.filter(x => x.status === 'pending').length);
    } catch {}
  },

  /* ---------- الطلبات ---------- */
  async ordersTab(body) {
    const st = App.params.get('status') || 'active';
    try { this.orders = await API.allOrders(); } catch (e) { body.innerHTML = UI.error(e); return; }
    const all = this.orders;
    const groups = { active: o => !['delivered', 'cancelled'].includes(o.status), new: o => o.status === 'new', confirmed: o => o.status === 'confirmed',
      with_courier: o => o.status === 'with_courier', delivered: o => o.status === 'delivered', cancelled: o => o.status === 'cancelled', all: () => true };
    const names = { active: 'قيد التنفيذ', ...ORDER_STATUS, all: 'الكل' };
    const q = normAr(App.params.get('q') || '');
    const rows = all.filter(groups[st] || groups.active).filter(o => !q || [o.code, o.name, o.phone, o.governorate].some(x => normAr(x).includes(q)));
    body.innerHTML = `<div class="tabs">${Object.keys(groups).map(k => `<a class="tab ${st === k ? 'on' : ''}" href="#/owner?tab=orders&status=${k}">${names[k]} <span class="n">${all.filter(groups[k]).length}</span></a>`).join('')}</div>
      <form class="shop-tools" id="oSearch"><input class="input" id="oq" type="search" placeholder="بحث برمز الطلب، الاسم، الهاتف، المحافظة" value="${esc(App.params.get('q') || '')}"></form>
      <div class="list">${rows.length ? rows.map(o => `<div class="row row-click" data-o="${o.id}">
          <div class="grow"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b class="num">${esc(o.code)}</b>${UI.orderPill(o.status)}</div>
            <div class="sub">${esc(o.name)} · ${esc(o.governorate)} · ${o.items.length} قطعة · ${fmtDate(o.created_at)}</div></div>
          <b style="color:var(--wine);white-space:nowrap">${fmtIQD(o.total)}</b></div>`).join('')
        : UI.empty('receipt', 'لا توجد طلبات هنا')}</div>`;
    $('#oSearch').onsubmit = e => { e.preventDefault(); App.go(`#/owner?tab=orders&status=${st}&q=${encodeURIComponent($('#oq').value.trim())}`); };
    $$('[data-o]', body).forEach(r => r.onclick = () => this.orderSheet(this.orders.find(o => o.id === r.dataset.o)));
  },
  orderSheet(o) {
    const at = ORDER_FLOW.indexOf(o.status), next = ORDER_FLOW[at + 1];
    const final = ['delivered', 'cancelled'].includes(o.status);
    const bySeller = {};
    for (const i of o.items) (bySeller[i.seller ? i.seller.shop_name : 'بائع محذوف'] ||= []).push(i);
    const courier = App.settings.courier_name || 'شركة التوصيل';
    openSheet(`<h2>طلب <span class="num">${esc(o.code)}</span> ${UI.orderPill(o.status)}</h2>
      <div class="card"><dl class="kv">
        <dt>الزبون</dt><dd>${esc(o.name)}</dd>
        <dt>الهاتف</dt><dd><a class="num" href="tel:${esc(o.phone)}" style="color:var(--wine)">${esc(o.phone)}</a></dd>
        <dt>المحافظة</dt><dd>${esc(o.governorate)}</dd>
        <dt>العنوان</dt><dd>${esc(o.address)}</dd>
        ${o.notes ? `<dt>ملاحظات</dt><dd>${esc(o.notes)}</dd>` : ''}
        <dt>الدفع</dt><dd>${PAYMENT_METHODS[o.payment_method]} · ${PAYMENT_STATUS[o.payment_status]}</dd>
        <dt>التاريخ</dt><dd>${fmtDate(o.created_at)}</dd>
        ${o.customer_id ? '' : '<dt>الحساب</dt><dd>طلب بدون حساب</dd>'}
      </dl></div>
      <div class="card">${Object.entries(bySeller).map(([shop, items]) => `<div class="small muted" style="margin-top:4px">${icon('store')} ${esc(shop)}</div>
        <div class="order-items">${items.map(i => `<div><span>${esc(i.title)}${i.qty > 1 ? ` × ${i.qty}` : ''}</span><span>${fmtIQD(i.price * i.qty)}</span></div>`).join('')}</div>`).join('')}
        <div class="sum-line"><span>المجموع</span><span>${fmtIQD(o.subtotal)}</span></div>
        <div class="sum-line"><span>التوصيل</span><span>${fmtIQD(o.delivery_fee)}</span></div>
        <div class="sum-line total"><span>الإجمالي (نقداً)</span><span>${fmtIQD(o.total)}</span></div></div>
      <div class="card stack">
        <h3 style="margin:0">${icon('truck')} ${esc(courier)}</h3>
        <div><label class="lbl" for="oRef">رقم الشحنة لدى شركة التوصيل</label><input class="input num" id="oRef" dir="ltr" value="${esc(o.courier_ref || '')}" ${final ? 'disabled' : ''}></div>
        ${final ? '' : `<div><label class="lbl" for="oNote">ملاحظة (اختياري)</label><input class="input" id="oNote" placeholder="تظهر في سجل الطلب"></div>
        <div class="status-btns">
          ${next ? `<button class="btn btn-primary" data-st="${next}">${icon(next === 'with_courier' ? 'truck' : 'check')} ${{ confirmed: 'تأكيد الطلب', with_courier: 'سُلِّم لشركة التوصيل', delivered: 'تم التسليم للزبون' }[next]}</button>` : ''}
          <button class="btn btn-ghost" data-st="${o.status}">حفظ رقم الشحنة</button>
          <button class="btn btn-danger" data-st="cancelled">إلغاء الطلب</button></div>`}
      </div>
      <div class="card"><h3>سجل الطلب</h3>${(o.events || []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at)).map(e =>
        `<div class="sum-line"><span>${UI.orderPill(e.status)} ${esc(e.note || '')}</span><span class="muted small">${fmtDate(e.created_at)}</span></div>`).join('') || '<p class="muted small">—</p>'}</div>`);
    $$('[data-st]', $('#sheetBody')).forEach(b => b.onclick = async () => {
      const s = b.dataset.st;
      if (s === 'cancelled' && !await confirmBox('إلغاء هذا الطلب؟ تعود القطع للعرض في المتجر.', 'إلغاء الطلب', true)) return this.orderSheet(o);
      const note = $('#oNote') ? $('#oNote').value.trim() : '', ref = $('#oRef') ? $('#oRef').value.trim() : '';
      busy(true);
      try { await API.setOrderStatus(o.id, s, note, ref); toast('تم التحديث'); closeSheet(); App.route(); }
      catch (e) { toast(e.message); } finally { busy(false); }
    });
  },

  /* ---------- البائعون ---------- */
  async sellersTab(body) {
    let rows;
    try { rows = await API.sellers(); } catch (e) { body.innerHTML = UI.error(e); return; }
    const order = { pending: 0, approved: 1, suspended: 2, rejected: 3 };
    rows.sort((a, b) => order[a.status] - order[b.status]);
    body.innerHTML = rows.length ? `<div class="list">${rows.map(s => `<div class="row" style="flex-wrap:wrap">
        <div class="thumb" style="display:flex;align-items:center;justify-content:center;color:var(--gold)">${icon('store')}</div>
        <div class="grow"><h4>${esc(s.shop_name || '—')} <span class="pill st-${s.status}">${SELLER_STATUS[s.status]}</span></h4>
          <div class="sub">${esc(s.profile ? s.profile.full_name : '')} · <a class="num" href="tel:${esc(s.profile ? s.profile.phone : '')}">${esc(s.profile ? s.profile.phone : '')}</a> · منذ ${fmtDay(s.created_at)}</div>
          ${s.bio ? `<div class="sub">${esc(s.bio)}</div>` : ''}</div>
        <div class="status-btns">
          ${s.status !== 'approved' ? `<button class="btn btn-primary btn-sm" data-ss="approved" data-id="${s.id}">${icon('check')} موافقة</button>` : ''}
          ${s.status === 'pending' ? `<button class="btn btn-danger btn-sm" data-ss="rejected" data-id="${s.id}">رفض</button>` : ''}
          ${s.status === 'approved' ? `<button class="btn btn-ghost btn-sm" data-ss="suspended" data-id="${s.id}">إيقاف</button>` : ''}
        </div></div>`).join('')}</div>` : UI.empty('users', 'لا يوجد بائعون بعد', 'عندما يسجّل أحد كبائع يظهر هنا لتوافق عليه.');
    $$('[data-ss]', body).forEach(b => b.onclick = async () => {
      const s = b.dataset.ss;
      if (s !== 'approved' && !await confirmBox(s === 'suspended' ? 'إيقاف هذا البائع؟ تختفي منتجاته من المتجر.' : 'رفض طلب هذا البائع؟', 'تأكيد', true)) return;
      busy(true); try { await API.setSellerStatus(b.dataset.id, s); toast('تم'); App.route(); } catch (e) { toast(e.message); } finally { busy(false); }
    });
  },

  /* ---------- رسوم التوصيل ---------- */
  async feesTab(body) {
    let fees;
    try { fees = await App.getFees(true); } catch (e) { body.innerHTML = UI.error(e); return; }
    const get = g => fees.find(f => f.governorate === g) || { governorate: g, fee: 0, active: false };
    body.innerHTML = `<div class="card" style="max-width:640px">
      <p class="notice">${icon('info')}<span>رسوم توصيل ثابتة لكل محافظة تُضاف إلى الطلب. أطفئ المحافظة لإيقاف التوصيل إليها.</span></p>
      <div class="grid2" style="margin:12px 0 4px"><input class="input num" id="allFee" inputmode="numeric" placeholder="سعر موحّد للكل"><button class="btn btn-ghost" id="applyAll">تطبيق على الكل</button></div>
      <div id="feeRows">${GOVERNORATES.map(g => { const f = get(g); return `<div class="fee-row"><b>${g}</b>
        <input class="input num" inputmode="numeric" data-fee="${g}" value="${f.fee}"><label class="check"><input type="checkbox" data-act="${g}" ${f.active ? 'checked' : ''}> متاح</label></div>`; }).join('')}</div>
      <button class="btn btn-primary btn-block" id="saveFees" style="margin-top:14px">${icon('check')} حفظ الرسوم</button></div>`;
    $$('[data-fee]', body).forEach(i => i.oninput = () => { i.value = toLatinDigits(i.value).replace(/\D/g, ''); });
    $('#applyAll').onclick = () => { const v = toLatinDigits($('#allFee').value).replace(/\D/g, ''); if (v) $$('[data-fee]', body).forEach(i => i.value = v); };
    $('#saveFees').onclick = async () => {
      const rows = GOVERNORATES.map(g => ({ governorate: g, fee: Number($(`[data-fee="${g}"]`).value || 0), active: $(`[data-act="${g}"]`).checked }));
      busy(true); try { await API.saveFees(rows); App.fees = null; toast('حُفظت رسوم التوصيل'); } catch (e) { toast(e.message); } finally { busy(false); }
    };
  },

  /* ---------- المبيعات ---------- */
  async salesTab(body) {
    let all;
    try { all = await API.allOrders(); } catch (e) { body.innerHTML = UI.error(e); return; }
    const days = Number(App.params.get('days') || 30);
    const since = days ? Date.now() - days * 864e5 : 0;
    const rows = all.filter(o => new Date(o.created_at).getTime() >= since);
    const delivered = rows.filter(o => o.status === 'delivered'), open = rows.filter(o => !['delivered', 'cancelled'].includes(o.status));
    const sum = (list, k) => list.reduce((s, o) => s + o[k], 0);
    const bySeller = {};
    for (const o of rows.filter(o => o.status !== 'cancelled')) for (const i of o.items) {
      const k = i.seller ? i.seller.shop_name : 'بائع محذوف';
      const b = bySeller[k] ||= { delivered: 0, open: 0, n: 0 };
      b[o.status === 'delivered' ? 'delivered' : 'open'] += i.price * i.qty; b.n += i.qty;
    }
    const sellers = Object.entries(bySeller).sort((a, b) => (b[1].delivered + b[1].open) - (a[1].delivered + a[1].open));
    const max = Math.max(1, ...sellers.map(([, v]) => v.delivered + v.open));
    body.innerHTML = `<div class="tabs">${[[7, '7 أيام'], [30, '30 يوماً'], [90, '3 أشهر'], [0, 'كل الوقت']].map(([d, l]) =>
        `<a class="tab ${days === d ? 'on' : ''}" href="#/owner?tab=sales&days=${d}">${l}</a>`).join('')}</div>
      <div class="stats">
        <div class="stat"><small>مبيعات مُسلَّمة</small><b>${fmtIQD(sum(delivered, 'subtotal'))}</b></div>
        <div class="stat"><small>قيد التنفيذ</small><b>${fmtIQD(sum(open, 'subtotal'))}</b></div>
        <div class="stat"><small>طلبات مُسلَّمة</small><b>${delivered.length}</b></div>
        <div class="stat"><small>ملغاة</small><b>${rows.filter(o => o.status === 'cancelled').length}</b></div></div>
      <div class="dash-grid">
        <div class="card"><h3>حسب البائع</h3>${sellers.length ? sellers.map(([k, v]) => `<div style="margin:10px 0">
          <div class="sum-line" style="padding:0"><b>${esc(k)}</b><span>${fmtIQD(v.delivered + v.open)}</span></div>
          <div class="bar"><span style="width:${Math.round((v.delivered + v.open) / max * 100)}%"></span></div>
          <div class="small muted">مُسلَّم ${fmtIQD(v.delivered)} · قيد التنفيذ ${fmtIQD(v.open)} · ${v.n} قطعة</div></div>`).join('') : '<p class="muted small">لا توجد مبيعات في هذه الفترة.</p>'}</div>
        <div class="card"><h3>ملخص</h3><dl class="kv">
          <dt>كل الطلبات</dt><dd>${rows.length}</dd>
          <dt>رسوم توصيل (مُسلَّمة)</dt><dd>${fmtIQD(sum(delivered, 'delivery_fee'))}</dd>
          <dt>نقد مع المندوب الآن</dt><dd>${fmtIQD(sum(rows.filter(o => o.status === 'with_courier'), 'total'))}</dd>
          <dt>متوسط قيمة الطلب</dt><dd>${fmtIQD(delivered.length ? Math.round(sum(delivered, 'subtotal') / delivered.length) : 0)}</dd></dl>
          <p class="hint">المبالغ بدون رسوم التوصيل ما لم يُذكر غير ذلك. لا توجد عمولة على البائعين في المرحلة الحالية.</p></div></div>`;
  }
};
