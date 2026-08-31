#!/usr/bin/env python3
import re
from pathlib import Path

server_py = Path('/root/usahaku/backend/server.py')
content = server_py.read_text()

# 1. Add imports after 'import httpx'
if 'from pymongo.errors import DuplicateKeyError' not in content:
    content = content.replace(
        'import httpx\n',
        'import httpx\nfrom pymongo.errors import DuplicateKeyError\nfrom fastapi.responses import JSONResponse\n',
        1
    )
    print('IMPORTS_ADDED')
else:
    print('IMPORTS_ALREADY_PRESENT')

# 2. Find the verify_wa function and add pre-check before rec = await db.wa_verifications.find_one...
pattern1 = r'(\s*)rec = await db\.wa_verifications\.find_one\(\s*\{"phone": phone\},\s*\{"_id": 0\}\s*\)'
pre_check_code = r'\1existing_user = await db.users.find_one({whatsapp: phone}, {_id: 0})\n\1if existing_user:\n\1    raise HTTPException(409, Nomor WhatsApp sudah terdaftar pada akun lain)\n\n\1rec = await db.wa_verifications.find_one({phone: phone}, {_id: 0})'

content, count1 = re.subn(pattern1, pre_check_code, content, flags=re.MULTILINE)
print(f'VERIFY_WA_PRECHECK_REPLACED: {count1}')

# 3. Find the register function and add pre-check before rec = await db.wa_verifications.find_one...
pattern2 = r'(\s*)rec = await db\.wa_verifications\.find_one\(\s*\{"phone": phone\},\s*\{"_id": 0\}\s*\)'
content, count2 = re.subn(pattern2, pre_check_code, content, flags=re.MULTILINE)
print(f'REGISTER_PRECHECK_REPLACED: {count2}')

# 4. Wrap await db.users.insert_one(user) with try/except DuplicateKeyError in register function
pattern3 = r'(\s*)await db\.users\.insert_one\(user\)\s*(\n|$)'
wrap_code = r'\1try:\n\1    await db.users.insert_one(user)\n\1except DuplicateKeyError:\n\1    raise HTTPException(409, Nomor WhatsApp sudah terdaftar pada akun lain)\n\2'

content, count3 = re.subn(pattern3, wrap_code, content, flags=re.MULTILINE)
print(f'INSERT_WRAP_REPLACED: {count3}')

# Write back
server_py.write_text(content)
print('FILE_WRITTEN')
