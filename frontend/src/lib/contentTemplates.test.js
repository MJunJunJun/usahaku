import { getContentTemplates, pickRandomContentTemplate } from "./contentTemplates";

const categories = [
  "Coffee Shop", "Restaurant", "Bakery", "Fashion", "Beauty",
  "Barbershop", "Retail", "Jasa", "Pendidikan", "Lainnya",
];

describe("content templates", () => {
  test.each(categories)("%s memiliki tepat 10 template lengkap", (category) => {
    const templates = getContentTemplates(category);

    expect(templates).toHaveLength(10);
    expect(new Set(templates.map((template) => template.id)).size).toBe(10);
    templates.forEach((template) => {
      expect(template.category).toBe(category);
      expect(template.description.trim()).not.toBe("");
      expect(template.heroTitle.trim()).not.toBe("");
      expect(template.heroSubtitle.trim()).not.toBe("");
      expect(template.about.trim()).not.toBe("");
    });
  });

  test("pilihan acak selalu berasal dari kategori yang dipilih", () => {
    categories.forEach((category) => {
      const validIds = getContentTemplates(category).map((template) => template.id);
      const selected = pickRandomContentTemplate(category);
      expect(selected.category).toBe(category);
      expect(validIds).toContain(selected.id);
    });
  });
});
