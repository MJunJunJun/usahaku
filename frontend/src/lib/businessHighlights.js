// Repair only known misplaced automotive defaults on explicitly identified hair businesses.
export function businessHighlights(data, highlights) {
  const text = [data.category, data.description, ...(data.products || []).map(p => p.name)].filter(Boolean).join(" ");
  if (!/barber|potong(?:an)? rambut|haircut/i.test(text)) return highlights;
  const replacements = {
    "Sparepart Original": { title: "Potongan Sesuai Karakter", desc: "Diskusikan gaya yang kamu inginkan sebelum menentukan potongan.", icon: "MessageCircle" },
    "Mekanik Berpengalaman": { title: "Layanan Potong Rambut", desc: "Temukan pilihan layanan dan hubungi kami untuk mengatur kunjungan.", icon: "Calendar" }
  };
  return highlights.map(item => replacements[typeof item === "string" ? item : item.title] || item);
}
