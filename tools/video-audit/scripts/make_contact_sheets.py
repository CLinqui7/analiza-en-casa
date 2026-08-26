#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, math
from pathlib import Path
import cv2
import numpy as np


def make_sheet(entries, root: Path, out_path: Path, cols: int, rows: int, tile_w: int, tile_h: int):
    label_h = 42
    canvas = np.full((rows*(tile_h+label_h), cols*tile_w, 3), 245, np.uint8)
    for i, e in enumerate(entries):
        r, c = divmod(i, cols)
        p = root / e['full_image']
        img = cv2.imread(str(p))
        if img is None:
            continue
        ih, iw = img.shape[:2]
        scale = min(tile_w/iw, tile_h/ih)
        nw, nh = max(1,int(iw*scale)), max(1,int(ih*scale))
        resized = cv2.resize(img, (nw,nh), interpolation=cv2.INTER_AREA)
        x = c*tile_w + (tile_w-nw)//2
        y = r*(tile_h+label_h) + (tile_h-nh)//2
        canvas[y:y+nh,x:x+nw] = resized
        label = f"{e['id']}  {e['timestamp']}  {e['kind']}"
        cv2.rectangle(canvas,(c*tile_w,r*(tile_h+label_h)+tile_h),(c*tile_w+tile_w,r*(tile_h+label_h)+tile_h+label_h),(25,25,25),-1)
        cv2.putText(canvas,label,(c*tile_w+8,r*(tile_h+label_h)+tile_h+28),cv2.FONT_HERSHEY_SIMPLEX,0.55,(255,255,255),1,cv2.LINE_AA)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_path), canvas, [cv2.IMWRITE_JPEG_QUALITY,88])


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('root')
    ap.add_argument('--manifest',default='event_manifest.csv')
    ap.add_argument('--out',default='contact_sheets_events')
    ap.add_argument('--cols',type=int,default=3)
    ap.add_argument('--rows',type=int,default=3)
    ap.add_argument('--tile-w',type=int,default=640)
    ap.add_argument('--tile-h',type=int,default=281)
    args=ap.parse_args()
    root=Path(args.root)
    with (root/args.manifest).open(encoding='utf-8-sig') as f:
        entries=list(csv.DictReader(f))
    per=args.cols*args.rows
    for idx in range(0,len(entries),per):
        make_sheet(entries[idx:idx+per],root,root/args.out/f"sheet_{idx//per+1:03d}.jpg",args.cols,args.rows,args.tile_w,args.tile_h)
    print(f"created {math.ceil(len(entries)/per)} sheets for {len(entries)} entries")
if __name__=='__main__': main()
