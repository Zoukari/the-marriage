create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mariage_settings (
  id            int primary key default 1 check (id = 1),
  groom         text not null default 'Atick Ali Aouad',
  bride         text not null default '',
  event_date    date not null default '2026-11-06',
  men_time      text not null default '13h00',
  women_time    text not null default '15h00',
  venue         text not null default '',
  maps_url      text not null default '',
  card_bg       text,
  qr_x          numeric not null default 38.3,
  qr_y          numeric not null default 63.3,
  qr_size       numeric not null default 26.6,
  name_x        numeric not null default 51.45,
  name_y        numeric not null default 41.2,
  name_w        numeric not null default 66,
  name_color    text not null default '#3f4a2f',
  admin_hash    text not null
);

alter table public.mariage_settings add column if not exists groom_y     numeric not null default 8.9;
alter table public.mariage_settings add column if not exists bride_y     numeric not null default 26.2;
alter table public.mariage_settings add column if not exists couple_w    numeric not null default 70;
alter table public.mariage_settings add column if not exists couple_size numeric not null default 9.5;
alter table public.mariage_settings add column if not exists groom_color text    not null default '#4b5634';
alter table public.mariage_settings add column if not exists bride_color text    not null default '#b3a06a';

insert into public.mariage_settings (id, admin_hash)
values (1, extensions.crypt('mariage2026', extensions.gen_salt('bf')))
on conflict (id) do nothing;

create table if not exists public.mariage_guests (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  first_name     text not null,
  last_name      text not null default '',
  phone_prefix   text not null default '+253',
  phone          text not null default '',
  gender         text not null check (gender in ('H','F')),
  sent_at        timestamptz,
  checked_in_at  timestamptz,
  created_at     timestamptz not null default now()
);

alter table public.mariage_guests add column if not exists checked_in_by text;

create table if not exists public.mariage_access (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  pin_hash    text not null,
  role        text not null default 'scan' check (role in ('scan','team')),
  active      boolean not null default true,
  last_login  timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.mariage_access add column if not exists quota int not null default 0;
alter table public.mariage_access drop constraint if exists mariage_access_role_check;
alter table public.mariage_access add constraint mariage_access_role_check check (role in ('scan','team','invite'));

alter table public.mariage_guests add column if not exists invited_by uuid references public.mariage_access(id) on delete set null;
alter table public.mariage_guests add column if not exists invited_by_name text;

alter table public.mariage_guests add column if not exists entries int not null default 1;
alter table public.mariage_guests add column if not exists entries_used int not null default 0;
alter table public.mariage_guests add column if not exists last_checkin_at timestamptz;
update public.mariage_guests set entries_used = 1 where checked_in_at is not null and entries_used = 0;

alter table public.mariage_settings enable row level security;
alter table public.mariage_access enable row level security;
alter table public.mariage_guests   enable row level security;

create or replace function public.mariage_check(p_pw text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from mariage_settings where id = 1 and admin_hash = crypt(p_pw, admin_hash)) then
    raise exception 'MOT_DE_PASSE_INVALIDE';
  end if;
end $$;

create or replace function public.mariage_auth(p_pw text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare a mariage_access;
begin
  if p_pw is null or p_pw = '' then return null; end if;
  if exists (select 1 from mariage_settings where id = 1 and admin_hash = crypt(p_pw, admin_hash)) then
    return json_build_object('role','admin','name','Admin');
  end if;
  select * into a from mariage_access where active and pin_hash = crypt(p_pw, pin_hash) limit 1;
  if a.id is not null then
    return json_build_object('role', a.role, 'name', a.name, 'id', a.id, 'quota', a.quota,
      'used', (select coalesce(sum(entries),0) from mariage_guests where invited_by = a.id));
  end if;
  return null;
end $$;

create or replace function public.mariage_need(p_pw text, p_level text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare me json; r text;
begin
  me := mariage_auth(p_pw);
  if me is null then raise exception 'MOT_DE_PASSE_INVALIDE'; end if;
  r := me->>'role';
  if r = 'admin' or p_level = 'any'
     or (p_level = 'team' and r = 'team')
     or (p_level = 'guests' and r in ('team','invite'))
     or (p_level = 'scan' and r in ('team','scan')) then
    return me;
  end if;
  raise exception 'ACCES_REFUSE';
end $$;

create or replace function public.mariage_whoami(p_pw text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare me json;
begin
  me := mariage_auth(p_pw);
  if me is null then perform pg_sleep(0.8); return null; end if;
  if me->>'id' is not null then
    update mariage_access set last_login = now() where id = (me->>'id')::uuid;
  end if;
  return me;
end $$;

create or replace function public.mariage_list_access(p_pw text)
returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_check(p_pw);
  return coalesce((select json_agg(json_build_object('id',a.id,'name',a.name,'role',a.role,'active',a.active,
    'quota',a.quota,'used',(select coalesce(sum(g.entries),0) from mariage_guests g where g.invited_by = a.id),
    'last_login',a.last_login,'created_at',a.created_at) order by a.created_at) from mariage_access a), '[]'::json);
end $$;

create or replace function public.mariage_save_access(p_pw text, p jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare pin text := nullif(trim(coalesce(p->>'pin','')),'');
begin
  perform mariage_check(p_pw);
  if pin is not null then
    if pin !~ '^[0-9]{4,8}$' then raise exception 'PIN_INVALIDE'; end if;
    if exists (select 1 from mariage_access where pin_hash = crypt(pin, pin_hash)
               and id is distinct from (p->>'id')::uuid)
       or exists (select 1 from mariage_settings where admin_hash = crypt(pin, admin_hash)) then
      raise exception 'PIN_DEJA_UTILISE';
    end if;
  end if;
  if p->>'id' is null then
    if pin is null then raise exception 'PIN_INVALIDE'; end if;
    if coalesce(trim(p->>'name'),'') = '' then raise exception 'NOM_REQUIS'; end if;
    insert into mariage_access (name, pin_hash, role, quota)
    values (trim(p->>'name'), crypt(pin, gen_salt('bf')), coalesce(p->>'role','scan'),
            greatest(coalesce((p->>'quota')::int, 0), 0));
  else
    update mariage_access set
      name     = coalesce(nullif(trim(p->>'name'),''), name),
      role     = coalesce(p->>'role', role),
      active   = coalesce((p->>'active')::boolean, active),
      quota    = greatest(coalesce((p->>'quota')::int, quota), 0),
      pin_hash = case when pin is null then pin_hash else crypt(pin, gen_salt('bf')) end
    where id = (p->>'id')::uuid;
  end if;
end $$;

create or replace function public.mariage_delete_access(p_pw text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_check(p_pw);
  delete from mariage_access where id = p_id;
end $$;

create or replace function public.mariage_login(p_pw text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  return exists (select 1 from mariage_settings where id = 1 and admin_hash = crypt(p_pw, admin_hash));
end $$;

create or replace function public.mariage_change_password(p_pw text, p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_check(p_pw);
  if length(coalesce(p_new,'')) < 6 then raise exception 'MOT_DE_PASSE_TROP_COURT'; end if;
  update mariage_settings set admin_hash = crypt(p_new, gen_salt('bf')) where id = 1;
end $$;

create or replace function public.mariage_get_settings(p_pw text)
returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_need(p_pw, 'any');
  return (select to_jsonb(s) - 'admin_hash' from mariage_settings s where id = 1);
end $$;

create or replace function public.mariage_save_settings(p_pw text, p jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_check(p_pw);
  update mariage_settings set
    groom      = coalesce(p->>'groom', groom),
    bride      = coalesce(p->>'bride', bride),
    event_date = coalesce((p->>'event_date')::date, event_date),
    men_time   = coalesce(p->>'men_time', men_time),
    women_time = coalesce(p->>'women_time', women_time),
    venue      = coalesce(p->>'venue', venue),
    maps_url   = coalesce(p->>'maps_url', maps_url),
    card_bg    = case when p ? 'card_bg' then nullif(p->>'card_bg','') else card_bg end,
    qr_x       = coalesce((p->>'qr_x')::numeric, qr_x),
    qr_y       = coalesce((p->>'qr_y')::numeric, qr_y),
    qr_size    = coalesce((p->>'qr_size')::numeric, qr_size),
    name_x     = coalesce((p->>'name_x')::numeric, name_x),
    name_y     = coalesce((p->>'name_y')::numeric, name_y),
    name_w     = coalesce((p->>'name_w')::numeric, name_w),
    name_color = coalesce(p->>'name_color', name_color),
    groom_y     = coalesce((p->>'groom_y')::numeric, groom_y),
    bride_y     = coalesce((p->>'bride_y')::numeric, bride_y),
    couple_w    = coalesce((p->>'couple_w')::numeric, couple_w),
    couple_size = coalesce((p->>'couple_size')::numeric, couple_size),
    groom_color = coalesce(p->>'groom_color', groom_color),
    bride_color = coalesce(p->>'bride_color', bride_color)
  where id = 1;
end $$;

create or replace function public.mariage_list_guests(p_pw text)
returns setof public.mariage_guests language plpgsql security definer set search_path = public, extensions as $$
declare me json;
begin
  me := mariage_need(p_pw, 'any');
  if me->>'role' = 'invite' then
    return query select * from mariage_guests where invited_by = (me->>'id')::uuid order by created_at desc;
  else
    return query select * from mariage_guests order by created_at desc;
  end if;
end $$;

create or replace function public.mariage_upsert_guest(p_pw text, p jsonb)
returns public.mariage_guests language plpgsql security definer set search_path = public, extensions as $$
declare r mariage_guests; me json; inv boolean; mid uuid; n int;
begin
  me := mariage_need(p_pw, 'guests');
  inv := me->>'role' = 'invite';
  mid := (me->>'id')::uuid;
  n := greatest(coalesce((p->>'entries')::int, 1), 1);
  if coalesce(trim(p->>'first_name'),'') = '' then raise exception 'PRENOM_REQUIS'; end if;
  if inv then
    perform 1 from mariage_access where id = mid for update;
    if (select coalesce(sum(entries),0) from mariage_guests
        where invited_by = mid and id is distinct from (p->>'id')::uuid) + n
       > (select quota from mariage_access where id = mid) then
      raise exception 'QUOTA_ATTEINT';
    end if;
  end if;
  if p->>'id' is null then
    insert into mariage_guests (first_name, last_name, phone_prefix, phone, gender, entries, invited_by, invited_by_name)
    values (trim(p->>'first_name'), trim(coalesce(p->>'last_name','')),
            coalesce(p->>'phone_prefix','+253'), coalesce(p->>'phone',''), p->>'gender', n,
            mid, case when me->>'role' = 'admin' then null else me->>'name' end)
    returning * into r;
  else
    update mariage_guests set
      first_name   = trim(p->>'first_name'),
      last_name    = trim(coalesce(p->>'last_name','')),
      phone_prefix = coalesce(p->>'phone_prefix', phone_prefix),
      phone        = coalesce(p->>'phone', phone),
      gender       = coalesce(p->>'gender', gender),
      entries      = n
    where id = (p->>'id')::uuid and (not inv or invited_by = mid)
    returning * into r;
    if r.id is null then raise exception 'ACCES_REFUSE'; end if;
  end if;
  return r;
end $$;

create or replace function public.mariage_delete_guest(p_pw text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me json;
begin
  me := mariage_need(p_pw, 'guests');
  delete from mariage_guests where id = p_id
    and (me->>'role' <> 'invite' or invited_by = (me->>'id')::uuid);
end $$;

create or replace function public.mariage_mark_sent(p_pw text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me json;
begin
  me := mariage_need(p_pw, 'guests');
  update mariage_guests set sent_at = now() where id = p_id
    and (me->>'role' <> 'invite' or invited_by = (me->>'id')::uuid);
end $$;

create or replace function public.mariage_reset_checkin(p_pw text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_need(p_pw, 'team');
  update mariage_guests set checked_in_at = null, checked_in_by = null, entries_used = 0, last_checkin_at = null where id = p_id;
end $$;

create or replace function public.mariage_scan_lookup(p_pw text, p_token text)
returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_need(p_pw, 'scan');
  return (select row_to_json(g) from mariage_guests g where token = p_token);
end $$;

create or replace function public.mariage_scan_confirm(p_pw text, p_token text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare r mariage_guests; me json;
begin
  me := mariage_need(p_pw, 'scan');
  update mariage_guests set entries_used = entries_used + 1,
      checked_in_at = coalesce(checked_in_at, now()), last_checkin_at = now(),
      checked_in_by = me->>'name'
    where token = p_token and entries_used < entries
    returning * into r;
  if r.id is null then
    select * into r from mariage_guests where token = p_token;
    if r.id is null then return json_build_object('status','unknown'); end if;
    return json_build_object('status','already','guest', row_to_json(r));
  end if;
  return json_build_object('status','ok','guest', row_to_json(r));
end $$;

create or replace function public.mariage_get_invitation(p_token text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare g mariage_guests;
begin
  select * into g from mariage_guests where token = p_token;
  if g.id is null then return null; end if;
  return json_build_object(
    'guest', json_build_object('first_name', g.first_name, 'last_name', g.last_name,
                               'gender', g.gender, 'token', g.token, 'entries', g.entries),
    'settings', (select to_jsonb(s) - 'admin_hash' from mariage_settings s where id = 1)
  );
end $$;

revoke all on public.mariage_settings, public.mariage_guests, public.mariage_access from anon, authenticated;
revoke execute on function public.mariage_check(text), public.mariage_auth(text), public.mariage_need(text,text) from public, anon, authenticated;
grant execute on function
  public.mariage_login(text),
  public.mariage_whoami(text),
  public.mariage_list_access(text),
  public.mariage_save_access(text,jsonb),
  public.mariage_delete_access(text,uuid),
  public.mariage_change_password(text,text),
  public.mariage_get_settings(text),
  public.mariage_save_settings(text,jsonb),
  public.mariage_list_guests(text),
  public.mariage_upsert_guest(text,jsonb),
  public.mariage_delete_guest(text,uuid),
  public.mariage_mark_sent(text,uuid),
  public.mariage_reset_checkin(text,uuid),
  public.mariage_scan_lookup(text,text),
  public.mariage_scan_confirm(text,text),
  public.mariage_get_invitation(text)
to anon, authenticated;
