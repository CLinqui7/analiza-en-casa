// Builds only Git-published source and starts an isolated synthetic QA web container.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const directory = resolve(process.env.ANALIZA_QA_PRIVATE_DIRECTORY || '');
assert.ok(process.env.ANALIZA_QA_PRIVATE_DIRECTORY && relative(process.cwd(), directory).startsWith('..'));
const statePath = resolve(directory, 'clinical-qa-state.json');
const state = JSON.parse(readFileSync(statePath, 'utf8'));
const key = process.env.ANALIZA_QA_SSH_KEY;
const host = process.env.ANALIZA_QA_SSH_HOST;
assert.ok(key && host === state.host && /^[a-zA-Z0-9@.-]+$/.test(host));
assert.match(state.container, /^analiza-clinical-qa-\d+$/);
assert.equal(state.env.PGDATABASE, 'analiza_qa');
const args = ['-i', key, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes'];
function run(binary, params) {
  return execFileSync(binary, params, { encoding: 'utf8', windowsHide: true, timeout: 900000 });
}
const sha = run('git', ['rev-parse', 'HEAD']).trim();
const branch = run('git', ['branch', '--show-current']).trim();
assert.match(branch, /^codex\/[a-zA-Z0-9._/-]+$/);
assert.ok(run('git', ['ls-remote', 'origin', `refs/heads/${branch}`]).startsWith(sha), 'Publish source to GitHub first');
const archive = resolve(directory, 'web-source.tar');
const remote = `/root/${state.container}-source.tar`;
const release = `/opt/analiza-contabo-staging/qa/${sha}`;
run('git', ['archive', '--format=tar', '-o', archive, sha, '.dockerignore', 'Dockerfile', 'package.json', 'package-lock.json', 'apps/web', 'packages', 'docs/qa', 'database/postgresql', 'database/mongodb', 'scripts/deployment', 'deploy/contabo']);
run('scp', [...args, archive, `${host}:${remote}`]);
run('ssh', [...args, host, `mkdir -p ${release} && tar -xf ${remote} -C ${release}`]);
state.web = `${state.container}-web`;
state.network = state.container;
state.sourceSha = sha;
state.webRemoteEnv = `/root/${state.web}.env`;
const envFile = resolve(directory, 'web.env');
writeFileSync(envFile, [
  'ANALIZA_DATA_MODE=postgresql', 'NEXT_PUBLIC_DATA_MODE=postgresql', 'NEXT_PUBLIC_RELEASE_PROFILE=full',
  'ANALIZA_REGISTRATION_MODE=disabled', 'NEXT_PUBLIC_REGISTRATION_MODE=disabled',
  'ANALIZA_DB_TRANSPORT=tcp', 'ANALIZA_QA_MODE=1', `PGHOST=${state.container}`, 'PGPORT=5432',
  'PGDATABASE=analiza_qa', 'PGUSER=analiza_clinical_qa_runtime', `PGPASSWORD=${state.runtimeSecret}`, '',
].join('\n'), { mode: 0o600 });
run('scp', [...args, envFile, `${host}:${state.webRemoteEnv}`]);
run('ssh', [...args, host, `chmod 600 ${state.webRemoteEnv}`]);
writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
const script = `set -e
cd ${release}
docker build --progress=plain --build-arg SOURCE_SHA=${sha} --build-arg DATA_MODE=postgresql --build-arg REGISTRATION_MODE=disabled --build-arg RELEASE_PROFILE=full --build-arg DEMO_SEED_ENABLED=0 -t analiza-clinical-qa:${sha} .
if ! docker network inspect ${state.network} >/dev/null 2>&1; then docker network create ${state.network}; fi
docker network connect ${state.network} ${state.container} 2>/dev/null || docker inspect ${state.container} --format '{{json .NetworkSettings.Networks}}' | grep -q '${state.network}'
if docker inspect ${state.web} >/dev/null 2>&1; then docker rm -f ${state.web}; fi
docker run -d --name ${state.web} --network ${state.network} --env-file ${state.webRemoteEnv} -p 127.0.0.1:15440:8080 --memory 1536m --cpus 2 analiza-clinical-qa:${sha}
`;
const scriptFile = resolve(directory, 'build-web.sh');
writeFileSync(scriptFile, script);
const remoteScript = `/root/${state.container}-build.sh`;
run('scp', [...args, scriptFile, `${host}:${remoteScript}`]);
run('ssh', [...args, host, `bash ${remoteScript} > /root/${state.container}-build.log 2>&1`]);
const log = openSync(resolve(directory, 'web-tunnel.log'), 'a');
const tunnel = spawn('ssh', [...args, '-o', 'ExitOnForwardFailure=yes', '-N', '-L', '127.0.0.1:55440:127.0.0.1:15440', host], { detached: true, windowsHide: true, stdio: ['ignore', log, log] });
tunnel.unref(); closeSync(log);
state.webTunnelPid = tunnel.pid;
writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ status: 'QA_WEB_STARTED', sha, container: state.web, localPort: 55440, productionChanged: false, credentialsPrinted: false }));
