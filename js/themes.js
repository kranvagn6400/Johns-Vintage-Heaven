'use strict';
/* ================= ثيمات المتجر: شعار + ألوان =================
   يُحمَّل في <head> قبل رسم الصفحة، فيطبّق آخر ثيم محفوظ في المتصفح فوراً (بدون وميض)،
   ثم يطبّق App الثيم الحقيقي من settings.store_theme بعد تحميل الإعدادات.
   الألوان في css/themes.css (classic = ألوان app.css الأصلية). الشعارات في logos/. */
const Themes = {
  list: {
    classic: { name: 'كلاسيكي', note: 'نبيذي ونحاسي وبني قهوة', logo: 'logos/classic.png', bar: '#241810', sw: ['#241810', '#7a2331', '#c9a253', '#f3e9d6'] },
    logo:    { name: 'ألوان الشعار', note: 'كحلي وخردلي وبرتقالي', logo: 'logos/logo.png', bar: '#2c3561', sw: ['#2c3561', '#e05a1c', '#f2c15a', '#f6efdc'] },
    olive:   { name: 'زيتوني', note: 'أخضر زيتوني وذهبي', logo: 'logos/olive.png', bar: '#1f2a1e', sw: ['#1f2a1e', '#4f6b3a', '#d4b46a', '#f1ecdc'] },
    teal:    { name: 'فيروزي', note: 'أزرق مخضر وذهبي ومرجاني', logo: 'logos/teal.png', bar: '#0f2a33', sw: ['#0f2a33', '#0f7c80', '#e0b25a', '#eef3f1'] },
    jukebox: { name: 'جوك بوكس', note: 'أحمر وأسود وأصفر', logo: 'logos/jukebox.png', bar: '#141414', sw: ['#141414', '#c8102e', '#e8c547', '#f5f1ea'] }
  },
  def: 'classic',
  current() { try { const v = JSON.parse(localStorage.getItem('jvh_store_theme')); return this.list[v] ? v : this.def; } catch { return this.def; } },
  // يغيّر الألوان (data-store على <html>) والشعار وأيقونة التبويب ولون شريط المتصفح
  apply(id) {
    if (!this.list[id]) id = this.def;
    const t = this.list[id], root = document.documentElement;
    if (id === 'classic') root.removeAttribute('data-store'); else root.dataset.store = id;
    try { localStorage.setItem('jvh_store_theme', JSON.stringify(id)); } catch {}
    // <img data-logo> في الشريط وصفحة الدخول، و<image data-logo> ملصق أسطوانة الواجهة
    document.querySelectorAll('[data-logo]').forEach(el => { const a = el.tagName.toLowerCase() === 'img' ? 'src' : 'href'; if (el.getAttribute(a) !== t.logo) el.setAttribute(a, t.logo); });
    const fav = document.querySelector('link[rel="icon"]'); if (fav) fav.href = t.logo;
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = t.bar;
    return id;
  }
};
Themes.apply(Themes.current());
