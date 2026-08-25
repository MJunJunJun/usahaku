import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, MessageCircle, Info, Wrench, Circle } from "lucide-react";
import { api } from "../lib/api";
import { Brand, Loading, Button } from "../lib/shared";
import PublicWebsiteView from "./PublicWebsiteView";

export function PublicRoute() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    api.get(`/public/${slug}`).then(r => setData(r.data)).catch(() => setError(true));
  }, [slug]);
  if (error) return <NotFoundPage />;
  if (!data) return <Loading text="Membuka website..." />;
  if (data.maintenance) return <MaintenancePage slug={slug} businessName={data.businessName} />;
  return <PublicWebsiteView data={data} />;
}

function MaintenancePage({ slug, businessName }) {
  return (
    <div className="maintenance-page">
      <header className="maintenance-header">
        <Brand />
      </header>
      <main className="maintenance-main">
        <div className="maintenance-card">
          <div className="maintenance-icon"><Wrench size={40} /></div>
          <div className="eyebrow">STATUS WEBSITE</div>
          <h1>Maaf, Website Sedang Dalam Pemeliharaan.</h1>
          <p>Website {businessName ? <b>{businessName}</b> : "ini"} sedang dalam pemeliharaan sementara. Silakan kembali beberapa saat lagi.</p>
          <div className="maintenance-divider" />
          <div className="maintenance-owner">
            <Info size={16} />
            <div>
              <b>Apakah Anda pemilik website ini?</b>
              <span>Masuk untuk mengaktifkan kembali website Anda.</span>
            </div>
            <Link data-testid="owner-info-link" className="btn btn-primary" to={`/owner-access/${slug}`}>Informasi untuk Pemilik <ArrowRight size={15} /></Link>
          </div>
        </div>
        <a data-testid="maintenance-home" className="text-link" href="/">Kembali ke UsahaKu →</a>
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="maintenance-page">
      <header className="maintenance-header"><Brand /></header>
      <main className="maintenance-main">
        <div className="maintenance-card">
          <div className="maintenance-icon"><Circle size={30} /></div>
          <div className="eyebrow">TIDAK DITEMUKAN</div>
          <h1>Website tidak ditemukan.</h1>
          <p>Tautan mungkin salah atau website belum dipublikasikan.</p>
        </div>
        <Link className="text-link" to="/">Kembali ke UsahaKu →</Link>
      </main>
    </div>
  );
}

export function OwnerAccess() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [notOwner, setNotOwner] = useState(false);
  useEffect(() => {
    api.get(`/owner-access/${slug}`)
      .then(r => setData(r.data))
      .catch(e => {
        if (e?.response?.status === 401) setNeedsLogin(true);
        else if (e?.response?.status === 403) setNotOwner(true);
      });
  }, [slug]);

  if (needsLogin) {
    return (
      <div className="maintenance-page">
        <header className="maintenance-header"><Brand /></header>
        <main className="maintenance-main">
          <div className="maintenance-card">
            <div className="eyebrow">INFORMASI PEMILIK</div>
            <h1>Apakah Anda pemilik website ini?</h1>
            <p>Masuk ke akun UsahaKu yang digunakan untuk mengelola website ini agar dapat melihat status dan mengaktifkannya kembali.</p>
            <div className="maintenance-actions">
              <Button data-testid="owner-login-button" onClick={() => nav("/login")}>Masuk ke UsahaKu <ArrowRight size={15} /></Button>
              <Link data-testid="owner-register-link" className="text-link" to="/register">Belum punya akun? Daftar</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }
  if (notOwner) {
    return (
      <div className="maintenance-page">
        <header className="maintenance-header"><Brand /></header>
        <main className="maintenance-main">
          <div className="maintenance-card">
            <div className="eyebrow">AKSES DITOLAK</div>
            <h1>Website ini bukan bagian dari akun Anda.</h1>
            <p>Silakan masuk dengan akun yang benar atau hubungi pemilik untuk mengakses informasi ini.</p>
            <div className="maintenance-actions">
              <Button data-testid="owner-back-login" onClick={() => nav("/login")}>Ganti akun</Button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  if (!data) return <Loading text="Memverifikasi kepemilikan..." />;

  const status = data.owner?.subscriptionStatus;
  const statusLabel = { TRIAL_ACTIVE: "Trial gratis aktif", TRIAL_EXPIRED: "Trial gratis berakhir", ACTIVE: "Berlangganan aktif", EXPIRED: "Berlangganan berakhir" }[status] || status;

  return (
    <div className="maintenance-page">
      <header className="maintenance-header"><Brand /></header>
      <main className="maintenance-main">
        <div className="maintenance-card wide">
          <div className="eyebrow">STATUS WEBSITE</div>
          <h1>Website Anda sedang tidak aktif.</h1>
          <p>{data.website.businessName} sedang dalam pemeliharaan karena {status === "TRIAL_EXPIRED" ? "trial gratis 30 hari telah berakhir" : "berlangganan telah berakhir"}. Aktifkan kembali untuk kembali online.</p>
          <div className="owner-status">
            <div><small>NAMA BISNIS</small><b>{data.website.businessName}</b></div>
            <div><small>URL PUBLIK</small><b>/site/{data.website.slug}</b></div>
            <div><small>STATUS</small><b>{statusLabel}</b></div>
            <div><small>PAKET</small><b>{data.owner.planSlug || "Trial"}</b></div>
          </div>
          <div className="maintenance-actions">
            <Button data-testid="owner-choose-plan" onClick={() => nav("/dashboard/subscription")}>Aktifkan kembali · Pilih paket <ArrowRight size={15} /></Button>
            <Link data-testid="owner-dashboard-link" className="text-link" to="/dashboard">Buka dashboard →</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
