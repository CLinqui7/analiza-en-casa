#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, json, sys
from pathlib import Path


def names(root: Path, folder: str, pattern: str = '*.jpg') -> set[str]:
    return {p.name for p in (root / folder).glob(pattern)}


def main() -> None:
    ap = argparse.ArgumentParser(description='Verifica que Codex declare revisada toda la evidencia obligatoria de un capítulo.')
    ap.add_argument('chapter_dir')
    args = ap.parse_args()
    root = Path(args.chapter_dir)
    manifest = root / 'event_manifest.csv'
    receipt = root / 'chapter_review_receipt.json'
    if not manifest.exists():
        raise SystemExit(f'Missing {manifest}')
    if not receipt.exists():
        raise SystemExit(f'Missing {receipt}')

    with manifest.open(encoding='utf-8-sig') as f:
        events = list(csv.DictReader(f))
    data = json.loads(receipt.read_text(encoding='utf-8'))

    required_events = {r['chapter_event_id'] for r in events}
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
    }
    error_lists = [
        missing_events, missing_details, missing_event_sheets, missing_safety_sheets,
        missing_ack, unknown_events, unknown_event_sheets, unknown_safety_sheets, unknown_details,
    ]
    result['passed'] = not any(error_lists)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result['passed'] else 1)


if __name__ == '__main__':
    main()
