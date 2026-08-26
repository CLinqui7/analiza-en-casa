import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const chaptersRoot=path.join(root,"references/video-audit/chapters");
const reviewsRoot=path.join(root,"video-audit-reviews");

function parseCSV(text){
  const rows=[]; let row=[],field="",q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"'){q=false;}else field+=c;}
    else{if(c==='"')q=true;else if(c===','){row.push(field);field="";}else if(c==='\n'){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field="";}else field+=c;}
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
  const header=(rows.shift()||[]).map(x=>x.replace(/^\uFEFF/,""));
  return rows.filter(r=>r.some(x=>x!=="")).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??""])));
}

const chapters=fs.readdirSync(chaptersRoot).filter(x=>x.startsWith("CH")&&fs.statSync(path.join(chaptersRoot,x)).isDirectory()).sort();
const rows=[];
for (const ch of chapters) {
  const manifest=parseCSV(fs.readFileSync(path.join(chaptersRoot,ch,"event_manifest.csv"),"utf8"));
  const required=manifest.length;
  const receiptPath=path.join(reviewsRoot,ch,"chapter_review_receipt.json");
  let receipt={}; try{receipt=JSON.parse(fs.readFileSync(receiptPath,"utf8"))}catch{}
  const ledgerPath=path.join(reviewsRoot,ch,"event_review_notes.csv");
  const ledger=fs.existsSync(ledgerPath)?parseCSV(fs.readFileSync(ledgerPath,"utf8")):[];
  const completedNotes=ledger.filter(r=>r.visible_change?.trim()&&r.classification?.trim()&&r.confidence?.trim()).length;
  rows.push({chapter:ch,required_events:required,reviewed_ids:(receipt.reviewed_event_ids||[]).length,ledger_rows:ledger.length,completed_notes:completedNotes});
}
const report={generated_at:new Date().toISOString(),chapters:rows,total_chapters:rows.length,fully_receipted:rows.filter(r=>r.reviewed_ids===r.required_events).length,fully_noted:rows.filter(r=>r.completed_notes===r.required_events).length};
fs.writeFileSync(path.join(root,"docs/overnight/VIDEO_AUDIT_STATUS.json"),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(root,"docs/overnight/VIDEO_AUDIT_STATUS.md"),`# Video audit status\n\n- Fully receipted: ${report.fully_receipted}/${report.total_chapters}\n- Fully noted: ${report.fully_noted}/${report.total_chapters}\n\n| Chapter | Required | Receipt IDs | Completed notes |\n|---|---:|---:|---:|\n${rows.map(r=>`| ${r.chapter} | ${r.required_events} | ${r.reviewed_ids} | ${r.completed_notes} |`).join("\n")}\n`);
console.log(JSON.stringify(report,null,2));
