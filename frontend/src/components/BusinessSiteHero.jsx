import { useId } from "react";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import { getImageAlt } from "../lib/imageAlt";

export default function BusinessSiteHero({ template, data, c, bgUrl, coverStyle, products, wa }) {
  const photoClipId = "playful-photo-" + useId().replace(/:/g, "");
  if (template === "warm") return <section className="warm-hero"><div className="warm-copy"><small>{c.heroBadge || "RASA YANG BERKESAN"}</small><h1>{c.heroTitle || `Selamat datang di ${data.businessName}`}</h1><p>{c.heroSubtitle || data.description}</p><a data-testid="public-hero-products" href={products.length ? "#menu" : wa}>Lihat pilihan <ArrowRight size={16} /></a></div><img src={bgUrl} alt={getImageAlt({ alt: data.coverImageAlt, context: "Tampilan usaha", businessName: data.businessName })} width="1600" height="900" fetchPriority="high" style={{ objectPosition: coverStyle?.objectPosition, filter: coverStyle?.filter }} /></section>;
  if (template === "bold") return <section className="bold-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(5,10,20,.92), rgba(5,10,20,.35)), url(${bgUrl})`, backgroundPosition: coverStyle?.backgroundPosition, backgroundSize: coverStyle?.backgroundSize }}><div className="bold-headline"><small>{c.heroBadge || data.category}</small><h1>{c.heroTitle || data.businessName}</h1><p>{c.heroSubtitle || data.description}</p><a data-testid="public-hero-products" href={products.length ? "#menu" : wa}><MessageCircle size={17} /> {c.heroCta || "Lihat produk"}</a></div><div className="bold-facts"><span><b>01</b>Kualitas pilihan</span><span><b>02</b>{data.city || "Indonesia"}</span><span><b>03</b>Pesan mudah</span></div></section>;
  if (template === "minimal") return <section className="minimal-hero"><div><small>EST. {data.city || "INDONESIA"}</small><h1>{c.heroTitle || data.businessName}</h1><p>{c.heroSubtitle || data.description}</p><a data-testid="public-hero-products" href={products.length ? "#menu" : wa}>Eksplor koleksi <ArrowRight size={15} /></a></div><figure><img src={bgUrl} alt={getImageAlt({ alt: data.coverImageAlt, context: "Tampilan usaha", businessName: data.businessName })} width="1600" height="900" fetchPriority="high" style={{ objectPosition: coverStyle?.objectPosition, filter: coverStyle?.filter }} /><figcaption>{c.heroBadge || "Pilihan berkualitas untuk keseharian Anda"}</figcaption></figure></section>;
  if (template === "playful") return (
    <section className="playful-hero">
      <div className="playful-copy">
        <span className="playful-welcome">{c.heroBadge || "SELAMAT DATANG"}</span>
        <h1>{c.heroTitle || "Hai dari " + data.businessName + "!"}</h1>
        <p>{c.heroSubtitle || data.description}</p>
        <div className="playful-hero-actions">
          {data.whatsapp && <a className="playful-primary-cta" data-testid="public-playful-whatsapp" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18} />{c.heroCta || "Chat WhatsApp"}<ArrowRight size={16} /></a>}
          {products.length > 0 && <a className="playful-secondary-cta" data-testid="public-hero-products" href="#menu">Lihat {/barber|potong rambut/i.test(data.category + " " + data.description) ? "Layanan" : "Produk & Menu"}<ArrowRight size={16} /></a>}
        </div>
      </div>
      <div className="playful-picture">
        <svg className="playful-clip-defs" width="0" height="0" aria-hidden="true"><defs><clipPath id={photoClipId} clipPathUnits="objectBoundingBox"><path d="M .055 .28 C .065 .18 .29 .035 .51 .012 C .66 -.007 .82 .015 .885 .08 C .94 .135 .955 .29 .975 .43 C .995 .58 1 .75 .955 .84 C .90 .955 .74 .988 .57 .985 C .36 1 .14 .965 .065 .875 C -.025 .775 .025 .65 .055 .54 C .09 .42 .025 .37 .055 .28 Z" /></clipPath></defs></svg>
        <div className="playful-photo-frame" style={{ clipPath: "url(#" + photoClipId + ")" }}>
          <img src={bgUrl} alt={getImageAlt({ alt: data.coverImageAlt, context: "Tampilan usaha", businessName: data.businessName })} width="1600" height="900" fetchPriority="high" style={{ clipPath: "url(#" + photoClipId + ")", objectPosition: coverStyle?.objectPosition, filter: coverStyle?.filter }} />
        </div>
        <i className="playful-photo-rays" aria-hidden="true" />
        {data.city && <b><MapPin size={14} />{data.city}</b>}
      </div>
    </section>
  );
  return null;
}
