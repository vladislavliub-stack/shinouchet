export const statusNames={none:'—',pending:'🟡 Ждёт проверки',approved:'✅ Согласовано',rejected:'❌ Отклонено',commented:'💬 Прокомментировано'};
export const memberNames={'98f3a667-bca0-4bb6-9f2b-da011ee69ceb':'Vlad','5932f3b8-6300-4a29-a7a8-ce002e8ddf31':'OlgaAnat'};
export function fromCloud(r){return {id:r.id,plate:r.plate,operations:r.operations,note:r.note,time:r.visited_at,createdAt:r.created_at,createdBy:r.created_by,author:memberNames[r.created_by]||'Пользователь',version:r.version,disposal:r.disposal,status:r.status,reviewedBy:r.reviewed_by,reviewer:memberNames[r.reviewed_by]||'',reviewedAt:r.reviewed_at,reviewComment:r.review_comment,deletedAt:r.deleted_at,comments:r.comments||[],history:r.history||[],demo:false};}
export async function api(path,options={}){
 let response;try{response=await fetch('./api/'+path,{cache:'no-store',credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal:options.signal||AbortSignal.timeout(25000)});}catch{throw new Error('Нет связи. Черновик сохранён.');}
 let data;try{data=await response.json();}catch{throw new Error('Сервис недоступен');}
 if(!response.ok){const error=new Error(data.error||'Ошибка сервера');error.status=response.status;throw error;}return data;
}
