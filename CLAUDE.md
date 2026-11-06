# Johns Vintage Heaven — multi-seller vinyl & gramophone marketplace (PWA)

Arabic RTL storefront (brand name stays English) for vinyl records and gramophones in Iraq. Plain JS, no build
step, no npm dependencies; scripts share globals (`$`, `API`, `UI`, `Cart`, `Shop`, `Seller`, `Owner`, `Admin`, `App`).
Talk to the user in Arabic. The user is the designer/technical supervisor; the store belongs to their friend.
Completely separate from the user's Maidan project (own folder, repo, Supabase project) — never touch Maidan.

## Modes (config.js → `window.JVH_CONFIG`)
- Empty `SUPABASE_URL`/`SUPABASE_KEY` → **demo mode** (`DemoAPI`, js/demo.js): fake DB in localStorage
  (`jvh_demo_db`, seeded by `demoSeed()`), quick role buttons on the login page, demo password `123456`,
  phones 07700000001…06. Uploaded photos are stored as data URLs. «إعادة ضبط البيانات التجريبية» in حسابي.
- Filled → **Supabase mode** (`SupaAPI`, js/api.js). Login = phone + password; phone becomes
  `<phone>@johnsvintageheaven.app` (`EMAIL_DOMAIN`). Needs «Confirm email» OFF. The key is the public anon key.
- `API` (app.js) picks one. **Both objects implement the same methods** — change both together, and keep
  demo.js rules in step with the RLS/RPCs in supabase-setup.sql.

## Roles (`profiles.role`) — single store (user's decision, 2026-11-06)
- `admin` «المشرف التقني» = the user: manages EVERYTHING — accounts/roles, store settings, orders and statuses,
  courier tracking number, delivery fees, sales («إدارة المتجر» #/owner is admin-only), and products. First-ever signup
  becomes admin (trigger). Last admin can't be removed.
- `owner` «صاحب المتجر» = the friend: adds/edits/deletes products and their photos («المنتجات» #/seller) AND sees orders
  and changes their status (#/owner shows only the «الطلبات» tab for owner; SQL `can_manage_orders()` = owner|admin, demo
  `canEdit()`). No delivery fees, sales, settings or accounts. Created by admin. Lands on #/owner (orders) after login.
- No sellers: signup creates customers only; seller signup, seller dashboard tabs and the «البائعون» review list are gone.
  The `seller` role value and `sellers` table remain only as the products' shop (`products.seller_id`): owner/admin get an
  approved shop named Johns Vintage Heaven via `API.ensureShop()` → RPC `ensure_staff_shop`. Owner and admin see and edit
  ALL store products (`myProducts` drops the seller filter for them).
- SQL: `is_staff()` now means admin only; `can_edit_products()` = owner|admin (products RLS, storage policies, ensure_staff_shop).
  Demo mirrors this with `isStaff()` (admin) and `canEdit()` (owner|admin); demo DB version 2 (no seller accounts).
- Customers have NO accounts (user's decision 2026-11-06): they browse, use the cart (localStorage `jvh_cart`), check out as
  guests and track with order code + phone. «حسابي» (top `#tbAccount` + bottom nav) shows only for owner/admin; guests get
  «تتبّع طلب» there instead. Staff log in at `#/login` («دخول الإدارة», not linked for customers). `#/signup` stays reachable
  only by URL (bootstrap of the first admin); `#/orders` redirects to `#/track`. The `customer` role still exists in the DB.
- `disabled`: blocked at login. Guest checkout is allowed; guests track with code + phone (`track_order` RPC).
- Supabase is LIVE (config.js filled, commit 61f67bd). Test in demo mode only: serve a copy with an empty config.js on
  another port (never let tests write to the live project). SQL changes must be re-run by the user in the SQL editor.

## Data (supabase-setup.sql — the user runs it in the Supabase SQL editor; safe to re-run)
- Tables: `profiles`, `sellers` (1:1 with profile; `commission_rate` reserved), `products` (kind record|cd|gramophone;
  the kind check is re-created by `alter table` so old DBs accept `cd`. Form (seller.js, rows toggled by `data-for`):
  record = singer «المطرب» (`artist`) + song «اسم الأغنية» (`album`), price + quantity, optional year/genre/speed 33|45|78/size 7|10|12;
  cd = same without speed/size (`album` label «اسم الأغنية أو الألبوم»); gramophone = title, price, quantity, brand, model.
  Record/CD `title` is built as "artist — album". `condition` and `working` are no longer collected or shown (columns kept);
  `isMusic(kind)` = record|cd. Genres list has no «مقام عراقي» / «تلاوة وإنشاد». `photos text[]`), `delivery_fees`
  (19 governorates), `settings` (key/value), `orders`, `order_items` (price/title snapshot, `commission_amount`
  reserved), `order_events` (status history), `payments` (phase 2, unused, server-only writes).
- Orders are created ONLY by `place_order` (security definer: prices and fee from DB, locks stock, decrements,
  sets `sold` at 0) and changed ONLY by `set_order_status` (staff any; customer cancel-own-new; delivered and
  cancelled are final; cancel restocks; COD delivered → `payment_status='paid'`).
- Status flow: new → confirmed → with_courier → delivered, or cancelled (`ORDER_FLOW` in util.js).
- Payment: `payment_method` cod now; zaincash/fastpay/qi allowed by the check constraint for phase 2
  (add a server webhook writing `payments` + `orders.payment_status`; never trust the browser).
- Storage: public bucket `product-photos`, path `<seller_id>/<product_id>/<rand>.jpg`; write policies = own folder
  + approved seller, or staff. Images are compressed client-side (`compressImage`, 1280px JPEG).
- Guard triggers: only admin changes `profiles.role`; sellers can't change their own `status`/commission;
  sellers can't move a product to another seller.

## Modules
- util.js: helpers, `store` (localStorage, prefix `jvh_`), constants (roles, statuses, grades, genres,
  `GOVERNORATES` copied from Maidan), `Cart`.
- ui.js: icons (`icon()`, `<i data-i>` + `UI.hydrate`), product card, placeholder art (SVG record/gramophone
  when no photo), order timeline.
- api.js `SupaAPI` · demo.js `DemoAPI` · shop.js (home, list + filter sheet (checkboxes only: product kind + genre, multi-select as comma lists `kind=record,cd`/`genre=…`; genre never hides gramophones), product, cart, checkout, done, track,
  my orders) · seller.js · owner.js (tabs orders/sellers/fees/sales) · admin.js (users/settings/system) ·
  app.js (hash router `#/path?query`, nav, login/signup, حسابي, theme).
- Never put personal data (phone, address) in URLs; tracking uses a form.

## Design
Vintage: paper cream `--paper`, wine `--wine`, brass `--gold`, espresso header; Georgia/serif italic for the
English brand, Kufi (OFL, fonts/) for Arabic. Light/dark tokens on `:root` (auto + manual in حسابي).
Sample style (not default): `?pixel=1` adds class `pixel` on <html> (saved in localStorage `jvh_style`, `?pixel=0` off) →
css/pixel.css (arcade-poster look, palette #F3620F #FFC20A #67944B #078D8C #084973 #DA0D1E as --po/--py/--pg/--pt/--pb/--pr;
never name vars --r etc., app.css uses --r for radius) + js/pixel.js (12×12 pixel icons, pixel record/gramophone art via `icon()`/`UI.art`).
Mobile-first: bottom nav < 900px, top nav ≥ 900px. Icons regenerated with `node tools/make-icons.js`.

## Designer edit mode
`?edit=1` (off: `?edit=0` or «إنهاء») loads js/picker.js tooling: the user clicks elements and writes change notes, saved in
localStorage `jvh_edit_notes` ({page, element, path, note}). When asked to «نفّذ ملاحظاتي», read them from the preview tab
(`JSON.parse(localStorage.jvh_edit_notes)`), confirm the size of the work with the user, then apply. Never active for customers.

## Deploy / cache
- Static site → Vercel (user creates GitHub repo + Vercel project; don't push without asking).
  `.vercelignore` keeps SQL, Markdown, server.js, tools, .claude off the site.
- On any JS/CSS/HTML change bump `CACHE` in sw.js. SW registers only on https.
- Recommended: domain in the friend's name; hosting/Supabase accounts stay with the user; payment merchant
  accounts (phase 2) in the friend's name.

## Testing
- `node server.js 8091` → http://localhost:8091 (preview config «jvh» in .claude/launch.json). Demo mode needs nothing else.
- Never create accounts or write data in a live Supabase project from tests.
- Editing files from a Node script: `String.replace` turns `$$` into `$` — use split/join.
