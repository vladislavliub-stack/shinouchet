-- Add comments without changing disposal decisions or record contents.
begin;
alter table public.work_visits add column if not exists comments jsonb not null default '[]'::jsonb;

create or replace function public.work_comment(p_id uuid,p_version integer,p_comment text)
returns public.work_visits language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid(); actor_name text; old public.work_visits; result public.work_visits; entry jsonb;
begin
 select login into actor_name from public.work_members where user_id=actor;
 if actor_name is null then raise exception 'Нет доступа' using errcode='42501'; end if;
 if p_comment is null or length(trim(p_comment))=0 or length(p_comment)>2000 then
  raise exception 'Напишите комментарий (до 2000 символов)' using errcode='22023';
 end if;
 select * into old from public.work_visits where id=p_id for update;
 if not found then raise exception 'Запись не найдена' using errcode='22023'; end if;
 if p_version is null or old.version<>p_version then raise exception 'Запись уже изменена. Откройте её заново.' using errcode='40001'; end if;
 if old.deleted_at is not null then raise exception 'Запись удалена' using errcode='22023'; end if;
 entry=jsonb_build_object('at',now(),'by',actor_name,'userId',actor,'text',trim(p_comment));
 update public.work_visits set comments=comments||jsonb_build_array(entry),version=version+1,
  history=history||jsonb_build_array(jsonb_build_object('at',now(),'by',actor_name,'field','comment','new',trim(p_comment)))
  where id=p_id returning * into result;
 return result;
end $$;
revoke all on function public.work_comment(uuid,integer,text) from public,anon;
grant execute on function public.work_comment(uuid,integer,text) to authenticated;

create or replace function public.work_reviewer_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if auth.uid()='5932f3b8-6300-4a29-a7a8-ce002e8ddf31'::uuid then
  if TG_OP<>'UPDATE' then raise exception 'Доступны просмотр, комментарии и согласование' using errcode='42501'; end if;
  if (to_jsonb(NEW)-array['status','reviewed_by','reviewed_at','review_comment','comments','version','history'])
   is distinct from (to_jsonb(OLD)-array['status','reviewed_by','reviewed_at','review_comment','comments','version','history']) then
   raise exception 'Доступны просмотр, комментарии и согласование' using errcode='42501';
  end if;
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end $$;
revoke all on function public.work_reviewer_guard() from public,anon,authenticated;
commit;
