import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronRight, Menu, X, Sparkles } from "lucide-react";
import { Brand } from "../lib/shared";
import { APP_NAME, PUBLIC_SITE_HOST, SEO_ORIGIN } from "../lib/config";
import { SeoHead, originUrl } from "../lib/seo";
import "./Landing.css";

function PublicNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <div className="container nav-inner">
        <Brand />
        <nav className={open ? "nav-open" : ""}>
          <a data-testid="nav-features" href="#fitur">Fitur</a>
          <a data-testid="nav-how" href="#cara-kerja">Cara kerja</a>
          <a data-testid="nav-pricing" href="#harga">Harga</a>
          <a data-testid="nav-examples" href="#contoh">Contoh</a>
          <Link data-testid="nav-website-usaha" to="/website-usaha">Website usaha</Link>
          <Link data-testid="nav-website-umkm" to="/website-umkm">Website UMKM</Link>
          <Link data-testid="nav-articles" to="/artikel">Artikel</Link>
          <Link data-testid="nav-login" to="/login">Masuk</Link>
          <Link data-testid="nav-register" className="nav-cta" to="/register">Buat Website Gratis <ArrowRight size={15} /></Link>
        </nav>
        <button data-testid="mobile-menu-button" className="mobile-menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
    </header>
  );
}

const Step = ({ n, title, text }) => <div className="step"><b>{n}</b><div><h3>{title}</h3><p>{text}</p></div></div>;
const Feature = ({ icon, title, text }) => <div className="feature"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>;
const Price = ({ name, price, desc, items, featured, testid }) => (
  <div className={`price-card ${featured ? "featured" : ""}`}>
    {featured && <span className="popular">PALING DIPILIH</span>}
    <h3>{name}</h3>
    <div className="price">{price}<small>/bulan</small></div>
    <p>{desc}</p>
    <ul>{items.map(i => <li key={i}><Check size={16} />{i}</li>)}</ul>
    <Link data-testid={testid} className={`btn ${featured ? "btn-primary" : "btn-outline"}`} to="/register">Pilih paket <ArrowRight size={15} /></Link>
  </div>
);

const Example = ({ title, category, description, color, slug, testid }) => (
  <Link data-testid={testid} className="example-card" to={`/site/${slug}`} style={{ background: color }}>
    <div className="example-header">
      <b>{title}</b>
      <span>{PUBLIC_SITE_HOST}/site/{slug}</span>
    </div>
    <div className="example-body">
      <small>{category.toUpperCase()}</small>
      <h4>{description}</h4>
    </div>
  </Link>
);

export default function Landing() {
  return (
    <div className="landing">
      <SeoHead
        title="Website Usaha Profesional dengan AI | Situska"
        description="Buat website usaha profesional dengan AI tanpa coding. Masukkan informasi usaha, tambahkan produk, dan buat website siap digunakan dalam beberapa klik."
        image="/assets/showcase/kopi-senja-cover.png"
        canonical="/"
        schema={[{ "@context": "https://schema.org", "@type": "SoftwareApplication", name: APP_NAME, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: "Platform untuk membuat website usaha profesional dengan AI tanpa coding.", offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" } }, { "@context": "https://schema.org", "@type": "Organization", name: APP_NAME, url: SEO_ORIGIN }, { "@context": "https://schema.org", "@type": "WebSite", name: APP_NAME, url: SEO_ORIGIN }]}
      />
      <PublicNav />
      <main>
        <section className="hero container">
          <div className="hero-copy reveal">
            <div className="eyebrow"><span className="eyebrow-dot" /> Dibuat untuk UMKM Indonesia</div>
            <h1>Website usaha<br /><em>siap dalam beberapa klik.</em></h1>
            <p className="hero-text">Masukkan informasi usaha, tambahkan produk, lalu Situska membantu membuat website yang siap memperkenalkan bisnismu—tanpa coding, tanpa ribet.</p>
            <div className="hero-actions">
              <Link data-testid="hero-register-button" className="btn btn-primary" to="/register">Buat Website Gratis <ArrowRight size={17} /></Link>
              <a data-testid="hero-how-link" className="text-link" href="#cara-kerja">Lihat cara kerja <ChevronRight size={16} /></a>
            </div>
            <div className="trust-row">
              <div className="avatar-stack"><span>R</span><span>D</span><span>A</span></div>
              <span>Dipercaya pemilik usaha lokal</span>
            </div>
          </div>
          <div className="hero-visual reveal delay-1">
            <div className="browser">
              <div className="browser-bar"><span /><span /><span /><small>{PUBLIC_SITE_HOST}/site/demo-kopi-senja</small></div>
              <div className="site-preview">
                <div className="site-nav"><b>kopi<span>senja</span></b><span>Menu &nbsp; Tentang &nbsp; Lokasi</span><strong>Pesan sekarang</strong></div>
                <div className="site-hero">
                  <div>
                    <small>EST. 2019 · JAKARTA</small>
                    <h3>Temukan jeda<br />di setiap teguk.</h3>
                    <p>Kopi pilihan, suasana hangat, cerita yang dekat.</p>
                    <button>Jelajahi menu <ArrowRight size={12} /></button>
                  </div>
                </div>
                <div className="site-products">
                  <small>FAVORIT HARI INI</small>
                  <div>
                    <article><div className="coffee-img img-one" /><b>Es Kopi Gula Aren</b><span>Rp28.000</span></article>
                    <article><div className="coffee-img img-two" /><b>Matcha Latte</b><span>Rp32.000</span></article>
                    <article><div className="coffee-img img-three" /><b>Americano</b><span>Rp24.000</span></article>
                  </div>
                </div>
              </div>
            </div>
            <div className="floating-note"><Sparkles size={15} /> Website dibuat dengan AI</div>
          </div>
        </section>

        <section className="logo-strip">
          <div className="container logo-strip-inner">
            <span>Mulai dari ide sederhana</span>
            <div><b>kopi senja</b><b>RUMAH ROTI</b><b>barber<span>co</span></b><b>nusa craft</b></div>
          </div>
        </section>

        <section id="problem" className="section container problem-section">
          <div className="section-heading">
            <div><div className="eyebrow">MASALAH UMKM</div><h2>Punya usaha bagus,<br /><span>tapi belum punya website?</span></h2></div>
            <p>Kami paham. Membuat website bisa terasa rumit, mahal, dan menyita waktu yang seharusnya bisa dipakai untuk melayani pelanggan.</p>
          </div>
          <div className="problem-grid">
            <div><b>Tidak tahu mulai dari mana</b><p>Bingung memilih tools, template, dan cara mengaturnya.</p></div>
            <div><b>Tidak punya waktu</b><p>Sudah sibuk menjalankan bisnis setiap hari.</p></div>
            <div><b>Tidak bisa coding</b><p>Kelihatan teknis dan susah dipelajari sendiri.</p></div>
            <div><b>Terbatas di media sosial</b><p>Produk hanya bisa dilihat lewat postingan atau story.</p></div>
          </div>
        </section>

        <section id="cara-kerja" className="section container">
          <div className="section-heading">
            <div><div className="eyebrow">CARA YANG LEBIH MUDAH</div><h2>Dari usaha lokal,<br /><span>terlihat profesional.</span></h2></div>
            <p>{APP_NAME} membantu kamu membuat website usaha profesional dalam beberapa langkah sederhana.</p>
          </div>
          <div className="steps">
            <Step n="01" title="Isi informasi usaha" text="Ceritakan nama, kategori, lokasi, dan kontak bisnismu." />
            <Step n="02" title="Tambahkan produk" text="Upload produk beserta harga dan deskripsi singkat." />
            <Step n="03" title="AI membuat website" text="Dapatkan tampilan yang sesuai dengan karakter usahamu." />
            <Step n="04" title="Edit & publish" text="Sesuaikan seperlunya, lalu bagikan ke pelanggan." />
          </div>
        </section>

        <section id="fitur" className="feature-band">
          <div className="container">
            <div className="eyebrow">SEMUA YANG KAMU BUTUHKAN</div>
            <h2>Satu tempat untuk<br /><span>mengembangkan usahamu.</span></h2>
            <div className="feature-grid">
              <Feature icon="✦" title="Website dengan AI" text="Dari informasi usaha menjadi website profesional dengan bantuan AI." />
              <Feature icon="▦" title="Katalog produk" text="Tampilkan produk, harga, dan foto dengan rapi." />
              <Feature icon="↗" title="Terhubung WhatsApp" text="Pelanggan dapat langsung menghubungi bisnis melalui WhatsApp." />
              <Feature icon="⌖" title="Siap untuk mobile" text="Website usaha tampil optimal di perangkat mobile." />
              <Feature icon="◉" title="Google Maps" text="Tampilkan lokasi usaha agar pelanggan mudah menemukan bisnis." />
              <Feature icon="✎" title="AI copywriting" text="Buat konten website bisnis dengan bantuan AI." />
              <Feature icon="◈" title="Multi website" text="Kelola beberapa website usaha dari satu akun." />
              <Feature icon="✧" title="AI edit" text="Edit tampilan website menggunakan instruksi sederhana." />
            </div>
          </div>
        </section>

        <section id="contoh" className="section container example-section">
          <div className="section-heading">
            <div><div className="eyebrow">CONTOH WEBSITE</div><h2>Dibuat untuk<br /><span>berbagai jenis usaha.</span></h2></div>
            <p>AI menyesuaikan gaya visual sesuai karakter bisnismu.</p>
          </div>
          <div className="example-grid">
            <Example testid="example-coffee" title="Kopi Senja" category="Coffee Shop" description="Contoh website usaha coffee shop dengan menu dan lokasi." slug="demo-kopi-senja" color="linear-gradient(135deg,#03045E,#0077B6)" />
            <Example testid="example-bakery" title="Rumah Roti" category="Bakery" description="Contoh website bakery dengan katalog roti dan informasi usaha." slug="demo-rumah-roti" color="linear-gradient(135deg,#03045E,#00B4D8)" />
            <Example testid="example-fashion" title="Nusa Craft" category="Fashion" description="Contoh website fashion untuk menampilkan koleksi pilihan." slug="demo-nusa-craft" color="linear-gradient(135deg,#0077B6,#00B4D8)" />
            <Example testid="example-barber" title="Barber Co" category="Barbershop" description="Contoh website barbershop dengan layanan dan kontak cepat." slug="demo-barber-co" color="linear-gradient(135deg,#03045E,#0077B6)" />
            <Example testid="example-beauty" title="Sari Beauty" category="Beauty" description="Contoh website beauty untuk layanan perawatan dan reservasi." slug="demo-sari-beauty" color="linear-gradient(135deg,#0077B6,#00B4D8)" />
            <Example testid="example-restaurant" title="Warung Sundari" category="Restaurant" description="Contoh website restoran dengan menu, lokasi, dan informasi bisnis." slug="demo-warung-sundari" color="linear-gradient(135deg,#03045E,#00B4D8)" />
          </div>
        </section>

        <section id="harga" className="pricing container">
          <div className="section-heading">
            <div><div className="eyebrow">PILIH SESUAI KEBUTUHAN</div><h2>Mulai gratis,<br /><span>tumbuh bersama.</span></h2></div>
            <p>Mulai dengan fitur dasar, lalu pilih paket yang mendukung langkah berikutnya.</p>
          </div>
          <div className="pricing-grid">
            <Price testid="price-trial-button" name="Gratis" price="Rp0" desc="untuk memulai" items={["1 website", "AI generation & editing", "Katalog produk", "WhatsApp & Google Maps"]} />
            <Price testid="price-basic-button" name="Basic" price="Rp50.000" desc="per bulan" items={["1 website", "Semua fitur AI", "Katalog tanpa batas", "Dukungan prioritas"]} />
            <Price testid="price-premium-button" featured name="Premium" price="Rp100.000" desc="per bulan" items={["3 website", "Semua fitur AI", "Katalog tanpa batas", "Dukungan prioritas"]} />
            <Price testid="price-platinum-button" name="Platinum" price="Rp100.000" desc="per bulan · fleksibel" items={["3 website + bisa ditambah", "+Rp25.000 per website tambahan", "Semua fitur AI", "Dukungan prioritas"]} />
          </div>
        </section>

        <section className="final-cta">
          <div className="container final-inner">
            <div>
              <div className="eyebrow">BISNISMU LAYAK TERLIHAT</div>
              <h2>Siap membuat usahamu<br />lebih mudah ditemukan?</h2>
            </div>
            <Link data-testid="final-register-button" className="btn btn-light" to="/register">Mulai sekarang <ArrowRight size={17} /></Link>
          </div>
        </section>
      </main>
      <footer>
        <div className="container">
          <Brand />
          <span>© 2026 {APP_NAME}. Untuk usaha yang terus bertumbuh.</span>
        </div>
      </footer>
    </div>
  );
}
