// Local capture server: serves index.html and stores POSTed frames. Usage: bun tools_server.mjs <port> <outdir>
import{mkdirSync,writeFileSync,readFileSync}from'fs';import{join,basename,dirname}from'path';
const[port,out]=[+process.argv[2],process.argv[3]];mkdirSync(out,{recursive:true});
Bun.serve({port,hostname:'127.0.0.1',maxRequestBodySize:1<<28,async fetch(q){const u=new URL(q.url);
 if(q.method=='POST'){const rel=u.pathname.replace(/^\/+/,'');if(rel.includes('..'))return new Response('bad',{status:400});const f=join(out,rel);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,Buffer.from(await q.arrayBuffer()));return new Response('ok')}
 return new Response(readFileSync(new URL('index.html',import.meta.url)),{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store'}})}});
console.log('serving',port,out);
