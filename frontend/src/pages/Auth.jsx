import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api, errorText } from "../lib/api";
import { Brand, Button, FormError } from "../lib/shared";

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
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await api.post(`/auth/${register ? "register" : "login"}`, form);
      localStorage.setItem("user", JSON.stringify(r.data));
      nav(r.data.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (ex) { setErr(errorText(ex)); }
    finally { setBusy(false); }
  };
  return (
    <div className="auth-page">
      <AuthSide />
      <div className="auth-form-wrap">
        <Link data-testid="auth-back-home" className="back-link" to="/">← Kembali ke beranda</Link>
        <div className="auth-form">
          <div className="eyebrow">{register ? "MULAI GRATIS" : "SELAMAT DATANG KEMBALI"}</div>
          <h2>{register ? "Buat website pertamamu." : "Masuk ke UsahaKu."}</h2>
          <p>{register ? "Trial gratis 30 hari, tanpa kartu kredit." : "Kelola semua website usahamu dari satu tempat."}</p>
          <form onSubmit={submit}>
            {register && (
              <label>Nama lengkap
                <input data-testid="register-name-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Rina Pratama" />
              </label>
            )}
            <label>Email
              <input data-testid={`${register ? "register" : "login"}-email-input`} required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" />
            </label>
            <label>Password
              <input data-testid={`${register ? "register" : "login"}-password-input`} required minLength="6" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimal 6 karakter" />
            </label>
            <FormError msg={err} />
            <Button data-testid={`${register ? "register" : "login"}-submit-button`} type="submit">
              {busy ? "Sebentar..." : register ? "Buat akun gratis" : "Masuk"} <ArrowRight size={16} />
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
    setBusy(true); setMsg("");
    try {
      const r = await api.post("/auth/forgot-password", { email });
      setMsg(r.data.message + " " + (r.data.hint || ""));
    } catch (ex) { setMsg(errorText(ex)); }
    finally { setBusy(false); }
  };
  return (
    <div className="auth-page">
      <AuthSide />
      <div className="auth-form-wrap">
        <Link data-testid="forgot-back-home" className="back-link" to="/login">← Kembali ke masuk</Link>
        <div className="auth-form">
          <div className="eyebrow">LUPA PASSWORD</div>
          <h2>Reset password akunmu.</h2>
          <p>Masukkan email akun. Kami akan siapkan tautan reset password.</p>
          <form onSubmit={submit}>
            <label>Email
              <input data-testid="forgot-email-input" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" />
            </label>
            {msg && <div data-testid="forgot-message" className="form-info">{msg}</div>}
            <Button data-testid="forgot-submit-button" type="submit">{busy ? "Mengirim..." : "Kirim instruksi"} <ArrowRight size={16} /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const token = params.get("token") || "";
  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setMsg("Password tidak sama."); return; }
    setBusy(true); setMsg("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setMsg("Password berhasil diperbarui. Mengalihkan...");
      setTimeout(() => nav("/login"), 1500);
    } catch (ex) { setMsg(errorText(ex)); }
    finally { setBusy(false); }
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
            <label>Password baru
              <input data-testid="reset-password-input" required minLength="6" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 6 karakter" />
            </label>
            <label>Konfirmasi password
              <input data-testid="reset-confirm-input" required minLength="6" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Ulangi password" />
            </label>
            {msg && <div data-testid="reset-message" className={msg.includes("berhasil") ? "form-info" : "form-error"}>{msg}</div>}
            <Button data-testid="reset-submit-button" type="submit" disabled={!token}>{busy ? "Menyimpan..." : "Perbarui password"} <ArrowRight size={16} /></Button>
          </form>
        </div>
      </div>
    </div>
  );
}
