from pathlib import Path
p = Path('/root/usahaku/backend/server.py')
if not p.exists():
    print('MISSING'); raise SystemExit(1)
lines = p.read_text().splitlines()
out = []
count = 0
for line in lines:
    if 'rec = await db.wa_verifications.find_one({phone: phone}, {_id: 0})' in line:
        indent = line[:len(line)-len(line.lstrip())]
        out.append(indent + 'existing_user = await db.users.find_one({whatsapp: phone}, {_id: 0})')
        out.append(indent + 'if existing_user:')
        out.append(indent + '    raise HTTPException(409, Nomor WhatsApp sudah terdaftar pada akun lain)')
        count += 1
    out.append(line)
new = '\n'.join(out) + '\n'
# backup
p.with_suffix('.bak-before-insert').write_text(p.read_text())
p.write_text(new)
print('inserted', count)
