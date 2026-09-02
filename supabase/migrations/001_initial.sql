-- Прогноз-Фрунзе: базовая схема данных.
-- ВАЖНО: данные участников и матчи хранятся в Supabase, а не в исходном коде.

create extension if not exists pgcrypto;

type noop;
