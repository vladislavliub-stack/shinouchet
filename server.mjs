import http from 'node:http';import {readFile,stat} from 'node:fs/promises';import path from 'node:path';
import sessions from './api/session.js';import records from './api/records.js';import speech from './api/transcribe.js';
const root=path.resolve('dist'),port=Number(process.env.PORT||4173),handlers={'/api/session':sessions.fetch,'/api/records':records.fetch,'/api/transcribe':speech.fetch};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png'};
http.createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(handlers[pathname]){
  const parts=[];let size=0;for await(const part of req){size+=part.length;if(size>4*1024*1024){res.writeHead(413);res.end();return;}parts.push(part);}
  const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(parts)}:{})});
  const response=await handlers[pathname](request);res.statusCode=response.status;
  response.headers.forEach((v,k)=>{if(k!=='set-cookie')res.setHeader(k,v);});
  if(response.headers.getSetCookie().length)res.setHeader('Set-Cookie',response.headers.getSetCookie());
  res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 if(pathname.startsWith('/api/')||pathname.startsWith('/server/'))throw Error();
 let target=path.resolve(root,'.'+pathname);if(target!==root&&!target.startsWith(root+path.sep))throw Error();
 if((await stat(target)).isDirectory())target=path.join(target,'index.html');
 const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(bytes);
}catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`ШиноУчёт: http://localhost:${port}`));
