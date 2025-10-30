create extension if not exists "pgcrypto";

create or replace function public.has_admin_access()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  prof_record record;
begin
  select p.initials, p.is_admin into prof_record
  from public.profiles p
  where p.id = auth.uid();

  if prof_record is null then
    return false;
  end if;

  if coalesce(prof_record.is_admin, false) then
    return true;
  end if;

  if upper(coalesce(prof_record.initials, '')) = 'RG' then
    return true;
  end if;

  if exists (
    select 1
    from public.roster r
    where upper(coalesce(r.initials, '')) = upper(coalesce(prof_record.initials, ''))
      and coalesce(r.is_admin, false)
  ) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.survey_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.survey_versions(id) on delete cascade,
  prompt text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.survey_versions(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  respondent_id uuid not null references auth.users(id),
  respondent_initials text,
  response_date date not null default current_date,
  selected_initials text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint survey_responses_unique unique (version_id, question_id, respondent_id, response_date)
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'survey_versions_touch_updated_at') then
    create trigger survey_versions_touch_updated_at
      before update on public.survey_versions
      for each row execute function public.touch_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'survey_responses_touch_updated_at') then
    create trigger survey_responses_touch_updated_at
      before update on public.survey_responses
      for each row execute function public.touch_updated_at();
  end if;
end $$;

create index if not exists survey_questions_version_sort_idx
  on public.survey_questions (version_id, sort_order);

create index if not exists survey_responses_lookup_idx
  on public.survey_responses (version_id, question_id, response_date);

create index if not exists survey_responses_respondent_idx
  on public.survey_responses (respondent_id, response_date);

create unique index if not exists survey_versions_live_unique
  on public.survey_versions (is_live)
  where is_live;

alter table public.survey_versions enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'survey_versions_select_all') then
    create policy "survey_versions_select_all" on public.survey_versions
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_versions_admin_insert') then
    create policy "survey_versions_admin_insert" on public.survey_versions
      for insert with check (public.has_admin_access());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_versions_admin_update') then
    create policy "survey_versions_admin_update" on public.survey_versions
      for update using (public.has_admin_access()) with check (public.has_admin_access());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_versions_admin_delete') then
    create policy "survey_versions_admin_delete" on public.survey_versions
      for delete using (public.has_admin_access());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'survey_questions_select_all') then
    create policy "survey_questions_select_all" on public.survey_questions
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_questions_admin_insert') then
    create policy "survey_questions_admin_insert" on public.survey_questions
      for insert with check (public.has_admin_access());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_questions_admin_update') then
    create policy "survey_questions_admin_update" on public.survey_questions
      for update using (public.has_admin_access()) with check (public.has_admin_access());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_questions_admin_delete') then
    create policy "survey_questions_admin_delete" on public.survey_questions
      for delete using (public.has_admin_access());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'survey_responses_select_self') then
    create policy "survey_responses_select_self" on public.survey_responses
      for select using (respondent_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_responses_select_admin') then
    create policy "survey_responses_select_admin" on public.survey_responses
      for select using (public.has_admin_access());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_responses_insert_self') then
    create policy "survey_responses_insert_self" on public.survey_responses
      for insert with check (respondent_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_responses_update_self') then
    create policy "survey_responses_update_self" on public.survey_responses
      for update using (respondent_id = auth.uid()) with check (respondent_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_responses_delete_self') then
    create policy "survey_responses_delete_self" on public.survey_responses
      for delete using (respondent_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'survey_responses_admin_write') then
    create policy "survey_responses_admin_write" on public.survey_responses
      for all using (public.has_admin_access()) with check (true);
  end if;
end $$;
