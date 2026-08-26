import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
const {values}=parseArgs({options:{"allow-pending":{type:"boolean",default:false}}});
const allowPending=values["allow-pending"];
const root=process.cwd();
const chaptersRoot=path.join(root,"references/video-audit/chapters");
const reviewsRoot=path.join(root,"video-audit-reviews");

function parseCSV(text){
  const rows=[]; let row=[],field="",q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){ if(c==='"'&&text[i+1]==='"'){field+='"';i++;} else if(c==='"'){q=false;} else field+=c; }
    else { if(c==='"')q=true; else if(c===','){row.push(field);field="";} else if(c==='\n'){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field="";} else field+=c; }
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
  const header=(rows.shift()||[]).map(x=>x.replace(/^\uFEFF/,""));
  return rows.filter(r=>r.some(x=>x!=="")).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??""])));
}
function jpgNames(dir){return fs.existsSync(dir)?new Set(fs.readdirSync(dir).filter(x=>x.toLowerCase().endsWith('.jpg'))):new Set()}
function evidencePathExists(value,source){
  if(!value)return false;
  const candidate=path.isAbsolute(value)?value:path.join(root,value);
  const sourceCandidate=path.join(source,value);
  return (fs.existsSync(candidate)&&fs.statSync(candidate).isFile()) ||
    (fs.existsSync(sourceCandidate)&&fs.statSync(sourceCandidate).isFile());
}
const chapters=fs.readdirSync(chaptersRoot).filter(x=>x.startsWith("CH")&&fs.statSync(path.join(chaptersRoot,x)).isDirectory()).sort();
const results=[];
let failed=false;
for(const ch of chapters){
  const source=path.join(chaptersRoot,ch), review=path.join(reviewsRoot,ch);
  const events=parseCSV(fs.readFileSync(path.join(source,"event_manifest.csv"),"utf8"));
  const requiredIds=new Set(events.map(r=>r.chapter_event_id));
  const eventsById=new Map(events.map(r=>[r.chapter_event_id,r]));
  let receipt={}; try{receipt=JSON.parse(fs.readFileSync(path.join(review,"chapter_review_receipt.json"),"utf8"))}catch{}
  const reviewedIds=new Set(receipt.reviewed_event_ids||[]);
  const notes=fs.existsSync(path.join(review,"event_review_notes.csv"))?parseCSV(fs.readFileSync(path.join(review,"event_review_notes.csv"),"utf8")):[];
  const noteMap=new Map(notes.map(r=>[r.chapter_event_id,r]));
  const missingNotes=[];
  for(const id of requiredIds){
    const r=noteMap.get(id);
    if(!r || !r.visible_change?.trim() || !r.classification?.trim() || !r.confidence?.trim()) missingNotes.push(id);
  }
  const reqEventSheets=jpgNames(path.join(source,"contact_sheets_events"));
  const reqSafetySheets=jpgNames(path.join(source,"contact_sheets_safety"));
  const reqDetails=jpgNames(path.join(source,"detail_crops"));
  const set=(x)=>new Set(x||[]);
  const missing=(a,b)=>[...a].filter(x=>!b.has(x));
  const extra=(a,b)=>[...a].filter(x=>!b.has(x));
  const acknowledgements={read_readme:receipt.read_readme,read_coverage:receipt.read_coverage,read_event_manifest:receipt.read_event_manifest,read_transcript:receipt.read_transcript,checked_exact_clip_for_uncertainties:receipt.checked_exact_clip_for_uncertainties};
  const missingAck=Object.entries(acknowledgements).filter(([,v])=>!v).map(([k])=>k);
  const inventoryErrors=[];
  let inventory={};
  try{inventory=JSON.parse(fs.readFileSync(path.join(review,"chapter_feature_inventory.json"),"utf8"))}
  catch(error){inventoryErrors.push(`inventory:invalid:${error.code||error.name}`)}
  const features=Array.isArray(inventory.features)?inventory.features:[];
  if(features.length===0)inventoryErrors.push("features:empty");
  const expectedChapterId=ch.slice(0,4);
  if(inventory.chapter_id&&inventory.chapter_id!==expectedChapterId)inventoryErrors.push(`chapter_id:${inventory.chapter_id}`);
  if(inventory.chapter&&inventory.chapter!==ch)inventoryErrors.push(`chapter:${inventory.chapter}`);
  if(!inventory.chapter_id&&!inventory.chapter)inventoryErrors.push("chapter:missing");
  const allowedClassifications=new Set(["VISIBLE","VERBAL","INFERRED","UNCERTAIN"]);
  const featureIds=[];
  for(const feature of features){
    const featureId=String(feature.id||"").trim()||"<missing-id>";
    featureIds.push(featureId);
    for(const field of ["id","name","description","classification","confidence"]){
      if(!String(feature[field]||"").trim())inventoryErrors.push(`${featureId}:${field}:missing`);
    }
    if(!allowedClassifications.has(feature.classification))inventoryErrors.push(`${featureId}:classification:${feature.classification||"missing"}`);
    const evidenceItems=Array.isArray(feature.evidence)?feature.evidence:[];
    if(evidenceItems.length===0)inventoryErrors.push(`${featureId}:evidence:empty`);
    for(const [index,evidence] of evidenceItems.entries()){
      const prefix=`${featureId}:evidence:${index+1}`;
      const eventId=String(evidence.chapter_event_id||"").trim();
      if(!requiredIds.has(eventId))inventoryErrors.push(`${prefix}:event:${eventId||"missing"}`);
      else if(evidence.timestamp!==eventsById.get(eventId).timestamp)inventoryErrors.push(`${prefix}:timestamp:${evidence.timestamp||"missing"}`);
      const primaryPath=String(evidence.path||evidence.image||"").trim();
      if(!primaryPath)inventoryErrors.push(`${prefix}:path:missing`);
      else if(!evidencePathExists(primaryPath,source))inventoryErrors.push(`${prefix}:path:not-found:${primaryPath}`);
      const detailCrop=String(evidence.detail_crop||"").trim();
      if(detailCrop&&!evidencePathExists(detailCrop,source))inventoryErrors.push(`${prefix}:detail-crop:not-found:${detailCrop}`);
    }
  }
  const featureIdCounts=new Map();
  for(const featureId of featureIds)featureIdCounts.set(featureId,(featureIdCounts.get(featureId)||0)+1);
  for(const [featureId,count] of featureIdCounts)if(count>1)inventoryErrors.push(`feature-id:duplicate:${featureId}`);
  const problems={
    missing_reviewed_event_ids:missing(requiredIds,reviewedIds),
    unknown_reviewed_event_ids:extra(reviewedIds,requiredIds),
    missing_event_notes:missingNotes,
    missing_event_sheets:missing(reqEventSheets,set(receipt.reviewed_event_contact_sheets)),
    unknown_event_sheets:extra(set(receipt.reviewed_event_contact_sheets),reqEventSheets),
    missing_safety_sheets:missing(reqSafetySheets,set(receipt.reviewed_safety_contact_sheets)),
    unknown_safety_sheets:extra(set(receipt.reviewed_safety_contact_sheets),reqSafetySheets),
    missing_detail_crops:missing(reqDetails,set(receipt.reviewed_detail_crops)),
    unknown_detail_crops:extra(set(receipt.reviewed_detail_crops),reqDetails),
    missing_acknowledgements:missingAck,
    feature_inventory_errors:inventoryErrors.sort()
  };
  const hasProblems=Object.values(problems).some(a=>a.length);
  const pending=(receipt.reviewed_event_ids||[]).length===0 && missingNotes.length===requiredIds.size;
  const passed=!hasProblems;
  if(!passed && !(allowPending&&pending)) failed=true;
  results.push({chapter:ch,required_events:requiredIds.size,passed,pending,...problems});
}
const summary={generated_at:new Date().toISOString(),allow_pending:allowPending,passed:!failed,chapters:results.length,verified:results.filter(r=>r.passed).length,pending:results.filter(r=>r.pending).length,failed:results.filter(r=>!r.passed&&!r.pending).length,results};
fs.writeFileSync(path.join(root,"docs/overnight/VIDEO_AUDIT_VERIFY.json"),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(failed)process.exit(1);
