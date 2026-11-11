-- Voices Across History: class & co-op codes, and the Explorers collection.
-- NOT yet applied to the shared IntexiaU Institute project. Review, then apply once
-- (Supabase dashboard SQL editor, a Supabase branch, or `supabase db push`).
-- Everything here is additive: no existing table or row is changed or removed,
-- except that vah_feedback.app is widened to allow 'explorers'.

-- A class or co-op: one code, a seat limit, and a leader who can read members' conversations.
create table if not exists public.vah_groups (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[A-Z0-9-]{4,40}$'),
  name         text not null,
  kind         text not null default 'class' check (kind in ('class', 'coop')),
  leader_email text not null check (leader_email = lower(trim(leader_email))),
  seats        integer not null check (seats between 1 and 500),
  starts_at    timestamptz not null default now(),
  expires_at   timestamptz,
  is_active    boolean not null default true,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists vah_groups_leader_idx on public.vah_groups (leader_email);

create table if not exists public.vah_group_members (
  group_id     uuid not null references public.vah_groups(id) on delete cascade,
  email        text not null check (email = lower(trim(email))),
  auth_user_id uuid references auth.users(id) on delete set null,
  joined_at    timestamptz not null default now(),
  primary key (group_id, email)
);
create index if not exists vah_group_members_email_idx on public.vah_group_members (email);

-- One saved exchange per figure reply, for members only. round_id ties roundtable turns together.
create table if not exists public.vah_group_turns (
  id         bigserial primary key,
  group_id   uuid not null references public.vah_groups(id) on delete cascade,
  email      text not null,
  app        text not null check (app in ('republic', 'philosophers', 'inventors', 'explorers')),
  figure_id  text not null,
  round_id   text,
  question   text not null,
  answer     text not null,
  created_at timestamptz not null default now()
);
create index if not exists vah_group_turns_group_idx on public.vah_group_turns (group_id, created_at desc);

-- Service-role only, like vah_users: RLS on with no policies, so only server routes can read or write.
alter table public.vah_groups        enable row level security;
alter table public.vah_group_members enable row level security;
alter table public.vah_group_turns   enable row level security;
comment on table public.vah_groups is 'Voices class & co-op codes. Service-role only by design; do NOT add anon/authenticated policies.';
comment on table public.vah_group_members is 'Members who joined a Voices class or co-op code. Service-role only.';
comment on table public.vah_group_turns is 'Saved member conversations a class or co-op leader can read. Members are told this on joining. Service-role only.';

-- Joins a code with a seat check that holds under concurrent sign-ups.
create or replace function public.vah_join_group(p_code text, p_email text, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.vah_groups;
  taken integer;
  addr text := lower(trim(p_email));
begin
  select * into g from public.vah_groups where code = upper(trim(p_code)) for update;
  if not found or not g.is_active then
    return jsonb_build_object('error', 'invalid');
  end if;
  if g.starts_at > now() then
    return jsonb_build_object('error', 'not_started');
  end if;
  if g.expires_at is not null and g.expires_at <= now() then
    return jsonb_build_object('error', 'expired');
  end if;
  if exists (select 1 from public.vah_group_members where group_id = g.id and email = addr) then
    update public.vah_group_members set auth_user_id = coalesce(auth_user_id, p_user) where group_id = g.id and email = addr;
    return jsonb_build_object('ok', true, 'already', true, 'name', g.name, 'kind', g.kind);
  end if;
  select count(*) into taken from public.vah_group_members where group_id = g.id;
  if taken >= g.seats then
    return jsonb_build_object('error', 'full');
  end if;
  insert into public.vah_group_members (group_id, email, auth_user_id) values (g.id, addr, p_user);
  return jsonb_build_object('ok', true, 'name', g.name, 'kind', g.kind);
end;
$$;
revoke all on function public.vah_join_group(text, text, uuid) from public, anon, authenticated;
grant execute on function public.vah_join_group(text, text, uuid) to service_role;

-- Let feedback from the new Explorers collection through.
alter table public.vah_feedback drop constraint if exists vah_feedback_app_check;
alter table public.vah_feedback add constraint vah_feedback_app_check
  check (app in ('republic', 'philosophers', 'inventors', 'explorers'));
