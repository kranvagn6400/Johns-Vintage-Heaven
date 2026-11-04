'use strict';
/* ================= وضع «حدّد ما تريد تعديله» (للمصمم فقط) =================
   يعمل بفتح الموقع بـ ?edit=1 ويتوقف بـ ?edit=0. في وضع «تحديد» تضغط على أي عنصر في الصفحة،
   تكتب ما تريد تغييره، وتُحفظ الملاحظة في المتصفح (jvh_edit_notes) مع مكان العنصر.
   Claude يقرأ الملاحظات من المتصفح وينفّذها. لا يؤثر على الزبائن لأنه لا يعمل بدون ?edit=1. */
(() => {
  const q = new URLSearchParams(location.search).get('edit');
  try { if (q === '1') localStorage.setItem('jvh_edit', '1'); if (q === '0') localStorage.removeItem('jvh_edit'); } catch {}
  let on = false; try { on = localStorage.getItem('jvh_edit') === '1'; } catch {}
  if (!on) return;

  const KEY = 'jvh_edit_notes';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = n => { try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {} };
  const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let picking = true, hoverEl = null, chosen = null;

  const css = document.createElement('style');
  css.textContent = `
    .pk-hover{outline:3px dashed #e11d48!important;outline-offset:2px!important;cursor:crosshair!important}
    .pk-chosen{outline:3px solid #e11d48!important;outline-offset:2px!important}
    #pkBar,#pkPop,#pkList{position:fixed;z-index:2147483000;font-family:"Kufi",system-ui,sans-serif;direction:rtl;color:#1f2937}
    #pkBar{bottom:calc(84px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:#111827;color:#fff;border-radius:14px;
      padding:8px;display:flex;gap:6px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:calc(100% - 16px);flex-wrap:wrap;justify-content:center}
    #pkBar button{border:0;border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;background:#374151;color:#fff}
    #pkBar button.on{background:#e11d48}
    #pkBar .t{font-size:12.5px;padding:0 6px}
    #pkPop,#pkList{left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom));width:min(420px,calc(100% - 24px));background:#fff;
      border-radius:16px;padding:14px;box-shadow:0 20px 50px rgba(0,0,0,.35);border:2px solid #e11d48}
    #pkPop textarea{width:100%;min-height:90px;border:1.5px solid #d1d5db;border-radius:10px;padding:10px;font:inherit;font-size:14px;margin:8px 0;box-sizing:border-box}
    #pkPop .what,#pkList .what{font-size:12px;color:#6b7280;background:#f3f4f6;border-radius:8px;padding:6px 8px;word-break:break-word}
    #pkPop .btns,#pkList .btns{display:flex;gap:8px}
    #pkPop button,#pkList button{flex:1;border:0;border-radius:10px;padding:10px;font:inherit;font-weight:700;cursor:pointer;background:#e5e7eb;color:#111827}
    #pkPop button.go{background:#e11d48;color:#fff}
    #pkList{max-height:60vh;overflow:auto}
    #pkList .it{border-bottom:1px solid #e5e7eb;padding:8px 0;display:flex;gap:8px;align-items:flex-start}
    #pkList .it b{font-size:14px}
    #pkList .it .x{flex:none;width:30px;height:30px;padding:0;background:#fee2e2;color:#e11d48}`;
  document.head.appendChild(css);

  const bar = document.createElement('div'); bar.id = 'pkBar';
  document.body.appendChild(bar);
  const ui = el => el && el.closest && el.closest('#pkBar,#pkPop,#pkList');

  function drawBar() {
    const n = load().length;
    bar.innerHTML = `<span class="t">وضع التعديل</span>
      <button data-a="pick" class="${picking ? 'on' : ''}">تحديد عنصر</button>
      <button data-a="browse" class="${picking ? '' : 'on'}">تصفّح</button>
      <button data-a="list">ملاحظاتي (${n})</button>
      <button data-a="exit">إنهاء</button>`;
  }
  bar.addEventListener('click', e => {
    const a = e.target.closest('button'); if (!a) return;
    const act = a.dataset.a;
    if (act === 'pick') picking = true;
    if (act === 'browse') { picking = false; clearHover(); closePop(); }
    if (act === 'list') showList();
    if (act === 'exit') { if (confirm('إنهاء وضع التعديل؟ ملاحظاتك تبقى محفوظة.')) { try { localStorage.removeItem('jvh_edit'); } catch {} location.href = location.pathname + location.hash; } }
    drawBar();
  });

  // وصف العنصر ومساره حتى يجده Claude في الكود
  function path(el) {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && e !== document.body && parts.length < 5; e = e.parentElement) {
      if (e.id) { parts.unshift('#' + e.id); break; }
      let s = e.tagName.toLowerCase();
      const cls = [...e.classList].filter(c => !c.startsWith('pk-')).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      const sib = e.parentElement ? [...e.parentElement.children].filter(x => x.tagName === e.tagName) : [];
      if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(e) + 1})`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  const label = el => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('alt') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 60);

  function clearHover() { if (hoverEl) hoverEl.classList.remove('pk-hover'); hoverEl = null; }
  document.addEventListener('mouseover', e => {
    if (!picking || ui(e.target)) return;
    clearHover(); hoverEl = e.target; hoverEl.classList.add('pk-hover');
  }, true);
  // نوقف النقرة قبل أن تصل للموقع، فلا تنفتح الروابط أثناء التحديد
  for (const ev of ['click', 'mousedown', 'mouseup', 'pointerdown', 'touchend']) {
    document.addEventListener(ev, e => {
      if (!picking || ui(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      if (ev === 'click') openPop(e.target);
    }, true);
  }

  function closePop() { const p = document.getElementById('pkPop'); if (p) p.remove(); if (chosen) chosen.classList.remove('pk-chosen'); chosen = null; }
  function openPop(el) {
    closePop(); clearHover(); const l = document.getElementById('pkList'); if (l) l.remove();
    chosen = el; el.classList.add('pk-chosen');
    const pop = document.createElement('div'); pop.id = 'pkPop';
    pop.innerHTML = `<b>ماذا تريد أن يتغيّر هنا؟</b>
      <div class="what">${h(label(el))}</div>
      <textarea placeholder="مثال: اجعل هذا الزر أكبر ولونه أخضر"></textarea>
      <div class="btns"><button class="go">حفظ الملاحظة</button><button class="no">إلغاء</button></div>`;
    document.body.appendChild(pop);
    const ta = pop.querySelector('textarea'); ta.focus();
    pop.querySelector('.no').onclick = closePop;
    pop.querySelector('.go').onclick = () => {
      const note = ta.value.trim(); if (!note) { ta.focus(); return; }
      const notes = load();
      notes.push({ page: location.hash || '#/', element: label(el), path: path(el), note, at: new Date().toISOString() });
      save(notes); closePop(); drawBar();
      flash('حُفظت الملاحظة رقم ' + notes.length);
    };
  }
  function showList() {
    closePop(); const old = document.getElementById('pkList'); if (old) { old.remove(); return; }
    const notes = load();
    const box = document.createElement('div'); box.id = 'pkList';
    box.innerHTML = `<b>ملاحظاتي (${notes.length})</b>
      ${notes.map((n, i) => `<div class="it"><div style="flex:1"><b>${i + 1}. ${h(n.note)}</b><div class="what">${h(n.element)} · ${h(n.page)}</div></div>
        <button class="x" data-i="${i}" aria-label="حذف">✕</button></div>`).join('') || '<p style="color:#6b7280">لا توجد ملاحظات بعد. اضغط «تحديد عنصر» ثم اضغط على أي شيء في الصفحة.</p>'}
      <p style="font-size:12.5px;color:#6b7280">عندما تنتهي، قل لـ Claude في المحادثة: «نفّذ ملاحظاتي».</p>
      <div class="btns"><button class="close">إغلاق</button></div>`;
    document.body.appendChild(box);
    box.querySelector('.close').onclick = () => box.remove();
    box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const n = load(); n.splice(+b.dataset.i, 1); save(n); box.remove(); drawBar(); showList(); });
  }
  function flash(msg) {
    if (typeof toast === 'function') return toast(msg);
  }
  drawBar();
})();
