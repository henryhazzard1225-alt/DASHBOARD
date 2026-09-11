import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalize,sample} from '../model.mjs';
test('daily metric validation rejects invalid values and duplicates',()=>{
 const row={date:'2026-09-11',source:'Store',revenue:250,orders:5,customers:3};
 assert.deepEqual(normalize([row]),[row]);
 for(const patch of [{date:'2026-02-30'},{revenue:-1},{orders:1.5},{customers:'3'}])assert.throws(()=>normalize([{...row,...patch}]));
 assert.throws(()=>normalize([row,row])); assert.equal(normalize(sample()).length,270);
});
test('API protects writes, validates imports, and persists data after restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dashboard-test-'));let child;
 const start=()=>new Promise((resolve,reject)=>{child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'3198',DATA_DIR:dir,INGEST_TOKEN:'test-only-token',CONNECTORS:'[]'},stdio:['ignore','pipe','pipe']});child.once('error',reject);child.stdout.once('data',resolve);child.stderr.once('data',d=>reject(new Error(String(d))));});
 const stop=()=>new Promise(resolve=>{child.once('exit',resolve);child.kill();});
 const call=(path,body,headers={})=>fetch('http://127.0.0.1:3198'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{await start();assert.equal((await (await call('/api/metrics')).json()).mode,'demo');
 const rows=[{date:'2026-09-11',source:'Test',revenue:99,orders:3,customers:2}];
 assert.equal((await call('/api/import',rows)).status,403);
 assert.equal((await call('/api/ingest',rows)).status,401);
 assert.equal((await call('/api/import',rows,{'X-Dashboard-Request':'1',Origin:'https://evil.example'})).status,403);
 assert.equal((await call('/api/import',rows,{'X-Dashboard-Request':'1'})).status,200);
 assert.equal((await call('/api/import',[{bad:true}],{'X-Dashboard-Request':'1'})).status,400);
 assert.deepEqual((await (await call('/api/metrics')).json()).rows,rows);
 assert.equal((await call('/api/ingest',rows,{Authorization:'Bearer test-only-token'})).status,200);
 assert.equal((await call('/.env')).status,404);
 await stop();await start();assert.deepEqual((await (await call('/api/metrics')).json()).rows,rows);
 }finally{if(child&&child.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});
