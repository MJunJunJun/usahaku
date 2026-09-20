export const APP_NAME = (process.env.REACT_APP_BRAND_NAME || "Situska").trim() || "Situska";

// One production origin for canonical URLs, Open Graph, sitemap links, and
// structured data. Override it per environment when the production domain moves.
export const SEO_ORIGIN = (process.env.REACT_APP_PUBLIC_APP_URL || "https://situska.com").trim().replace(/\/$/, "");

// Each published business uses its own subdomain, for example
// "kopi-senja.situska.com".  The base can still be overridden in staging.
export const PUBLIC_SITE_DOMAIN = (process.env.REACT_APP_PUBLIC_SITE_DOMAIN || "situska.com").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
export const PUBLIC_SITE_HOST = PUBLIC_SITE_DOMAIN;

export const publicSiteHost = (slug) => slug ? `${slug}.${PUBLIC_SITE_DOMAIN}` : PUBLIC_SITE_DOMAIN;
export const publicSiteUrl = (slug, path = "") => `https://${publicSiteHost(slug)}${path}`;
export const publicSitePath = (slug, path = "") => `/site/${slug}${path}`;
