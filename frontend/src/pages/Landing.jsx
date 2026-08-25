import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronRight, Menu, X, Sparkles } from "lucide-react";
import { Brand } from "../lib/shared";

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

const Example = ({ title, category, color, testid }) => (
  <div data-testid={testid} className="example-card" style={{ background: color }}>
    <div className="example-header">
      <b>{title}</b>
      <span>usahaku.id/{title.toLowerCase().replaceAll(" ", "-")}</span>
    </div>
    <div className="example-body">
      <small>{category.toUpperCase()}</small>
      <h4>Cerita usahamu, tampak profesional.</h4>
    </div>
  </div>
);

export default function Landing() {
  return (
    <div className="landing">
      <PublicNav />
      <main>
        <section className="hero container">
          <div className="hero-copy reveal">
            <div className="eyebrow"><span className="eyebrow-dot" /> Dibuat untuk UMKM Indonesia</div>
            <h1>Website profesional<br /><em>untuk usahamu.</em></h1>
            <p className="hero-text">Masukkan informasi usaha, tambahkan produk, lalu biarkan AI membantu membuat website yang siap memperkenalkan bisnismu—tanpa coding, tanpa ribet.</p>
            <div className="hero-actions">
              <Link data-testid="hero-register-button" className="btn btn-primary" to="/register">Buat Website Gratis <ArrowRight size={17} /></Link>
              <a data-testid="hero-how-link" className="text-link" href="#cara-kerja">Lihat cara kerja <ChevronRight size={16} /></a>
            </div>
            <div className="trust-row">
              <div className="avatar-stack"><span>R</span><span>D</span><span>A</span></div>
              <span>Dipercaya pemilik usaha lokal · Trial 30 hari</span>
            </div>
          </div>
          <div className="hero-visual reveal delay-1">
            <div className="browser">
              <div className="browser-bar"><span /><span /><span /><small>preview.usahaku.id/kopi-senja</small></div>
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
            <p>UsahaKu membantu kamu hadir di dunia digital dalam beberapa langkah sederhana.</p>
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
              <Feature icon="✦" title="Website dengan AI" text="Dari data usaha menjadi tampilan website yang meyakinkan." />
              <Feature icon="▦" title="Katalog produk" text="Tampilkan produk, harga, dan foto dengan rapi." />
              <Feature icon="↗" title="Terhubung WhatsApp" text="Pelanggan bisa langsung memesan lewat WhatsApp." />
              <Feature icon="⌖" title="Siap untuk mobile" text="Tampil sempurna di layar HP pelanggan." />
              <Feature icon="◉" title="Google Maps" text="Tunjukkan lokasi usahamu dengan jelas." />
              <Feature icon="✎" title="AI copywriting" text="Konten dibuat rapi otomatis oleh AI." />
              <Feature icon="◈" title="Multi website" text="Kelola beberapa bisnis dari satu akun." />
              <Feature icon="✧" title="AI edit" text="Ubah desain hanya dengan mengetik perintah." />
            </div>
          </div>
        </section>

        <section id="contoh" className="section container example-section">
          <div className="section-heading">
            <div><div className="eyebrow">CONTOH WEBSITE</div><h2>Dibuat untuk<br /><span>berbagai jenis usaha.</span></h2></div>
            <p>AI menyesuaikan gaya visual sesuai karakter bisnismu.</p>
          </div>
          <div className="example-grid">
            <Example testid="example-coffee" title="Kopi Senja" category="Coffee Shop" color="linear-gradient(135deg,#14532d,#166534)" />
            <Example testid="example-bakery" title="Rumah Roti" category="Bakery" color="linear-gradient(135deg,#c2410c,#f97316)" />
            <Example testid="example-fashion" title="Nusa Craft" category="Fashion" color="linear-gradient(135deg,#312e81,#4338ca)" />
            <Example testid="example-barber" title="Barber Co" category="Barbershop" color="linear-gradient(135deg,#1f2937,#374151)" />
            <Example testid="example-beauty" title="Sari Beauty" category="Beauty" color="linear-gradient(135deg,#831843,#be185d)" />
            <Example testid="example-restaurant" title="Warung Sundari" category="Restaurant" color="linear-gradient(135deg,#78350f,#b45309)" />
          </div>
        </section>

        <section id="harga" className="pricing container">
          <div className="section-heading">
            <div><div className="eyebrow">PILIH SESUAI KEBUTUHAN</div><h2>Mulai gratis,<br /><span>tumbuh bersama.</span></h2></div>
            <p>Uji coba dulu 30 hari. Saat siap, pilih paket yang mendukung langkah berikutnya.</p>
          </div>
          <div className="pricing-grid">
            <Price testid="price-trial-button" name="Trial Gratis" price="Rp0" desc="30 hari pertama" items={["1 website", "AI generation & editing", "Katalog produk", "WhatsApp & Google Maps"]} />
            <Price testid="price-premium-1-button" featured name="Premium 1" price="Rp50.000" desc="per bulan" items={["1 website", "Semua fitur AI", "Katalog tanpa batas", "Dukungan prioritas"]} />
            <Price testid="price-premium-3-button" name="Premium 3" price="Rp100.000" desc="per bulan" items={["Hingga 3 website", "Semua fitur AI", "Tambah website +Rp25.000", "Dukungan prioritas"]} />
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
          <span>© 2026 UsahaKu. Untuk usaha yang terus bertumbuh.</span>
        </div>
      </footer>
    </div>
  );
}
