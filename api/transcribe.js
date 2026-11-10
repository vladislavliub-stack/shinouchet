import {session,failure,ApiError} from '../server/auth.mjs';
import {canWrite} from '../src/permissions.js';
const MODEL='whisper-large-v3';
const MAX_BYTES=3*1024*1024;
const limits=new Map();
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function transcribeRequest(request,{env=process.env,fetcher=fetch,now=Date.now}={}){
 // The key stays on the server. No AI Gateway or paid fallback.
 const token=env.GROQ_API_KEY;
 if(request.method==='GET')return json({ready:!!token,model:MODEL,provider:'groq'});
 if(request.method!=='POST')return json({error:'Метод не поддерживается'},405);
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return json({error:'Нет доступа'},403);
 const type=(request.headers.get('content-type')||'').split(';')[0];
 if(!['audio/webm','audio/mp4','audio/wav','audio/x-wav','audio/mpeg','audio/ogg','application/octet-stream'].includes(type))return json({error:'Неверный аудиоформат'},415);
 if(!token)return json({error:'Сервис речи не подключён',code:'setup_required'},503);
 if(Number(request.headers.get('content-length'))>MAX_BYTES)return json({error:'Запись слишком длинная'},413);
 const ip=request.headers.get('x-real-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'local';
 const time=now();let limit=limits.get(ip);
 if(!limit||time-limit.start>3600000){limit={start:time,count:0};limits.set(ip,limit);}
 if(limit.count>=20)return json({error:'Слишком много попыток. Попробуйте позже.'},429);
 const audio=new Uint8Array(await request.arrayBuffer());
 if(audio.byteLength<100)return json({error:'Пустая запись'},400);
 if(audio.byteLength>MAX_BYTES)return json({error:'Запись слишком длинная'},413);
 limit.count++;
 if(limits.size>1000)for(const [key,value]of limits)if(time-value.start>3600000)limits.delete(key);
 try{
  const form=new FormData();
  const extensions={'audio/webm':'webm','audio/mp4':'m4a','audio/wav':'wav','audio/x-wav':'wav','audio/mpeg':'mp3','audio/ogg':'ogg'};
  form.append('file',new Blob([audio],{type}),'recording.'+(extensions[type]||'webm'));
  form.append('model',MODEL);
  form.append('language','ru');
  form.append('temperature','0');
  form.append('response_format','json');
  form.append('prompt','Шиномонтаж. Госномер диктуют именами: Константин 565 Ольга Ольга; Евгений 142 Светлана Владимир. Замена колёс, балансировка, ремонт прокола, вентиль, правка диска.');
  const upstream=await fetcher('https://api.groq.com/openai/v1/audio/transcriptions',{
   method:'POST',signal:AbortSignal.timeout(55000),
   headers:{Authorization:'Bearer '+token},body:form,
  });
  const data=await upstream.json();
  if(!upstream.ok){
   const detail=data.error||data;
   const code=typeof detail==='object'?(detail.code||detail.type):'upstream_error';
   console.error('transcription_failed',{status:upstream.status,code});
   const setup=['customer_verification_required','insufficient_credits','insufficient_quota','authentication_error','invalid_api_key','unauthorized'].includes(code)||[401,402,403].includes(upstream.status);
   // Return setup links only, never raw upstream errors, headers, or credentials.

   if(upstream.status===429)return json({error:'Лимит Groq. Повторите позже.',code:'rate_limit'},429);
   return json({error:setup?'Проверьте ключ Groq':'Сервис речи недоступен. Повторите.',code:setup?'setup_required':String(code)},setup?503:502);
  }
  if(!data.text?.trim())return json({error:'Не удалось разобрать речь. Повторите.'},422);
  return json({text:data.text.trim()});
 }catch(error){console.error('transcription_failed',{code:error.name});return json({error:'Нет ответа от сервиса речи. Повторите.'},504);}
}
export async function authenticatedTranscribe(request,{authSession=session,...options}={}){
 try{const s=await authSession(request,options);if(!canWrite(s.user))throw new ApiError('Запись доступна только Vlad',403);const response=await transcribeRequest(request,options);s.cookies.forEach(c=>response.headers.append('Set-Cookie',c));return response;}catch(error){return failure(error);}
}
export default {fetch:authenticatedTranscribe};
