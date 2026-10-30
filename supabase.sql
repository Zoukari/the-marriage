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
  qr_x          numeric not null default 35.0,
  qr_y          numeric not null default 34.44,
  qr_size       numeric not null default 30.0,
  name_x        numeric not null default 52.06,
  name_y        numeric not null default 64.33,
  name_w        numeric not null default 60,
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

alter table public.mariage_settings enable row level security;
alter table public.mariage_guests   enable row level security;

create or replace function public.mariage_check(p_pw text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from mariage_settings where id = 1 and admin_hash = crypt(p_pw, admin_hash)) then
    raise exception 'MOT_DE_PASSE_INVALIDE';
  end if;
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
  perform mariage_check(p_pw);
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
begin
  perform mariage_check(p_pw);
  return query select * from mariage_guests order by created_at desc;
end $$;

create or replace function public.mariage_upsert_guest(p_pw text, p jsonb)
returns public.mariage_guests language plpgsql security definer set search_path = public, extensions as $$
declare r mariage_guests;
begin
  perform mariage_check(p_pw);
  if coalesce(trim(p->>'first_name'),'') = '' then raise exception 'PRENOM_REQUIS'; end if;
  if p->>'id' is null then
    insert into mariage_guests (first_name, last_name, phone_prefix, phone, gender)
    values (trim(p->>'first_name'), trim(coalesce(p->>'last_name','')),
            coalesce(p->>'phone_prefix','+253'), coalesce(p->>'phone',''), p->>'gender')
    returning * into r;
  else
    update mariage_guests set
      first_name   = trim(p->>'first_name'),
      last_name    = trim(coalesce(p->>'last_name','')),
      phone_prefix = coalesce(p->>'phone_prefix', phone_prefix),
      phone        = coalesce(p->>'phone', phone),
      gender       = coalesce(p->>'gender', gender)
    where id = (p->>'id')::uuid
    returning * into r;
  end if;
  return r;
end $$;

create or replace function public.mariage_delete_guest(p_pw text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_check(p_pw);
  delete from mariage_guests where id = p_id;
end $$;

create or replace function public.mariage_mark_sent(p_pw text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_check(p_pw);
  update mariage_guests set sent_at = now() where id = p_id;
end $$;

create or replace function public.mariage_reset_checkin(p_pw text, p_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_check(p_pw);
  update mariage_guests set checked_in_at = null where id = p_id;
end $$;

create or replace function public.mariage_scan_lookup(p_pw text, p_token text)
returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform mariage_check(p_pw);
  return (select row_to_json(g) from mariage_guests g where token = p_token);
end $$;

create or replace function public.mariage_scan_confirm(p_pw text, p_token text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare r mariage_guests;
begin
  perform mariage_check(p_pw);
  update mariage_guests set checked_in_at = now()
    where token = p_token and checked_in_at is null
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
                               'gender', g.gender, 'token', g.token),
    'settings', (select to_jsonb(s) - 'admin_hash' from mariage_settings s where id = 1)
  );
end $$;

revoke all on public.mariage_settings, public.mariage_guests from anon, authenticated;
revoke execute on function public.mariage_check(text) from public, anon, authenticated;
grant execute on function
  public.mariage_login(text),
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
