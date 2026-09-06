create or replace view public.submitted_prediction_board
with (security_invoker = false) as
select
  p.match_id,
  p.user_id,
  pf.display_name,
  p.home_score as predicted_home_score,
  p.away_score as predicted_away_score,
  p.submitted_at,
  case
    when m.result_confirmed and m.home_score is not null and m.away_score is not null
      then public.prediction_points(p.home_score, p.away_score, m.home_score, m.away_score)
    else null::integer
  end as points,
  m.home_team,
  m.away_team,
  m.kickoff_at,
  m.home_score,
  m.away_score,
  m.round_id
from public.predictions p
join public.profiles pf on pf.id = p.user_id
join public.matches m on m.id = p.match_id
where p.submitted_at is not null
  and (
    public.is_admin()
    or exists (
      select 1
      from public.predictions viewer_p
      join public.matches viewer_m on viewer_m.id = viewer_p.match_id
      where viewer_p.user_id = auth.uid()
        and viewer_p.submitted_at is not null
        and viewer_m.round_id = m.round_id
    )
  );

grant select on public.submitted_prediction_board to authenticated;
