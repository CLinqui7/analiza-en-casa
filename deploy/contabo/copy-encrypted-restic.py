"""Copy an encrypted restic repository off the VPS and verify the copy.

This script reads only the encrypted repository through host-key-verified SFTP.
It never receives a PostgreSQL credential or writes plaintext backup contents.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys


parser = argparse.ArgumentParser()
parser.add_argument('--host', required=True)
parser.add_argument('--user', required=True)
parser.add_argument('--ssh-key', type=Path, required=True)
parser.add_argument('--known-hosts', type=Path, required=True)
parser.add_argument('--remote-repository', required=True)
parser.add_argument('--destination', type=Path, required=True)
parser.add_argument('--restic', type=Path, required=True)
parser.add_argument('--restic-password-file', type=Path, required=True)
parser.add_argument('--module-dir', type=Path)
args = parser.parse_args()
if args.module_dir:
    sys.path.insert(0, str(args.module_dir))
import paramiko  # noqa: E402

root = args.destination.resolve()
root.mkdir(parents=True, exist_ok=True)
stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
partial = (root / f'snapshot-{stamp}.partial').resolve()
final = (root / f'snapshot-{stamp}').resolve()
for path in (partial, final):
    if path.parent != root or path.exists():
        raise RuntimeError('Destination must be a fresh directory under the offsite root')
partial.mkdir(mode=0o700)

client = paramiko.SSHClient()
client.load_host_keys(str(args.known_hosts))
client.set_missing_host_key_policy(paramiko.RejectPolicy())
client.connect(
    args.host, username=args.user, key_filename=str(args.ssh_key),
    timeout=15, auth_timeout=15, banner_timeout=15,
    look_for_keys=False, allow_agent=False,
)
files = []
sftp = client.open_sftp()


def copy_tree(remote, local):
    for entry in sftp.listdir_attr(remote):
        if entry.filename in ('.', '..') or '/' in entry.filename or '\\' in entry.filename:
            raise RuntimeError('Unsafe repository entry name')
        source = remote.rstrip('/') + '/' + entry.filename
        target = local / entry.filename
        if target.resolve().parent != local.resolve():
            raise RuntimeError('Repository entry leaves the offsite directory')
        if stat.S_ISDIR(entry.st_mode):
            target.mkdir()
            copy_tree(source, target)
        elif stat.S_ISREG(entry.st_mode):
            sftp.get(source, str(target))
            source_hash = hashlib.sha256()
            with sftp.open(source, 'rb') as stream:
                while block := stream.read(65536):
                    source_hash.update(block)
            copied_hash = hashlib.sha256(target.read_bytes()).hexdigest()
            if source_hash.hexdigest() != copied_hash:
                raise RuntimeError('Encrypted repository copy failed SHA-256 comparison')
            files.append({'path': target.relative_to(partial).as_posix(), 'sha256': copied_hash, 'bytes': entry.st_size})
        else:
            raise RuntimeError('Unexpected file type in encrypted repository')


try:
    copy_tree(args.remote_repository, partial)
finally:
    sftp.close()
    client.close()

environment = os.environ.copy()
environment['RESTIC_PASSWORD_FILE'] = str(args.restic_password_file)
subprocess.run(
    [str(args.restic), '--no-cache', '-r', str(partial), 'check', '--read-data'],
    env=environment, check=True, stdout=subprocess.DEVNULL,
)
manifest = {
    'copied_at': dt.datetime.now(dt.timezone.utc).isoformat(),
    'source': 'encrypted Contabo restic repository',
    'files': files,
    'restic_read_data_check': 'passed',
}
(partial / 'copy-verification.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
partial.rename(final)
print(json.dumps({'offsite_path': str(final), 'files': len(files), 'bytes': sum(item['bytes'] for item in files), 'restic_check': 'passed'}))
