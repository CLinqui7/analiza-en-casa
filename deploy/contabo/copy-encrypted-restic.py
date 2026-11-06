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
import shlex
import stat
import subprocess
import sys
import time


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
files = {}
sftp = client.open_sftp()


def source_hashes():
    command = (
        f'cd -- {shlex.quote(args.remote_repository)} '
        '&& find . -type f -print0 | xargs -0 sha256sum'
    )
    _, output, errors = client.exec_command(command)
    values = output.read().decode('utf-8')
    message = errors.read().decode('utf-8')
    if output.channel.recv_exit_status() != 0:
        raise RuntimeError(f'Could not hash encrypted source repository: {message.strip()}')
    return {
        name.removeprefix('./'): digest
        for line in values.splitlines()
        for digest, name in [line.split('  ', 1)]
    }


def copy_tree(remote, local, hashes):
    for entry in sftp.listdir_attr(remote):
        if entry.filename in ('.', '..') or '/' in entry.filename or '\\' in entry.filename:
            raise RuntimeError('Unsafe repository entry name')
        source = remote.rstrip('/') + '/' + entry.filename
        target = local / entry.filename
        if target.resolve().parent != local.resolve():
            raise RuntimeError('Repository entry leaves the offsite directory')
        relative = target.relative_to(partial).as_posix()
        # Restic lock files are transient and are not needed for restoration.
        if relative.startswith('locks/'):
            continue
        if stat.S_ISDIR(entry.st_mode):
            target.mkdir(exist_ok=True)
            copy_tree(source, target, hashes)
        elif stat.S_ISREG(entry.st_mode):
            # A new pack may appear between listing and hashing; the next pass picks it up.
            if relative not in hashes:
                continue
            if relative in files and target.is_file() and target.stat().st_size == entry.st_size:
                continue
            sftp.get(source, str(target))
            copied_hash = hashlib.sha256(target.read_bytes()).hexdigest()
            if hashes[relative] != copied_hash:
                raise RuntimeError('Encrypted repository copy failed SHA-256 comparison')
            files[relative] = {'path': relative, 'sha256': copied_hash, 'bytes': entry.st_size}
        else:
            raise RuntimeError('Unexpected file type in encrypted repository')


environment = os.environ.copy()
environment['RESTIC_PASSWORD_FILE'] = str(args.restic_password_file)
try:
    for attempt in range(3):
        # A VPS backup may append packs or indexes during the offsite transfer.
        # Rescan before each integrity check, copying only newly added files.
        copy_tree(args.remote_repository, partial, source_hashes())
        check = subprocess.run(
            [str(args.restic), '--no-cache', '-r', str(partial), 'check', '--read-data'],
            env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
        )
        if check.returncode == 0:
            break
        if attempt == 2:
            raise RuntimeError(f'Encrypted offsite copy failed restic verification: {check.stderr.strip()}')
        time.sleep(3)
finally:
    sftp.close()
    client.close()

verified_files = [files[name] for name in sorted(files)]
manifest = {
    'copied_at': dt.datetime.now(dt.timezone.utc).isoformat(),
    'source': 'encrypted Contabo restic repository',
    'files': verified_files,
    'restic_read_data_check': 'passed',
}
(partial / 'copy-verification.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
partial.rename(final)
print(json.dumps({'offsite_path': str(final), 'files': len(verified_files), 'bytes': sum(item['bytes'] for item in verified_files), 'restic_check': 'passed'}))
