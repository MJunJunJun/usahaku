import { MessageCircle } from "lucide-react";
import { resolveMediaUrl } from "../lib/api";
import { publicWebsiteHref } from "../lib/config";
import { getImageAlt } from "../lib/imageAlt";

export default function BusinessSiteNav({ data, innerPage = false, articleUrl = "" }) {
  const c = data.aiGeneratedContent || {};
  const home = publicWebsiteHref(data.slug);
  const section = (id) => `${innerPage ? home : ""}#${id}`;
  const phone = String(data.whatsapp || "").replace(/\D/g, "");
  const wa = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(`Halo ${data.businessName}, saya ingin informasi dan memesan.`)}` : "#";
  const articles = articleUrl && <a data-testid="public-articles-link" href={articleUrl} aria-current={innerPage ? "page" : undefined}>Artikel</a>;
  const contact = (label, className) => <a data-testid="public-whatsapp-nav" className={className} href={wa} target="_blank" rel="noreferrer">{label}</a>;
  const link = (id, label) => <a data-testid={`public-nav-${id}`} href={section(id)}>{label}</a>;
  const vis = data.sectionVisibility || {};
  const products = (data.products || []).length > 0;
  const testimonials = vis.testimonials !== false && (c.testimonials || [1]).length > 0;
  const cards = { address: true, hours: true, social: true, ...(data.contactCards || {}) };
  const logo = resolveMediaUrl(data.logoUrl);
  return <header className="public-nav">
    <div className="public-brand"><a data-testid="public-home-link" href={home} className="business-brand-link">
      {logo ? <img src={logo} alt={getImageAlt({ alt: data.logoAlt, context: "Logo", businessName: data.businessName })} /> : <span className="public-brand-initial">{(data.businessName || "U")[0].toUpperCase()}</span>}
      <div className="public-brand-title"><b>{data.businessName}</b><small className="store-status"><span className="status-dot-pulse" /> Buka Hari Ini</small></div>
    </a></div>
    <nav className="public-nav-links" aria-label="Navigasi website">
      {link("tentang", "Tentang")}
      {vis.highlights !== false && (c.highlights || []).length > 0 && link("keunggulan", "Keunggulan")}
      {products && link("menu", "Produk & Menu")}
      {testimonials && link("testimoni", "Ulasan")}
      {vis.faq !== false && (c.faq || [1]).length > 0 && link("faq", "FAQ")}
      {vis.contact !== false && Object.values(cards).some(Boolean) && link("lokasi", "Kontak")}
      {articles}
    </nav>
    {contact(<><MessageCircle size={15} /><span>Chat WhatsApp</span></>, "public-nav-cta")}
  </header>;
}
