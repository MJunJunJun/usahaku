import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Plus, Sparkles, Store, CreditCard, Settings, Bell, Users, ClipboardList, ScrollText, Cog, Ticket, MessageSquare, Radio, BookUser, LayoutTemplate, FileText } from "lucide-react";
import { api, daysUntil } from "./api";
import { APP_NAME } from "./config";
import { NoIndex } from "./seo";

export const Brand = ({ light = false, mini = false }) => (
  <Link data-testid="brand-logo" className={`brand ${light ? "brand-light" : ""} ${mini ? "brand-mini" : ""}`} to="/">
    <span className="brand-mark"><Store size={mini ? 14 : 17} /></span>
    {!mini && APP_NAME}
  </Link>
);

export const Button = ({ children, variant = "primary", className = "", ...props }) => (
  <button data-testid={props["data-testid"] || "action-button"} className={`btn btn-${variant} ${className}`.trim()} {...props}>
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
  const status = user.subscriptionStatus;
  const expiryDays = daysUntil(status === "TRIAL_ACTIVE" ? user.trialEndDate : user.subscriptionExpiryDate);
  return (
    <aside className="app-sidebar">
      <Brand />
      <div className="side-label">RUANG KERJA</div>
      <NavLink end data-testid="sidebar-dashboard" to="/dashboard"><LayoutDashboard size={17} />Ringkasan</NavLink>
      <NavLink data-testid="sidebar-websites" to="/dashboard/websites"><Store size={17} />Website saya</NavLink>
      <NavLink data-testid="sidebar-create" to="/dashboard/websites/create" className="side-create"><Plus size={17} />{status === "TRIAL_PENDING" ? "Buat website Gratis" : "Buat website"}</NavLink>
      <NavLink data-testid="sidebar-subscription" to="/dashboard/subscription"><CreditCard size={17} />Paket & billing</NavLink>
      <NavLink data-testid="sidebar-coupons" to="/dashboard/coupons"><Ticket size={17} />Kupon saya</NavLink>
      <NavLink data-testid="sidebar-notifications" to="/dashboard/notifications"><Bell size={17} />Notifikasi</NavLink>
      <div className="side-spacer" />
      {showTrial && (
        <div className="trial-mini">
          <Sparkles size={16} />
          <b>
            {status === "TRIAL_PENDING" && "Gratis"}
            {status === "TRIAL_ACTIVE" && "Paket Gratis"}
            {status === "ACTIVE" && "Berlangganan aktif"}
            {status === "TRIAL_EXPIRED" && "Paket Gratis tidak aktif"}
            {status === "EXPIRED" && "Berlangganan berakhir"}
          </b>
          <span>
            {status === "TRIAL_PENDING" && "Buat 1 website gratis"}
            {status === "TRIAL_ACTIVE" && `${expiryDays} hari tersisa`}
            {status === "ACTIVE" && `${expiryDays} hari tersisa`}
            {(status === "TRIAL_EXPIRED" || status === "EXPIRED") && "Pilih paket untuk lanjut"}
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
      <NavLink end data-testid="admin-sidebar-overview" to="/admin"><LayoutDashboard size={17} />Overview</NavLink>
      <NavLink data-testid="admin-sidebar-users" to="/admin/users"><Users size={17} />Pengguna</NavLink>
      <NavLink data-testid="admin-sidebar-websites" to="/admin/websites"><Store size={17} />Website</NavLink>
      <NavLink data-testid="admin-sidebar-buildza-articles" to="/admin/buildza-articles"><FileText size={17} />Artikel Situska</NavLink>
      <NavLink data-testid="admin-sidebar-articles" to="/admin/articles"><FileText size={17} />Artikel</NavLink>
      <NavLink data-testid="admin-sidebar-payments" to="/admin/payment-requests"><ClipboardList size={17} />Pembayaran</NavLink>
      <NavLink data-testid="admin-sidebar-plans" to="/admin/plans"><CreditCard size={17} />Paket</NavLink>
      <NavLink data-testid="admin-sidebar-generator-templates" to="/admin/generator-templates"><LayoutTemplate size={17} />Template generator</NavLink>
      <NavLink data-testid="admin-sidebar-coupons" to="/admin/coupons"><Ticket size={17} />Kupon</NavLink>
      <NavLink data-testid="admin-sidebar-wa-contacts" to="/admin/wa-contacts"><BookUser size={17} />Kontak WA</NavLink>
      <NavLink data-testid="admin-sidebar-whatsapp" to="/admin/whatsapp"><Radio size={17} />WhatsApp</NavLink>
      <NavLink data-testid="admin-sidebar-logs" to="/admin/activity-logs"><ScrollText size={17} />Aktivitas</NavLink>
      <NavLink data-testid="admin-sidebar-settings" to="/admin/settings"><Cog size={17} />Pengaturan</NavLink>
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
  return <div className="app-shell"><NoIndex /><UserSidebar user={user} showTrial={showTrial} /><main className="app-main">{children}</main></div>;
};

export const AdminShell = ({ children }) => {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  useEffect(() => {
    api.get("/auth/me").then(r => { if (r.data.role !== "ADMIN") nav("/dashboard"); else setUser(r.data); }).catch(() => nav("/login"));
  }, [nav]);
  if (!user) return <Loading text="Memuat panel admin..." />;
  return <div className="app-shell admin-shell"><NoIndex /><AdminSidebar /><main className="app-main">{children}</main></div>;
};

export const StatusBadge = ({ status }) => {
  const map = {
    TRIAL_PENDING: { label: "Gratis", cls: "badge-neutral" },
    TRIAL_ACTIVE: { label: "Paket Gratis", cls: "badge-info" },
    ACTIVE: { label: "Berlangganan", cls: "badge-success" },
    TRIAL_EXPIRED: { label: "Paket Gratis tidak aktif", cls: "badge-warning" },
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
