import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });

export const money = (n) => new Intl.NumberFormat("id-ID").format(Number(n || 0));

export const errorText = (e) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
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
  const fd = new FormData();
  fd.append("file", file);
  const r = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return r.data;
};
