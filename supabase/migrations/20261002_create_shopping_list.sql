-- Lista de Compras
-- Os valores desta tabela são independentes das transações,
-- contas e cartões. Nada aqui altera o saldo principal do usuário.

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null check (char_length(trim(product_name)) > 0),
  is_purchased boolean not null default false,
  purchased_value numeric(12, 2),
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_list_purchase_state_check check (
    (is_purchased = false and purchased_value is null and purchased_at is null)
    or
    (
      is_purchased = true
      and purchased_value is not null
      and purchased_value >= 0
      and purchased_at is not null
    )
  )
);

create index if not exists shopping_list_items_user_id_idx
  on public.shopping_list_items(user_id);

create index if not exists shopping_list_items_user_status_idx
  on public.shopping_list_items(user_id, is_purchased, created_at desc);

alter table public.shopping_list_items enable row level security;

drop policy if exists "shopping_list_select_own" on public.shopping_list_items;
create policy "shopping_list_select_own"
  on public.shopping_list_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "shopping_list_insert_own" on public.shopping_list_items;
create policy "shopping_list_insert_own"
  on public.shopping_list_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "shopping_list_update_own" on public.shopping_list_items;
create policy "shopping_list_update_own"
  on public.shopping_list_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "shopping_list_delete_own" on public.shopping_list_items;
create policy "shopping_list_delete_own"
  on public.shopping_list_items
  for delete
  using (auth.uid() = user_id);
