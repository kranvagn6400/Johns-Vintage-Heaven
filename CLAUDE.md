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

## Roles (`profiles.role`)
- `admin` «المشرف التقني» = the user: accounts/roles, store settings (tagline, announcement, contact phone,
  courier name). Can open إدارة المتجر for support. First-ever signup becomes admin (trigger). Last admin can't be removed.
- `owner` «صاحب المتجر» = the friend: approves/rejects/suspends sellers, all orders and their statuses,
  courier tracking number, delivery fee per governorate, sales page. Created by admin (حساب جديد → صاحب المتجر).
- `seller` «بائع»: signs up with «بائع» + shop name → `sellers.status='pending'`; only `approved` sellers can
  write products/photos (RLS `is_approved_seller`). Sees only own products and `seller_orders()` (own items,
  no customer phone/address). Seller created by admin is auto-approved.
- `customer` «زبون»: browse, cart (localStorage `jvh_cart`), checkout, «طلباتي», cancel own order while `new`.
- `disabled`: blocked at login.
- Guest checkout is allowed; guests track with code + phone (`track_order` RPC).

## Data (supabase-setup.sql — the user runs it in the Supabase SQL editor; safe to re-run)
- Tables: `profiles`, `sellers` (1:1 with profile; `commission_rate` reserved), `products` (kind record|gramophone;
  record: artist/album/year/genre/speed 33|45|78/size 7|10|12; gramophone: brand/model/working; `condition` =
  Goldmine grade M…P for records, excellent…needs_repair for gramophones; `photos text[]`), `delivery_fees`
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
- api.js `SupaAPI` · demo.js `DemoAPI` · shop.js (home, list + filter sheet, product, cart, checkout, done, track,
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
