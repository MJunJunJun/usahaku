import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Plus, Sparkles, Store, CreditCard, Settings, Bell, Users, ClipboardList, ScrollText, Cog, Ticket } from "lucide-react";
import { api, daysUntil } from "./api";

export const Brand = ({ light = false, mini = false }) => (
  <Link data-testid="brand-logo" className={`brand ${light ? "brand-light" : ""} ${mini ? "brand-mini" : ""}`} to="/">
    <span className="brand-mark"><Store size={mini ? 14 : 17} /></span>
    {!mini && "UsahaKu"}
  </Link>
);

export const Button = ({ children, variant = "primary", ...props }) => (
  <button data-testid={props["data-testid"] || "action-button"} className={`btn btn-${variant}`} {...props}>
    {children}
  </button>
);

export const Loading = ({ text = "Memuat..." }) => (
  <div className="loading"><span className="spinner" />{text}</div>
);

export const FormError = ({ msg }) => msg ? <div data-testid="form-error" className="form-error">{msg}</div> : null;

export const useUser = (redirectOnFail = "/login") => {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  useEffect(() => {
    api.get("/auth/me").then(r => setUser(r.data)).catch(() => nav(redirectOnFail));
  }, [nav, redirectOnFail]);
  return user;
};

export const UserSidebar = ({ user, showTrial = true }) => {
  const nav = useNavigate();
  const trial = daysUntil(user.trialEndDate);
  const status = user.subscriptionStatus;
  const expiryDays = daysUntil(user.subscriptionExpiryDate);
  return (
    <aside className="app-sidebar">
      <Brand />
      <div className="side-label">RUANG KERJA</div>
      <Link data-testid="sidebar-dashboard" to="/dashboard"><LayoutDashboard size={17} />Ringkasan</Link>
      <Link data-testid="sidebar-websites" to="/dashboard/websites"><Store size={17} />Website saya</Link>
      <Link data-testid="sidebar-create" to="/dashboard/websites/create" className="side-create"><Plus size={17} />Buat website</Link>
      <Link data-testid="sidebar-subscription" to="/dashboard/subscription"><CreditCard size={17} />Paket & billing</Link>
      <Link data-testid="sidebar-coupons" to="/dashboard/coupons"><Ticket size={17} />Kupon saya</Link>
      <Link data-testid="sidebar-notifications" to="/dashboard/notifications"><Bell size={17} />Notifikasi</Link>
      <div className="side-spacer" />
      {showTrial && (
        <div className="trial-mini">
          <Sparkles size={16} />
          <b>
            {status === "TRIAL_ACTIVE" && "Trial gratis"}
            {status === "ACTIVE" && "Berlangganan aktif"}
            {status === "TRIAL_EXPIRED" && "Trial berakhir"}
            {status === "EXPIRED" && "Berlangganan berakhir"}
          </b>
          <span>
            {status === "TRIAL_ACTIVE" && `${trial} hari tersisa`}
            {status === "ACTIVE" && `${expiryDays} hari tersisa`}
            {(status === "TRIAL_EXPIRED" || status === "EXPIRED") && "Perpanjang untuk lanjut"}
          </span>
          <Link data-testid="sidebar-manage-plan" to="/dashboard/subscription">Kelola paket →</Link>
        </div>
      )}
      <button data-testid="sidebar-logout" className="logout" onClick={async () => { await api.post("/auth/logout"); nav("/"); }}>
        <LogOut size={16} />Keluar
      </button>
    </aside>
  );
};

export const AdminSidebar = () => {
  const nav = useNavigate();
  return (
    <aside className="app-sidebar admin-sidebar">
      <Brand />
      <div className="side-label">ADMIN PANEL</div>
      <Link data-testid="admin-sidebar-overview" to="/admin"><LayoutDashboard size={17} />Overview</Link>
      <Link data-testid="admin-sidebar-users" to="/admin/users"><Users size={17} />Pengguna</Link>
      <Link data-testid="admin-sidebar-websites" to="/admin/websites"><Store size={17} />Website</Link>
      <Link data-testid="admin-sidebar-payments" to="/admin/payment-requests"><ClipboardList size={17} />Pembayaran</Link>
      <Link data-testid="admin-sidebar-plans" to="/admin/plans"><CreditCard size={17} />Paket</Link>
      <Link data-testid="admin-sidebar-coupons" to="/admin/coupons"><Ticket size={17} />Kupon</Link>
      <Link data-testid="admin-sidebar-logs" to="/admin/activity-logs"><ScrollText size={17} />Aktivitas</Link>
      <Link data-testid="admin-sidebar-settings" to="/admin/settings"><Cog size={17} />Pengaturan</Link>
      <div className="side-spacer" />
      <Link data-testid="admin-sidebar-user-mode" to="/dashboard" className="admin-switch"><Settings size={15} />Mode pengguna</Link>
      <button data-testid="admin-sidebar-logout" className="logout" onClick={async () => { await api.post("/auth/logout"); nav("/"); }}>
        <LogOut size={16} />Keluar
      </button>
    </aside>
  );
};

export const UserShell = ({ children }) => {
  const user = useUser();
  const [websiteCount, setWebsiteCount] = useState(null);
  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      api.get("/dashboard").then(r => setWebsiteCount(r.data.stats.total)).catch(() => setWebsiteCount(0));
    }
  }, [user]);
  if (!user) return <Loading text="Menyiapkan ruang kerja..." />;
  if (user.role === "ADMIN") return <AdminShell>{children}</AdminShell>;
  const showTrial = (websiteCount === null) ? false : (user.subscriptionStatus !== "TRIAL_ACTIVE" || websiteCount > 0);
  return <div className="app-shell"><UserSidebar user={user} showTrial={showTrial} /><main className="app-main">{children}</main></div>;
};

export const AdminShell = ({ children }) => {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  useEffect(() => {
    api.get("/auth/me").then(r => { if (r.data.role !== "ADMIN") nav("/dashboard"); else setUser(r.data); }).catch(() => nav("/login"));
  }, [nav]);
  if (!user) return <Loading text="Memuat panel admin..." />;
  return <div className="app-shell admin-shell"><AdminSidebar /><main className="app-main">{children}</main></div>;
};

export const StatusBadge = ({ status }) => {
  const map = {
    TRIAL_ACTIVE: { label: "Trial aktif", cls: "badge-info" },
    ACTIVE: { label: "Berlangganan", cls: "badge-success" },
    TRIAL_EXPIRED: { label: "Trial berakhir", cls: "badge-warning" },
    EXPIRED: { label: "Berakhir", cls: "badge-danger" },
    PAYMENT_PENDING: { label: "Menunggu bayar", cls: "badge-info" },
    PENDING: { label: "Menunggu", cls: "badge-warning" },
    APPROVED: { label: "Disetujui", cls: "badge-success" },
    REJECTED: { label: "Ditolak", cls: "badge-danger" },
    SUSPENDED: { label: "Ditangguhkan", cls: "badge-danger" },
    PUBLISHED: { label: "Online", cls: "badge-success" },
    DRAFT: { label: "Draft", cls: "badge-neutral" },
  };
  const s = map[status] || { label: status, cls: "badge-neutral" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};
