import { useEffect, useState } from "react";
import {
  ArrowRight,
  MessageCircle,
  Sparkles,
  Star,
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  Award,
  HeartHandshake,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coffee,
  ShoppingBag,
  Store,
  ExternalLink,
  Flame,
  Gift,
  CheckCircle2,
  Wrench,
  Calendar,
  Truck,
  RefreshCw,
  X,
} from "lucide-react";
import { money } from "../lib/api";

const ICON_MAP = {
  ShieldCheck: ShieldCheck,
  Sparkles: Sparkles,
  Award: Award,
  HeartHandshake: HeartHandshake,
  Coffee: Coffee,
  MessageCircle: MessageCircle,
  Flame: Flame,
  Gift: Gift,
  CheckCircle2: CheckCircle2,
  Wrench: Wrench,
  Calendar: Calendar,
  Truck: Truck,
  RefreshCw: RefreshCw,
  Clock: Clock,
};

const DEFAULT_CATEGORY_COVERS = {
  kopi: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1200&auto=format&fit=crop",
  makanan: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop",
  bakery: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1200&auto=format&fit=crop",
  fashion: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop",
  salon: "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1200&auto=format&fit=crop",
  otomotif: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?q=80&w=1200&auto=format&fit=crop",
  jasa: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200&auto=format&fit=crop",
  kesehatan: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1200&auto=format&fit=crop",
};

const getCategoryCover = (category, name) => {
  const t = `${category || ""} ${name || ""}`.toLowerCase();
  for (const [k, url] of Object.entries(DEFAULT_CATEGORY_COVERS)) {
    if (t.includes(k)) return url;
  }
  return "https://images.unsplash.com/photo-1445116572660-236099ec97a0?q=80&w=1200&auto=format&fit=crop";
};

export default function PublicWebsiteView({ data, embedded = false }) {
  const c = data.aiGeneratedContent || {};
  const primary = data.themeConfig?.primary || c.primaryColor || "#16A34A";
  const accent = data.themeConfig?.accent || c.accentColor || "#14532D";
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
  const fixUrl = (u) => (!u ? "" : u.startsWith("http") ? u : backendUrl + u);

  const [activeFaq, setActiveFaq] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [tSlide, setTSlide] = useState(0);
  const [showProductPopup, setShowProductPopup] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [popupImageIdx, setPopupImageIdx] = useState(0);

  const cleanWa = (data.whatsapp || "").replace(/\D/g, "");
  const wa = cleanWa
    ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(
        `Halo ${data.businessName}, saya ingin informasi dan memesan.`
      )}`
    : "#";

  const bgUrl =
    fixUrl(data.coverImageUrl) || getCategoryCover(data.category, data.businessName);
  const logoUrl = fixUrl(data.logoUrl);
  const products = data.products || [];

  // Extract categories for filter
  const productCategories = [
    "ALL",
    ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
  ];
  const filteredProducts =
    selectedCategory === "ALL"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  // Normalize highlights
  const highlights = (c.highlights || []).map((h, i) => {
    if (typeof h === "string") {
      return {
        title: h,
        desc: "Kualitas dan kepuasan pelanggan adalah komitmen kami.",
        icon: ["ShieldCheck", "Sparkles", "HeartHandshake"][i % 3],
      };
    }
    return h;
  });

  const faqs = c.faq || [
    {
      q: "Bagaimana cara melakukan pemesanan?",
      a: "Pilih produk favorit Anda di atas, lalu klik tombol 'Pesan via WhatsApp'. Pesan otomatis akan langsung terkirim ke admin kami.",
    },
    {
      q: "Metode pembayaran apa saja yang tersedia?",
      a: "Kami menerima transfer bank, QRIS (e-wallet), serta pembayaran tunai saat pick-up di lokasi.",
    },
    {
      q: "Apakah bisa kirim ke luar kota?",
      a: "Ya, kami melayani pengiriman dengan ekspedisi terpercaya dan packing yang aman.",
    },
  ];

  const testimonials = c.testimonials || [
    {
      name: "Rina Wijaya",
      role: "Pelanggan Setia",
      comment: "Kualitas produknya konsisten dan respon pelayanannya sangat cepat. Selalu puas belanja di sini!",
      rating: 5,
    },
    {
      name: "Budi Santoso",
      role: "Pelanggan",
      comment: "Pemesanan via WhatsApp praktis banget, barang sampai tepat waktu dan sesuai deskripsi.",
      rating: 5,
    },
  ];

  // Carousel ulasan: 3 kartu per slide, auto-slide tiap 30 detik + panah navigasi
  const T_PER_PAGE = 3;
  const tPages = [];
  for (let i = 0; i < testimonials.length; i += T_PER_PAGE) {
    tPages.push(testimonials.slice(i, i + T_PER_PAGE));
  }
  const tLast = tPages.length - 1;
  const safeTSlide = Math.min(tSlide, tLast);

  useEffect(() => {
    if (tPages.length <= 1) return undefined;
    const id = setInterval(() => {
      setTSlide((s) => (s >= tLast ? 0 : s + 1));
    }, 30000);
    return () => clearInterval(id);
  }, [tPages.length, tLast]);

  const goTSlide = (dir) => setTSlide((s) => (s + dir + tPages.length) % tPages.length);

  const hours = c.businessHours || "Senin - Minggu: 08:00 - 22:00 WIB";

  // Section visibility (dari Section Manager)
  const vis = data.sectionVisibility || {};
  const contactCards = { address: true, hours: true, social: true, ...(data.contactCards || {}) };
  const showHighlights = vis.highlights !== false && highlights.length > 0;
  const showTestimonials = vis.testimonials !== false && testimonials.length > 0;
  const showFaq = vis.faq !== false && faqs.length > 0;
  const showContact = vis.contact !== false;
  const anyContactCard = contactCards.address || contactCards.hours || contactCards.social;
  const mapsUrl =
    data.mapsUrl ||
    `https://maps.google.com/?q=${encodeURIComponent([data.address, data.city, data.province].filter(Boolean).join(", "))}`;

  return (
    <div
      className={`public-site ${embedded ? "embedded" : ""}`}
      style={{ "--pri": primary, "--acc": accent }}
    >
      {/* 1. TOPBAR / NAVBAR */}
      <header className="public-nav">
        <div className="public-brand">
          {logoUrl ? (
            <img src={logoUrl} alt={data.businessName} />
          ) : (
            <span className="public-brand-initial">
              {(data.businessName || "U")[0].toUpperCase()}
            </span>
          )}
          <div className="public-brand-title">
            <b>{data.businessName}</b>
            <small className="store-status">
              <span className="status-dot-pulse" /> Buka Hari Ini
            </small>
          </div>
        </div>

        <nav className="public-nav-links">
          <a href="#tentang">Tentang</a>
          {showHighlights && <a href="#keunggulan">Keunggulan</a>}
          {products.length > 0 && <a href="#menu">Produk & Menu</a>}
          {showTestimonials && <a href="#testimoni">Ulasan</a>}
          {showFaq && <a href="#faq">FAQ</a>}
          {showContact && anyContactCard && <a href="#lokasi">Kontak</a>}
        </nav>

        <a
          data-testid="public-whatsapp-nav"
          className="public-nav-cta"
          href={wa}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={15} /> <span>Chat WhatsApp</span>
        </a>
      </header>

      {/* 2. HERO BANNER SECTION */}
      <section
        className="public-hero"
        style={{
          backgroundImage: `linear-gradient(135deg, ${accent}f5 0%, ${primary}cc 55%, rgba(15, 23, 42, 0.85) 100%), url(${bgUrl})`,
        }}
      >
        <div className="public-hero-inner">
          <div className="hero-pill-badge">
            <Sparkles size={13} />
            <span>
              {c.heroBadge ||
                `${(data.category || "UMKM").toUpperCase()} TERPERCAYA`}
            </span>
          </div>

          <h2>{c.heroTitle || `Selamat Datang di ${data.businessName}`}</h2>

          <p className="hero-desc">
            {c.heroSubtitle ||
              data.description ||
              "Menghadirkan produk dan layanan terbaik dengan sepenuh hati untuk kepuasan Anda."}
          </p>

          <div className="hero-action-buttons">
            <a
              data-testid="public-whatsapp-hero"
              className="btn-hero-primary"
              href={wa}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={16} />
              <span>{c.heroCta || "Pesan via WhatsApp"}</span>
            </a>

            {products.length > 0 && (
              <a href="#menu" className="btn-hero-secondary">
                <span>Lihat Produk & Menu</span>
                <ArrowRight size={15} />
              </a>
            )}
          </div>

          <div className="hero-trust-bar">
            <div className="trust-item">
              <div className="stars-row">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} fill="#FBBF24" color="#FBBF24" />
                ))}
              </div>
              <span>4.9 / 5.0 Rating Kepuasan</span>
            </div>
            <span className="trust-dot">•</span>
            <div className="trust-item">
              <ShieldCheck size={16} />
              <span>Kualitas Terjamin</span>
            </div>
            <span className="trust-dot">•</span>
            <div className="trust-item">
              <MapPin size={16} />
              <span>{data.city || "Indonesia"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TENTANG KAMI / STORY SECTION */}
      {(c.about || data.description) && (
        <section id="tentang" className="public-about-section">
          <div className="section-container">
            <div className="section-header center">
              <span className="section-badge">TENTANG KAMI</span>
              <h3>Cerita & Komitmen {data.businessName}</h3>
              <div className="section-line" />
            </div>
            <div className="about-content-card">
              <p className="about-text">{c.about || data.description}</p>
              {data.city && (
                <div className="about-meta">
                  <div className="about-meta-item">
                    <Store size={18} />
                    <span>
                      Berdiri melayani pelanggan di{" "}
                      <b>
                        {data.city}
                        {data.province ? `, ${data.province}` : ""}
                      </b>
                    </span>
                  </div>
                  <div className="about-meta-item">
                    <Clock size={18} />
                    <span>{hours}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4. HIGHLIGHTS / KEUNGGULAN SECTION */}
      {showHighlights && (
        <section id="keunggulan" className="public-highlights-section">
          <div className="section-container">
            <div className="section-header center">
              <span className="section-badge">MENGAPA MEMILIH KAMI</span>
              <h3>Keunggulan & Jaminan Kualitas</h3>
              <div className="section-line" />
            </div>

            <div className="highlights-grid">
              {highlights.map((h, i) => {
                const IconComponent = ICON_MAP[h.icon] || ShieldCheck;
                return (
                  <div key={i} className="highlight-box">
                    <div className="highlight-icon-wrapper">
                      <IconComponent size={24} />
                    </div>
                    <h4>{h.title}</h4>
                    <p>{h.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 5. KATALOG PRODUK / MENU SECTION */}
      {products.length > 0 && (
        <section id="menu" className="public-products-section">
          <div className="section-container">
            <div className="section-header center">
              <span className="section-badge">
                {(c.productHeadline || "KATALOG PRODUK").toUpperCase()}
              </span>
              <h3>{c.productHeadline || "Pilihan Produk & Menu Favorit"}</h3>
              <p className="section-subtitle">
                {c.productSubheadline ||
                  "Daftar pilihan terbaik yang siap dipesan langsung melalui WhatsApp."}
              </p>
              <div className="section-line" />
            </div>

            {/* Category tabs */}
            {productCategories.length > 2 && (
              <div className="product-category-tabs">
                {productCategories.map((cat) => (
                  <button
                    key={cat}
                    className={`cat-pill ${
                      selectedCategory === cat ? "active" : ""
                    }`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === "ALL" ? "Semua Menu" : cat}
                  </button>
                ))}
              </div>
            )}

            {/* Products Grid — flex center: 1 item tengah, 2 item dempet tengah, baris terakhir rata tengah */}
            <div className="products-grid flex-center">
              {filteredProducts.map((p, i) => {
                const img = fixUrl(p.images?.[0]);
                const orderText = `Halo ${data.businessName}, saya ingin memesan *${p.name}* (Rp${money(
                  p.price
                )}). Apakah masih tersedia?`;
                const itemWa = cleanWa
                  ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(
                      orderText
                    )}`
                  : wa;

                return (
                  <article
                    data-testid={`public-product-${i}`}
                    key={p.id || i}
                    className="product-card"
                    onClick={() => {
                      setCurrentProduct({
                        id: p.id,
                        name: p.name,
                        price: p.price,
                        description: p.description || `Deskripsi: ${data.businessName || "Usaha"} menjual produk berkualitas untuk kebutuhan Anda.`,
                        images: (p.images || []).map(fixUrl),
                        businessName: data.businessName
                      });
                      setPopupImageIdx(0);
                      setShowProductPopup(true);
                    }}
                  >
                    <div className="product-image-container">
                      {img ? (
                        <>
                          <div
                            className="product-card-img"
                            style={{ backgroundImage: `url(${img})` }}
                          />
                          {(p.images?.length || 0) > 1 && (
                            <div className="product-card-img-thumbnails">
                              {p.images.map((thumbUrl, idx) => (
                                <span
                                  key={idx}
                                  className={`product-card-img-thumbnail${
                                    idx === 0 ? " active" : ""
                                  }`}
                                  style={{
                                    backgroundImage: `url(${fixUrl(thumbUrl)})`,
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="product-card-img-placeholder">
                          <ShoppingBag size={32} />
                          <span>{p.name}</span>
                        </div>
                      )}
                      {p.price > 0 && (
                        <span className="price-tag-badge">
                          Rp{money(p.price)}
                        </span>
                      )}
                    </div>

                    <div className="product-card-body">
                      <h4>{p.name}</h4>
<p>
                  {p.description || 
                    `Deskripsi: ${data.businessName || "Usaha"} menjual produk berkualitas untuk kebutuhan Anda.`}
                </p>

                      <div className="product-card-footer">
                        <div className="product-price-box">
                          <small>Harga</small>
                          <b>Rp{money(p.price)}</b>
                        </div>

                        <a
                          data-testid={`public-product-whatsapp-${i}`}
                          href={itemWa}
                          target="_blank"
                          rel="noreferrer"
                          className="product-order-btn"
                          title="Pesan via WhatsApp"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle size={15} />
                          <span>Pesan</span>
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 6. TESTIMONI / SOCIAL PROOF SECTION */}
      {showTestimonials && (
        <section id="testimoni" className="public-testimonials-section">
          <div className="section-container">
            <div className="section-header center">
              <span className="section-badge">ULASAN PELANGGAN</span>
              <h3>Apa Kata Mereka Tentang Kami</h3>
              <div className="section-line" />
            </div>

            <div className="testimonial-carousel">
              {tPages.length > 1 && (
                <button
                  type="button"
                  className="testimonial-arrow prev"
                  onClick={() => goTSlide(-1)}
                  aria-label="Ulasan sebelumnya"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              <div className="testimonials-grid flex-center">
                {(tPages[safeTSlide] || tPages[0]).map((t, i) => (
                  <div key={i} className="testimonial-card">
                    <div className="testimonial-stars">
                      {[...Array(t.rating || 5)].map((_, j) => (
                        <Star key={j} size={15} fill="#FBBF24" color="#FBBF24" />
                      ))}
                    </div>
                    <p className="testimonial-comment">"{t.comment}"</p>
                    <div className="testimonial-author">
                      <div className="author-avatar">
                        {(t.name || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <b>{t.name}</b>
                        <small>{t.role || "Pelanggan"}</small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {tPages.length > 1 && (
                <button
                  type="button"
                  className="testimonial-arrow next"
                  onClick={() => goTSlide(1)}
                  aria-label="Ulasan berikutnya"
                >
                  <ChevronRight size={20} />
                </button>
              )}

              {tPages.length > 1 && (
                <div className="testimonial-dots">
                  {tPages.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`testimonial-dot ${i === safeTSlide ? "active" : ""}`}
                      onClick={() => setTSlide(i)}
                      aria-label={`Slide ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 7. FAQ ACCORDION SECTION */}
      {showFaq && (
        <section id="faq" className="public-faq-section">
          <div className="section-container">
            <div className="section-header center">
              <span className="section-badge">PERTANYAAN UMUM</span>
              <h3>Sering Ditanyakan (FAQ)</h3>
              <div className="section-line" />
            </div>

            <div className="faq-list">
              {faqs.map((f, i) => {
                const isOpen = activeFaq === i;
                return (
                  <div
                    key={i}
                    className={`faq-item ${isOpen ? "open" : ""}`}
                    onClick={() => setActiveFaq(isOpen ? null : i)}
                  >
                    <div className="faq-question">
                      <b>{f.q}</b>
                      <ChevronDown
                        size={18}
                        className={`faq-arrow ${isOpen ? "rotate" : ""}`}
                      />
                    </div>
                    {isOpen && <div className="faq-answer"><p>{f.a}</p></div>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 8. LOKASI, JAM OPERASIONAL & KONTAK */}
      {showContact && anyContactCard && (
        <section id="lokasi" className="public-location-section">
          <div className="section-container">
            <div className="section-header center">
              <span className="section-badge">KUNJUNGI & HUBUNGI</span>
              <h3>Lokasi & Informasi Kontak</h3>
              <div className="section-line" />
            </div>

            <div className="location-cards-grid">
              {/* Card 1: Alamat & Rute */}
              {contactCards.address && (
                <div className="info-box">
                  <div className="info-icon">
                    <MapPin size={22} />
                  </div>
                  <h4>Alamat & Lokasi</h4>
                  <p>{data.address || "Hubungi kami untuk petunjuk arah lengkap."}</p>
                  <b>
                    {[data.city, data.province].filter(Boolean).join(", ") ||
                      "Indonesia"}
                  </b>
                  {data.address && (
                    <a
                      target="_blank"
                      rel="noreferrer"
                      className="maps-link-btn"
                      href={mapsUrl}
                    >
                      <ExternalLink size={14} /> Petunjuk Arah di Google Maps
                    </a>
                  )}
                </div>
              )}

              {/* Card 2: Jam Buka */}
              {contactCards.hours && (
                <div className="info-box">
                  <div className="info-icon">
                    <Clock size={22} />
                  </div>
                  <h4>Jam Operasional</h4>
                  <p>Kami siap melayani pesanan Anda pada jadwal operasional:</p>
                  <div className="hours-badge">{hours}</div>
                  <span className="hours-note">
                    Pemesanan online via WhatsApp tetap dibuka 24 jam.
                  </span>
                </div>
              )}

              {/* Card 3: Kontak & Medsos */}
              {contactCards.social && (
                <div className="info-box">
                  <div className="info-icon">
                    <Phone size={22} />
                  </div>
                  <h4>Hubungi Kami</h4>
              <ul className="contact-list">
                {data.whatsapp && (
                  <li>
                    <MessageCircle size={15} /> WhatsApp: <b>{data.whatsapp}</b>
                  </li>
                )}
                {data.phone && (
                  <li>
                    <Phone size={15} /> Telepon: <span>{data.phone}</span>
                  </li>
                )}
                {data.email && (
                  <li>
                    <Mail size={15} /> Email: <span>{data.email}</span>
                  </li>
                )}
                {data.instagram && (
                  <li>
                    <span>📸 Instagram: <b>{data.instagram}</b></span>
                  </li>
                )}
                {data.facebook && (
                  <li>
                    <span>📘 Facebook: <b>{data.facebook}</b></span>
                  </li>
                )}
                {data.tiktok && (
                  <li>
                    <span>🎵 TikTok: <b>{data.tiktok}</b></span>
                  </li>
                )}
              </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 9. FOOTER */}
      <footer className="public-footer-pro">
        <div className="footer-inner">
          <div className="footer-brand">
            <b>{data.businessName}</b>
            <p>
              {data.category || "Usaha"} terpercaya di {data.city || "Indonesia"}.
            </p>
          </div>
          <div className="footer-credit">
            <span>Dibuat dengan <a href="/" target="_blank" rel="noreferrer">UsahaKu</a> • Platform Website AI UMKM Indonesia</span>
          </div>
        </div>
      </footer>
      {/* 10. PRODUCT DETAIL POPUP */}
      {showProductPopup && currentProduct && (
      <div className="product-popup-overlay" onClick={() => setShowProductPopup(false)}>
        <div
          className="product-popup-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="product-popup-header">
            <h3>{currentProduct.name}</h3>
            <button onClick={() => setShowProductPopup(false)} className="product-popup-close">
              <X size={20} />
            </button>
          </div>
          <div className="product-popup-image">
            {currentProduct.images && currentProduct.images.length > 0 ? (
              <img
                src={currentProduct.images[popupImageIdx] || currentProduct.images[0]}
                alt={currentProduct.name}
              />
            ) : (
              <div className="product-popup-image-placeholder">
                <ShoppingBag size={48} />
                <span>Tidak ada foto</span>
              </div>
            )}
          </div>

          {currentProduct.images && currentProduct.images.length > 1 && (
            <div className="product-popup-thumbs">
              {currentProduct.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`product-popup-thumb${idx === popupImageIdx ? " active" : ""}`}
                  onClick={() => setPopupImageIdx(idx)}
                  aria-label={`Lihat foto ${idx + 1}`}
                >
                  <img src={img} alt={`${currentProduct.name} ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}

          <div className="product-popup-body">
            <div className="product-popup-price">
              Rp{money(currentProduct.price)}
            </div>
            <div className="product-popup-desc">
              <p dangerouslySetInnerHTML={{ __html: currentProduct.description }} />
            </div>
          </div>
          <div className="product-popup-footer">
            <a
              data-testid="public-product-popup-order-wa"
              className="product-popup-btn"
              target="_blank"
              rel="noreferrer"
              href={
                cleanWa
                  ? `https://wa.me/${cleanWa}?text=${encodeURIComponent(
                      `Halo ${data.businessName}, saya ingin memesan *${currentProduct.name}* (Rp${money(currentProduct.price)}). Apakah masih tersedia?`
                    )}`
                  : wa
              }
            >
              <MessageCircle size={16} />
              <span>Pesan Sekarang</span>
            </a>
          </div>
        </div>
      </div>
    )}

    {/* 10. FLOATING QUICK WHATSAPP BUTTON (MOBILE & DESKTOP) */}
    {cleanWa && (
      <a
        data-testid="floating-whatsapp-btn"
        href={wa}
        target="_blank"
        rel="noreferrer"
        className="floating-wa-btn"
        title="Chat WhatsApp Sekarang"
      >
        <MessageCircle size={24} />
        <span className="floating-wa-label">Chat Sekarang</span>
      </a>
    )}
    </div>
  );
}
