from pathlib import Path
import re, uuid, sys
p = Path('/root/usahaku/backend/server.py')
if not p.exists():
    print('MISSING'); sys.exit(1)
s = p.read_text()
backup = p.with_name(p.name + '.bak-after-restore-' + uuid.uuid4().hex[:8])
backup.write_text(s)
print('backup:', backup)
pattern = re.compile(r'(?m)^(?P<indent>\s*)rec = await db\.wa_verifications\.find_one\(\{phone: phone\}, \{_id: 0\}\)')

def repl(m):
    indent = m.group('indent')
    rep = indent + 'existing_user = await db.users.find_one({whatsapp: phone}, {_id: 0})\n'
    rep += indent + 'if existing_user:\n'
    rep += indent + '    raise HTTPException(409, Nomor WhatsApp sudah terdaftar pada akun lain)\n'
    rep += indent + 'rec = await db.wa_verifications.find_one({phone: phone}, {_id: 0})'
    return rep

s_new, n = pattern.subn(repl, s, count=2)
if n > 0:
    s = s_new
    print('inserted_checks:', n)
else:
    print('no_replacements')

anchor = 'await db.users.create_index(email, unique=True)'
if anchor in s:
    if 'create_index(whatsapp' not in s:
        s = s.replace(anchor, anchor + '\n        await db.users.create_index(whatsapp, unique=True, partialFilterExpression={whatsapp: {: }})')
        print('index_inserted')
    else:
        print('index_already_present')
else:
    print('anchor_not_found')

p.write_text(s)
print('written')
