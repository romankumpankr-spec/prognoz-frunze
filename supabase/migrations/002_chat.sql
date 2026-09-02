-- Realtime group chat for authenticated league participants.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_at_idx on public.chat_messages(created_at);
alter table public.chat_messages enable row level security;

create policy "authenticated can read chat" on public.chat_messages
  for select to authenticated using (true);
create policy "users can send chat" on public.chat_messages
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users can delete own chat" on public.chat_messages
  for delete to authenticated using (auth.uid() = user_id or public.is_admin());

alter table public.chat_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
