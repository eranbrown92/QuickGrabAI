"""Build the runtime-only Web Store ZIP and source ZIP; no third-party dependencies."""
from pathlib import Path
import json
import re
import sys
import zipfile

root = Path(__file__).resolve().parent
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'dist'
out.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
version = manifest['version']
assert version == json.loads((root / 'package.json').read_text())['version']
assert not manifest.get('host_permissions'), 'API host access must remain optional for the upgrade.'
assert manifest['optional_host_permissions'] == ['https://api.openai.com/*']
runtime = sorted([p for p in root.iterdir() if p.is_file() and p.suffix in {'.js', '.html', '.css'}] + list((root / 'icons').glob('*.png')))
assert all((root / icon).is_file() for icon in manifest['icons'].values())
assert (root / manifest['background']['service_worker']).is_file()
assert (root / manifest['action']['default_popup']).is_file()
assert (root / manifest['options_page']).is_file()
for file in runtime:
    if file.suffix != '.js':
        continue
    source = file.read_text(encoding='utf-8')
    assert '.innerHTML' not in source, f'Unsafe rendering in {file.name}'
    assert not re.search(r'\b(?:gpt-\d|o[1-9](?:-mini)?[\x22\x27])', source), f'Bundled model ID in {file.name}'
    for imported in re.findall(r"from\s+['\"](\./[^'\"]+)['\"]", source):
        assert (file.parent / imported).is_file(), f'Missing import: {imported}'

def archive(name, files):
    target = out / name
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for file in files:
            bundle.write(file, file.relative_to(root).as_posix())
    with zipfile.ZipFile(target) as bundle:
        assert 'manifest.json' in bundle.namelist()
        assert bundle.testzip() is None
    print(f'{target.name}: {target.stat().st_size:,} bytes, {len(files)} files')
    return target

archive(f'QuickGrabAI-{version}-chrome-web-store.zip', [root / 'manifest.json', *runtime])
source_files = sorted(file for file in root.rglob('*') if file.is_file() and
    not any(part in {'node_modules', '.git', '__pycache__', 'dist'} for part in file.relative_to(root).parts) and out not in file.parents)
archive(f'QuickGrabAI-{version}-source.zip', source_files)
