#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, json, math, subprocess, sys
from pathlib import Path
from typing import Optional, Tuple
import cv2
import numpy as np


def hms_ms(seconds: float) -> str:
    ms_total=int(round(max(0,seconds)*1000)); h,rem=divmod(ms_total,3600000); m,rem=divmod(rem,60000); s,ms=divmod(rem,1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

def slug(seconds: float) -> str:
    ms_total=int(round(max(0,seconds)*1000)); h,rem=divmod(ms_total,3600000); m,rem=divmod(rem,60000); s,ms=divmod(rem,1000)
    return f"{h:02d}h{m:02d}m{s:02d}s{ms:03d}ms"

def probe(video: str):
    p=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames,duration','-of','json',video],capture_output=True,text=True,check=True)
    d=json.loads(p.stdout)['streams'][0]
    num,den=map(float,d['r_frame_rate'].split('/')); fps=num/den
    return int(d['width']),int(d['height']),fps,float(d.get('duration') or 0),int(d.get('nb_frames') or 0)

def diff_metrics(a,b,threshold=14):
    diff=cv2.absdiff(a,b); mean=float(diff.mean()); mask=(diff>=threshold).astype(np.uint8)*255
    k=np.ones((3,3),np.uint8); mask=cv2.morphologyEx(mask,cv2.MORPH_OPEN,k); mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,k)
    return float(np.count_nonzero(mask))/mask.size,mean,mask

def dhash(gray,hash_size=16):
    img=cv2.resize(gray,(hash_size+1,hash_size),interpolation=cv2.INTER_AREA); diff=img[:,1:]>img[:,:-1]
    v=0
    for bit in diff.flatten(): v=(v<<1)|int(bit)
    return v

def bbox(mask):
    ys,xs=np.where(mask>0)
    if len(xs)==0: return ''
    return f"{int(xs.min())},{int(ys.min())},{int(xs.max()+1)},{int(ys.max()+1)}"

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('out_dir')
    ap.add_argument('--fps',type=float,default=12.5); ap.add_argument('--width',type=int,default=320)
    ap.add_argument('--start',type=float,default=0.0); ap.add_argument('--end',type=float,default=0.0)
    ap.add_argument('--min-event-gap',type=float,default=.32); ap.add_argument('--state-area',type=float,default=.010); ap.add_argument('--state-mean',type=float,default=1.15)
    ap.add_argument('--abrupt-area',type=float,default=.030); ap.add_argument('--motion-area',type=float,default=.0045); ap.add_argument('--settle-frames',type=int,default=3)
    args=ap.parse_args(); out=Path(args.out_dir); out.mkdir(parents=True,exist_ok=True)
    sw,sh,source_fps,duration,source_frames=probe(args.video)
    ah=max(2,int(round(sh*args.width/sw))); ah-=ah%2
    clip_end = args.end if args.end > 0 else duration
    clip_duration = max(0.0, clip_end - args.start)
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-threads','1']
    if args.start > 0: cmd += ['-ss', str(args.start)]
    cmd += ['-i',args.video]
    if clip_duration > 0 and (args.start > 0 or args.end > 0): cmd += ['-t', str(clip_duration)]
    cmd += ['-an','-vf',f'fps={args.fps},scale={args.width}:{ah}:flags=area,format=gray','-f','rawvideo','-pix_fmt','gray','-']
    proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=10**7)
    frame_bytes=args.width*ah; prev=None; last=None; last_hash=None; last_event=-1e9; in_motion=False; low_run=0; records=[]; idx=0
    def add(t,kind,state_area,state_mean,motion_area,motion_mean,state_mask,gray):
        nonlocal last,last_hash,last_event
        hv=dhash(gray)
        if last_hash is not None and (hv^last_hash).bit_count()<=1 and state_area<.018: return False
        eid=f"E{len(records)+1:05d}"
        records.append({'id':eid,'time_seconds':round(t,3),'timestamp':hms_ms(t),'time_slug':slug(t),'kind':kind,'source_frame':int(round(t*source_fps)),'analysis_frame':idx,'analysis_bbox_xyxy':bbox(state_mask),'state_changed_area_ratio':round(state_area,6),'state_mean_absdiff':round(state_mean,4),'motion_changed_area_ratio':round(motion_area,6),'motion_mean_absdiff':round(motion_mean,4)})
        last=gray.copy(); last_hash=hv; last_event=t; return True
    assert proc.stdout
    while True:
        raw=proc.stdout.read(frame_bytes)
        if len(raw)<frame_bytes: break
        gray=np.frombuffer(raw,dtype=np.uint8).reshape((ah,args.width)); gray=cv2.GaussianBlur(gray,(5,5),0); t=args.start + idx/args.fps
        if prev is None:
            prev=gray.copy(); last=gray.copy(); last_hash=dhash(gray); last_event=-1e9
            add(t,'video_start',1,255,0,0,np.zeros_like(gray),gray); idx+=1; continue
        ma,mm,mmask=diff_metrics(gray,prev); sa,sm,smask=diff_metrics(gray,last)
        moving=ma>=args.motion_area or mm>=.65
        if moving: in_motion=True; low_run=0
        elif in_motion: low_run+=1
        elapsed=t-last_event
        if ma>=args.abrupt_area and elapsed>=args.min_event_gap:
            add(t,'abrupt_change',sa,sm,ma,mm,smask,gray)
        elif sa>=args.state_area and sm>=args.state_mean and elapsed>=max(args.min_event_gap,.48) and not moving:
            add(t,'stable_change',sa,sm,ma,mm,smask,gray)
        elif sa>=args.state_area and sm>=args.state_mean and elapsed>=.90:
            add(t,'motion_progress',sa,sm,ma,mm,smask,gray)
        if in_motion and low_run>=args.settle_frames:
            if sa>=.004 or sm>=.70: add(t,'settled',sa,sm,ma,mm,smask,gray)
            in_motion=False; low_run=0
        prev=gray.copy(); idx+=1
        if idx%5000==0: print(f"processed {idx} analysis frames / {t:.1f}s, events={len(records)}",file=sys.stderr)
    proc.stdout.close(); rc=proc.wait(); err=proc.stderr.read().decode('utf-8','replace') if proc.stderr else ''
    if rc!=0: raise SystemExit(f"ffmpeg failed {rc}: {err}")
    meta={'source_video':args.video,'source_width':sw,'source_height':sh,'source_fps':source_fps,'source_duration_seconds':duration,'source_frame_count':source_frames,'analysis_fps':args.fps,'analysis_width':args.width,'analysis_height':ah,'processed_start_seconds':args.start,'processed_end_seconds':clip_end,'analysis_frames_processed':idx,'event_count':len(records),'detector':vars(args)}
    (out/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    (out/'event_manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    fields=list(records[0].keys()) if records else []
    with (out/'event_manifest.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(records)
    print(json.dumps(meta,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
