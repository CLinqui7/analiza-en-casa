#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, json, sys
from collections import Counter
from pathlib import Path


def names(root: Path, folder: str, pattern: str = '*.jpg') -> set[str]:
    return {p.name for p in (root / folder).glob(pattern)}


def evidence_path_exists(repo_root: Path, source_root: Path, value: str) -> bool:
    candidate = Path(value)
    if candidate.is_absolute():
        return candidate.is_file()
    return (repo_root / candidate).is_file() or (source_root / candidate).is_file()


def main() -> None:
    ap = argparse.ArgumentParser(description='Verifica que Codex declare revisada toda la evidencia obligatoria de un capítulo.')
    ap.add_argument('chapter_dir')
    ap.add_argument(
        '--review-dir',
        help='Directorio editable de revisión. Por defecto usa video-audit-reviews/<capítulo>.',
    )
    args = ap.parse_args()
    root = Path(args.chapter_dir).resolve()
    repo_root = next((parent for parent in root.parents if (parent / 'video-audit-reviews').is_dir()), None)
    if repo_root is None and not args.review_dir:
        raise SystemExit(f'Cannot locate video-audit-reviews from {root}')
    review_root = (
        Path(args.review_dir).resolve()
        if args.review_dir
        else repo_root / 'video-audit-reviews' / root.name
    )
    manifest = root / 'event_manifest.csv'
    receipt = review_root / 'chapter_review_receipt.json'
    notes_path = review_root / 'event_review_notes.csv'
    inventory_path = review_root / 'chapter_feature_inventory.json'
    if not manifest.exists():
        raise SystemExit(f'Missing {manifest}')
    if not receipt.exists():
        raise SystemExit(f'Missing {receipt}')
    if not notes_path.exists():
        raise SystemExit(f'Missing {notes_path}')
    if not inventory_path.exists():
        raise SystemExit(f'Missing {inventory_path}')

    with manifest.open(encoding='utf-8-sig') as f:
        events = list(csv.DictReader(f))
    with notes_path.open(encoding='utf-8-sig') as f:
        notes = list(csv.DictReader(f))
    data = json.loads(receipt.read_text(encoding='utf-8'))
    inventory = json.loads(inventory_path.read_text(encoding='utf-8'))

    required_events = {r['chapter_event_id'] for r in events}
    events_by_id = {r['chapter_event_id']: r for r in events}
    reviewed_events = set(data.get('reviewed_event_ids', []))

    required_event_sheets = names(root, 'contact_sheets_events')
    required_safety_sheets = names(root, 'contact_sheets_safety')
    required_details = names(root, 'detail_crops')

    reviewed_event_sheets = set(data.get('reviewed_event_contact_sheets', []))
    reviewed_safety_sheets = set(data.get('reviewed_safety_contact_sheets', []))
    reviewed_details = set(data.get('reviewed_detail_crops', []))

    missing_events = sorted(required_events - reviewed_events)
    missing_event_sheets = sorted(required_event_sheets - reviewed_event_sheets)
    missing_safety_sheets = sorted(required_safety_sheets - reviewed_safety_sheets)
    missing_details = sorted(required_details - reviewed_details)

    unknown_events = sorted(reviewed_events - required_events)
    unknown_event_sheets = sorted(reviewed_event_sheets - required_event_sheets)
    unknown_safety_sheets = sorted(reviewed_safety_sheets - required_safety_sheets)
    unknown_details = sorted(reviewed_details - required_details)

    note_ids = [row.get('chapter_event_id', '').strip() for row in notes]
    note_id_set = set(note_ids)
    note_counts = Counter(note_ids)
    missing_note_ids = sorted(required_events - note_id_set)
    unknown_note_ids = sorted(note_id_set - required_events)
    duplicate_note_ids = sorted(event_id for event_id, count in note_counts.items() if count > 1)
    allowed_classifications = {'VISIBLE', 'VERBAL', 'INFERRED', 'UNCERTAIN'}
    incomplete_notes = sorted(
        row.get('chapter_event_id', '').strip() or '<missing-id>'
        for row in notes
        if not row.get('visible_change', '').strip()
        or not row.get('classification', '').strip()
        or not row.get('confidence', '').strip()
    )
    invalid_classifications = sorted(
        row.get('chapter_event_id', '').strip() or '<missing-id>'
        for row in notes
        if row.get('classification', '').strip() not in allowed_classifications
    )

    features = inventory.get('features', [])
    inventory_errors: list[str] = []
    if not features:
        inventory_errors.append('features:empty')
    expected_chapter_id = root.name[:4]
    inventory_chapter_id = inventory.get('chapter_id')
    inventory_chapter = inventory.get('chapter')
    if inventory_chapter_id and inventory_chapter_id != expected_chapter_id:
        inventory_errors.append(f'chapter_id:{inventory_chapter_id}')
    if inventory_chapter and inventory_chapter != root.name:
        inventory_errors.append(f'chapter:{inventory_chapter}')
    if not inventory_chapter_id and not inventory_chapter:
        inventory_errors.append('chapter:missing')
    feature_ids: list[str] = []
    for feature in features:
        feature_id = str(feature.get('id', '')).strip() or '<missing-id>'
        feature_ids.append(feature_id)
        for field in ('id', 'name', 'description', 'classification', 'confidence'):
            if not str(feature.get(field, '')).strip():
                inventory_errors.append(f'{feature_id}:{field}:missing')
        if feature.get('classification') not in allowed_classifications:
            inventory_errors.append(f'{feature_id}:classification:{feature.get("classification", "missing")}')
        evidence_items = feature.get('evidence', [])
        if not evidence_items:
            inventory_errors.append(f'{feature_id}:evidence:empty')
        for index, evidence in enumerate(evidence_items, start=1):
            prefix = f'{feature_id}:evidence:{index}'
            event_id = str(evidence.get('chapter_event_id', '')).strip()
            if event_id not in required_events:
                inventory_errors.append(f'{prefix}:event:{event_id or "missing"}')
            elif evidence.get('timestamp') != events_by_id[event_id].get('timestamp'):
                inventory_errors.append(f'{prefix}:timestamp:{evidence.get("timestamp", "missing")}')
            primary_path = str(evidence.get('path') or evidence.get('image') or '').strip()
            if not primary_path:
                inventory_errors.append(f'{prefix}:path:missing')
            elif not evidence_path_exists(repo_root, root, primary_path):
                inventory_errors.append(f'{prefix}:path:not-found:{primary_path}')
            detail_crop = str(evidence.get('detail_crop') or '').strip()
            if detail_crop and not evidence_path_exists(repo_root, root, detail_crop):
                inventory_errors.append(f'{prefix}:detail-crop:not-found:{detail_crop}')
    duplicate_feature_ids = sorted(
        feature_id for feature_id, count in Counter(feature_ids).items() if count > 1
    )
    inventory_errors.extend(f'feature-id:duplicate:{feature_id}' for feature_id in duplicate_feature_ids)

    required_files_ack = {
        'README.md': bool(data.get('read_readme')),
        'coverage.json': bool(data.get('read_coverage')),
        'event_manifest.csv': bool(data.get('read_event_manifest')),
        'transcript_raw.txt': bool(data.get('read_transcript')),
        'chapter_video_exact_reference.mp4': bool(data.get('checked_exact_clip_for_uncertainties')),
    }
    missing_ack = sorted(k for k, ok in required_files_ack.items() if not ok)

    result = {
        'chapter': root.name,
        'required_events': len(required_events),
        'reviewed_events': len(required_events & reviewed_events),
        'required_detail_crops': len(required_details),
        'reviewed_detail_crops': len(required_details & reviewed_details),
        'missing_events': missing_events,
        'missing_detail_crops': missing_details,
        'missing_event_contact_sheets': missing_event_sheets,
        'missing_safety_contact_sheets': missing_safety_sheets,
        'missing_required_file_acknowledgements': missing_ack,
        'unknown_event_ids': unknown_events,
        'unknown_event_contact_sheets': unknown_event_sheets,
        'unknown_safety_contact_sheets': unknown_safety_sheets,
        'unknown_detail_crops': unknown_details,
        'missing_event_review_notes': missing_note_ids,
        'unknown_event_review_notes': unknown_note_ids,
        'duplicate_event_review_notes': duplicate_note_ids,
        'incomplete_event_review_notes': incomplete_notes,
        'invalid_event_review_note_classifications': invalid_classifications,
        'feature_inventory_errors': sorted(inventory_errors),
    }
    error_lists = [
        missing_events, missing_details, missing_event_sheets, missing_safety_sheets,
        missing_ack, unknown_events, unknown_event_sheets, unknown_safety_sheets, unknown_details,
        missing_note_ids, unknown_note_ids, duplicate_note_ids, incomplete_notes, invalid_classifications,
        inventory_errors,
    ]
    result['passed'] = not any(error_lists)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result['passed'] else 1)


if __name__ == '__main__':
    main()
