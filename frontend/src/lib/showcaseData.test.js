import { getShowcaseSite, SHOWCASE_THEMES } from "./showcaseData";
import { WEBSITE_TEMPLATES } from "./templates";

test("contoh website mencakup semua tema dan alamat lama tetap tersedia", () => {
  expect(new Set(Object.values(SHOWCASE_THEMES))).toEqual(new Set(WEBSITE_TEMPLATES.map(t => t.id)));
  for (const [slug, style] of Object.entries(SHOWCASE_THEMES)) {
    const site = getShowcaseSite(slug);
    expect(site.slug).toBe(slug);
    expect(site.templateStyle).toBe(style);
    expect(site.themeConfig.style).toBe(style);
    expect(site.products).toHaveLength(7);
    expect(site.aiGeneratedContent.faq).not.toHaveLength(0);
    expect(getShowcaseSite(`demo-${slug}`)).toEqual(site);
  }
  expect(getShowcaseSite("demo-website-pelanggan")).toBeNull();
});
