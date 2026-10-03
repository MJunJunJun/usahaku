import { renderToStaticMarkup } from "react-dom/server";
import PublicWebsiteView from "./PublicWebsiteView";

jest.mock("../lib/api", () => ({ api: { get: jest.fn() }, money: value => String(value), resolveMediaUrl: value => value }));
const site = {
  businessName: "Usaha Uji", slug: "uji", whatsapp: "6281234567890", description: "Tentang usaha",
  themeConfig: { primary: "#DB2777", accent: "#831843" },
  products: [{ id: "p1", name: "Produk Uji", price: 10000, images: [] }],
  aiGeneratedContent: { heroTitle: "Hero Uji", highlights: [{ title: "Keunggulan Uji", desc: "Layanan terbaik" }], faq: [{ q: "Pertanyaan Uji", a: "Jawaban" }], testimonials: [{ name: "Pelanggan", comment: "Bagus", rating: 5 }] }
};
test.each(["modern", "warm", "bold", "minimal", "playful"])("%s renders all sections, shared header, colors and WhatsApp", templateStyle => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<PublicWebsiteView data={{ ...site, templateStyle }} embedded />);
  expect(container.querySelector(".public-nav")).not.toBeNull();
  expect(container.querySelector(".public-hero").textContent).toContain("Hero Uji");
  for (const id of ["tentang", "keunggulan", "menu", "testimoni", "faq", "lokasi"]) {
    expect(container.querySelector('#' + id)).not.toBeNull();
    expect(container.querySelector('[href="#' + id + '"]')).not.toBeNull();
  }
  expect(container.querySelector(".public-site").style.getPropertyValue("--pri")).toBe("#DB2777");
  expect(container.querySelector(".public-site").style.getPropertyValue("--acc")).toBe("#831843");
  expect(container.querySelector('[data-testid="floating-whatsapp-btn"]').href).toContain("wa.me/6281234567890");
});
test("hidden sections stay hidden in alternative templates", () => {
  const html = renderToStaticMarkup(<PublicWebsiteView data={{ ...site, templateStyle: "warm", sectionVisibility: { highlights: false, testimonials: false, faq: false, contact: false } }} embedded />);
  for (const id of ["keunggulan", "testimoni", "faq", "lokasi"]) expect(html).not.toContain('id="' + id + '"');
});
