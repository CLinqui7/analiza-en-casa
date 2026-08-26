import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const req = [
  "package.json", "AGENTS.md", "index.html", "app/main.js", "supabase/migrations",
  "references/video-audit/CHAPTERS.json", "references/video-audit/MASTER_EVENT_MANIFEST.csv",
  "references/video-audit/chapters", "video-audit-reviews", "codex/PROMPT_OVERNIGHT_MASTER.md"
];
const errors = [];
const warnings = [];
for (const rel of req) if (!fs.existsSync(path.join(root, rel))) errors.push(`Missing: ${rel}`);

function walk(dir, out=[]) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    if ([".git","node_modules",".next","dist","coverage"].includes(e.name)) continue;
    const p=path.join(dir,e.name);
    if (e.isDirectory()) walk(p,out); else out.push(p);
  }
  return out;
}
const files=walk(root);
let total=0; let max={size:0,file:""};
const suspect=[];
const secretPatterns=[
  /sb_secret_[A-Za-z0-9_-]{12,}/g,
  /service_role\s*[=:]\s*["']?[A-Za-z0-9._-]{20,}/gi,
  /sk-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/g
];
for (const file of files) {
  const st=fs.statSync(file); total+=st.size;
  if (st.size>max.size) max={size:st.size,file:path.relative(root,file)};
  if (st.size>95*1024*1024) errors.push(`File over 95 MiB: ${path.relative(root,file)} (${(st.size/1024/1024).toFixed(1)} MiB)`);
  const rel=path.relative(root,file);
  if (/\.env($|\.)/.test(rel) && rel!==".env.example") errors.push(`Environment file must not be committed: ${rel}`);
  if (st.size<2*1024*1024 && /\.(md|txt|json|js|mjs|sql|yml|yaml|ps1|bat|html|css)$/i.test(file)) {
    const text=fs.readFileSync(file,"utf8");
    for (const pattern of secretPatterns) if (pattern.test(text)) suspect.push(rel);
  }
}
if (suspect.length) errors.push(`Possible secrets in: ${[...new Set(suspect)].join(", ")}`);

const chaptersPath=path.join(root,"references/video-audit/chapters");
const chapters=fs.existsSync(chaptersPath)?fs.readdirSync(chaptersPath).filter(x=>x.startsWith("CH")&&fs.statSync(path.join(chaptersPath,x)).isDirectory()).sort():[];
if (chapters.length!==17) errors.push(`Expected 17 chapters, found ${chapters.length}`);
let events=0, crops=0, clips=0, eventSheets=0, safetySheets=0;
for (const ch of chapters) {
  const dir=path.join(chaptersPath,ch);
  const manifest=path.join(dir,"event_manifest.csv");
  if (!fs.existsSync(manifest)) errors.push(`Missing event manifest: ${ch}`);
  else events += Math.max(0, fs.readFileSync(manifest,"utf8").trim().split(/\r?\n/).length-1);
  const count=(sub,ext)=>{const p=path.join(dir,sub); return fs.existsSync(p)?fs.readdirSync(p).filter(x=>x.toLowerCase().endsWith(ext)).length:0};
  crops += count("detail_crops",".jpg");
  eventSheets += count("contact_sheets_events",".jpg");
  safetySheets += count("contact_sheets_safety",".jpg");
  if (fs.existsSync(path.join(dir,"chapter_video_exact_reference.mp4"))) clips++;
  for (const needed of ["README.md","coverage.json","event_manifest.csv","transcript_raw.txt","CODEX_ANALYZE_THIS_CHAPTER.md","CODEX_IMAGE_BATCHES.md"]) {
    if (!fs.existsSync(path.join(dir,needed))) errors.push(`Missing ${needed} in ${ch}`);
  }
}
const report={
  generated_at:new Date().toISOString(),
  passed:errors.length===0,
  files:files.length,
  total_mib:Number((total/1024/1024).toFixed(2)),
  largest_file:max,
  chapters:chapters.length,
  events,detail_crops:crops,exact_clips:clips,event_contact_sheets:eventSheets,safety_contact_sheets:safetySheets,
  errors,warnings
};
fs.mkdirSync(path.join(root,"docs/overnight"),{recursive:true});
fs.writeFileSync(path.join(root,"docs/overnight/CODEX_PREFLIGHT_REPORT.json"),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(root,"docs/overnight/CODEX_PREFLIGHT_REPORT.md"),`# Codex preflight\n\n- Passed: **${report.passed}**\n- Files: ${report.files}\n- Size: ${report.total_mib} MiB\n- Chapters: ${report.chapters}\n- Events: ${report.events}\n- Detail crops: ${report.detail_crops}\n- Exact clips: ${report.exact_clips}\n- Event sheets: ${report.event_contact_sheets}\n- Safety sheets: ${report.safety_contact_sheets}\n- Largest file: ${report.largest_file.file} (${(report.largest_file.size/1024/1024).toFixed(2)} MiB)\n\n## Errors\n${errors.length?errors.map(x=>`- ${x}`).join("\n"):"None"}\n`);
console.log(JSON.stringify(report,null,2));
if (!report.passed) process.exit(1);
