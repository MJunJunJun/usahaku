import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorText } from "../lib/api";
import { AlertCircle, CheckCircle, Loader2, Clock } from "lucide-react";
import "./VerifyWA.css";

export default function VerifyWA() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [timeLeft, setTimeLeft] = useState(600);
  const [formData, setFormData] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem("pendingRegistration");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const createdAt = new Date(parsed.createdAt).getTime();
        const now = Date.now();
        const elapsed = (now - createdAt) / 1000;
        if (elapsed < 600) {
          setFormData(parsed);
          setTimeLeft(Math.max(0, 600 - Math.floor(elapsed)));
        } else {
          sessionStorage.removeItem("pendingRegistration");
          navigate("/register");
        }
      } catch (e) {
        sessionStorage.removeItem("pendingRegistration");
        navigate("/register");
      }
    } else {
      navigate("/register");
    }
  }, [navigate]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  const handleTimeout = () => {
    setErr("Kode verifikasi sudah kedaluwarsa (10 menit). Silakan daftar ulang.");
    sessionStorage.removeItem("pendingRegistration");
    setTimeout(() => navigate("/register"), 3000);
  };

  const sendWaCode = async () => {
    if (!formData) return;
    setBusy(true);
    setErr("");
    try {
      await api.post("/auth/send-wa-code", { phone: formData.whatsapp, name: formData.name });
      setMsg("Kode verifikasi terkirim ke WhatsApp Anda.");
      setResendCooldown(60);
    } catch (ex) {
      setErr(errorText(ex));
    } finally {
      setBusy(false);
    }
  };

  const verifyAndRegister = async () => {
    if (!formData || code.length < 4) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const verifyRes = await api.post("/auth/verify-wa", { phone: formData.whatsapp, code });
      if (!verifyRes.data || !verifyRes.data.ok) {
        setErr("Kode verifikasi salah atau sudah kedaluwarsa.");
        setBusy(false);
        return;
      }

      const registerData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        whatsapp: formData.whatsapp,
      };
      const regRes = await api.post("/auth/register", registerData);
      
      const loginRes = await api.post("/auth/login", { email: formData.email, password: formData.password });
      localStorage.setItem("user", JSON.stringify(loginRes.data));
      sessionStorage.removeItem("pendingRegistration");
      
      navigate(loginRes.data.role === "ADMIN" ? "/admin" : "/dashboard");
    } catch (ex) {
      setErr(errorText(ex));
    } finally {
      setBusy(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!formData) {
    return (
      <div className="verify-page">
        <div className="verify-card">
          <Loader2 className="spin" size={32} />
          <p>Memuat data pendaftaran...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-page">
      <div className="verify-card">
        <div className="verify-header">
          <div className="verify-icon">
            <Clock size={32} />
          </div>
          <h2>Verifikasi WhatsApp</h2>
          <p>Kami telah mengirim kode 6 digit ke <strong>{formData.whatsapp}</strong></p>
        </div>

        <div className="timer-bar">
          <Clock size={16} />
          <span>Kode berlaku hingga: <strong>{formatTime(timeLeft)}</strong></span>
        </div>

        {msg && <div className="form-info">{msg}</div>}
        {err && <div className="form-error"><AlertCircle size={16} /> {err}</div>}

        <form onSubmit={(e) => { e.preventDefault(); verifyAndRegister(); }}>
          <label>
            <span>Kode Verifikasi</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoComplete="one-time-code"
              required
              disabled={busy}
              autoFocus
            />
          </label>

          <button type="submit" className="btn btn-verify" disabled={busy || code.length < 4}>
            {busy ? <><Loader2 size={16} className="spin" /> Memverifikasi...</> : <><CheckCircle size={18} /> Verifikasi Sekarang</>}
          </button>
        </form>

        <div className="resend-area">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={sendWaCode}
            disabled={busy || resendCooldown > 0 || timeLeft <= 0}
          >
            {resendCooldown > 0 
              ? `Kirim ulang dalam ${resendCooldown}s` 
              : "Kirim ulang kode"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              sessionStorage.removeItem("pendingRegistration");
              navigate("/register");
            }}
            disabled={busy}
          >
            Batal & Daftar Ulang
          </button>
        </div>

        <div className="verify-footer">
          <p>Tidak menerima kode? Pastikan nomor WhatsApp aktif dan coba kirim ulang.</p>
        </div>
      </div>
    </div>
  );
}
