-- =====================================================================
-- Johns Vintage Heaven — إعداد قاعدة بيانات Supabase (المرحلة الأولى)
-- الأدوار (متجر واحد): admin = المشرف التقني، يدير كل شيء · owner = صاحب المتجر، يضيف ويعدّل ويحذف المنتجات فقط · customer = زبون
-- شغّل هذا الملف مرة واحدة في مشروع Supabase الخاص بالمتجر:
--   SQL Editor ← New query ← الصق المحتوى كاملاً ← Run
-- آمن لإعادة التشغيل (يستخدم if not exists / or replace).
-- مهم: Authentication ← Sign In / Providers ← Email ← أطفئ «Confirm email».
-- أول حساب يُسجَّل في المتجر يصبح admin تلقائياً.
-- =====================================================================

-- ---------- الجداول ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  phone       text not null default '',
  full_name   text not null default '',
  role        text not null default 'customer'
              check (role in ('customer', 'seller', 'owner', 'admin', 'disabled')),
  created_at  timestamptz not null default now()
);

-- بيانات البائع (صف واحد لكل بائع). الموافقة من صاحب المتجر.
create table if not exists public.sellers (
  id               uuid primary key references public.profiles(id) on delete cascade,
  shop_name        text not null default '',
  bio              text not null default '',
  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected', 'suspended')),
  commission_rate  numeric(5,2) not null default 0,   -- للمستقبل: نسبة عمولة المتجر (غير مستخدمة الآن)
  reviewed_by      uuid references public.profiles(id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.sellers(id) on delete cascade,
  kind         text not null check (kind in ('record', 'gramophone', 'cd')),
  title        text not null,
  description  text not null default '',
  price        integer not null check (price >= 0),          -- بالدينار العراقي
  stock        integer not null default 1 check (stock >= 0),
  status       text not null default 'active' check (status in ('active', 'hidden', 'sold')),
  condition    text not null default '',                      -- أسطوانات: M/NM/VG+/VG/G+/G/F/P · غرامافون: excellent/very_good/good/fair/needs_repair
  photos       text[] not null default '{}',                  -- مسارات في bucket product-photos
  -- الأسطوانات
  artist       text not null default '',
  album        text not null default '',
  year         integer,
  genre        text not null default '',
  speed        integer check (speed in (33, 45, 78)),
  size         integer check (size in (7, 10, 12)),
  -- الغرامافونات
  brand        text not null default '',
  model        text not null default '',
  working      boolean,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists products_list on public.products (status, created_at desc);
create index if not exists products_seller on public.products (seller_id, created_at desc);
-- أنواع المنتجات: أسطوانة، غرامافون، CD. السطران التاليان يحدّثان القيد في قاعدة أُنشئت قبل إضافة الـ CD
alter table public.products drop constraint if exists products_kind_check;
alter table public.products add constraint products_kind_check check (kind in ('record', 'gramophone', 'cd'));

-- رسوم التوصيل لكل محافظة (يحددها صاحب المتجر)
create table if not exists public.delivery_fees (
  governorate  text primary key,
  fee          integer not null default 5000 check (fee >= 0),
  active       boolean not null default true
);
insert into public.delivery_fees (governorate, fee) values
  ('بغداد', 5000), ('البصرة', 8000), ('نينوى', 8000), ('أربيل', 8000), ('السليمانية', 8000), ('دهوك', 8000),
  ('كركوك', 8000), ('الأنبار', 8000), ('ديالى', 7000), ('صلاح الدين', 8000), ('بابل', 7000), ('كربلاء', 7000),
  ('النجف', 7000), ('واسط', 7000), ('ميسان', 8000), ('ذي قار', 8000), ('المثنى', 8000), ('القادسية', 7000), ('حلبجة', 8000)
on conflict (governorate) do nothing;

-- إعدادات المتجر العامة (نصوص الواجهة، رقم التواصل، شركة التوصيل...)
create table if not exists public.settings (
  key    text primary key,
  value  text not null default ''
);
insert into public.settings (key, value) values
  ('tagline', 'أسطوانات وغرامافونات من الزمن الجميل'),
  ('announcement', ''),
  ('contact_phone', ''),
  ('courier_name', 'شركة التوصيل')
on conflict (key) do nothing;

-- الطلبات. طريقة الدفع الآن: cod (الدفع عند الاستلام). المرحلة الثانية: zaincash / fastpay / qi.
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,                 -- رمز قصير يراه الزبون للتتبع
  customer_id     uuid references public.profiles(id) on delete set null,   -- فارغ = طلب بدون حساب
  name            text not null,
  phone           text not null,
  governorate     text not null,
  address         text not null,
  notes           text not null default '',
  subtotal        integer not null default 0,
  delivery_fee    integer not null default 0,
  total           integer not null default 0,
  status          text not null default 'new'
                  check (status in ('new', 'confirmed', 'with_courier', 'delivered', 'cancelled')),
  payment_method  text not null default 'cod' check (payment_method in ('cod', 'zaincash', 'fastpay', 'qi')),
  payment_status  text not null default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'refunded', 'failed')),
  courier_ref     text not null default '',             -- رقم الشحنة لدى شركة التوصيل
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_created on public.orders (created_at desc);
create index if not exists orders_customer on public.orders (customer_id, created_at desc);

create table if not exists public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  product_id         uuid references public.products(id) on delete set null,
  seller_id          uuid references public.sellers(id) on delete set null,
  title              text not null,          -- نسخة من اسم المنتج وقت الطلب
  price              integer not null,       -- السعر وقت الطلب (من قاعدة البيانات، لا من المتصفح)
  qty                integer not null default 1 check (qty > 0),
  commission_amount  integer not null default 0   -- للمستقبل
);
create index if not exists order_items_order on public.order_items (order_id);
create index if not exists order_items_seller on public.order_items (seller_id);

-- سجل تغيّر حالة الطلب
create table if not exists public.order_events (
  id          bigserial primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  status      text not null,
  note        text not null default '',
  by_user     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists order_events_order on public.order_events (order_id, created_at);

-- المرحلة الثانية (الدفع الإلكتروني): جدول جاهز وغير مستخدم الآن.
-- يُكتب فيه فقط من الخادم (webhook بمفتاح service_role)، لا من المتصفح.
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  provider      text not null check (provider in ('zaincash', 'fastpay', 'qi')),
  amount        integer not null,
  status        text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  provider_ref  text not null default '',
  raw           jsonb,
  created_at    timestamptz not null default now()
);

-- ---------- دوال الصلاحيات ----------
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'admin', false)          -- متجر واحد: المشرف وحده يدير الطلبات والتوصيل والحسابات
$$;
-- إضافة المنتجات وتعديلها وحذفها: صاحب المتجر والمشرف
create or replace function public.can_edit_products() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() in ('owner', 'admin'), false)
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'admin', false)
$$;
create or replace function public.is_approved_seller(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sellers s join profiles p on p.id = s.id
                 where s.id = uid and s.status = 'approved' and p.role in ('seller', 'owner', 'admin'))
$$;

-- ---------- إنشاء الملف الشخصي عند التسجيل ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r text := 'customer';
begin
  if not exists (select 1 from profiles) then
    r := 'admin';                                   -- أول حساب = المشرف التقني
  end if;
  insert into profiles (id, phone, full_name, role)
  values (new.id, coalesce(meta->>'phone', ''), coalesce(meta->>'full_name', ''), r)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- لا يغيّر الدور إلا المشرف التقني، ولا يُحذف آخر admin
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if not is_admin() then raise exception 'ليست لديك صلاحية لتغيير الدور'; end if;
    if old.role = 'admin' and not exists (select 1 from profiles where role = 'admin' and id <> old.id) then
      raise exception 'لا يمكن إزالة آخر مشرف تقني';
    end if;
    if new.role = 'seller' then
      insert into sellers (id, shop_name) values (new.id, new.full_name) on conflict (id) do nothing;
    end if;
  end if;
  new.id := old.id;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- البائع يعدّل اسم متجره ونبذته فقط؛ الحالة والعمولة لصاحب المتجر/المشرف
create or replace function public.guard_seller() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then
    new.status := old.status; new.commission_rate := old.commission_rate;
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
  elsif new.status is distinct from old.status then
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
  end if;
  new.id := old.id;
  return new;
end $$;
drop trigger if exists sellers_guard on public.sellers;
create trigger sellers_guard before update on public.sellers
  for each row execute function public.guard_seller();

create or replace function public.touch_product() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and not is_staff() then new.seller_id := old.seller_id; end if;
  return new;
end $$;
drop trigger if exists products_touch on public.products;
create trigger products_touch before insert or update on public.products
  for each row execute function public.touch_product();

-- ---------- RLS ----------
alter table public.profiles      enable row level security;
alter table public.sellers       enable row level security;
alter table public.products      enable row level security;
alter table public.delivery_fees enable row level security;
alter table public.settings      enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.order_events  enable row level security;
alter table public.payments      enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or is_staff());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

drop policy if exists sellers_select on public.sellers;
create policy sellers_select on public.sellers for select to anon, authenticated
  using (status = 'approved' or id = auth.uid() or is_staff());
drop policy if exists sellers_update on public.sellers;
create policy sellers_update on public.sellers for update to authenticated
  using (id = auth.uid() or is_staff()) with check (id = auth.uid() or is_staff());

drop policy if exists products_select on public.products;
create policy products_select on public.products for select to anon, authenticated
  using ((status in ('active', 'sold') and is_approved_seller(seller_id)) or can_edit_products());
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated
  with check (can_edit_products() and (seller_id = auth.uid() or is_staff()));
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
  using (can_edit_products()) with check (can_edit_products());
drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete to authenticated
  using (can_edit_products());

drop policy if exists fees_select on public.delivery_fees;
create policy fees_select on public.delivery_fees for select to anon, authenticated using (true);
drop policy if exists fees_write on public.delivery_fees;
create policy fees_write on public.delivery_fees for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to anon, authenticated using (true);
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all to authenticated using (is_admin()) with check (is_admin());

-- الطلبات تُنشأ وتُعدّل فقط عبر الدوال أدناه (place_order / set_order_status)
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (customer_id = auth.uid() or is_staff());
drop policy if exists items_select on public.order_items;
create policy items_select on public.order_items for select to authenticated
  using (is_staff() or exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid()));
drop policy if exists events_select on public.order_events;
create policy events_select on public.order_events for select to authenticated
  using (is_staff() or exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid()));
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated using (is_staff());

-- ---------- إنشاء طلب (زبون مسجّل أو بدون حساب) ----------
-- الأسعار ورسوم التوصيل تُحسب هنا من قاعدة البيانات، لا يُوثق بما يرسله المتصفح.
create or replace function public.place_order(p_name text, p_phone text, p_governorate text, p_address text,
                                              p_notes text, p_items jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_order uuid; v_code text; v_fee integer; v_sub integer := 0; it jsonb; pr products%rowtype; q integer;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_address), '') = '' then raise exception 'الاسم والعنوان مطلوبان'; end if;
  if regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') !~ '^07\d{9}$' then raise exception 'رقم الهاتف غير صحيح'; end if;
  select fee into v_fee from delivery_fees where governorate = p_governorate and active;
  if v_fee is null then raise exception 'التوصيل غير متاح لهذه المحافظة'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'السلة فارغة'; end if;

  loop
    v_code := 'JV' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from orders where code = v_code);
  end loop;
  insert into orders (code, customer_id, name, phone, governorate, address, notes, delivery_fee)
  values (v_code, auth.uid(), trim(p_name), regexp_replace(p_phone, '\D', '', 'g'), p_governorate, trim(p_address),
          coalesce(trim(p_notes), ''), v_fee)
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    q := greatest(coalesce((it->>'qty')::integer, 1), 1);
    select * into pr from products where id = (it->>'product_id')::uuid for update;
    if not found or pr.status <> 'active' or not is_approved_seller(pr.seller_id) then
      raise exception 'منتج غير متوفر: %', coalesce(pr.title, '');
    end if;
    if pr.stock < q then raise exception 'الكمية غير متوفرة: %', pr.title; end if;
    insert into order_items (order_id, product_id, seller_id, title, price, qty)
    values (v_order, pr.id, pr.seller_id, pr.title, pr.price, q);
    update products set stock = stock - q, status = case when stock - q = 0 then 'sold' else status end where id = pr.id;
    v_sub := v_sub + pr.price * q;
  end loop;

  update orders set subtotal = v_sub, total = v_sub + v_fee where id = v_order;
  insert into order_events (order_id, status, by_user) values (v_order, 'new', auth.uid());
  return json_build_object('id', v_order, 'code', v_code, 'total', v_sub + v_fee);
end $$;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to anon, authenticated;

-- ---------- تتبع طلب برمزه + رقم الهاتف (بدون حساب) ----------
create or replace function public.track_order(p_code text, p_phone text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'order', to_json(o),
    'items', coalesce((select json_agg(i) from order_items i where i.order_id = o.id), '[]'::json),
    'events', coalesce((select json_agg(e order by e.created_at) from order_events e where e.order_id = o.id), '[]'::json))
  from orders o
  where o.code = upper(trim(p_code)) and o.phone = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
$$;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- ---------- تغيير حالة الطلب ----------
-- صاحب المتجر/المشرف: أي انتقال. الزبون: إلغاء طلبه فقط وهو «جديد». delivered و cancelled نهائيتان.
create or replace function public.set_order_status(p_order uuid, p_status text, p_note text default '', p_courier_ref text default null)
returns json language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; it record;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if not is_staff() then
    if not (o.customer_id = auth.uid() and o.status = 'new' and p_status = 'cancelled') then
      raise exception 'ليست لديك صلاحية لهذه العملية';
    end if;
  end if;
  if p_status not in ('new', 'confirmed', 'with_courier', 'delivered', 'cancelled') then raise exception 'حالة غير صحيحة'; end if;
  if o.status in ('delivered', 'cancelled') and p_status <> o.status then raise exception 'لا يمكن تغيير طلب مكتمل أو ملغى'; end if;

  if p_status = 'cancelled' and o.status <> 'cancelled' then
    for it in select product_id, qty from order_items where order_id = o.id and product_id is not null loop
      update products set stock = stock + it.qty, status = case when status = 'sold' then 'active' else status end
      where id = it.product_id;
    end loop;
  end if;

  update orders set status = p_status,
         courier_ref = coalesce(p_courier_ref, courier_ref),
         payment_status = case when p_status = 'delivered' and payment_method = 'cod' then 'paid' else payment_status end,
         updated_at = now()
  where id = o.id;
  if p_status <> o.status or coalesce(p_note, '') <> '' then
    insert into order_events (order_id, status, note, by_user) values (o.id, p_status, coalesce(p_note, ''), auth.uid());
  end if;
  return json_build_object('id', o.id, 'status', p_status);
end $$;
grant execute on function public.set_order_status(uuid, text, text, text) to authenticated;

-- ---------- طلبات البائع: منتجاته فقط وبدون بيانات الزبون الشخصية ----------
create or replace function public.seller_orders()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select o.id, o.code, o.status, o.governorate, o.created_at,
           json_agg(json_build_object('title', i.title, 'price', i.price, 'qty', i.qty, 'product_id', i.product_id)) as items,
           sum(i.price * i.qty)::integer as seller_total
    from orders o join order_items i on i.order_id = o.id
    where i.seller_id = auth.uid()
    group by o.id
  ) x
$$;
grant execute on function public.seller_orders() to authenticated;

-- ---------- منتجات الإدارة: صاحب المتجر والمشرف يبيعان منتجاتهما أيضاً ----------
-- يُنشئ لهما «متجراً» معتمداً باسم المتجر عند أول فتح للوحة المنتجات (products.seller_id يحتاج صفاً في sellers).
create or replace function public.ensure_staff_shop()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_edit_products() then raise exception 'ليست لديك صلاحية لهذه العملية'; end if;
  insert into sellers (id, shop_name, status, reviewed_by, reviewed_at)
  values (auth.uid(), 'Johns Vintage Heaven', 'approved', auth.uid(), now())
  on conflict (id) do update set status = 'approved';
end $$;
grant execute on function public.ensure_staff_shop() to authenticated;

-- ---------- صور المنتجات ----------
-- bucket عام للقراءة (صور المتجر تُعرض للجميع). المسار: <seller_id>/<product_id>/<n>.jpg
insert into storage.buckets (id, name, public) values ('product-photos', 'product-photos', true)
on conflict (id) do update set public = true;

drop policy if exists product_photos_insert on storage.objects;
create policy product_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and (
    public.can_edit_products()));
drop policy if exists product_photos_update on storage.objects;
create policy product_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and (
    public.can_edit_products()));
drop policy if exists product_photos_delete on storage.objects;
create policy product_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and (
    public.can_edit_products()));
-- الزبائن يرون الصور عبر الرابط العام للـ bucket. لكن الحذف والاستبدال في Storage يحتاجان أيضاً صلاحية select
-- لمن يدير المنتجات، وإلا رُفضت العملية بخطأ RLS.
drop policy if exists product_photos_select on storage.objects;
create policy product_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'product-photos' and public.can_edit_products());
