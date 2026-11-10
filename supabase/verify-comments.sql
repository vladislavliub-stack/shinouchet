begin;
insert into public.work_visits(id,plate,operations,visited_at,created_by,disposal,status)
values ('30000000-0000-4000-8000-000000000001','К565ОО','["Замена"]',now(),'98f3a667-bca0-4bb6-9f2b-da011ee69ceb',false,'none'),
 ('30000000-0000-4000-8000-000000000002','Е142СВ','["Ремонт"]',now(),'98f3a667-bca0-4bb6-9f2b-da011ee69ceb',true,'pending'),
 ('30000000-0000-4000-8000-000000000003','А123ВС','["Ремонт"]',now(),'5932f3b8-6300-4a29-a7a8-ce002e8ddf31',false,'none');
set local role authenticated;
select set_config('request.jwt.claim.sub','5932f3b8-6300-4a29-a7a8-ce002e8ddf31',true);
do $$ declare r public.work_visits; begin
 r=public.work_comment('30000000-0000-4000-8000-000000000001',1,'  Проверить пробег  ');
 if r.status<>'none' or r.disposal or r.comments->0->>'text'<>'Проверить пробег' or r.comments->0->>'by'<>'OlgaAnat' or r.history->-1->>'field'<>'comment' then raise exception 'COMMENT OR AUDIT FAILED'; end if;
 begin perform public.work_comment(r.id,1,'Повтор'); raise exception 'STALE ACCEPTED'; exception when serialization_failure then null; end;
 begin perform public.work_comment(r.id,2,'   '); raise exception 'EMPTY ACCEPTED'; exception when invalid_parameter_value then null; end;
 begin perform public.work_comment(r.id,2,repeat('а',2001)); raise exception 'LONG ACCEPTED'; exception when invalid_parameter_value then null; end;
 begin update public.work_visits set comments='[]' where id=r.id; raise exception 'DIRECT WRITE'; exception when insufficient_privilege then null; end;
 begin perform public.work_save(r.id,2,'К565ОО','["Другое"]','',now(),false); raise exception 'REVIEWER EDIT'; exception when insufficient_privilege then null; end;
 r=public.work_comment('30000000-0000-4000-8000-000000000003',1,'Старая своя запись');
 r=public.work_action('30000000-0000-4000-8000-000000000002',1,'approve','Утиль согласован');
 r=public.work_comment(r.id,2,'Отдельный комментарий');
 if r.status<>'approved' or r.review_comment<>'Утиль согласован' or r.reviewed_by<>auth.uid() then raise exception 'DECISION LOST'; end if;
end $$;
select set_config('request.jwt.claim.sub','98f3a667-bca0-4bb6-9f2b-da011ee69ceb',true);
do $$ declare r public.work_visits; begin
 r=public.work_save('30000000-0000-4000-8000-000000000001',2,'К565ОО','["Замена"]','Правка',now(),false);
 if jsonb_array_length(r.comments)<>1 then raise exception 'EDIT LOST COMMENT'; end if;
 r=public.work_comment(r.id,3,'Ответ автора');
 if jsonb_array_length(r.comments)<>2 then raise exception 'SECOND COMMENT LOST'; end if;
 r=public.work_action(r.id,4,'delete','');
 begin perform public.work_comment(r.id,5,'Удалено'); raise exception 'DELETED COMMENT ACCEPTED'; exception when invalid_parameter_value then null; end;
 r=public.work_action(r.id,5,'restore','');
 if jsonb_array_length(r.comments)<>2 then raise exception 'RESTORE LOST COMMENT'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
do $$ begin
 begin perform public.work_comment('30000000-0000-4000-8000-000000000001',6,'Чужой'); raise exception 'OUTSIDER ACCEPTED'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.work_comment('30000000-0000-4000-8000-000000000001',6,'Аноним'); raise exception 'ANON ACCEPTED'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: general comments, audit, decisions preserved, edit/restore retained, conflict/empty/deleted/anonymous/outsider/direct writes blocked. Fixtures rolled back.' as verification;
