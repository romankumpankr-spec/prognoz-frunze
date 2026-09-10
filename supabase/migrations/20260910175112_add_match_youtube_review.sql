alter table public.matches
  add column if not exists youtube_url text;
