const CATEGORY_SLUGS = {
  "Coffee Shop": "coffee-shop",
  Restaurant: "restaurant",
  Bakery: "bakery",
  Fashion: "fashion",
  Beauty: "beauty",
  Barbershop: "barbershop",
  Retail: "retail",
  Jasa: "jasa",
  Pendidikan: "pendidikan",
  Lainnya: "lainnya",
};

const PALETTES = [
  ["#14532d", "#22c55e"], ["#78350f", "#f59e0b"], ["#172554", "#3b82f6"],
  ["#4c1d95", "#a855f7"], ["#831843", "#ec4899"], ["#134e4a", "#14b8a6"],
  ["#1f2937", "#64748b"], ["#7c2d12", "#fb923c"], ["#312e81", "#818cf8"],
  ["#064e3b", "#fbbf24"],
];

const LOGO_STYLE_LABELS = [
  "Monogram bulat", "Kotak tebal", "Inisial serif", "Bingkai berlian",
  "Wordmark minimal", "Lencana klasik", "Kotak garis", "Huruf latin",
  "Pita modern", "Emblem elegan",
];

const VARIANTS = [
  ["natural", "Natural hangat", "center", "cover", "none"],
  ["bright", "Terang & bersih", "center", "cover", "brightness(1.08) saturate(.95)"],
  ["rich", "Warna kaya", "center", "cover", "saturate(1.15) contrast(1.04)"],
  ["soft", "Lembut & tenang", "center", "cover", "brightness(1.04) saturate(.82)"],
  ["close", "Fokus dekat", "center", "cover", "contrast(1.04)"],
  ["wide", "Sudut lebar", "center", "cover", "brightness(.98)"],
  ["classic", "Klasik elegan", "center", "cover", "sepia(.12) contrast(1.05)"],
  ["fresh", "Segar modern", "center", "cover", "saturate(1.08) brightness(1.03)"],
  ["moody", "Gelap premium", "center", "cover", "brightness(.85) contrast(1.1)"],
  ["editorial", "Editorial minimal", "center", "cover", "saturate(.72) contrast(1.08)"],
];

const normalizeCategory = (category = "") => {
  const value = category.toLowerCase();
  if (/coffee|kopi|cafe|kedai/.test(value)) return "Coffee Shop";
  if (/restaurant|restoran|kuliner|makanan|warung/.test(value)) return "Restaurant";
  if (/bakery|roti|kue/.test(value)) return "Bakery";
  if (/fashion|butik|pakaian/.test(value)) return "Fashion";
  if (/beauty|salon|kecantikan/.test(value)) return "Beauty";
  if (/barber/.test(value)) return "Barbershop";
  if (/retail|toko/.test(value)) return "Retail";
  if (/pendidikan|sekolah|kursus|bimbel/.test(value)) return "Pendidikan";
  if (/jasa|service|layanan/.test(value)) return "Jasa";
  return CATEGORY_SLUGS[category] ? category : "Lainnya";
};

const initials = (name = "") => {
  const chars = name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2);
  return (chars || "U").toUpperCase().replace(/[^A-Z0-9]/g, "U");
};

const logoSvg = (businessName, index, selectedColor = "") => {
  const [defaultDark, defaultLight] = PALETTES[index];
  const dark = selectedColor || defaultDark;
  const light = selectedColor || defaultLight;
  const nameMark = initials(businessName);
  const isPair = nameMark.length > 1;
  const monoSize = isPair ? 34 : 42;
  const boldSize = isPair ? 32 : 40;
  const serifSize = isPair ? 48 : 58;
  const underlineWidth = isPair ? 72 : 50;
  const underlineStart = 48 - underlineWidth / 2;
  const common = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"`;
  const styles = [
    `<circle cx="48" cy="48" r="42" fill="${dark}"/><text x="48" y="61" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${monoSize}" font-weight="800">${nameMark}</text>`,
    `<rect x="9" y="9" width="78" height="78" rx="13" fill="${dark}"/><text x="48" y="62" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${boldSize}" font-weight="900">${nameMark}</text>`,
    `<text x="48" y="61" text-anchor="middle" fill="${dark}" font-family="Georgia,serif" font-size="${serifSize}" font-weight="700">${nameMark}</text><path d="M${underlineStart} 73h${underlineWidth}" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>`,
    `<path d="M48 5 91 48 48 91 5 48Z" fill="${dark}"/><text x="48" y="60" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${isPair ? 29 : 35}" font-weight="800">${nameMark}</text>`,
    `<rect x="8" y="28" width="80" height="40" rx="20" fill="${dark}"/><text x="48" y="56" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="27" font-weight="800" letter-spacing="2">${nameMark}</text>`,
    `<circle cx="48" cy="48" r="41" fill="none" stroke="${dark}" stroke-width="6"/><circle cx="48" cy="48" r="31" fill="${dark}"/><text x="48" y="${isPair ? 58 : 60}" text-anchor="middle" fill="white" font-family="Georgia,serif" font-size="${isPair ? 29 : 34}" font-weight="700">${nameMark}</text>`,
    `<rect x="12" y="12" width="72" height="72" rx="6" fill="none" stroke="${dark}" stroke-width="5"/><text x="48" y="61" text-anchor="middle" fill="${dark}" font-family="Arial,sans-serif" font-size="${boldSize}" font-weight="900">${nameMark}</text>`,
    `<text x="48" y="62" text-anchor="middle" fill="${dark}" font-family="Brush Script MT,Segoe Script,cursive" font-size="${isPair ? 45 : 57}" font-style="italic" font-weight="700" letter-spacing="${isPair ? -2 : 0}">${nameMark}</text>`,
    `<path d="M8 27h80v42H8l10-21z" fill="${dark}"/><path d="M88 27 78 48l10 21" fill="${light}" opacity=".36"/><text x="48" y="60" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${isPair ? 28 : 34}" font-weight="900" letter-spacing="${isPair ? 0 : 1}">${nameMark}</text>`,
    `<path d="M48 7 83 20v27c0 23-15 36-35 43C28 83 13 70 13 47V20z" fill="${dark}"/><text x="48" y="60" text-anchor="middle" fill="white" font-family="Georgia,serif" font-size="37" font-weight="700">${nameMark}</text>`,
  ];
  const svg = `<svg ${common}>${styles[index]}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const getLogoTemplates = (_category, businessName, selectedColor = "") => {
  // Category stays in the signature so all template pickers share one API;
  // the monogram uses the business name and works consistently for any category.
  return VARIANTS.map(([id], index) => ({ id, label: LOGO_STYLE_LABELS[index], url: logoSvg(businessName, index, selectedColor) }));
};

export const getCoverTemplates = (category) => {
  const normalized = normalizeCategory(category);
  const slug = CATEGORY_SLUGS[normalized];
  return VARIANTS.map(([id, _label, position, size, filter], index) => ({
    id,
    label: `Template ${normalized} ${index + 1}`,
    // Every category owns ten physical cover files. Keeping the path in the
    // template (rather than deriving it in the component) makes selection,
    // preview, persistence, and deployment behave exactly the same.
    url: `/assets/templates/covers/${slug}/${String(index + 1).padStart(2, "0")}.jpg`,
    position,
    size,
    filter,
  }));
};

const randomFrom = (items) => items[Math.floor(Math.random() * items.length)];

export const pickRandomImageTemplates = (category, businessName = "") => ({
  logo: randomFrom(getLogoTemplates(category, businessName)),
  cover: randomFrom(getCoverTemplates(category)),
});

export const getCoverVisualStyle = (variantId = "natural") => {
  const [, , position, size, filter] = VARIANTS.find(([id]) => id === variantId) || VARIANTS[0];
  return { backgroundPosition: position, backgroundSize: size, objectPosition: position, filter };
};
