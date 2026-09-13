export const APP_NAME = (process.env.REACT_APP_BRAND_NAME || "UsahaKu").trim() || "UsahaKu";

const configuredPublicHost = (process.env.REACT_APP_PUBLIC_SITE_HOST || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
const activeHost = typeof window !== "undefined" ? window.location.host : "";
export const PUBLIC_SITE_HOST = configuredPublicHost || activeHost || "example.com";
