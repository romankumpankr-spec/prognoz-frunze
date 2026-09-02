-- Прогноз-Фрунзе — initial database schema.
-- Applied to the production Supabase project as migration initial_league_schema.
-- Keep all participant, match and prediction data in Supabase; deployments must not erase it.

create extension if not exists pgcrypto;

create type public.user_role as enum ('player', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.user_role not null default 'player',
  created_at timestamptz not null default now()
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  home_score integer,
  away_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_scores check ((home_score is null and away_score is null) or (home_score >= 0 and away_score >= 0))
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create index matches_round_idx on public.matches(round_id, kickoff_at);
create index predictions_user_idx on public.predictions(user_id);
create index predictions_match_idx on public.predictions(match_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.match_outcome(home integer, away integer)
returns integer language sql immutable
as $$ select case when home > away then 1 when home < away then -1 else 0 end; $$;

create or replace function public.prediction_points(predicted_home integer, predicted_away integer, actual_home integer, actual_away integer)
returns integer language sql immutable
as $$
  select case
    when predicted_home = actual_home and predicted_away = actual_away then 3
    when predicted_home - predicted_away = actual_home - actual_away then 2
    when public.match_outcome(predicted_home, predicted_away) = public.match_outcome(actual_home, actual_away) then 1
    else 0
  end;
$$;

create or replace view public.prediction_results with (security_invoker = true) as
select p.id, p.user_id, p.match_id, p.home_score as predicted_home, p.away_score as predicted_away,
       m.home_score as actual_home, m.away_score as actual_away,
       case when m.home_score is null or m.away_score is null then null
            else public.prediction_points(p.home_score, p.away_score, m.home_score, m.away_score) end as points
from public.predictions p join public.matches m on m.id = p.match_id;

create or replace view public.standings with (security_invoker = true) as
select pf.id as user_id, pf.display_name, coalesce(sum(pr.points), 0)::integer as points,
       count(pr.points)::integer as scored_matches
from public.profiles pf
left join public.prediction_results pr on pr.user_id = pf.id and pr.points is not null
group by pf.id, pf.display_name;

alter table public.profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

create policy "profiles readable by authenticated users" on public.profiles for select to authenticated using (true);
create policy "users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "rounds readable by authenticated users" on public.rounds for select to authenticated using (true);
create policy "admins manage rounds" on public.rounds for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "matches readable by authenticated users" on public.matches for select to authenticated using (true);
create policy "admins manage matches" on public.matches for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "users read own predictions or published predictions" on public.predictions for select to authenticated using (
  user_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.matches m where m.id = predictions.match_id
      and (m.kickoff_at <= now() or (m.home_score is not null and m.away_score is not null))
  )
);

create policy "users create own predictions before kickoff" on public.predictions for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.matches m where m.id = predictions.match_id and m.kickoff_at > now())
);

create policy "users update own predictions before kickoff" on public.predictions for update to authenticated
using (user_id = auth.uid() and exists (select 1 from public.matches m where m.id = predictions.match_id and m.kickoff_at > now()))
with check (user_id = auth.uid() and exists (select 1 from public.matches m where m.id = predictions.match_id and m.kickoff_at > now()));

create policy "admins manage predictions" on public.predictions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger matches_touch_updated_at before update on public.matches for each row execute procedure public.touch_updated_at();
create trigger predictions_touch_updated_at before update on public.predictions for each row execute procedure public.touch_updated_at();
