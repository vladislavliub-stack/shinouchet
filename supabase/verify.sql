-- Integration checks using the real two identities and real RLS/RPC functions.
-- Every fixture is rolled back, leaving the workshop journal untouched.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','98f3a667-bca0-4bb6-9f2b-da011ee69ceb',true);
select public.work_save('10000000-0000-4000-8000-000000000001',0,'К565ОО','["Замена колёс","Балансировка"]','Проверка',now(),true);
do $$ begin
 begin update public.work_visits set note='bypass'; raise exception 'DIRECT WRITE ALLOWED'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','5932f3b8-6300-4a29-a7a8-ce002e8ddf31',true);
do $$ begin
 if not exists(select 1 from public.work_visits where id='10000000-0000-4000-8000-000000000001') then raise exception 'NOT SHARED'; end if;
 begin perform public.work_save('10000000-0000-4000-8000-000000000001',1,'К565ОО','["Замена"]','',now(),true); raise exception 'NONAUTHOR EDIT ALLOWED'; exception when insufficient_privilege then null; end;
 begin perform public.work_action('10000000-0000-4000-8000-000000000001',1,'delete',''); raise exception 'NONAUTHOR DELETE ALLOWED'; exception when insufficient_privilege then null; end;
end $$;
select public.work_action('10000000-0000-4000-8000-000000000001',1,'approve','Согласна');
do $$ begin
 if not exists(select 1 from public.work_visits where status='approved' and reviewed_by=auth.uid() and review_comment='Согласна' and version=2 and jsonb_array_length(history)=2) then raise exception 'REVIEW NOT AUDITED'; end if;
end $$;
select set_config('request.jwt.claim.sub','98f3a667-bca0-4bb6-9f2b-da011ee69ceb',true);
do $$ begin
 begin perform public.work_save('10000000-0000-4000-8000-000000000001',1,'К565ОО','["Замена"]','',now(),true); raise exception 'STALE WRITE ALLOWED'; exception when serialization_failure then null; end;
end $$;
select public.work_save('10000000-0000-4000-8000-000000000001',2,'К565ОО','["Замена колёс","Балансировка"]','Пробег уточнён',now(),true);
do $$ begin
 if not exists(select 1 from public.work_visits where status='pending' and reviewed_by is null and review_comment='' and version=3) then raise exception 'REVIEW NOT RESET'; end if;
end $$;
select set_config('request.jwt.claim.sub','5932f3b8-6300-4a29-a7a8-ce002e8ddf31',true);
select public.work_action('10000000-0000-4000-8000-000000000001',3,'reject','Маленький пробег');
select set_config('request.jwt.claim.sub','98f3a667-bca0-4bb6-9f2b-da011ee69ceb',true);
select public.work_action('10000000-0000-4000-8000-000000000001',4,'delete','');
do $$ begin if not exists(select 1 from public.work_visits where deleted_at is not null and version=5) then raise exception 'NOT DELETED'; end if; end $$;
select public.work_action('10000000-0000-4000-8000-000000000001',5,'restore','');
do $$ begin if not exists(select 1 from public.work_visits where deleted_at is null and version=6 and status='rejected') then raise exception 'NOT RESTORED'; end if; end $$;
select public.work_import('10000000-0000-4000-8000-000000000002','Е142СВ','["Ремонт"]','Архив',now(),false,'[{"at":"2026-11-01T12:00:00Z","field":"note","old":"до","new":"после"},{"at":"2026-11-01T12:00:00Z","field":"status","new":"approved"}]');
do $$ begin
 if not exists(select 1 from public.work_visits where id='10000000-0000-4000-8000-000000000002' and jsonb_array_length(history)=2 and history->0->>'by'='Локальный архив' and status='none') then raise exception 'IMPORT HISTORY FAILED'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
do $$ begin
 if exists(select 1 from public.work_visits) then raise exception 'OUTSIDER CAN READ'; end if;
 begin perform public.work_action('10000000-0000-4000-8000-000000000001',6,'approve',''); raise exception 'OUTSIDER CAN WRITE'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.work_visits; raise exception 'ANON READ ALLOWED'; exception when insufficient_privilege then null; end;
 begin perform public.work_action('10000000-0000-4000-8000-000000000001',6,'approve',''); raise exception 'ANON RPC ALLOWED'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: shared journal, review, author rights, audit, conflict, reset, trash, restore, import, outsider and anonymous access. Fixtures rolled back.' as verification;
