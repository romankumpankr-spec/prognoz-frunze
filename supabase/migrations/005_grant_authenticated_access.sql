grant select on table public.profiles to authenticated;
grant select on table public.rounds to authenticated;
grant select on table public.matches to authenticated;
grant select on table public.predictions to authenticated;
grant select on table public.chat_messages to authenticated;
grant select on table public.prediction_results to authenticated;
grant select on table public.standings to authenticated;
grant select on table public.confirmed_prediction_board to authenticated;

grant insert, update, delete on table public.rounds to authenticated;
grant insert, update, delete on table public.matches to authenticated;
grant insert, update, delete on table public.predictions to authenticated;
grant insert, delete on table public.chat_messages to authenticated;
