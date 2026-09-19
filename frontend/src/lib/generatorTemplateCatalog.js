import { api } from "./api";
import { TEMPLATE_CATEGORIES, getContentTemplates, setManagedContentTemplates } from "./contentTemplates";
import { getCoverTemplates, LOGO_STYLE_OPTIONS, setManagedImageTemplates } from "./imageTemplates";

export const makeDefaultTemplateCatalog = () => ({
  contents: TEMPLATE_CATEGORIES.flatMap((category) => getContentTemplates(category).map((item) => ({ ...item }))),
  logos: LOGO_STYLE_OPTIONS.map((item) => ({ ...item })),
  covers: TEMPLATE_CATEGORIES.flatMap((category) => getCoverTemplates(category).map((item) => ({ ...item, category }))),
});

export const applyTemplateCatalog = (catalog) => {
  if (!catalog || typeof catalog !== "object") return;
  setManagedContentTemplates(catalog.contents);
  setManagedImageTemplates({ logos: catalog.logos, covers: catalog.covers });
};

export const loadTemplateCatalog = async () => {
  const { data } = await api.get("/generator-templates");
  if (data?.catalog) applyTemplateCatalog(data.catalog);
  return data?.catalog || null;
};
