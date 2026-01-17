-- Crowd forecasting schema (global across families)
create extension if not exists pgcrypto;

create table if not exists public.crowd_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    type text not null check (type in ('by_year', 'by_deadline')),
    status text not null default 'open' check (status in ('open', 'resolved', 'closed')),
    created_by uuid references public.users(id),
    snapshot_cadence text not null check (snapshot_cadence in ('weekly', 'monthly')),
    date_granularity text check (date_granularity in ('yearly', 'quarterly', 'monthly')),
    min_year integer,
    max_year integer,
    target_date date,
    resolution jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create table if not exists public.crowd_forecasts (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.crowd_events(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    distribution jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (event_id, user_id)
);

create table if not exists public.crowd_snapshot_bins (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.crowd_events(id) on delete cascade,
    snapshot_at date not null,
    distribution jsonb not null,
    created_at timestamptz not null default now(),
    unique (event_id, snapshot_at)
);
