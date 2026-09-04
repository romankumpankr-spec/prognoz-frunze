alter table public.matches
  add column if not exists result_confirmed boolean not null default false;

create or replace view public.prediction_results
with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.match_id,
  p.home_score as predicted_home,
  p.away_score as predicted_away,
  m.home_score as actual_home,
  m.away_score as actual_away,
  case
    when not m.result_confirmed or m.home_score is null or m.away_score is null then null::integer
    else prediction_points(p.home_score, p.away_score, m.home_score, m.away_score)
  end as points
from public.predictions p
join public.matches m on m.id = p.match_id;

create or replace view public.confirmed_prediction_board
with (security_invoker = true) as
select
  p.match_id,
  p.user_id,
  pf.display_name,
  p.home_score as predicted_home_score,
  p.away_score as predicted_away_score,
  pr.points,
  m.home_team,
  m.away_team,
  m.kickoff_at,
  m.home_score,
  m.away_score,
  m.round_id
from public.predictions p
join public.profiles pf on pf.id = p.user_id
join public.matches m on m.id = p.match_id
left join public.prediction_results pr on pr.id = p.id
where m.result_confirmed = true;

-- A participant may see own predictions at any time, while other participants
-- become visible only after the administrator confirms the match result.
drop policy if exists "users read own predictions or published predictions" on public.predictions;
drop policy if exists "users read own predictions or confirmed predictions" on public.predictions;
create policy "users read own predictions or confirmed predictions"
on public.predictions
for select to authenticated
using (
  user_id = auth.uid()
  or is_admin()
  or exists (
    select 1
    from public.matches m
    where m.id = predictions.match_id
      and m.result_confirmed = true
  )
);
