-- Allow Vlad to review his own disposal entries, preserving all other checks.
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
  if old.created_by=actor and actor<>'98f3a667-bca0-4bb6-9f2b-da011ee69ceb'::uuid then raise exception 'Свою запись согласовать нельзя' using errcode='42501'; end if;
  event=jsonb_build_object('at',now(),'by',actor_name,'field','status','old',old.status,'new',case when p_action='approve' then 'approved' else 'rejected' end,'comment',p_comment);
  update public.work_visits set status=case when p_action='approve' then 'approved' else 'rejected' end,
   reviewed_by=actor,reviewed_at=now(),review_comment=p_comment,version=version+1,
   history=history||jsonb_build_array(event) where id=p_id returning * into result;
 end if;
 return result;
end $$;
revoke all on function public.work_action(uuid,integer,text,text) from public,anon;
grant execute on function public.work_action(uuid,integer,text,text) to authenticated;
