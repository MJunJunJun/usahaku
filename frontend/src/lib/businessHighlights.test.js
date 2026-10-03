import { businessHighlights } from "./businessHighlights";
const old = [{ title: "Sparepart Original", desc: "Suku cadang" }, { title: "Mekanik Berpengalaman" }, { title: "Reservasi Mudah", desc: "Konten pemilik" }];
test("repairs only misplaced defaults on hair businesses", () => {
 const result = businessHighlights({ category: "Barbershop" }, old);
 expect(result[0].title).toBe("Potongan Sesuai Karakter");
 expect(result[1].title).toBe("Layanan Potong Rambut");
 expect(result[2]).toBe(old[2]);
 expect(businessHighlights({ category: "Bengkel" }, old)).toBe(old);
});
