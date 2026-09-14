"""Inspect every Docker application layer, including deleted files from older layers.
Usage: py scripts/deployment/scan-image.py .local/cloud-run/candidate-image.tar
No extraction; output contains paths only, never file contents or credentials.
"""
import io
import json
import re
import sys
import tarfile
from pathlib import Path

# Compare known private configuration values without displaying or exporting them.
known_secrets = []
for directory in (Path('.'), Path('apps/web')):
    for private_env in directory.glob('.env*'):
        if not private_env.is_file() or private_env.name.endswith(('.example', '.sample')):
            continue
        for line in private_env.read_text(encoding='utf-8-sig').splitlines():
            key, separator, value = line.partition('=')
            value = value.strip().strip('\"\'')
            if separator and re.search(r'(PASSWORD|TOKEN|SECRET|KEY|MONGODB_URI|DATABASE_URL)', key) and len(value) >= 8:
                known_secrets.append(value.encode())

violations = []
count = 0
reviewed_placeholders = []
with tarfile.open(sys.argv[1], 'r:*') as archive:
    manifest = json.load(archive.extractfile('manifest.json'))
    for entry in manifest:
        config = json.load(archive.extractfile(entry['Config']))
        for value in config.get('config', {}).get('Env', []):
            if re.match(r'^(PGPASSWORD|MONGODB_URI|GOOGLE_APPLICATION_CREDENTIALS|.*SECRET.*)=.+', value):
                violations.append('config: ' + value.split('=', 1)[0])
        for layer in entry['Layers']:
            with tarfile.open(fileobj=io.BytesIO(archive.extractfile(layer).read()), mode='r:*') as contents:
                for member in contents:
                    path = member.name.lstrip('./')
                    if not path.startswith('app/') or not member.isfile():
                        continue
                    count += 1
                    if re.search(r'(^|/)(\.env($|\.)|\.npmrc|\.local/|\.analiza-runtime/|\.git/|\.ssh/)|\.(pem|key|p12|pfx|dump|bson|zip)$', path):
                        violations.append(path)
                    if member.size < 5_000_000:
                        data = contents.extractfile(member).read()
                        credential_data = data
                        # Exact public SDK JSDoc fixture (seven x's, not key material). Do not
                        # exempt the file: real keys/tokens anywhere else must still fail.
                        sdk_example = b'-----BEGIN PRIVATE KEY-----xxxxxxx\\n-----END PRIVATE KEY-----\\n'
                        if path == 'app/node_modules/@google-cloud/storage/build/esm/src/storage.js' and sdk_example in data:
                            credential_data = data.replace(sdk_example, b'[public SDK documentation placeholder]')
                            reviewed_placeholders.append(path)
                        if re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{36}|sb_secret_[A-Za-z0-9_-]{20,}', credential_data):
                            violations.append(path + ': private credential pattern')
                        if any(secret in data for secret in known_secrets):
                            violations.append(path + ': private environment value embedded')
print(json.dumps({'passed': not violations, 'application_files_scanned': count, 'reviewed_sdk_placeholders': reviewed_placeholders, 'violations': sorted(set(violations))}))
sys.exit(1 if violations else 0)
