"""Runtime evidence for hospitalization Selenium actions only."""

from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
PATH = ROOT / '.qa-results' / 'selenium-hospitalizations.json'


def reset() -> None:
    PATH.parent.mkdir(parents=True, exist_ok=True)
    # This function runs only after the Selenium suite has actually started.
    # A missing file is therefore PENDING_RUNTIME, while a partial result from a
    # started suite is a real runtime failure for any absent required action.
    PATH.write_text(json.dumps({'runtime_status': 'EXECUTING', 'results': []}), encoding='utf8')


def complete() -> None:
    data = json.loads(PATH.read_text(encoding='utf8')) if PATH.exists() else {'results': []}
    data['runtime_status'] = 'EXECUTED'
    PATH.write_text(json.dumps(data, indent=2), encoding='utf8')


def record_pass(action_id: str, test_id: str, started_at: float, url: str) -> None:
    data = json.loads(PATH.read_text(encoding='utf8')) if PATH.exists() else {'results': []}
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    fingerprint = subprocess.check_output(['node', 'scripts/print-functional-fingerprint.mjs'], cwd=ROOT, text=True).strip()
    data['results'] = [item for item in data['results'] if item['action_id'] != action_id]
    data['results'].append({
        'action_id': action_id,
        'test_id': test_id,
        'status': 'PASS',
        'git_sha': sha,
        'functional_fingerprint': fingerprint,
        'executed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'duration_ms': int((time.time() - started_at) * 1000),
        'url': url,
    })
    PATH.write_text(json.dumps(data, indent=2), encoding='utf8')
