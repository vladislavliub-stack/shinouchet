-- ШиноУчёт: one shared workshop, two explicitly admitted accounts.
-- No photos, vehicle directory, public sign-up or direct client writes.
begin;
create table if not exists public.work_members (
  user_id uuid primary key references auth.users(id),
  login text not null unique
);
insert into public.work_members(user_id,login) values
('98f3a667-bca0-4bb6-9f2b-da011ee69ceb','Vlad'),
('5932f3b8-6300-4a29-a7a8-ce002e8ddf31','OlgaAnat')
on conflict(user_id) do update set login=excluded.login;

create table if not exists public.work_visits (
  id uuid primary key,
  plate text not null check (plate ~ '^[АВЕКМНОРСТУХ][0-9]{3}[АВЕКМНОРСТУХ]{2}([0-9]{2,3})?$'),
  operations jsonb not null,
  note text not null default '',
  visited_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.work_members(user_id),
  version integer not null default 1,
  disposal boolean not null default false,
  status text not null default 'none' check(status in ('none','pending','approved','rejected')),
  reviewed_by uuid references public.work_members(user_id),
  reviewed_at timestamptz,
  review_comment text not null default '',
  deleted_at timestamptz,
  history jsonb not null default '[]'::jsonb
);
create index if not exists work_visits_time_idx on public.work_visits(visited_at desc);
create index if not exists work_visits_plate_idx on public.work_visits(plate);
alter table public.work_members enable row level security;
alter table public.work_visits enable row level security;
revoke all on public.work_members,public.work_visits from anon,authenticated;
grant select on public.work_members,public.work_visits to authenticated;

create or replace function public.work_is_member() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.work_members where user_id=(select auth.uid()));
$$;
revoke all on function public.work_is_member() from public,anon;
grant execute on function public.work_is_member() to authenticated;
drop policy if exists work_members_read on public.work_members;
create policy work_members_read on public.work_members for select to authenticated
 using ((select public.work_is_member()));
drop policy if exists work_visits_read on public.work_visits;
create policy work_visits_read on public.work_visits for select to authenticated
 using ((select public.work_is_member()));

create or replace function public.work_save(
 p_id uuid,p_version integer,p_plate text,p_operations jsonb,p_note text,
 p_time timestamptz,p_disposal boolean
) returns public.work_visits
language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid(); actor_name text; old public.work_visits; result public.work_visits;
 events jsonb := '[]'::jsonb; k text; old_data jsonb; new_data jsonb;
begin
 select login into actor_name from public.work_members where user_id=actor;
 if actor_name is null then raise exception 'Нет доступа' using errcode='42501'; end if;
 if p_id is null or p_version is null or p_plate is null or p_plate !~ '^[АВЕКМНОРСТУХ][0-9]{3}[АВЕКМНОРСТУХ]{2}([0-9]{2,3})?$'
   or p_note is null or length(p_note)>4000 or p_time is null or not isfinite(p_time) or p_disposal is null
   or p_operations is null or jsonb_typeof(p_operations)<>'array'
 then raise exception 'Проверьте поля записи' using errcode='22023'; end if;
 if jsonb_array_length(p_operations)<1 or jsonb_array_length(p_operations)>30
   or exists(select 1 from jsonb_array_elements(p_operations) x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}'))<1 or length(x#>>'{}')>250)
 then raise exception 'Проверьте работы' using errcode='22023'; end if;
 select * into old from public.work_visits where id=p_id for update;
 if found then
  if old.created_by<>actor then raise exception 'Изменять запись может её автор' using errcode='42501'; end if;
  if old.version<>p_version then raise exception 'Запись уже изменена. Откройте её заново.' using errcode='40001'; end if;
  if old.deleted_at is not null then raise exception 'Запись удалена. Сначала восстановите её.' using errcode='22023'; end if;
  old_data=jsonb_build_object('plate',old.plate,'operations',old.operations,'note',old.note,'time',old.visited_at,'disposal',old.disposal);
  new_data=jsonb_build_object('plate',p_plate,'operations',p_operations,'note',p_note,'time',p_time,'disposal',p_disposal);
  for k in select jsonb_object_keys(new_data) loop
   if old_data->k is distinct from new_data->k then
    events=events||jsonb_build_array(jsonb_build_object('at',now(),'by',actor_name,'field',k,'old',old_data->k,'new',new_data->k));
   end if;
  end loop;
  if events='[]'::jsonb then return old; end if;
  if old.status in ('approved','rejected') and p_disposal then
   events=events||jsonb_build_array(jsonb_build_object('at',now(),'by',actor_name,'field','status','old',old.status,'new','pending'));
  end if;
  update public.work_visits set plate=p_plate,operations=p_operations,note=p_note,visited_at=p_time,
   disposal=p_disposal,status=case when p_disposal then 'pending' else 'none' end,
   reviewed_by=null,reviewed_at=null,review_comment='',version=version+1,history=history||events
   where id=p_id returning * into result;
 else
  if p_version<>0 then raise exception 'Запись не найдена' using errcode='22023'; end if;
  insert into public.work_visits(id,plate,operations,note,visited_at,created_by,disposal,status,history)
   values(p_id,p_plate,p_operations,p_note,p_time,actor,p_disposal,case when p_disposal then 'pending' else 'none' end,
    jsonb_build_array(jsonb_build_object('at',now(),'by',actor_name,'field','event','new','Создано')))
   returning * into result;
 end if;
 return result;
end $$;

create or replace function public.work_action(p_id uuid,p_version integer,p_action text,p_comment text default '')
returns public.work_visits language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid(); actor_name text; old public.work_visits; result public.work_visits; event jsonb;
begin
 select login into actor_name from public.work_members where user_id=actor;
 if actor_name is null then raise exception 'Нет доступа' using errcode='42501'; end if;
 if p_action is null or p_action not in ('approve','reject','delete','restore') or p_comment is null or length(p_comment)>2000
 then raise exception 'Неверное действие' using errcode='22023'; end if;
 select * into old from public.work_visits where id=p_id for update;
 if not found then raise exception 'Запись не найдена' using errcode='22023'; end if;
 if p_version is null or old.version<>p_version then raise exception 'Запись уже изменена. Откройте её заново.' using errcode='40001'; end if;
 if p_action in ('delete','restore') then
  if old.created_by<>actor then raise exception 'Удалять и восстанавливать может автор' using errcode='42501'; end if;
  if (p_action='delete' and old.deleted_at is not null) or (p_action='restore' and old.deleted_at is null)
   then raise exception 'Откройте запись заново' using errcode='22023'; end if;
  event=jsonb_build_object('at',now(),'by',actor_name,'field','event','new',case when p_action='delete' then 'Удалено' else 'Восстановлено' end);
  update public.work_visits set deleted_at=case when p_action='delete' then now() else null end,
   version=version+1,history=history||jsonb_build_array(event) where id=p_id returning * into result;
 else
  if old.deleted_at is not null or not old.disposal then raise exception 'Запись не требует проверки' using errcode='22023'; end if;
  if old.created_by=actor then raise exception 'Свою запись согласовать нельзя' using errcode='42501'; end if;
  event=jsonb_build_object('at',now(),'by',actor_name,'field','status','old',old.status,'new',case when p_action='approve' then 'approved' else 'rejected' end,'comment',p_comment);
  update public.work_visits set status=case when p_action='approve' then 'approved' else 'rejected' end,
   reviewed_by=actor,reviewed_at=now(),review_comment=p_comment,version=version+1,
   history=history||jsonb_build_array(event) where id=p_id returning * into result;
 end if;
 return result;
end $$;
revoke all on function public.work_save(uuid,integer,text,jsonb,text,timestamptz,boolean) from public,anon;
revoke all on function public.work_action(uuid,integer,text,text) from public,anon;
grant execute on function public.work_save(uuid,integer,text,jsonb,text,timestamptz,boolean) to authenticated;
grant execute on function public.work_action(uuid,integer,text,text) to authenticated;
commit;
