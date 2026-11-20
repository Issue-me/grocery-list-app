
-- ============================================================
-- FIJI GROCERY LIST
-- Supabase database schema and security
-- ============================================================

-- 1. EXTENSIONS
create extension if not exists pgcrypto;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- User profiles
create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    name text,
    email text
);

-- Households
create table if not exists public.households (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    invite_code text unique not null
        default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
    owner_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

-- Household members
create table if not exists public.household_members (
    household_id uuid references public.households(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    role text not null default 'member'
        check (role in ('owner', 'member')),
    joined_at timestamptz not null default now(),
    primary key (household_id, user_id)
);

-- Shopping lists
create table if not exists public.shopping_lists (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households(id) on delete cascade,
    name text not null default 'Shopping list',
    created_at timestamptz not null default now()
);

-- Shopping list items
create table if not exists public.list_items (
    id uuid primary key default gen_random_uuid(),
    list_id uuid not null references public.shopping_lists(id) on delete cascade,
    name text not null,
    category text not null default 'Other',
    quantity numeric not null default 1 check (quantity > 0),
    unit text not null default 'pieces',
    notes text,
    price numeric check (price is null or price >= 0),
    discount_type text default 'none'
        check (discount_type in ('none', 'percentage', 'fixed', 'special')),
    discount_value numeric check (discount_value is null or discount_value >= 0),
    final_price numeric check (final_price is null or final_price >= 0),
    is_bought boolean not null default false,
    is_already_have boolean not null default false,
    is_deleted boolean not null default false,
    added_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

-- Keep removals as tombstones so offline deletes sync to every household member.
alter table public.list_items
    add column if not exists is_deleted boolean not null default false;
alter table public.list_items
    add column if not exists is_already_have boolean not null default false;

-- Grocery products
create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text not null default 'Other',
    barcode_optional text
);

-- Supermarkets
create table if not exists public.stores (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    location text,
    website text
);

-- Product prices
create table if not exists public.product_prices (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products(id) on delete cascade,
    store_id uuid not null references public.stores(id) on delete cascade,
    price numeric not null check (price >= 0),
    discount_price numeric check (discount_price is null or discount_price >= 0),
    discount_type text,
    discount_value numeric,
    valid_from date,
    valid_to date,
    last_updated timestamptz not null default now(),
    check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

-- Pantry
create table if not exists public.pantry_items (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households(id) on delete cascade,
    product_name text not null,
    quantity text,
    expiry_date date,
    notes text,
    created_at timestamptz not null default now()
);

-- Recipes
create table if not exists public.recipes (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households(id) on delete cascade,
    name text not null,
    ingredients jsonb not null default '[]'::jsonb,
    instructions_optional text,
    created_at timestamptz not null default now()
);

-- Meal plans
create table if not exists public.meal_plans (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households(id) on delete cascade,
    week_start_date date not null,
    meals jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

-- Shopping history
create table if not exists public.shopping_history (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households(id) on delete cascade,
    date timestamptz not null default now(),
    total_spent numeric not null default 0 check (total_spent >= 0),
    items jsonb not null default '[]'::jsonb
);

-- Shared offline-friendly household settings and pantry snapshots.
create table if not exists public.household_app_state (
    household_id uuid primary key references public.households(id) on delete cascade,
    payload jsonb not null default '{"pantry":[],"history":[],"budget":0}'::jsonb,
    updated_at timestamptz not null default now()
);

-- Only users added here by a database administrator may change store prices.
create table if not exists public.price_admins (
    user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_price_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.price_admins where user_id = (select auth.uid())) $$;

create or replace function public.admin_add_product_price(
    p_name text, p_store text, p_price numeric, p_discount_price numeric default null
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare product_id uuid; store_id uuid; price_id uuid;
begin
    if not public.is_price_admin() then raise exception 'Price admin access is required'; end if;
    if length(trim(p_name)) not between 1 and 100 or length(trim(p_store)) not between 1 and 80
       or p_price < 0 or (p_discount_price is not null and (p_discount_price < 0 or p_discount_price > p_price)) then
        raise exception 'Please check the item name, store, and prices';
    end if;
    select id into product_id from public.products where lower(name)=lower(trim(p_name)) limit 1;
    if product_id is null then
        insert into public.products(name, category) values(trim(p_name), 'Other') returning id into product_id;
    end if;
    select id into store_id from public.stores where lower(name)=lower(trim(p_store)) limit 1;
    if store_id is null then raise exception 'Choose a listed Fiji store'; end if;
    insert into public.product_prices(product_id,store_id,price,discount_price,discount_type,valid_from,last_updated)
    values(product_id,store_id,p_price,p_discount_price,case when p_discount_price is null then null else 'special' end,current_date,now())
    returning id into price_id;
    return price_id;
end $$;

revoke all on function public.is_price_admin() from public, anon;
grant execute on function public.is_price_admin() to authenticated;
revoke all on function public.admin_add_product_price(text,text,numeric,numeric) from public, anon;
grant execute on function public.admin_add_product_price(text,text,numeric,numeric) to authenticated;
alter table public.price_admins enable row level security;
alter table public.household_app_state enable row level security;

-- ============================================================
-- 3. INDEXES
-- ============================================================

create index if not exists idx_household_members_user
    on public.household_members(user_id);

create index if not exists idx_shopping_lists_household
    on public.shopping_lists(household_id);

create index if not exists idx_list_items_list
    on public.list_items(list_id);

create index if not exists idx_list_items_updated
    on public.list_items(updated_at);

create index if not exists idx_pantry_household
    on public.pantry_items(household_id);

create index if not exists idx_recipes_household
    on public.recipes(household_id);

create index if not exists idx_meal_plans_household
    on public.meal_plans(household_id);

create index if not exists idx_history_household
    on public.shopping_history(household_id);

create index if not exists idx_prices_product
    on public.product_prices(product_id);

create unique index if not exists idx_products_name_unique
    on public.products(lower(name));

-- ============================================================
-- 4. USER PROFILE AUTOMATION
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.users (id, name, email)
    values (
        new.id,
        new.raw_user_meta_data ->> 'name',
        new.email
    )
    on conflict (id) do update
    set name = coalesce(excluded.name, public.users.name),
        email = excluded.email;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_profile_sync on auth.users;
drop trigger if exists on_auth_user_profile_updated on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep the profile email in step if a user changes it in Supabase Auth.
create trigger on_auth_user_profile_updated
after update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- 5. AUTOMATIC HOUSEHOLD OWNER MEMBERSHIP
-- ============================================================

create or replace function public.add_household_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.household_members (
        household_id,
        user_id,
        role
    )
    values (
        new.id,
        new.owner_id,
        'owner'
    );

    return new;
end;
$$;

drop trigger if exists on_household_created on public.households;

create trigger on_household_created
after insert on public.households
for each row execute function public.add_household_owner();

-- ============================================================
-- 6. SECURE HOUSEHOLD ACCESS FUNCTIONS
-- ============================================================

create or replace function public.is_household_member(
    p_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.household_members m
        where m.household_id = p_household_id
          and m.user_id = (select auth.uid())
    );
$$;

create or replace function public.is_household_owner(
    p_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.households h
        where h.id = p_household_id
          and h.owner_id = (select auth.uid())
    );
$$;

create or replace function public.shares_household_with(
    p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.household_members mine
        join public.household_members other_member
          on other_member.household_id = mine.household_id
        where mine.user_id = (select auth.uid())
          and other_member.user_id = p_user_id
    );
$$;

create or replace function public.can_access_shopping_list(
    p_list_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.shopping_lists l
        join public.household_members m
          on m.household_id = l.household_id
        where l.id = p_list_id
          and m.user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_household_owner(uuid) from public, anon;
revoke all on function public.can_access_shopping_list(uuid) from public, anon;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.can_access_shopping_list(uuid) to authenticated;
revoke all on function public.shares_household_with(uuid) from public, anon;
grant execute on function public.shares_household_with(uuid) to authenticated;

-- ============================================================
-- 7. HOUSEHOLD INVITATION REDEMPTION
-- ============================================================

create or replace function public.join_household(
    p_invite_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_household_id uuid;
    v_user_id uuid;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'You must sign in before joining a household.';
    end if;

    if p_invite_code is null or length(trim(p_invite_code)) = 0 then
        raise exception 'Please enter a valid invitation code.';
    end if;

    select h.id
    into v_household_id
    from public.households h
    where h.invite_code = upper(trim(p_invite_code));

    if v_household_id is null then
        raise exception 'Invalid household invitation code.';
    end if;

    insert into public.household_members (
        household_id,
        user_id,
        role
    )
    values (
        v_household_id,
        v_user_id,
        'member'
    )
    on conflict (household_id, user_id) do nothing;

    return v_household_id;
end;
$$;

revoke all on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;

-- ============================================================
-- 8. AUTOMATIC UPDATED_AT
-- ============================================================

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists update_list_items_timestamp on public.list_items;

create trigger update_list_items_timestamp
before update on public.list_items
for each row execute function public.update_updated_at();

-- ============================================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.list_items enable row level security;
alter table public.products enable row level security;
alter table public.stores enable row level security;
alter table public.product_prices enable row level security;
alter table public.pantry_items enable row level security;
alter table public.recipes enable row level security;
alter table public.meal_plans enable row level security;
alter table public.shopping_history enable row level security;

-- ============================================================
-- 10. REMOVE OLD POLICIES BEFORE RECREATING THEM
-- ============================================================

drop policy if exists "users read own profile" on public.users;
drop policy if exists "users update own profile" on public.users;
drop policy if exists "household members read names" on public.users;

drop policy if exists "members read households" on public.households;
drop policy if exists "owner creates household" on public.households;
drop policy if exists "owner updates household" on public.households;
drop policy if exists "owner deletes household" on public.households;

drop policy if exists "users read own membership" on public.household_members;
drop policy if exists "members read household memberships" on public.household_members;

drop policy if exists "members manage lists" on public.shopping_lists;
drop policy if exists "household list items" on public.list_items;

drop policy if exists "members manage household records" on public.pantry_items;
drop policy if exists "members manage recipes" on public.recipes;
drop policy if exists "members manage meal plans" on public.meal_plans;
drop policy if exists "members manage history" on public.shopping_history;
drop policy if exists "members manage app state" on public.household_app_state;

drop policy if exists "anyone reads products" on public.products;
drop policy if exists "anyone reads stores" on public.stores;
drop policy if exists "anyone reads prices" on public.product_prices;

-- ============================================================
-- 11. PROFILE POLICIES
-- ============================================================

create policy "users read own profile"
on public.users
for select to authenticated
using (id = (select auth.uid()));

create policy "users update own profile"
on public.users
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "household members read names"
on public.users
for select to authenticated
using (public.shares_household_with(id));

-- ============================================================
-- 12. HOUSEHOLD POLICIES
-- ============================================================

create policy "members read households"
on public.households
for select to authenticated
using (
    owner_id = (select auth.uid())
    or public.is_household_member(id)
);

create policy "owner creates household"
on public.households
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "owner updates household"
on public.households
for update to authenticated
using (public.is_household_owner(id))
with check (public.is_household_owner(id));

create policy "owner deletes household"
on public.households
for delete to authenticated
using (public.is_household_owner(id));

-- ============================================================
-- 13. HOUSEHOLD MEMBERSHIP POLICIES
-- ============================================================

create policy "users read own membership"
on public.household_members
for select to authenticated
using (user_id = (select auth.uid()));

create policy "members read household memberships"
on public.household_members
for select to authenticated
using (public.is_household_member(household_id));

-- Membership creation is handled by protected database functions.
-- Direct membership insertion, updating and deletion are not allowed.

-- ============================================================
-- 14. SHOPPING LIST POLICIES
-- ============================================================

create policy "members manage lists"
on public.shopping_lists
for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "household list items"
on public.list_items
for all to authenticated
using (public.can_access_shopping_list(list_id))
with check (public.can_access_shopping_list(list_id));

-- ============================================================
-- 15. PANTRY, RECIPES, MEALS AND HISTORY POLICIES
-- ============================================================

create policy "members manage household records"
on public.pantry_items
for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "members manage recipes"
on public.recipes
for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "members manage meal plans"
on public.meal_plans
for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "members manage history"
on public.shopping_history
for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "members manage app state"
on public.household_app_state
for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

-- ============================================================
-- 16. PUBLIC READ-ONLY GROCERY CATALOGUE
-- ============================================================

create policy "anyone reads products"
on public.products
for select to anon, authenticated
using (true);

create policy "anyone reads stores"
on public.stores
for select to anon, authenticated
using (true);

create policy "anyone reads prices"
on public.product_prices
for select to anon, authenticated
using (true);

-- No public or authenticated write policies are provided
-- for shared products, stores or prices.

-- ============================================================
-- 17. DATABASE PERMISSIONS
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
on public.households,
   public.shopping_lists,
   public.list_items,
   public.pantry_items,
   public.recipes,
   public.meal_plans,
   public.shopping_history,
   public.household_app_state
to authenticated;

grant select, update
on public.users
to authenticated;

grant select
on public.household_members
to authenticated;

grant select
on public.products,
   public.stores,
   public.product_prices
to anon, authenticated;

-- ============================================================
-- 18. SAMPLE FIJI SUPERMARKETS AND PRODUCTS
-- ============================================================

insert into public.stores (name)
values
    ('MH'),
    ('Superstore'),
    ('FoodCity'),
    ('Fresh Choice'),
    ('Pak’n Save')
on conflict (name) do nothing;

insert into public.products (name, category)
values
    ('Bananas', 'Produce'),
    ('Milk', 'Dairy'),
    ('Rice', 'Pantry'),
    ('Bread', 'Bakery'),
    ('Chicken', 'Meat and seafood'),
    ('Cooking oil', 'Pantry'),
    ('Laundry powder', 'Household')
on conflict do nothing;

-- ============================================================
-- 19. ENABLE REALTIME FOR SHOPPING LIST ITEMS
-- ============================================================

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'list_items'
    ) then
        alter publication supabase_realtime
        add table public.list_items;
    end if;
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'household_app_state'
    ) then
        alter publication supabase_realtime
        add table public.household_app_state;
    end if;
end;
$$;

-- ============================================================
-- END OF FIJI GROCERY LIST DATABASE SETUP
-- ============================================================
