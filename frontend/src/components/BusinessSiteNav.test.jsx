import { renderToStaticMarkup } from "react-dom/server";
import BusinessSiteNav from "./BusinessSiteNav";

jest.mock("../lib/api", () => ({ resolveMediaUrl: (value) => value }));

const site = { slug: "test1", businessName: "Test", whatsapp: "6281234567890", products: [], aiGeneratedContent: { highlights: ["Layanan"] } };
const renderNav = (templateStyle, innerPage) => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<BusinessSiteNav data={{ ...site, templateStyle }} innerPage={innerPage} articleUrl="https://test1.situska.com/artikel" />);
  return container;
};

test.each(["modern", "warm", "bold", "minimal", "playful"])("%s keeps menu and WhatsApp consistent on inner pages", (template) => {
  const home = renderNav(template, false);
  const article = renderNav(template, true);
  expect(article.textContent).toBe(home.textContent);
  expect(article.querySelector("header").className).toBe(home.querySelector("header").className);
  expect(article.querySelector('[data-testid="public-whatsapp-nav"]').href).toBe(home.querySelector('[data-testid="public-whatsapp-nav"]').href);
  for (const anchor of article.querySelectorAll('nav a[href*="#"]')) {
    expect(anchor.href).toMatch(/^https:\/\/test1\.situska\.com\/#/);
  }
});

test("modern menu respects hidden sections and absent products", () => {
  const html = renderToStaticMarkup(<BusinessSiteNav data={{ ...site, sectionVisibility: { highlights: false, testimonials: false, faq: false, contact: false } }} innerPage articleUrl="/artikel" />);
  expect(html).not.toContain("Produk &amp; Menu");
  expect(html).not.toContain(">Keunggulan<");
  expect(html).not.toContain(">Ulasan<");
  expect(html).not.toContain(">FAQ<");
  expect(html).not.toContain(">Kontak<");
  expect(html).toContain(">Tentang<");
  expect(html).toContain(">Artikel<");
});
