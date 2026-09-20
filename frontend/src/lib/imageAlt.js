/** Returns an accessible, human-readable image alternative without persisting generated copy. */
export function getImageAlt({ alt, context, businessName, articleTitle, decorative = false } = {}) {
  if (decorative) return "";
  const manualAlt = typeof alt === "string" ? alt.trim() : "";
  if (manualAlt) return manualAlt;
  const label = typeof context === "string" ? context.trim() : "";
  if (label) return `${label} Situska`;
  const business = typeof businessName === "string" ? businessName.trim() : "";
  if (business) return `Image ${business} Situska`;
  const article = typeof articleTitle === "string" ? articleTitle.trim() : "";
  if (article) return `Image ${article.slice(0, 120)} Situska`;
  return "Image Situska";
}
