import { useEffect } from "react";
import { SEO_ORIGIN } from "./config";

const absoluteUrl = (value = "") => !value ? "" : (/^https?:\/\//i.test(value) ? value : `${SEO_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`);
const setTag = (selector, attributes) => {
  let tag = document.head.querySelector(selector);
  if (!tag) { tag = document.createElement("meta"); document.head.appendChild(tag); }
  Object.entries(attributes).forEach(([key, value]) => tag.setAttribute(key, value || ""));
};

export function SeoHead({ title, description, image, type = "website", schema, canonical, robots = "index, follow" }) {
  useEffect(() => {
    const canonicalUrl = absoluteUrl(canonical || window.location.pathname);
    const imageUrl = absoluteUrl(image);
    document.title = title;
    setTag('meta[name="description"]', { name: "description", content: description });
    setTag('meta[name="robots"]', { name: "robots", content: robots });
    [["og:title", title], ["og:description", description], ["og:type", type], ["og:url", canonicalUrl], ["og:image", imageUrl], ["twitter:card", "summary_large_image"], ["twitter:title", title], ["twitter:description", description], ["twitter:image", imageUrl]].forEach(([property, content]) => {
      const isTwitter = property.startsWith("twitter:");
      const selector = `meta[${isTwitter ? "name" : "property"}="${property}"]`;
      setTag(selector, { [isTwitter ? "name" : "property"]: property, content });
    });
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = canonicalUrl;
    let jsonLd = document.head.querySelector('script[data-buildza-schema]');
    if (!jsonLd) { jsonLd = document.createElement("script"); jsonLd.type = "application/ld+json"; jsonLd.dataset.buildzaSchema = "true"; document.head.appendChild(jsonLd); }
    jsonLd.text = schema ? JSON.stringify(schema) : "";
  }, [title, description, image, type, schema, canonical, robots]);
  return null;
}

export function NoIndex() {
  useEffect(() => {
    setTag('meta[name="robots"]', { name: "robots", content: "noindex, nofollow" });
    return () => setTag('meta[name="robots"]', { name: "robots", content: "index, follow" });
  }, []);
  return null;
}

export const originUrl = () => SEO_ORIGIN;
