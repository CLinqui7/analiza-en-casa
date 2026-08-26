#!/usr/bin/env python3
from __future__ import annotations
import argparse,csv,json,subprocess,shutil
from pathlib import Path
import cv2


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('chunk_dir'); ap.add_argument('--quality',type=int,default=4)
    args=ap.parse_args(); chunk=Path(args.chunk_dir)
    meta=json.loads((chunk/'metadata.json').read_text()); start=float(meta['processed_start_seconds']); end=float(meta['processed_end_seconds']); afps=float(meta['analysis_fps'])
    with (chunk/'event_manifest.csv').open(encoding='utf-8-sig') as f: rows=list(csv.DictReader(f))
    out=chunk/'event_frames_full'; crops=chunk/'event_crops'; temp=chunk/'_raw_5fps'
    for p in (out,crops,temp): shutil.rmtree(p,ignore_errors=True); p.mkdir(parents=True)
    # Decode the chapter once at exactly the same cadence as the detector. This is
    # more reliable than a very long select expression and guarantees index parity.
    cmd=['ffmpeg','-y','-hide_banner','-loglevel','error','-threads','4']
    if start>0: cmd += ['-ss',str(start)]
    cmd += ['-i',args.video,'-t',str(end-start),'-an','-vf',f'fps={afps}','-fps_mode','vfr','-q:v',str(args.quality),'-start_number','0',str(temp/'raw_%06d.jpg')]
    subprocess.run(cmd,check=True)
    available=len(list(temp.glob('raw_*.jpg')))
    aw=int(meta['analysis_width']); ah=int(meta['analysis_height']); sw=int(meta['source_width']); sh=int(meta['source_height'])
    missing=[]
    for r in rows:
        analysis_idx=int(r['analysis_frame']); src=temp/f'raw_{analysis_idx:06d}.jpg'
        if not src.exists(): missing.append(analysis_idx); continue
        name=f"{r['id']}_{r['time_slug']}_{r['kind']}.jpg"; dst=out/name; shutil.move(src,dst)
        r['full_image']=str(dst.relative_to(chunk)); r['detail_crop']=''; r['detail_bbox_xyxy']=''
        b=r.get('analysis_bbox_xyxy','')
        if b:
            x0,y0,x1,y1=map(int,b.split(',')); X0=max(0,int(x0*sw/aw)-50); Y0=max(0,int(y0*sh/ah)-30); X1=min(sw,int(x1*sw/aw)+50); Y1=min(sh,int(y1*sh/ah)+30)
            ratio=((X1-X0)*(Y1-Y0))/(sw*sh)
            if .0015<=ratio<=.82:
                img=cv2.imread(str(dst)); crop=img[Y0:Y1,X0:X1]
                if crop.size:
                    if crop.shape[1]<900:
                        scale=min(3.0,900/crop.shape[1]); crop=cv2.resize(crop,(int(crop.shape[1]*scale),int(crop.shape[0]*scale)),interpolation=cv2.INTER_CUBIC)
                    cpath=crops/name.replace('.jpg','_DETAIL.jpg'); cv2.imwrite(str(cpath),crop,[cv2.IMWRITE_JPEG_QUALITY,92]); r['detail_crop']=str(cpath.relative_to(chunk)); r['detail_bbox_xyxy']=f'{X0},{Y0},{X1},{Y1}'
    shutil.rmtree(temp)
    if missing: raise SystemExit(f'Missing {len(missing)} event frames. Examples: {missing[:10]}. Available sampled frames: {available}')
    fields=list(rows[0].keys())
    with (chunk/'event_manifest_with_images.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    (chunk/'event_manifest_with_images.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'chunk':str(chunk),'sampled_frames_decoded':available,'events':len(rows),'full_images':len(list(out.glob('*.jpg'))),'crops':len(list(crops.glob('*.jpg')))},indent=2))
if __name__=='__main__':main()
