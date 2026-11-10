import {ApiError,body,guard,reply,session,supabase,failure} from '../server/auth.mjs';
import {canWrite} from '../src/permissions.js';
export async function recordsRequest(request,{fetcher=fetch}={}){
 let cookies=[];
 try{
  guard(request);const s=await session(request,{fetcher});cookies=s.cookies;
  if(request.method==='GET'){
   const offset=Number(new URL(request.url).searchParams.get('offset')||0);
   if(!Number.isSafeInteger(offset)||offset<0)throw new ApiError('Неверная страница');
   const result=await supabase('/rest/v1/work_visits?select=*&order=created_at.asc,id.asc&limit=1000&offset='+offset,{token:s.token,fetcher});
   if(!result.ok)throw new ApiError('Не удалось загрузить журнал',503);
   return reply({records:result.data},200,cookies);
  }
  if(request.method!=='POST')throw new ApiError('Метод не поддерживается',405);
  const input=await body(request);let path,data;
  if(!canWrite(s.user)&&!['approve','reject','comment'].includes(input.action))throw new ApiError('Доступны просмотр, комментарии и согласование',403);
  if(input.action==='save'||input.action==='import'){
   const r=input.record||{};path='work_save';data={p_id:r.id,p_version:r.version??0,p_plate:r.plate,p_operations:r.operations,p_note:r.note||'',p_time:r.time,p_disposal:!!r.disposal};
   if(input.action==='import'){path='work_import';delete data.p_version;data.p_history=r.legacyHistory||[];}
  }else if(input.action==='comment'){
   path='work_comment';data={p_id:input.id,p_version:input.version,p_comment:input.comment||''};
  }else if(['approve','reject','delete','restore'].includes(input.action)){
   path='work_action';data={p_id:input.id,p_version:input.version,p_action:input.action,p_comment:input.comment||''};
  }else throw new ApiError('Неверное действие');
  const result=await supabase('/rest/v1/rpc/'+path,{token:s.token,method:'POST',data,fetcher});
  if(!result.ok){const code=result.data?.code;throw new ApiError(result.data?.message||'Не удалось сохранить',code==='40001'||code==='23505'?409:code==='42501'?403:400);}
  const record=Array.isArray(result.data)?result.data[0]:result.data;
  if(!record?.id)throw new ApiError('Нет подтверждения сохранения. Обновите журнал.',503);
  return reply({record},200,cookies);
 }catch(error){return failure(error,cookies);}
}
export default {fetch:recordsRequest};
