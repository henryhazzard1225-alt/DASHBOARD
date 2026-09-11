import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalize,sample} from './model.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT||3000);
const connectors=JSON.parse(process.env.CONNECTORS||'[]');
const dataDir=process.env.DATA_DIR||root+'data';
let state={mode:'demo',updatedAt:null,rows:sample()};
try {state=JSON.parse(await readFile(dataDir+'/metrics.json','utf8'));state.rows=normalize(state.rows);} catch(e){if(e.code!=='ENOENT') throw e;}
let queue=Promise.resolve();
async function save(rows) {
  const next={mode:'live',updatedAt:new Date().toISOString(),rows:normalize(rows)};
  const task=queue.then(async()=>{await mkdir(dataDir,{recursive:true});await writeFile(dataDir+'/metrics.tmp',JSON.stringify(next));await rename(dataDir+'/metrics.tmp',dataDir+'/metrics.json');state=next;});
  queue=task.catch(()=>{}); await task;
}
async function body(req) {let text='';for await(const part of req){text+=part;if(Buffer.byteLength(text)>2000000)throw new Error('Payload exceeds 2 MB.');}return JSON.parse(text);}
function tokenOK(req){const expected=process.env.INGEST_TOKEN;if(!expected)return false;const a=Buffer.from(req.headers.authorization||'');const b=Buffer.from('Bearer '+expected);return a.length===b.length&&timingSafeEqual(a,b);}
const assets={'/':['public/index.html','text/html'],'/app.js':['public/app.js','text/javascript'],'/style.css':['public/style.css','text/css']};
http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try {
    if(!['localhost:'+port,'127.0.0.1:'+port].includes(req.headers.host))return send(403,{error:'Invalid host.'});
    if(req.headers.origin && !['http://localhost:'+port,'http://127.0.0.1:'+port].includes(req.headers.origin))return send(403,{error:'Invalid origin.'});
    const path=new URL(req.url,'http://localhost').pathname;
    if(req.method==='GET'&&path==='/api/metrics')return send(200,state);
    if(req.method==='GET'&&path==='/api/connectors')return send(200,connectors.map(({id,name})=>({id,name})));
    if(req.method==='POST') {
      if(path==='/api/ingest'){if(!tokenOK(req))return send(401,{error:'Valid ingest bearer token required.'});await save(await body(req));return send(200,{ok:true});}
      if(req.headers['x-dashboard-request']!=='1')return send(403,{error:'Dashboard request required.'});
      if(path==='/api/import'){await save(await body(req));return send(200,{ok:true});}
      if(path==='/api/sync'){
        const {id}=await body(req);const c=connectors.find(c=>c.id===id);if(!c)return send(404,{error:'Connector not configured.'});
        const url=new URL(c.url);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Connector requires HTTPS without URL credentials.');
        const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:c.tokenEnv&&process.env[c.tokenEnv]?{Authorization:'Bearer '+process.env[c.tokenEnv]}:{}});
        if(!response.ok)throw new Error('Source returned HTTP '+response.status);
        let raw='';for await(const chunk of response.body){raw+=new TextDecoder().decode(chunk);if(Buffer.byteLength(raw)>2000000)throw new Error('Source exceeds 2 MB.');}
        let rows=JSON.parse(raw);for(const key of (c.rowsPath||'').split('.').filter(Boolean))rows=rows?.[key];
        if(c.mapping&&Array.isArray(rows))rows=rows.map(r=>Object.fromEntries(['date','revenue','orders','customers','source'].map(k=>[k,r[c.mapping[k]||k]])));
        await save(rows);return send(200,{ok:true});
      }
    }
    if(req.method==='GET'&&assets[path]){const [file,type]=assets[path];res.writeHead(200,{'Content-Type':type});return res.end(await readFile(root+file));}
    send(404,{error:'Not found.'});
  }catch(e){send(400,{error:e.message});}
}).listen(port,'127.0.0.1',()=>console.log(`DASHBOARD running at http://localhost:${port}`));
