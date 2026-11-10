begin;
-- Fixtures cover records OlgaAnat might have created before losing write access.
insert into public.work_visits(id,plate,operations,visited_at,created_by,disposal,status)
values ('20000000-0000-4000-8000-000000000001','К565ОО','["Замена"]',now(),'98f3a667-bca0-4bb6-9f2b-da011ee69ceb',true,'pending'),
 ('20000000-0000-4000-8000-000000000002','Е142СВ','["Ремонт"]',now(),'5932f3b8-6300-4a29-a7a8-ce002e8ddf31',false,'none');
set local role authenticated;
select set_config('request.jwt.claim.sub','5932f3b8-6300-4a29-a7a8-ce002e8ddf31',true);
do $$ begin
 if not exists(select 1 from public.work_visits where id='20000000-0000-4000-8000-000000000001') then raise exception 'REVIEWER CANNOT READ'; end if;
 begin perform public.work_save('20000000-0000-4000-8000-000000000003',0,'А123ВС','["Замена"]','',now(),false); raise exception 'REVIEWER CREATED'; exception when insufficient_privilege then null; end;
 begin perform public.work_import('20000000-0000-4000-8000-000000000003','А123ВС','["Замена"]','',now(),false,'[]'); raise exception 'REVIEWER IMPORTED'; exception when insufficient_privilege then null; end;
 begin perform public.work_save('20000000-0000-4000-8000-000000000002',1,'Е142СВ','["Ремонт"]','Правка',now(),false); raise exception 'REVIEWER EDITED'; exception when insufficient_privilege then null; end;
 begin perform public.work_action('20000000-0000-4000-8000-000000000002',1,'delete',''); raise exception 'REVIEWER DELETED'; exception when insufficient_privilege then null; end;
end $$;
select public.work_action('20000000-0000-4000-8000-000000000001',1,'approve','Согласна');
select public.work_action('20000000-0000-4000-8000-000000000001',2,'reject','Пробег небольшой');
select set_config('request.jwt.claim.sub','98f3a667-bca0-4bb6-9f2b-da011ee69ceb',true);
select public.work_save('20000000-0000-4000-8000-000000000003',0,'А123ВС','["Замена"]','',now(),false);
select public.work_action('20000000-0000-4000-8000-000000000003',1,'delete','');
select public.work_action('20000000-0000-4000-8000-000000000003',2,'restore','');
rollback;
select 'PASS: OlgaAnat reads and reviews; creation, import, editing and deletion denied; Vlad retains writes. All fixtures rolled back.' as verification;
