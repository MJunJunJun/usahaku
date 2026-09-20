const allowedTags = new Set(["P", "H2", "H3", "STRONG", "EM", "UL", "OL", "LI", "A", "BLOCKQUOTE", "BR"]);

export function articleToHtml(content = "") {
  if (!content) return "";
  if (/<[a-z][\s\S]*>/i.test(content)) return sanitizeArticleHtml(content);
  return content.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
}

export function sanitizeArticleHtml(html = "") {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const clean = (node) => {
    [...node.children].forEach((child) => {
      if (!allowedTags.has(child.tagName)) { child.replaceWith(...child.childNodes); return; }
      [...child.attributes].forEach((attr) => {
        if (child.tagName !== "A" || attr.name.toLowerCase() !== "href" || !/^(https?:|mailto:|\/)/i.test(attr.value)) child.removeAttribute(attr.name);
      });
      if (child.tagName === "A") { child.setAttribute("rel", "noopener noreferrer"); }
      clean(child);
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

/**
 * Prepares already-saved rich HTML for the public article page.  This does not
 * transform editor content into paragraphs: it preserves the semantic tags,
 * while adding stable, collision-safe anchors for the generated table of
 * contents.
 */
export function preparePublicArticleContent(content = "") {
  const html = articleToHtml(content);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const usedIds = new Set();
  const headings = [...doc.body.querySelectorAll("h2, h3")].map((node) => {
    const label = node.textContent.trim();
    const base = slugForAnchor(label) || "bagian";
    let id = base; let number = 2;
    while (usedIds.has(id)) { id = `${base}-${number}`; number += 1; }
    usedIds.add(id);
    node.id = id;
    return { id, label, level: Number(node.tagName.slice(1)) };
  }).filter((heading) => heading.label);
  return { html: doc.body.innerHTML, headings };
}

export function readingMinutes(content = "") {
  const words = content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

const escapeHtml = (value) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
const slugForAnchor = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
