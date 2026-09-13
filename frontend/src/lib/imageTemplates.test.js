import { getCoverTemplates, getLogoTemplates, pickRandomImageTemplates } from "./imageTemplates";

const categories = ["Coffee Shop", "Restaurant", "Bakery", "Fashion", "Beauty", "Barbershop", "Retail", "Jasa", "Pendidikan", "Lainnya"];

test.each(categories)("%s memiliki 10 template logo dan cover", (category) => {
  const logos = getLogoTemplates(category, "Usaha Contoh");
  const covers = getCoverTemplates(category);
  expect(logos).toHaveLength(10);
  expect(covers).toHaveLength(10);
  expect(logos.every((item) => item.url.startsWith("data:image/svg+xml,"))).toBe(true);
  expect(covers.every((item) => item.url.startsWith("/assets/templates/covers/"))).toBe(true);
  expect(new Set(covers.map((item) => item.url)).size).toBe(10);
  const selected = pickRandomImageTemplates(category, "Usaha Contoh");
  expect(logos.map((item) => item.id)).toContain(selected.logo.id);
  expect(covers.map((item) => item.id)).toContain(selected.cover.id);
});
