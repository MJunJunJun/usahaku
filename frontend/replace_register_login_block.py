#!/usr/bin/env python3
from pathlib import Path
p = Path('/root/usahaku/frontend/src/pages/Auth.jsx')
s = p.read_text()
old = 'setMsg(r.data.message || Selamat, akun Anda sudah aktif. Silakan login ulang.);\n        setTimeout(() => nav(/login), 1500);'
new = (
'try {\n'
'        const loginRes = await api.post(, { email: form.email, password: form.password });\n'
'        if (loginRes.data && loginRes.data.role) {\n'
'          localStorage.setItem(user, JSON.stringify(loginRes.data));\n'
'          nav(loginRes.data.role === ADMIN ? /admin : /dashboard);\n'
'        } else {\n'
'          setMsg(r.data.message || Akun aktif. Silakan login ulang.);\n'
'          setTimeout(() => nav(/login), 1500);\n'
'        }\n'
'      } catch (ex) {\n'
'        setMsg(r.data.message || Akun aktif. Silakan login ulang.);\n'
'        setTimeout(() => nav(/login), 1500);\n'
'      }'
)
if old in s:
    s = s.replace(old, new)
    p.write_text(s)
    print('REPLACED_NAV_BLOCK')
else:
    print('OLD_NOT_FOUND')
