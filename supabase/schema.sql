create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  topic_history text[] not null default '{}',
  personas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  topic text,
  title text,
  body text,
  english_title text,
  english_body text,
  tags jsonb not null default '[]'::jsonb,
  image_prompts jsonb not null default '[]'::jsonb,
  location text,
  created_at timestamptz not null default now()
);

create table if not exists public.inspirations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.inspirations enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can upsert own profile" on public.profiles;
create policy "Users can upsert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can read own favorites" on public.favorites;
create policy "Users can read own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own favorites" on public.favorites;
create policy "Users can create own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own favorites" on public.favorites;
create policy "Users can delete own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own inspirations" on public.inspirations;
create policy "Users can read own inspirations"
  on public.inspirations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own inspirations" on public.inspirations;
create policy "Users can create own inspirations"
  on public.inspirations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own inspirations" on public.inspirations;
create policy "Users can delete own inspirations"
  on public.inspirations for delete
  using (auth.uid() = user_id);
