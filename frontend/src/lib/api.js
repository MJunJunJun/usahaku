import axios from "axios";

// Satu sumber URL untuk local, Docker, dan production. Tanpa env, semua request
// memakai origin aktif dan /api diteruskan oleh dev proxy atau reverse proxy.
const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
const configuredBackend = (process.env.REACT_APP_BACKEND_URL || "").trim().replace(/\/$/, "");
export const BACKEND_ORIGIN = configuredBackend || browserOrigin;
export const API = `${BACKEND_ORIGIN}/api`;

export const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  // Aset bawaan frontend selalu mengikuti domain website aktif.
  if (url.startsWith("/assets/")) return url;
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      // URL upload lokal lama tetap portabel saat domain/backend berubah.
      if (["localhost", "127.0.0.1"].includes(parsed.hostname) && parsed.pathname.startsWith("/api/uploads/")) {
        return `${BACKEND_ORIGIN}${parsed.pathname}${parsed.search}`;
      }
    } catch (_) {}
    return url;
  }
  return `${BACKEND_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
};
export const api = axios.create({ baseURL: API, withCredentials: true });

export const money = (n) => new Intl.NumberFormat("id-ID").format(Number(n || 0));

export const errorText = (e) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  if (!e?.response) return "Server belum dapat dihubungi. Periksa koneksi lalu coba lagi.";
  if (e.response.status >= 500) return "Server sedang mengalami kendala. Silakan coba lagi.";
  return "Terjadi kesalahan. Silakan coba lagi.";
};

export const daysUntil = (iso) => {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));
};

export const formatDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch { return "-"; }
};

export const formatDateTime = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "-"; }
};

export const uploadFile = async (file) => {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Hanya gambar JPG, PNG, atau WebP yang dapat diunggah.");
  }
  const fd = new FormData();
  fd.append("file", file);
  const r = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return r.data;
};
