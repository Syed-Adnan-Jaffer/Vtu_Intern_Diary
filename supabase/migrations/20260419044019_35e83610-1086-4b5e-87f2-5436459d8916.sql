
-- Profiles table (one per user)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  usn text,
  branch text,
  semester text,
  college text,
  internship_title text,
  internship_type text,
  company_name text,
  mentor_name text,
  start_date date,
  end_date date,
  weekly_plan text,
  skip_weekends boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Users can delete own profile" on public.profiles for delete to authenticated using (auth.uid() = id);

-- Diary entries
create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  day_number integer,
  bullets text,
  content text,
  status text not null default 'draft' check (status in ('draft','finalized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

alter table public.diary_entries enable row level security;

create policy "Users can view own entries" on public.diary_entries for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own entries" on public.diary_entries for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own entries" on public.diary_entries for update to authenticated using (auth.uid() = user_id);
create policy "Users can delete own entries" on public.diary_entries for delete to authenticated using (auth.uid() = user_id);

create index diary_entries_user_date_idx on public.diary_entries(user_id, entry_date);

-- updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger diary_entries_set_updated_at before update on public.diary_entries
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
