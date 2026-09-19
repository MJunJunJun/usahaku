export const APP_NAME = (process.env.REACT_APP_BRAND_NAME || "Situska").trim() || "Situska";

// One production origin for canonical URLs, Open Graph, sitemap links, and
// structured data. Override it per environment when the production domain moves.
export const SEO_ORIGIN = (process.env.REACT_APP_PUBLIC_APP_URL || "https://situska.com").trim().replace(/\/$/, "");

const configuredPublicHost = (process.env.REACT_APP_PUBLIC_SITE_HOST || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
const activeHost = typeof window !== "undefined" ? window.location.host : "";
export const PUBLIC_SITE_HOST = configuredPublicHost || activeHost || "example.com";
