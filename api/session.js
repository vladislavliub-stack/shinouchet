import {MEMBERS,ApiError,body,guard,reply,session,supabase,sessionCookies,clearCookies,failure} from '../server/auth.mjs';
export async function sessionRequest(request,{env=process.env,fetcher=fetch}={}){
 try{
  guard(request);
  if(request.method==='GET'){const s=await session(request,{fetcher});return reply({user:s.user},200,s.cookies);}
  if(request.method==='DELETE'){
   try{const s=await session(request,{fetcher});await supabase('/auth/v1/logout?scope=local',{token:s.token,method:'POST',fetcher});}catch{}
   return reply({ok:true},200,clearCookies());
  }
  if(request.method!=='POST')throw new ApiError('Метод не поддерживается',405);
  const input=await body(request);
  const login=String(input.login||'').toLowerCase();
  let emails;try{emails=JSON.parse(env.SHINOUCHET_LOGIN_EMAILS||'{}');}catch{throw new ApiError('Вход ещё не настроен',503);}
  const email=emails[login];
  if(!email||typeof input.password!=='string'||!input.password||input.password.length>256)throw new ApiError('Неверный логин или пароль',401);
  const result=await supabase('/auth/v1/token?grant_type=password',{method:'POST',data:{email,password:input.password},fetcher});
  if(!result.ok){if(result.status===429)throw new ApiError('Много попыток. Попробуйте позже.',429);throw new ApiError('Неверный логин или пароль',401);}
  const {user}=result.data;
  if(!MEMBERS[user?.id]||MEMBERS[user.id].toLowerCase()!==login)throw new ApiError('Нет доступа',403);
  const member=await supabase('/rest/v1/work_members?select=login&user_id=eq.'+user.id,{token:result.data.access_token,fetcher});
  if(!member.ok||!member.data?.length)throw new ApiError('Нет доступа',403);
  return reply({user:{id:user.id,login:MEMBERS[user.id]}},200,sessionCookies(result.data));
 }catch(error){return failure(error);}
}
export default {fetch:sessionRequest};
