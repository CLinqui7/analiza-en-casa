#!/usr/bin/env python3
from __future__ import annotations
import csv, json, math, os, shutil, subprocess, re, unicodedata
from pathlib import Path
import cv2
import numpy as np

ROOT=Path('/mnt/data/video_master_audit')
VIDEO=Path('/mnt/data/Analiza en Casa desarrollo (1).mp4')
CHUNK_ROOT=ROOT/'event_chunks_5fps'
SAFETY=ROOT/'safety_frames_1fps'
OUT=ROOT/'codex_video_evidence'
DURATION=3270.96

CHAPTERS=[
('CH01',0,110,'Contexto inicial, acceso, dashboard y listado de pacientes','Referencias iniciales, inicio de sesión, dashboard y navegación al catálogo de pacientes.'),
('CH02',110,282,'Alta y edición de pacientes','Datos personales, seguro, contactos, dirección, ubicación y confirmaciones.'),
('CH03',282,370,'Hospitalización y navegación de preautorizaciones','Listado de hospitalizaciones, filtros, pestañas y entrada al flujo de cotización/seguro.'),
('CH04',370,445,'Cotización: datos generales','Paciente, factura, empresa, foco, descuento, seguro y comentarios.'),
('CH05',445,680,'Cotización: servicios, estudios y medicamentos','Selección, búsqueda, precios, cantidades, disponibilidad y adición de conceptos.'),
('CH06',680,865,'Cotización: insumos, equipos, honorarios, extras y totales','Resto de categorías, resumen, descuentos, cobertura y totalización.'),
('CH07',865,970,'Preautorización, seguro y reclamo','Estados de cotización, envío a seguro, respuesta, reclamo y seguimiento.'),
('CH08',970,1260,'Perfil administrativo, cuentas por cobrar y pagos','Perfil de ejecución, facturas, pagos, ajustes, impresión y estado de cuenta.'),
('CH09',1260,1640,'Hospitalización clínica y reporte de salud','Perfil clínico, diagnósticos, dispositivos, reportes y configuración del documento.'),
('CH10',1640,1895,'Orden médica, tratamientos y tarjeta de medicamentos','Creación de órdenes, tratamientos, indicaciones, tarjeta e historial de tratamientos.'),
('CH11',1895,2008,'Agenda y turnos','Calendario, creación de turno, selección de paciente, recurso, fecha y tipo.'),
('CH12',2008,2203,'Cuentas por pagar y pagos de servicios','Recursos, visitas, montos, estados, filtros y pago a proveedores o personal.'),
('CH13',2203,2392,'Compras y compras al por mayor','Nueva compra, proveedor, factura, ítems, cantidades, impuestos, descuentos y detalle.'),
('CH14',2392,2728,'Inventario, movimientos, acuses, cierres, bodegas y kits','Existencias, movimientos, lotes/acuses, pacientes activos, cierres, bodegas y kits.'),
('CH15',2728,2983,'Acuse de inventario y catálogos de ítems','Entrega/acuse e ítems maestros de medicamentos, insumos, estudios, honorarios y servicios.'),
('CH16',2983,3070,'Descuentos y reglas por categoría','Catálogo de descuentos y aplicación a servicios, medicamentos, equipos, insumos y honorarios.'),
('CH17',3070,DURATION,'Reporte de salud detallado e impresión','Secciones clínicas, antecedentes, evoluciones, alergias, configuración y salida imprimible.'),
]



def safe_slug(text: str) -> str:
    text=unicodedata.normalize('NFKD',text).encode('ascii','ignore').decode('ascii').lower()
    text=re.sub(r'[^a-z0-9]+','_',text).strip('_')
    return text

def link_or_copy(src:Path,dst:Path):
    dst.parent.mkdir(parents=True,exist_ok=True)
    if dst.exists(): dst.unlink()
    try: os.link(src,dst)
    except OSError: shutil.copy2(src,dst)


def load_events():
    rows=[]
    boundaries={'chunk_01':0,'chunk_02':900,'chunk_03':1800,'chunk_04':2700}
    for name in ['chunk_01','chunk_02','chunk_03','chunk_04']:
        p=CHUNK_ROOT/name/'event_manifest_with_images.csv'
        with p.open(encoding='utf-8-sig') as f:
            for r in csv.DictReader(f):
                t=float(r['time_seconds'])
                if t+1e-9 < boundaries[name]:
                    continue
                r['source_chunk']=name
                r['source_full_image']=str((CHUNK_ROOT/name/r['full_image']).relative_to(ROOT))
                r['source_detail_crop']=str((CHUNK_ROOT/name/r['detail_crop']).relative_to(ROOT)) if r.get('detail_crop') else ''
                rows.append(r)
    rows.sort(key=lambda r:(float(r['time_seconds']),r['source_chunk'],r['id']))
    # Remove exact/near duplicates from overlap boundaries.
    ded=[]
    for r in rows:
        if ded and abs(float(r['time_seconds'])-float(ded[-1]['time_seconds']))<0.11 and r['kind']==ded[-1]['kind']:
            continue
        ded.append(r)
    for i,r in enumerate(ded,1): r['global_event_id']=f'GE{i:05d}'
    return ded


def contact_sheet(images,labels,out_path,cols=3,rows=3,tile_w=640,tile_h=281):
    label_h=40; canvas=np.full((rows*(tile_h+label_h),cols*tile_w,3),242,np.uint8)
    for i,(p,label) in enumerate(zip(images,labels)):
        if i>=cols*rows: break
        img=cv2.imread(str(p));
        if img is None: continue
        h,w=img.shape[:2]; scale=min(tile_w/w,tile_h/h); nw,nh=max(1,int(w*scale)),max(1,int(h*scale)); im=cv2.resize(img,(nw,nh),interpolation=cv2.INTER_AREA)
        rr,cc=divmod(i,cols); x=cc*tile_w+(tile_w-nw)//2; y=rr*(tile_h+label_h)+(tile_h-nh)//2; canvas[y:y+nh,x:x+nw]=im
        ly=rr*(tile_h+label_h)+tile_h; cv2.rectangle(canvas,(cc*tile_w,ly),(cc*tile_w+tile_w,ly+label_h),(25,25,25),-1)
        cv2.putText(canvas,label[:80],(cc*tile_w+7,ly+26),cv2.FONT_HERSHEY_SIMPLEX,.49,(255,255,255),1,cv2.LINE_AA)
    out_path.parent.mkdir(parents=True,exist_ok=True); cv2.imwrite(str(out_path),canvas,[cv2.IMWRITE_JPEG_QUALITY,88])


def make_sheets(entries,root,key,out_dir,prefix,cols=3,rows=3):
    per=cols*rows; out_dir.mkdir(parents=True,exist_ok=True)
    for n in range(0,len(entries),per):
        group=entries[n:n+per]; imgs=[root/e[key] for e in group]; labels=[]
        for e in group:
            if 'global_event_id' in e: labels.append(f"{e['global_event_id']} {e['timestamp']} {e['kind']}")
            else: labels.append(e['label'])
        contact_sheet(imgs,labels,out_dir/f'{prefix}_{n//per+1:03d}.jpg',cols,rows)


def main():
    shutil.rmtree(OUT,ignore_errors=True); OUT.mkdir(parents=True)
    events=load_events()
    # Master manifest points to canonical source images.
    fields=list(events[0].keys())
    with (OUT/'MASTER_EVENT_MANIFEST.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(events)
    (OUT/'MASTER_EVENT_MANIFEST.json').write_text(json.dumps(events,ensure_ascii=False,indent=2),encoding='utf-8')

    chapters_summary=[]
    for cid,start,end,title,desc in CHAPTERS:
        cdir=OUT/'chapters'/f'{cid}_{safe_slug(title)}'
        cdir.mkdir(parents=True)
        c_events=[r.copy() for r in events if (start<=float(r['time_seconds'])<end) or (cid=='CH17' and start<=float(r['time_seconds'])<=end)]
        for j,r in enumerate(c_events,1):
            r['chapter_id']=cid; r['chapter_event_id']=f'{cid}-E{j:04d}'
            src=ROOT/r['source_full_image']; dst=cdir/'event_frames'/f"{r['chapter_event_id']}_{r['time_slug']}_{r['kind']}.jpg"; link_or_copy(src,dst); r['chapter_full_image']=str(dst.relative_to(cdir))
            if r.get('source_detail_crop'):
                csrc=ROOT/r['source_detail_crop']; cdst=cdir/'detail_crops'/f"{r['chapter_event_id']}_{r['time_slug']}_DETAIL.jpg"; link_or_copy(csrc,cdst); r['chapter_detail_crop']=str(cdst.relative_to(cdir))
            else: r['chapter_detail_crop']=''
        # One deterministic frame per second. This is the anti-omission safety net.
        safety_entries=[]
        for sec in range(int(math.floor(start)),int(math.floor(end))+1):
            src=SAFETY/f'S_{sec:06d}.jpg'
            if src.exists():
                dst=cdir/'safety_frames_1fps'/src.name; link_or_copy(src,dst); safety_entries.append({'image':str(dst.relative_to(cdir)),'label':f'{sec//3600:02d}:{(sec%3600)//60:02d}:{sec%60:02d} safety'})
        # Exact visual/audio fallback clip with one second overlap at each boundary.
        clip_start=max(0,start-1); clip_end=min(DURATION,end+1); clip=cdir/'chapter_video_exact_reference.mp4'
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-ss',str(clip_start),'-i',str(VIDEO),'-t',str(clip_end-clip_start),'-map','0:v:0','-map','0:a:0','-c','copy','-avoid_negative_ts','make_zero',str(clip)],check=True)
        # Per-chapter manifests.
        efields=list(c_events[0].keys()) if c_events else []
        with (cdir/'event_manifest.csv').open('w',newline='',encoding='utf-8-sig') as f:
            if efields:
                w=csv.DictWriter(f,fieldnames=efields);w.writeheader();w.writerows(c_events)
        (cdir/'event_manifest.json').write_text(json.dumps(c_events,ensure_ascii=False,indent=2),encoding='utf-8')
        (cdir/'safety_manifest.json').write_text(json.dumps(safety_entries,ensure_ascii=False,indent=2),encoding='utf-8')
        make_sheets(c_events,cdir,'chapter_full_image',cdir/'contact_sheets_events','events',3,3)
        # Safety sheets are overview only; individual frames remain available.
        make_sheets(safety_entries,cdir,'image',cdir/'contact_sheets_safety','safety',4,4)
        coverage={'chapter_id':cid,'title':title,'description':desc,'start_seconds':start,'end_seconds':end,'clip_start_with_overlap':clip_start,'clip_end_with_overlap':clip_end,'duration_seconds':round(end-start,2),'event_frames':len(c_events),'detail_crops':sum(bool(r['chapter_detail_crop']) for r in c_events),'safety_frames_1fps':len(safety_entries),'expected_safety_frames':int(math.floor(end))-int(math.floor(start))+1,'event_contact_sheets':math.ceil(len(c_events)/9),'safety_contact_sheets':math.ceil(len(safety_entries)/16)}
        (cdir/'coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2),encoding='utf-8')
        readme=f'''# {cid} · {title}\n\n**Rango principal:** {start:.2f}s a {end:.2f}s  \n**Descripción:** {desc}\n\n## Evidencia disponible\n\n- `chapter_video_exact_reference.mp4`: video y audio del capítulo, con 1 segundo de solape como protección de borde.\n- `event_frames/`: estados de interfaz detectados cuando cambia la pantalla.\n- `detail_crops/`: ampliaciones de menús, modales, tablas o áreas que cambiaron.\n- `safety_frames_1fps/`: una captura por segundo, independientemente de la detección.\n- `contact_sheets_events/`: recorrido visual rápido de los eventos.\n- `contact_sheets_safety/`: comprobación cronológica de cobertura.\n- `event_manifest.csv`: IDs, timestamps y rutas de evidencia.\n\nLa fuente de verdad final sigue siendo el clip. Las capturas permiten que Codex, que admite imágenes pero no video o audio como modalidad directa, trabaje sin tragarse los 54 minutos de una sola vez.\n'''
        (cdir/'README.md').write_text(readme,encoding='utf-8')
        task=f'''# Tarea Codex: auditoría funcional de {cid}\n\nAnaliza únicamente este capítulo antes de modificar el producto.\n\n1. Lee `README.md`, `coverage.json` y `event_manifest.csv`.\n2. Revisa todas las hojas de `contact_sheets_events/` en orden.\n3. Abre individualmente **cada imagen** de `event_frames/`; cuando exista, abre también su imagen correspondiente en `detail_crops/`.\n4. Usa `safety_frames_1fps/` para revisar cualquier intervalo mayor de 3 segundos entre eventos.\n5. El MP4 es la evidencia final para resolver dudas; no supongas que Codex puede interpretarlo como entrada multimodal directa.\n6. No implementes todavía. Genera:\n   - `chapter_feature_inventory.json`\n   - `chapter_feature_inventory.md`\n   - `chapter_open_questions.md`\n\nCada función, campo, botón, pestaña, estado, impresión, validación o flujo debe incluir al menos una evidencia: `chapter_event_id`, timestamp y ruta de imagen. No inventes comportamiento no visible o no mencionado en la transcripción. Marca `INCIERTO` cuando falte evidencia.\n\nEl JSON debe separar: pantallas, navegación, formularios/campos, tablas/columnas, acciones, estados, reglas explícitas, reglas inferidas, documentos/impresiones, entidades de datos, permisos aparentes, integraciones, errores y preguntas abiertas.\n'''
        (cdir/'CODEX_ANALYZE_THIS_CHAPTER.md').write_text(task,encoding='utf-8')
        chapters_summary.append({**coverage,'directory':str(cdir.relative_to(OUT))})

    with (OUT/'CHAPTERS.csv').open('w',newline='',encoding='utf-8-sig') as f:
        fields=list(chapters_summary[0].keys());w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(chapters_summary)
    (OUT/'CHAPTERS.json').write_text(json.dumps(chapters_summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'chapters':len(CHAPTERS),'master_events':len(events),'output':str(OUT)},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
