import { ArrowRight, MessageCircle } from "lucide-react";
import { money } from "../lib/api";

export default function PublicWebsiteView({ data, embedded = false }) {
  const c = data.aiGeneratedContent || {};
  const primary = data.themeConfig?.primary || "#16A34A";
  const accent = data.themeConfig?.accent || "#14532D";
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
  const fixUrl = (u) => !u ? "" : (u.startsWith("http") ? u : backendUrl + u);
  const wa = data.whatsapp ? `https://wa.me/${data.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Halo ${data.businessName}, saya ingin memesan.`)}` : "#";
  const bgUrl = fixUrl(data.coverImageUrl) || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1200&auto=format&fit=crop";
  const logoUrl = fixUrl(data.logoUrl);
  const products = data.products || [];

  const heroStyle = { "--pri": primary, "--acc": accent, backgroundImage: `linear-gradient(115deg, ${accent}f2 0%, ${primary}bf 60%, transparent 100%), url(${bgUrl})` };

  return (
    <div className={`public-site ${embedded ? "embedded" : ""}`} style={{ "--pri": primary, "--acc": accent }}>
      <div className="public-nav">
        <div className="public-brand">
          {logoUrl && <img src={logoUrl} alt="" />}
          <b>{data.businessName}</b>
        </div>
        <span className="public-nav-links">
          <a href="#tentang">Tentang</a>
          <a href="#menu">Menu</a>
          <a href="#lokasi">Lokasi</a>
        </span>
        <a data-testid="public-whatsapp-nav" className="public-nav-cta" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Hubungi</a>
      </div>
      <div className="public-hero" style={heroStyle}>
        <div className="public-hero-inner">
          <small>{(data.category || "").toUpperCase()} · {(data.city || "INDONESIA").toUpperCase()}</small>
          <h2>{c.heroTitle || `Selamat datang di ${data.businessName}`}</h2>
          <p>{c.heroSubtitle || data.description || "Temukan produk terbaik dari kami."}</p>
          <a data-testid="public-whatsapp-hero" href={wa} target="_blank" rel="noreferrer">
            {c.heroCta || "Pesan sekarang"} <ArrowRight size={14} />
          </a>
        </div>
      </div>
      {(c.about || data.description) && (
        <div id="tentang" className="public-about">
          <small>TENTANG KAMI</small>
          <h3>Cerita di balik {data.businessName}</h3>
          <p>{c.about || data.description}</p>
        </div>
      )}
      {c.highlights?.length ? (
        <div className="public-highlights">
          {c.highlights.slice(0, 3).map((h, i) => (
            <div key={i} className="highlight-card"><b>0{i + 1}</b><span>{h}</span></div>
          ))}
        </div>
      ) : null}
      {products.length > 0 && (
        <div id="menu" className="public-content">
          <div className="public-section-title">
            <small>{c.productHeadline ? c.productHeadline.toUpperCase() : "MENU FAVORIT"}</small>
            <h3>{c.productHeadline || "Yang paling disukai"}</h3>
          </div>
          <div className="public-products">
            {products.map((p, i) => {
              const img = fixUrl(p.images?.[0]);
              const wam = `https://wa.me/${(data.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Halo ${data.businessName}, saya ingin memesan ${p.name}.`)}`;
              return (
                <article data-testid={`public-product-${i}`} key={p.id || i}>
                  <div className={`public-product-image product-${i % 3}`} style={img ? { backgroundImage: `url(${img})` } : undefined} />
                  <div>
                    <h4>{p.name}</h4>
                    <p>{p.description || "Pilihan terbaik untuk hari ini."}</p>
                    <b>Rp{money(p.price)}</b>
                  </div>
                  <a data-testid={`public-product-whatsapp-${i}`} href={data.whatsapp ? wam : wa} target="_blank" rel="noreferrer"><MessageCircle size={14} /></a>
                </article>
              );
            })}
          </div>
        </div>
      )}
      <div id="lokasi" className="public-contact">
        <div>
          <small>DATANG DAN SINGGAH</small>
          <b>{data.address || "Temukan lokasi kami"}</b>
          <span>{[data.city, data.province].filter(Boolean).join(", ") || "Indonesia"}</span>
          {data.address && (
            <a target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${encodeURIComponent([data.address, data.city, data.province].filter(Boolean).join(", "))}`}>Buka di Google Maps →</a>
          )}
        </div>
        <div>
          <small>HUBUNGI KAMI</small>
          {data.whatsapp && <b>WhatsApp {data.whatsapp}</b>}
          {data.phone && <span>Telepon {data.phone}</span>}
          {data.email && <span>{data.email}</span>}
          {data.instagram && <span>Instagram {data.instagram}</span>}
          {data.facebook && <span>Facebook {data.facebook}</span>}
        </div>
      </div>
      <div className="public-footer">
        <b>{data.businessName}</b>
        <span>Dibuat dengan UsahaKu</span>
      </div>
    </div>
  );
}
