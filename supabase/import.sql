-- Local history is explicitly marked as an unverified archive, never as a server decision.
create or replace function public.work_import(p_id uuid,p_plate text,p_operations jsonb,p_note text,p_time timestamptz,p_disposal boolean,p_history jsonb)
returns public.work_visits language plpgsql security definer set search_path='' as $$
declare result public.work_visits; legacy jsonb;
begin
 if p_history is null or jsonb_typeof(p_history)<>'array' or length(p_history::text)>50000 then
  raise exception 'Слишком большая локальная история' using errcode='22023'; end if;
 result=public.work_save(p_id,0,p_plate,p_operations,p_note,p_time,p_disposal);
 select coalesce(jsonb_agg(jsonb_build_object('at',x->>'at','by','Локальный архив','source','legacy','field',x->>'field','old',x->'old','new',x->'new')),'[]'::jsonb)
 into legacy from jsonb_array_elements(p_history) x
 where x->>'field' in ('plate','operations','note','time') and x->>'at' is not null;
 update public.work_visits set history=legacy||history where id=p_id returning * into result;
 return result;
end $$;
revoke all on function public.work_import(uuid,text,jsonb,text,timestamptz,boolean,jsonb) from public,anon;
grant execute on function public.work_import(uuid,text,jsonb,text,timestamptz,boolean,jsonb) to authenticated;
