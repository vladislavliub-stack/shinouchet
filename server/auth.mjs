// No service-role key: all database requests carry the signed-in user's token.
export const MEMBERS={
 '98f3a667-bca0-4bb6-9f2b-da011ee69ceb':'Vlad',
 '5932f3b8-6300-4a29-a7a8-ce002e8ddf31':'OlgaAnat',
};
export const BASE='https://wiuuthuxeqrufcewumey.supabase.co';
export const PUBLIC_KEY='sb_publishable_Z3dWJkNlPYdSDarh5HDYYg_X52GPxr8';
const ACCESS='__Host-work-access',REFRESH='__Host-work-refresh';
export class ApiError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export function reply(body,status=200,cookies=[]){const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Vary':'Cookie'});cookies.forEach(c=>headers.append('Set-Cookie',c));return new Response(JSON.stringify(body),{status,headers});}
export function guard(request){const origin=request.headers.get('origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError('Нет доступа',403);}
export async function body(request){guard(request);if(!(request.headers.get('content-type')||'').startsWith('application/json'))throw new ApiError('Нужен JSON',415);if(Number(request.headers.get('content-length'))>65536)throw new ApiError('Слишком большая запись',413);const text=await request.text();if(text.length>65536)throw new ApiError('Слишком большая запись',413);try{return JSON.parse(text);}catch{throw new ApiError('Неверные данные');}}
const cookie=(name,value,age)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export const sessionCookies=data=>[cookie(ACCESS,data.access_token,2592000),cookie(REFRESH,data.refresh_token,2592000)];
export const clearCookies=()=>[cookie(ACCESS,'',0),cookie(REFRESH,'',0)];
function readCookie(request,name){const value=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));try{return value?decodeURIComponent(value.slice(name.length+1)):'';}catch{return '';}}
export async function supabase(path,{token='',fetcher=fetch,method='GET',data}={}){
 const response=await fetcher(BASE+path,{method,headers:{apikey:PUBLIC_KEY,...(token?{Authorization:'Bearer '+token}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(15000)});
 let result;try{result=await response.json();}catch{throw new ApiError('База временно недоступна',503);}
 return {ok:response.ok,status:response.status,data:result};
}
export async function session(request,{fetcher=fetch}={}){
 let token=readCookie(request,ACCESS),cookies=[];
 let result=token?await supabase('/auth/v1/user',{token,fetcher}):{ok:false};
 if(!result.ok){
  const refresh=readCookie(request,REFRESH);if(!refresh)throw new ApiError('Войдите в приложение',401);
  const next=await supabase('/auth/v1/token?grant_type=refresh_token',{method:'POST',data:{refresh_token:refresh},fetcher});
  if(!next.ok||!next.data.access_token)throw new ApiError('Войдите снова',401);
  token=next.data.access_token;cookies=sessionCookies(next.data);
  // getUser verifies the token with Auth, rather than trusting a decoded JWT.
  result=await supabase('/auth/v1/user',{token,fetcher});
 }
 const id=result.data?.id;
 if(!result.ok||!MEMBERS[id])throw new ApiError('Нет доступа',403);
 const member=await supabase('/rest/v1/work_members?select=login&user_id=eq.'+encodeURIComponent(id),{token,fetcher});
 if(!member.ok)throw new ApiError('База ещё не настроена',503);
 if(!member.data?.length)throw new ApiError('Нет доступа',403);
 return {token,cookies,user:{id,login:MEMBERS[id]}};
}
export function failure(error,cookies=[]){return reply({error:error instanceof ApiError?error.message:'Нет связи с базой. Повторите.'},error.status||503,error.status===401?clearCookies():cookies);}
