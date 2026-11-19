// Creates a NEW, memory-backed QA container; never reads/writes the active application database.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { writeFile, mkdir, open } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { Client } from 'pg';

const key = process.env.ANALIZA_QA_SSH_KEY;
const host = process.env.ANALIZA_QA_SSH_HOST;
const directory = resolve(process.env.ANALIZA_QA_PRIVATE_DIRECTORY || '');
assert.ok(key && host && /^[a-zA-Z0-9@.-]+$/.test(host));
assert.ok(process.env.ANALIZA_QA_PRIVATE_DIRECTORY && relative(process.cwd(),directory).startsWith('..'), 'Private QA directory must be outside Git');
const name = `analiza-clinical-qa-${Date.now()}`;
const remoteEnv = `/root/${name}.env`;
const sshArgs = ['-i',key,'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=10'];
const adminSecret = randomBytes(32).toString('hex'), runtimeSecret = randomBytes(32).toString('hex'), qaSecret = randomBytes(32).toString('hex');
function run(binary,args,options={}) { const result=spawnSync(binary,args,{encoding:'utf8',timeout:120000,windowsHide:true,...options}); assert.equal(result.status,0,`${binary} failed: ${(result.stderr||'').replaceAll(adminSecret,'[redacted]').replaceAll(runtimeSecret,'[redacted]').replaceAll(qaSecret,'[redacted]')}`); return result.stdout.trim(); }
await mkdir(directory,{recursive:true});
const envPath=resolve(directory,`${name}.env`);
await writeFile(envPath,`POSTGRES_PASSWORD=${adminSecret}\nPOSTGRES_DB=analiza_qa\n`,{mode:0o600});
run('scp',[...sshArgs,envPath,`${host}:${remoteEnv}`]);
run('ssh',[...sshArgs,host,`chmod 600 ${remoteEnv}`]);
// Use the same PostgreSQL image already running, without reading its environment/secrets.
const dbImage=run('ssh',[...sshArgs,host,"docker inspect analiza-contabo-staging-database-1 --format '{{.Image}}'"]);
assert.match(dbImage,/^sha256:[a-f0-9]{64}$/);
run('ssh',[...sshArgs,host,`docker run -d --name ${name} --memory 768m --cpus 1 --pids-limit 128 --env-file ${remoteEnv} --tmpfs /var/lib/postgresql:rw,size=1073741824 -p 127.0.0.1:15439:5432 ${dbImage}`]);
const log=await open(resolve(directory,`${name}-tunnel.log`),'a');
const tunnel=spawn('ssh',[...sshArgs,'-o','ExitOnForwardFailure=yes','-N','-L','127.0.0.1:55439:127.0.0.1:15439',host],{detached:true,windowsHide:true,stdio:['ignore',log.fd,log.fd]});
tunnel.unref(); await log.close();
const env={...process.env,PGHOST:'127.0.0.1',PGPORT:'55439',PGDATABASE:'analiza_qa',PGUSER:'postgres',PGPASSWORD:adminSecret,ANALIZA_DATA_MODE:'postgresql',ANALIZA_DB_TRANSPORT:'tcp',ANALIZA_QA_MODE:'1',ANALIZA_MIGRATION_APPROVED:'1',ANALIZA_PG_RUNTIME_ROLE:'analiza_clinical_qa_runtime',ANALIZA_QA_PASSWORD:qaSecret};
let admin;
for(let attempt=0;attempt<30;attempt++) { const client=new Client({host:env.PGHOST,port:Number(env.PGPORT),database:env.PGDATABASE,user:env.PGUSER,password:adminSecret,connectionTimeoutMillis:1500}); try { await client.connect();admin=client;break; } catch {await client.end().catch(()=>{});await new Promise(resolve=>setTimeout(resolve,500));} }
assert.ok(admin,'QA PostgreSQL tunnel ready');
await admin.query('CREATE ROLE analiza_clinical_qa_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '+admin.escapeLiteral(runtimeSecret));
for(const flag of ['--migrate','--migrate','--seed-synthetic']) run(process.execPath,['scripts/deployment/db-command.mjs',flag],{env});
await admin.end();
const runtimeEnv={...env,PGUSER:'analiza_clinical_qa_runtime',PGPASSWORD:runtimeSecret};
const privateState={container:name,host,remoteEnv,tunnelPid:tunnel.pid,localPort:55439,adminSecret,runtimeSecret,qaSecret,env:Object.fromEntries(Object.entries(runtimeEnv).filter(([key])=>/^(PG|ANALIZA_)/.test(key)))};
await writeFile(resolve(directory,'clinical-qa-state.json'),JSON.stringify(privateState,null,2),{mode:0o600});
console.log(JSON.stringify({status:'READY',container:name,database:'analiza_qa',localPort:55439,repeatedMigration:true,syntheticOnly:true,credentialsPrinted:false}));
