import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const blocked=[];
function walk(dir,out=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if([".git","node_modules",".next","dist","coverage"].includes(e.name))continue;const p=path.join(dir,e.name);e.isDirectory()?walk(p,out):out.push(p)}return out}
const files=walk(root);
for(const file of files){const rel=path.relative(root,file);const st=fs.statSync(file);if(st.size>95*1024*1024)blocked.push(`${rel}: ${(st.size/1024/1024).toFixed(1)} MiB`);if(/^\.env($|\.)/.test(rel)&&rel!=='.env.example')blocked.push(`${rel}: environment file`)}
console.log(`Files checked: ${files.length}`);
console.log(`Repository size: ${(files.reduce((a,f)=>a+fs.statSync(f).size,0)/1024/1024).toFixed(1)} MiB`);
if(blocked.length){console.error('Blocked files:\n'+blocked.map(x=>' - '+x).join('\n'));process.exit(1)}
console.log('GitHub preflight passed. No file exceeds 95 MiB and no local env file was found.');
