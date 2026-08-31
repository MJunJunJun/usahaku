import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, AlertCircle, CheckCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { api, errorText } from "../lib/api";
import { Brand, Button, FormError } from "../lib/shared";
import "./Auth.css";

function AuthSide() {
  return (
    <div className="auth-side">
      <Brand light />
      <div>
        <div className="eyebrow light-eyebrow">DIGITALISASI USAHA</div>
        <h1>Usahamu punya cerita.<br /><em>Biarkan lebih banyak<br />orang menemukannya.</em></h1>
        <p>Website profesional yang dibuat dengan bantuan AI—untuk kamu yang punya banyak hal lain untuk dikerjakan.</p>
      </div>
      <span className="auth-quote">"Sekarang pelanggan baru bisa menemukan kami bahkan saat toko sedang tutup."<b>— Rina, Kopi Senja</b></span>
    </div>
  );
}

export function AuthPage({ register = false }) {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    confirmPassword: "",
    whatsapp: "" 
  });
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // ===== CEK SESSION: kalau sudah login, arahkan langsung =====
  useEffect(() => {
    api.get("/auth/me", { withCredentials: true }).then(r => {
      const role = (r.data && r.data.role) || "";
      const target = role === "ADMIN" ? "/admin" : "/dashboard";
      if (target) nav(target);
    }).catch(() => {
      // Belum login, biarkan form tampil
    });
  }, [nav]);

  const validateForm = () => {
    if (!form.name.trim()) return "Nama lengkap wajib diisi";
    if (!form.whatsapp.trim()) return "Nomor WhatsApp wajib diisi";
    if (!form.email.trim()) return "Email wajib diisi";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Format email tidak valid";
    if (form.password.length < 6) return "Password minimal 6 karakter";
    if (form.password !== form.confirmPassword) return "Konfirmasi password tidak cocok";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    
    const validationErr = validateForm();
    if (validationErr) {
      setErr(validationErr);
      return;
    }

    setBusy(true);
    try {
      // 1. Kirim kode verifikasi WA
      await api.post("/auth/send-wa-code", { phone: form.whatsapp, name: form.name });
      
      // 2. Simpan data pendaftaran ke sessionStorage (10 menit TTL)
      const pendingData = {
        ...form,
        createdAt: new Date().toISOString()
      };
      sessionStorage.setItem("pendingRegistration", JSON.stringify(pendingData));
      
      // 3. Redirect ke halaman verifikasi
      nav("/verify-wa");
    } catch (ex) {
      setErr(errorText(ex));
    } finally {
      setBusy(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (err) setErr(""); // Clear error saat user mengetik
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <div className="auth-page">
      <AuthSide />
      <div className="auth-form-wrap">
        <Link data-testid="auth-back-home" className="back-link" to="/">← Kembali ke beranda</Link>
        <div className="auth-form">
          <div className="eyebrow">{register ? "MULAI GRATIS" : "SELAMAT DATANG KEMBALI"}</div>
          <h2>{register ? "Buat website pertamamu." : "Masuk ke UsahaKu."}</h2>
          <p>{register ? "Ayo mulai buat website usahamu." : "Kelola semua website usahamu dari satu tempat."}</p>
          
          <form onSubmit={handleSubmit}>
            {register && (
              <>
                <label>
                  Nama Lengkap
                  <input
                    data-testid="register-name-input"
                    required
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleInputChange}
                    placeholder="Nama lengkap Anda"
                    autoComplete="name"
                    disabled={busy}
                  />
                </label>
                
                <label>
                  Nomor WhatsApp
                  <input
                    data-testid="register-whatsapp-input"
                    required
                    type="tel"
                    name="whatsapp"
                    value={form.whatsapp}
                    onChange={handleInputChange}
                    placeholder="628xxxxxxxxxx"
                    autoComplete="tel"
                    disabled={busy}
                    inputMode="numeric"
                    maxLength={15}
                  />
                  <span className="field-hint">Kode verifikasi akan dikirim ke nomor ini</span>
                </label>
              </>
            )}
            
            <label>
              Email
              <input
                data-testid={`${register ? "register" : "login"}-email-input`}
                required
                type="email"
                name="email"
                value={form.email}
                onChange={handleInputChange}
                placeholder="nama@email.com"
                autoComplete={register ? "email" : "username"}
                disabled={busy}
              />
            </label>
            
            <label className="password-field">
              <span>Password</span>
              <div className="password-input-wrap">
                <input
                  data-testid={`${register ? "register" : "login"}-password-input`}
                  required
                  minLength={6}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleInputChange}
                  placeholder="Minimal 6 karakter"
                  autoComplete={register ? "new-password" : "current-password"}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  disabled={busy}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            
            {register && (
              <label className="password-field">
                <span>Konfirmasi Password</span>
                <div className="password-input-wrap">
                  <input
                    data-testid="register-confirm-input"
                    required
                    minLength={6}
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Ulangi password"
                    autoComplete="new-password"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={togglePasswordVisibility}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    disabled={busy}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
            
            <FormError msg={err} />
            
            <Button data-testid={`${register ? "register" : "login"}-submit-button`} type="submit" disabled={busy}>
              {busy ? <><Loader2 size={16} className="spin" /> Sebentar...</> : register ? "Buat akun gratis" : "Masuk"} <ArrowRight size={16} />
            </Button>
          </form>
          
          {!register && <Link data-testid="forgot-password-link" className="forgot" to="/forgot-password">Lupa password?</Link>}
          
          <div className="auth-switch">
            {register ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
            <Link data-testid="auth-switch-link" to={register ? "/login" : "/register"}>
              {register ? "Masuk" : "Daftar gratis"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  
  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg("Masukkan email yang valid");
      return;
    }
    setBusy(true);
    try {
      const r = await api.post("/auth/forgot-password", { email });
      setMsg(r.data?.message || "Jika email terdaftar, instruksi reset sudah dibuat.");
    } catch (ex) {
      setMsg(errorText(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthSide />
      <div className="auth-form-wrap">
        <Link data-testid="reset-back-home" className="back-link" to="/login">← Kembali ke masuk</Link>
        <div className="auth-form">
          <div className="eyebrow">RESET PASSWORD</div>
          <h2>Lupa password?</h2>
          <p>Masukkan email Anda, kami akan kirim tautan reset password.</p>
          <form onSubmit={submit}>
            <label>
              Email
              <input data-testid="forgot-email-input" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" disabled={busy} />
            </label>
            {msg && <div data-testid="forgot-message" className={msg.includes("berhasil") || msg.includes("instruksi") ? "form-info" : "form-error"}>{msg}</div>}
            <Button data-testid="forgot-submit-button" type="submit" disabled={busy}>{busy ? <><Loader2 size={16} className="spin" /> Mengirim...</> : "Kirim tautan reset"} <ArrowRight size={16} /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  
  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!token) { setMsg("Token reset tidak ditemukan. Kembali ke <Link to=\"/forgot-password\">lupa password</Link>."); return; }
    if (password.length < 6) { setMsg("Password minimal 6 karakter"); return; }
    if (password !== confirm) { setMsg("Konfirmasi password tidak cocok"); return; }
    setBusy(true);
    try {
      const r = await api.post("/auth/reset-password", { token, password });
      setMsg(r.data?.message || "Password berhasil diperbarui. Silakan login.");
      setTimeout(() => nav("/login"), 2000);
    } catch (ex) {
      setMsg(errorText(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthSide />
      <div className="auth-form-wrap">
        <Link data-testid="reset-back-home" className="back-link" to="/login">← Kembali ke masuk</Link>
        <div className="auth-form">
          <div className="eyebrow">PASSWORD BARU</div>
          <h2>Buat password baru.</h2>
          <p>Buat password yang mudah kamu ingat dan aman.</p>
          {!token && <div className="form-error">Token reset tidak ditemukan. Kembali ke <Link to="/forgot-password">lupa password</Link>.</div>}
          <form onSubmit={submit}>
            <label className="password-field">
              <span>Password baru</span>
              <div className="password-input-wrap">
                <input data-testid="reset-password-input" required minLength="6" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 6 karakter" autoComplete="new-password" disabled={busy} />
                <button type="button" className="password-toggle" onClick={togglePasswordVisibility} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} disabled={busy}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </label>
            <label className="password-field">
              <span>Konfirmasi password</span>
              <div className="password-input-wrap">
                <input data-testid="reset-confirm-input" required minLength="6" type={showPassword ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Ulangi password" autoComplete="new-password" disabled={busy} />
                <button type="button" className="password-toggle" onClick={togglePasswordVisibility} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} disabled={busy}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </label>
            {msg && <div data-testid="reset-message" className={msg.includes("berhasil") ? "form-info" : "form-error"}>{msg}</div>}
            <Button data-testid="reset-submit-button" type="submit" disabled={!token || busy}>{busy ? <><Loader2 size={16} className="spin" /> Menyimpan...</> : "Perbarui password"} <ArrowRight size={16} /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}