
[1m[33mDocker LXC Container[m
[33m OS: [1;92mDebian GNU/Linux - Version: 13[m
[33m Hostname: [1;92musahaku[m
[33m IP Address: [1;92m172.31.10.62[m

#!/usr/bin/env python3
from pathlib import Path
p=Path('/root/usahaku/backend/server.py')
if not p.exists():
    print('MISSING')
    raise SystemExit(2)
text=p.read_text()
lines=text.splitlines(True)
# insert import after import httpx
inserted_import=False
if not any('from pymongo.errors import DuplicateKeyError' in ln for ln in lines):
    for idx,ln in enumerate(lines):
        if ln.strip()==import httpx:
            lines.insert(idx+1, 'from pymongo.errors import DuplicateKeyError\n')
            inserted_import=True
            break
# ensure existing_user before every wa_verifications.find_one
changed_rec=0
i=0
while i < len(lines):
    if 'rec = await db.wa_verifications.find_one' in lines[i]:
        # check nearby
        prev=''.join(lines[max(0,i-6):i])
        if 'existing_user = await db.users.find_one' in prev:
            i+=1
            continue
        # determine indent
        line=lines[i]
        indent=''
        for ch in line:
            if ch in ' \t': indent+=ch
            else: break
        insert_block = indent + '{0}existing_user = await db.users.find_one({{whatsapp: phone}}, {{_id: 0}})\n'.format()
        insert_block += indent + 'if existing_user:\n'
        insert_block += indent + '    raise HTTPException(409, Nomor WhatsApp sudah terdaftar pada akun lain)\n'
        lines[i:i]=[insert_block]
        changed_rec+=1
        i += 3
    i+=1
# wrap insert_one(user) in try/except DuplicateKeyError
changed_insert=0
for idx,ln in enumerate(lines):
    if 'await db.users.insert_one(user)' in ln:
        # already wrapped?
        block=''.join(lines[max(0,idx-6):min(len(lines), idx+3)])
        if 'except DuplicateKeyError' in block:
            break
        # compute indent
        indent=''
        for ch in ln:
            if ch in ' \t': indent+=ch
            else: break
        new_block = indent + 'try:\n'
        new_block += indent + '    await db.users.insert_one(user)\n'
        new_block += indent + 'except DuplicateKeyError:\n'
        new_block += indent + '    raise HTTPException(409, Nomor WhatsApp sudah terdaftar pada akun lain)\n'
        lines[idx]=new_block
        changed_insert=1
        break
# write back if changes
if inserted_import or changed_rec or changed_insert:
    p.write_text(''.join(lines))
    print('PATCHED', inserted_import, changed_rec, changed_insert)
else:
    print('NO_CHANGES')
