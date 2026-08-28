"""Runtime evidence recorder; actions are never inferred from a suite result."""
from __future__ import annotations
import json, subprocess, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PATH = ROOT / '.qa-results' / 'selenium-patients.json'

def reset() -> None:
    PATH.parent.mkdir(parents=True, exist_ok=True)
    PATH.write_text(json.dumps({'results': []}), encoding='utf8')

def record_pass(action_id: str, test_id: str, started_at: float, url: str) -> None:
    data = json.loads(PATH.read_text(encoding='utf8')) if PATH.exists() else {'results': []}
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    data['results'] = [item for item in data['results'] if item['action_id'] != action_id]
    data['results'].append({'action_id': action_id, 'test_id': test_id, 'status': 'PASS', 'git_sha': sha, 'executed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'duration_ms': int((time.time()-started_at)*1000), 'url': url})
    PATH.write_text(json.dumps(data, indent=2), encoding='utf8')

def record_fail(action_id: str, test_id: str, started_at: float, url: str, error: str) -> None:
    data = json.loads(PATH.read_text(encoding='utf8')) if PATH.exists() else {'results': []}
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    data['results'].append({'action_id': action_id, 'test_id': test_id, 'status': 'FAIL', 'git_sha': sha, 'executed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'duration_ms': int((time.time()-started_at)*1000), 'url': url, 'error': error})
    PATH.write_text(json.dumps(data, indent=2), encoding='utf8')
