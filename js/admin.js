'use strict';
/* ================= لوحة المشرف التقني: الحسابات والأدوار، إعدادات المتجر، حالة النظام ================= */
const APP_VERSION = 1;
const Admin = {
  route(view) {
    const tab = App.params.get('tab') || 'users';
    view.innerHTML = `<div class="page-head"><h1>لوحة المشرف</h1></div>
      <div class="tabs">${[['users', 'الحسابات', 'users'], ['settings', 'إعدادات المتجر', 'settings'], ['system', 'النظام', 'shield']]
        .map(([k, l, ic]) => `<a class="tab ${tab === k ? 'on' : ''}" href="#/admin?tab=${k}">${icon(ic)} ${l}</a>`).join('')}
        <a class="tab" href="#/owner">${icon('chart')} إدارة المتجر</a></div><div id="adminBody">${UI.loading()}</div>`;
    const body = $('#adminBody');
    ({ users: () => this.users(body), settings: () => this.settings(body), system: () => this.system(body) }[tab] || (() => this.users(body)))();
  },

  async users(body) {
    let rows;
    try { rows = await API.users(); } catch (e) { body.innerHTML = UI.error(e); return; }
    const role = App.params.get('role') || '';
    const list = rows.filter(u => !role || u.role === role);
    body.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <select class="input" id="roleF" style="flex:1;min-width:160px"><option value="">كل الأدوار (${rows.length})</option>
          ${Object.keys(ROLE_NAMES).map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>${ROLE_NAMES[r]} (${rows.filter(u => u.role === r).length})</option>`).join('')}</select>
        <button class="btn btn-primary" id="newUser">${icon('plus')} حساب جديد</button></div>
      <div class="list">${list.map(u => `<div class="row row-click" data-u="${u.id}">
        <div class="thumb" style="display:flex;align-items:center;justify-content:center;color:var(--wine)">${icon(u.role === 'seller' ? 'store' : u.role === 'admin' ? 'shield' : 'user')}</div>
        <div class="grow"><h4>${esc(u.full_name || '—')} ${u.id === API.me.id ? '<span class="pill">أنت</span>' : ''}</h4><div class="sub num" style="text-align:right">${esc(u.phone)}</div></div>
        <span class="pill ${u.role === 'disabled' ? 'st-cancelled' : ''}">${ROLE_NAMES[u.role] || u.role}</span></div>`).join('') || UI.empty('users', 'لا توجد حسابات')}</div>`;
    $('#roleF').onchange = e => App.go('#/admin?tab=users' + (e.target.value ? '&role=' + e.target.value : ''));
    $('#newUser').onclick = () => this.newUser();
    $$('[data-u]', body).forEach(r => r.onclick = () => this.userSheet(rows.find(u => u.id === r.dataset.u)));
  },
  userSheet(u) {
    openSheet(`<h2>${esc(u.full_name || 'حساب')}</h2>
      <div class="card"><dl class="kv"><dt>الهاتف</dt><dd class="num" style="text-align:right">${esc(u.phone)}</dd><dt>منذ</dt><dd>${fmtDay(u.created_at)}</dd>
        <dt>الدور الحالي</dt><dd>${ROLE_NAMES[u.role]}</dd></dl></div>
      <div class="card stack"><label class="lbl" for="uRole">تغيير الدور</label>
        <select class="input" id="uRole">${UI.options(Object.keys(ROLE_NAMES), u.role, ROLE_NAMES)}</select>
        <p class="hint">صاحب المتجر: يدير الطلبات والبائعين ورسوم التوصيل. البائع الجديد يحتاج موافقة صاحب المتجر. «موقوف» يمنع الدخول.</p>
        <button class="btn btn-primary" id="saveRole">حفظ</button></div>`, 'sheet-sm');
    $('#saveRole').onclick = async () => {
      const r = $('#uRole').value; if (r === u.role) return closeSheet();
      if (u.id === API.me.id && !await confirmBox('ستفقد صلاحيات المشرف على حسابك. متابعة؟', 'متابعة', true)) return;
      busy(true);
      try { await API.setRole(u.id, r); toast('تم تغيير الدور'); if (u.id === API.me.id) await API.restore(); closeSheet(); App.route(); }
      catch (e) { toast(e.message); } finally { busy(false); }
    };
  },
  newUser() {
    openSheet(`<h2>حساب جديد</h2><form id="nuForm" class="stack" novalidate>
      <div><label class="lbl" for="nuName">الاسم</label><input class="input" id="nuName" required></div>
      <div><label class="lbl" for="nuPhone">رقم الهاتف (يستخدمه للدخول)</label><input class="input num" id="nuPhone" type="tel" inputmode="numeric" dir="ltr" maxlength="11" placeholder="07XXXXXXXXX"></div>
      <div><label class="lbl" for="nuPass">كلمة مرور مؤقتة</label><input class="input" id="nuPass" dir="ltr" autocomplete="new-password" minlength="6"><p class="hint">أعطها لصاحب الحساب ليغيّرها من «حسابي».</p></div>
      <div><label class="lbl" for="nuRole">الدور</label><select class="input" id="nuRole">${UI.options(['owner', 'seller', 'customer', 'admin'], 'owner', ROLE_NAMES)}</select></div>
      <div id="nuShopW" class="hidden"><label class="lbl" for="nuShop">اسم المتجر</label><input class="input" id="nuShop"><p class="hint">البائع الذي ينشئه المشرف يُعتمد مباشرة.</p></div>
      <button class="btn btn-primary" type="submit">إنشاء الحساب</button></form>`, 'sheet-sm');
    $('#nuRole').onchange = e => $('#nuShopW').classList.toggle('hidden', e.target.value !== 'seller');
    $('#nuPhone').oninput = e => { e.target.value = normPhone(e.target.value).slice(0, 11); };
    $('#nuForm').onsubmit = async e => {
      e.preventDefault();
      const d = { full_name: $('#nuName').value.trim(), phone: $('#nuPhone').value, password: $('#nuPass').value, role: $('#nuRole').value, shop_name: $('#nuShop').value.trim() };
      if (!d.full_name) return toast('اكتب الاسم');
      if (!validPhone(d.phone)) return toast('رقم الهاتف غير صحيح');
      if (d.password.length < 6) return toast('كلمة المرور 6 أحرف على الأقل');
      busy(true, 'جارٍ إنشاء الحساب…');
      try { await API.createUser(d); toast('أُنشئ الحساب'); closeSheet(); App.route(); } catch (err) { toast(err.message); } finally { busy(false); }
    };
  },

  async settings(body) {
    let s;
    try { s = await API.settings(); } catch (e) { body.innerHTML = UI.error(e); return; }
    body.innerHTML = `<form id="setForm" class="card stack" style="max-width:640px">
      <div><label class="lbl" for="sTag">العبارة تحت اسم المتجر (الصفحة الرئيسية)</label><input class="input" id="sTag" value="${esc(s.tagline || '')}"></div>
      <div><label class="lbl" for="sAnn">شريط الإعلان أعلى الموقع</label><input class="input" id="sAnn" value="${esc(s.announcement || '')}" placeholder="اتركه فارغاً لإخفائه"></div>
      <div><label class="lbl" for="sPhone">رقم التواصل مع المتجر</label><input class="input num" id="sPhone" dir="ltr" inputmode="numeric" value="${esc(s.contact_phone || '')}"></div>
      <div><label class="lbl" for="sCourier">اسم شركة التوصيل</label><input class="input" id="sCourier" value="${esc(s.courier_name || '')}"></div>
      <button class="btn btn-primary" type="submit">${icon('check')} حفظ الإعدادات</button></form>`;
    $('#setForm').onsubmit = async e => {
      e.preventDefault(); busy(true);
      try {
        await API.saveSettings({ tagline: $('#sTag').value.trim(), announcement: $('#sAnn').value.trim(), contact_phone: normPhone($('#sPhone').value), courier_name: $('#sCourier').value.trim() });
        await App.loadSettings(); toast('حُفظت الإعدادات');
      } catch (err) { toast(err.message); } finally { busy(false); }
    };
  },

  system(body) {
    const demo = API.mode === 'demo';
    body.innerHTML = `<div class="dash-grid"><div class="card"><h3>حالة الربط</h3><dl class="kv">
        <dt>الوضع</dt><dd>${demo ? '<span class="pill st-pending">تجريبي (محلي)</span>' : '<span class="pill st-approved">Supabase</span>'}</dd>
        ${demo ? '' : `<dt>المشروع</dt><dd class="num" style="text-align:right;word-break:break-all">${esc(SupaAPI.base)}</dd>`}
        <dt>إصدار التطبيق</dt><dd>${APP_VERSION}</dd>
        <dt>الدفع</dt><dd>عند الاستلام فقط (الدفع الإلكتروني: المرحلة الثانية)</dd></dl></div>
      <div class="card"><h3>ملاحظات</h3><p class="small muted">${demo
        ? 'الموقع يعمل الآن بقاعدة بيانات تجريبية داخل هذا المتصفح. لتشغيله فعلياً: أنشئ مشروع Supabase، شغّل supabase-setup.sql، ثم ضع الرابط والمفتاح العام في config.js.'
        : 'إدارة الأدوار هنا. الطلبات والبائعون ورسوم التوصيل من «إدارة المتجر». المشرف لا يتعامل مع الأموال.'}</p></div></div>`;
  }
};
