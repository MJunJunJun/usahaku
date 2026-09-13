import { ArrowRight, MapPin, MessageCircle, ShoppingBag, Star } from "lucide-react";
import { money } from "../lib/api";

const ProductCards = ({ data, products, fixUrl, wa, compact = false }) => (
  <div className={`tpl-products ${compact ? "tpl-products-compact" : ""}`}>
    {products.map((product, index) => {
      const image = fixUrl(product.images?.[0]);
      const text = `Halo ${data.businessName}, saya ingin memesan *${product.name}* (Rp${money(product.price)}). Apakah masih tersedia?`;
      const orderUrl = data.whatsapp ? `https://wa.me/${String(data.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : wa;
      return <article className="tpl-product" key={product.id || index}>
        <div className="tpl-product-image">
          {image ? <img src={image} alt={product.name} /> : <ShoppingBag size={28} />}
        </div>
        <div className="tpl-product-copy">
          <h3>{product.name}</h3>
          <p>{product.description || "Produk pilihan yang dibuat untuk kebutuhan Anda."}</p>
          <div><b>Rp{money(product.price)}</b><a href={orderUrl} target="_blank" rel="noreferrer">Pesan <ArrowRight size={14} /></a></div>
        </div>
      </article>;
    })}
  </div>
);

const TestimonialStrip = ({ testimonials }) => testimonials?.length ? (
  <section className="tpl-testimonials">
    {testimonials.slice(0, 3).map((item, index) => <figure key={index}>
      <span>{[...Array(item.rating || 5)].map((_, i) => <Star key={i} size={13} fill="currentColor" />)}</span>
      <blockquote>“{item.comment}”</blockquote><figcaption>{item.name} · {item.role || "Pelanggan"}</figcaption>
    </figure>)}
  </section>
) : null;

const Footer = ({ data, wa }) => <footer className="tpl-footer">
  <b>{data.businessName}</b><span>{data.address || [data.city, data.province].filter(Boolean).join(", ") || "Indonesia"}</span>
  <a href={wa} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Hubungi WhatsApp</a>
</footer>;

const WarmLayout = ({ data, c, bgUrl, coverStyle, products, fixUrl, wa, highlights, testimonials }) => (
  <div className="tpl-site tpl-warm">
    <header className="tpl-nav"><b>{data.businessName}</b><nav><a href="#cerita">Cerita kami</a><a href="#menu">Menu</a><a href="#ulasan">Ulasan</a></nav><a className="tpl-nav-cta" href={wa} target="_blank" rel="noreferrer">Reservasi</a></header>
    <main>
      <section className="warm-hero"><div className="warm-copy"><small>{c.heroBadge || "RASA YANG BERKESAN"}</small><h1>{c.heroTitle || `Selamat datang di ${data.businessName}`}</h1><p>{c.heroSubtitle || data.description}</p><a href="#menu">Lihat pilihan <ArrowRight size={16} /></a></div><img src={bgUrl} alt={data.businessName} style={{ objectPosition: coverStyle?.objectPosition, filter: coverStyle?.filter }} /></section>
      <section id="cerita" className="warm-story"><small>SEKILAS TENTANG KAMI</small><p>{c.about || data.description}</p><div>{highlights.slice(0, 3).map((h, i) => <span key={i}><b>0{i + 1}</b>{h.title}</span>)}</div></section>
      {products.length > 0 && <section id="menu" className="warm-menu"><div><small>PILIHAN TERBAIK</small><h2>{c.productHeadline || "Menu untuk dinikmati"}</h2></div><ProductCards data={data} products={products} fixUrl={fixUrl} wa={wa} compact /></section>}
      <section id="ulasan"><TestimonialStrip testimonials={testimonials} /></section>
    </main><Footer data={data} wa={wa} />
  </div>
);

const BoldLayout = ({ data, c, bgUrl, coverStyle, products, fixUrl, wa, highlights, testimonials }) => (
  <div className="tpl-site tpl-bold-new">
    <main className="bold-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(5,10,20,.92), rgba(5,10,20,.35)), url(${bgUrl})`, backgroundPosition: coverStyle?.backgroundPosition, backgroundSize: coverStyle?.backgroundSize }}><header><b>{data.businessName}</b><a href={wa} target="_blank" rel="noreferrer">CHAT SEKARANG ↗</a></header><div className="bold-headline"><small>{c.heroBadge || data.category}</small><h1>{c.heroTitle || data.businessName}</h1><p>{c.heroSubtitle || data.description}</p><a href="#produk"><MessageCircle size={17} /> {c.heroCta || "Lihat produk"}</a></div><div className="bold-facts"><span><b>01</b>Kualitas pilihan</span><span><b>02</b>{data.city || "Indonesia"}</span><span><b>03</b>Pesan mudah</span></div></main>
    {highlights.length > 0 && <section className="bold-highlights">{highlights.slice(0, 3).map((h, i) => <article key={i}><b>0{i + 1}</b><h3>{h.title}</h3><p>{h.desc}</p></article>)}</section>}
    {products.length > 0 && <section id="produk" className="bold-products"><small>KOLEKSI TERPILIH</small><h2>{c.productHeadline || "Produk kami"}</h2><ProductCards data={data} products={products} fixUrl={fixUrl} wa={wa} /></section>}
    <TestimonialStrip testimonials={testimonials} /><Footer data={data} wa={wa} />
  </div>
);

const MinimalLayout = ({ data, c, bgUrl, coverStyle, products, fixUrl, wa, testimonials }) => (
  <div className="tpl-site tpl-minimal-new"><header className="minimal-nav"><b>{data.businessName}</b><span>{data.category}</span><a href={wa} target="_blank" rel="noreferrer">Kontak</a></header>
    <main><section className="minimal-hero"><div><small>EST. {data.city || "INDONESIA"}</small><h1>{c.heroTitle || data.businessName}</h1><p>{c.heroSubtitle || data.description}</p><a href="#koleksi">Eksplor koleksi <ArrowRight size={15} /></a></div><figure><img src={bgUrl} alt={data.businessName} style={{ objectPosition: coverStyle?.objectPosition, filter: coverStyle?.filter }} /><figcaption>{c.heroBadge || "Pilihan berkualitas untuk keseharian Anda"}</figcaption></figure></section>
    <section className="minimal-about"><small>01 / PROFIL</small><p>{c.about || data.description}</p></section>
    {products.length > 0 && <section id="koleksi" className="minimal-products"><small>02 / KOLEKSI</small><h2>{c.productHeadline || "Pilihan utama"}</h2><ProductCards data={data} products={products} fixUrl={fixUrl} wa={wa} compact /></section>}
    <TestimonialStrip testimonials={testimonials} /></main><Footer data={data} wa={wa} /></div>
);

const PlayfulLayout = ({ data, c, bgUrl, coverStyle, products, fixUrl, wa, highlights, testimonials }) => (
  <div className="tpl-site tpl-playful-new"><header className="playful-nav"><b>✦ {data.businessName}</b><a href={wa} target="_blank" rel="noreferrer">Pesan sekarang!</a></header><main>
    <section className="playful-hero"><div className="playful-copy"><span>HEY, SELAMAT DATANG! 👋</span><h1>{c.heroTitle || `Hai dari ${data.businessName}!`}</h1><p>{c.heroSubtitle || data.description}</p><a href="#seru"><MessageCircle size={17} /> {c.heroCta || "Yuk lihat!"}</a></div><div className="playful-picture"><img src={bgUrl} alt={data.businessName} style={{ objectPosition: coverStyle?.objectPosition, filter: coverStyle?.filter }} /><i>★</i><b>{data.city || "Pilihan lokal"}</b></div></section>
    {highlights.length > 0 && <section className="playful-highlights">{highlights.slice(0, 3).map((h, i) => <article key={i}><strong>{["😊", "⚡", "💚"][i]}</strong><h3>{h.title}</h3><p>{h.desc}</p></article>)}</section>}
    {products.length > 0 && <section id="seru" className="playful-products"><small>YANG LAGI FAVORIT</small><h2>{c.productHeadline || "Pilih kesukaanmu"}</h2><ProductCards data={data} products={products} fixUrl={fixUrl} wa={wa} /></section>}
    <TestimonialStrip testimonials={testimonials} /></main><Footer data={data} wa={wa} /></div>
);

export function WebsiteTemplateLayout({ template, embedded, device, ...props }) {
  const Layout = template === "warm" ? WarmLayout : template === "bold" ? BoldLayout : template === "minimal" ? MinimalLayout : template === "playful" ? PlayfulLayout : null;
  return Layout ? <div className={`template-preview ${embedded ? "embedded" : ""} preview-${device || "desktop"}`}><Layout {...props} /></div> : null;
}
