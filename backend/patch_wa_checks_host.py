from pathlib import Path
p = Path('/root/usahaku/backend/server.py')
if not p.exists():
    print('MISSING')
    raise SystemExit(1)
orig = p.read_text().splitlines()
lines = orig[:]
# Insert before these line numbers (1-based). Process descending to avoid index shift.
targets = [2158, 387, 347]
inserted_total = 0
for t in sorted(targets, reverse=True):
    idx = t - 1
    if idx < 0 or idx > len(lines):
        print('skip', t)
        continue
    # check nearby for existing insertion
    already = False
    for k in range(max(0, idx-5), min(len(lines), idx+1)):
        if 'existing_user = await db.users.find_one' in lines[k]:
            already = True
            break
    if already:
        print('already at', t)
        continue
    indent = lines[idx][:len(lines[idx]) - len(lines[idx].lstrip())]
    ins = [
        indent + 'existing_user = await db.users.find_one({whatsapp: phone}, {_id: 0})',
        indent + 'if existing_user:',
        indent + '    raise HTTPException(409, Nomor WhatsApp sudah terdaftar pada akun lain)'
    ]
    lines[idx:idx] = ins
    inserted_total += len(ins)
    print('inserted at', t)
# backup
bak = p.with_suffix('.bak-wa-checks')
if not bak.exists():
    bak.write_text('\n'.join(orig) + '\n')
# write updated file
p.write_text('\n'.join(lines) + '\n')
print('done inserted_total', inserted_total)
