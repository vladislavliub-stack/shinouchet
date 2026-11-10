-- Narrow OlgaAnat's existing access. Review RPCs keep working; creation,
-- imports and content/deletion changes are blocked even via direct Supabase RPC.
create or replace function public.work_reviewer_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if auth.uid()='5932f3b8-6300-4a29-a7a8-ce002e8ddf31'::uuid then
  if TG_OP<>'UPDATE' then
   raise exception 'Доступны просмотр и согласование' using errcode='42501';
  end if;
  if (to_jsonb(NEW)-array['status','reviewed_by','reviewed_at','review_comment','comments','version','history'])
   is distinct from (to_jsonb(OLD)-array['status','reviewed_by','reviewed_at','review_comment','version','history']) then
   raise exception 'Доступны просмотр и согласование' using errcode='42501';
  end if;
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end $$;
create or replace trigger work_reviewer_guard before insert or update or delete
on public.work_visits for each row execute function public.work_reviewer_guard();
revoke all on function public.work_reviewer_guard() from public,anon,authenticated;
