const slugify = (value = "") => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const escapeHtml = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tag = (name, value) => `<${name}>${escapeHtml(value)}</${name}>`;

// Template hanya menyusun data website yang sudah ada. Ia sengaja tidak
// membuat fakta, produk, FAQ, atau kontak ketika data sumbernya kosong.
export const ARTICLE_TEMPLATE_VARIANTS = [
  { id: "profile", name: "Profil Bisnis", purpose: "Kenalkan bisnis, keunggulan, produk, dan kontak." },
  { id: "products", name: "Produk Unggulan", purpose: "Soroti pilihan produk atau layanan terbaik." },
  { id: "strengths", name: "Keunggulan Bisnis", purpose: "Fokus pada alasan pelanggan memilih bisnis Anda." },
  { id: "faq", name: "FAQ Bisnis", purpose: "Jawab pertanyaan yang paling sering ditanyakan pelanggan." },
  { id: "local", name: "Artikel Lokal", purpose: "Perkenalkan bisnis dalam konteks lokasi usaha." },
  { id: "contact", name: "Cara Memesan", purpose: "Bantu calon pelanggan menghubungi dan memesan." },
  { id: "story", name: "Cerita Bisnis", purpose: "Ceritakan identitas dan komitmen bisnis Anda." },
  { id: "catalog", name: "Katalog Pilihan", purpose: "Susun pilihan produk dalam format katalog ringkas." },
  { id: "guide", name: "Panduan Pelanggan", purpose: "Buat panduan yang relevan memakai informasi bisnis." },
  { id: "summary", name: "Ringkasan Bisnis", purpose: "Buat ringkasan cepat untuk calon pelanggan baru." },
];

export const getBusinessArticleTemplates = (category = "Usaha") => ARTICLE_TEMPLATE_VARIANTS.map((template, index) => ({ ...template, id: `business-${template.id}`, label: `${category} · Template ${index + 1}: ${template.name}` }));

export function generateBusinessProfileArticle(site = {}, selectedTemplateId = "business-profile") {
  const name = site.businessName || "Usaha Anda";
  const type = site.category || "usaha";
  const place = [site.city, site.province].filter(Boolean).join(", ");
  const where = place ? ` di ${place}` : "";
  const config = site.aiGeneratedContent || {};
  const highlights = Array.isArray(config.highlights) ? config.highlights.filter(Boolean) : [];
  const faq = Array.isArray(config.faq) ? config.faq.filter((item) => item?.q && item?.a) : [];
  const products = Array.isArray(site.products) ? site.products.filter((item) => item?.name) : [];
  const template = getBusinessArticleTemplates(type).find((item) => item.id === selectedTemplateId) || getBusinessArticleTemplates(type)[0];
  const titles = {
    profile: `Mengenal ${name}, ${type}${where}`,
    products: `Produk Unggulan ${name}${where}`,
    strengths: `Keunggulan ${name} sebagai ${type}${where}`,
    faq: `Pertanyaan Umum tentang ${name}${where}`,
    local: `${name}, ${type}${where}`,
    contact: `Cara Memesan dan Menghubungi ${name}`,
    story: `Cerita di Balik ${name}`,
    catalog: `Katalog Pilihan ${name}`,
    guide: `Panduan Memilih Produk dari ${name}`,
    summary: `Informasi Lengkap ${name}${where}`,
  };
  const variant = template.id.replace("business-", "");
  const title = titles[variant] || titles.profile;
  const keyword = `${type}${place ? ` ${site.city}` : ""}`.trim().toLowerCase();
  const description = site.description || config.about || "";
  const intro = description ? `${name} adalah ${type}${where}. ${description}` : `${name} adalah ${type}${where}.`;
  const parts = [tag("p", intro)];

  if (description) parts.push(tag("h2", `Tentang ${name}`), tag("p", description));
  if (highlights.length) {
    parts.push(tag("h2", `Apa yang Membuat ${name} Berbeda?`));
    highlights.forEach((item) => {
      const itemTitle = typeof item === "string" ? item : item.title;
      const itemDescription = typeof item === "object" ? item.desc : "";
      if (itemTitle) parts.push(tag("h3", itemTitle));
      if (itemDescription) parts.push(tag("p", itemDescription));
    });
  }
  if (products.length) {
    parts.push(tag("h2", `Pilihan Produk ${name}`));
    products.forEach((product) => {
      parts.push(tag("h3", product.name));
      if (product.description) parts.push(tag("p", product.description));
    });
  }
  if (place || site.address) {
    parts.push(tag("h2", `Lokasi ${name}`));
    parts.push(tag("p", [site.address, place].filter(Boolean).join(", ")));
  }
  if (faq.length) {
    parts.push(tag("h2", `Pertanyaan yang Sering Ditanyakan tentang ${name}`));
    faq.forEach((item) => parts.push(tag("h3", item.q), tag("p", item.a)));
  }
  if (site.whatsapp || site.phone || site.instagram) {
    parts.push(tag("h2", "Hubungi Kami"));
    const contacts = [];
    if (site.whatsapp) contacts.push(`Hubungi ${name} melalui WhatsApp untuk informasi dan pemesanan.`);
    else if (site.phone) contacts.push(`Hubungi ${name} melalui telepon untuk informasi lebih lanjut.`);
    if (site.instagram) contacts.push(`Ikuti Instagram ${name} untuk pembaruan terbaru.`);
    parts.push(tag("p", contacts.join(" ")));
  }
  const excerpt = `${name} adalah ${type}${where}${description ? `. ${description}` : "."}`.slice(0, 160);
  return {
    title,
    seoTitle: title.slice(0, 65),
    slug: slugify(title),
    focusKeyword: keyword,
    excerpt,
    content: parts.join(""),
    coverImageUrl: site.coverImageUrl || "",
    coverImageAlt: site.coverImageUrl ? `${name}${type ? `, ${type}` : ""}${place ? ` di ${place}` : ""}` : "",
    category: type,
    status: "PUBLISHED",
    templateId: template.id,
  };
}

export const BUSINESS_ARTICLE_TEMPLATE = { id: "business-profile", name: "Profil Bisnis", description: "Ceritakan bisnis Anda, keunggulan, produk, lokasi, FAQ, dan cara menghubungi." };
