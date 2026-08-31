#!/usr/bin/env python3
from pathlib import Path
p = Path('/root/usahaku/frontend/src/pages/Auth.jsx')
s = p.read_text()
orig = s

# 1) replace disabled prop
s = s.replace('disabled={waBusy || !form.whatsapp}', 'disabled={waBusy || !form.whatsapp || waSent || waVerified}')

# 2) replace setTimeout nav login block
old = 'setTimeout(() => nav(/login), 1500);'
new = (
'try {\n'
'  const loginRes = await api.post(/auth/login, { email: form.email, password: form.password });\n'
'  if (loginRes.data && loginRes.data.role) {\n'
'    localStorage.setItem(user, JSON.stringify(loginRes.data));\n'
'    nav(loginRes.data.role === ADMIN ? /admin : /dashboard);\n'
'  } else {\n'
'    setMsg(r.data.message || Akun aktif. Silakan login ulang.);\n'
'    setTimeout(() => nav(/login), 1500);\n'
'  }\n'
'} catch (ex) {\n'
'  setMsg(r.data.message || Akun aktif. Silakan login ulang.);\n'
'  setTimeout(() => nav(/login), 1500);\n'
'}'
)

s = s.replace(old, new)

if s == orig:
    print('NO_CHANGES')
else:
    p.write_text(s)
    print('FILE_UPDATED')
