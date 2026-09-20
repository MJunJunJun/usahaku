import { getImageAlt } from "./imageAlt";

test("manual alt selalu diprioritaskan", () => expect(getImageAlt({ alt: "Secangkir kopi latte Kopisenja", businessName: "Kopisenja" })).toBe("Secangkir kopi latte Kopisenja"));
test("nama usaha menjadi fallback", () => expect(getImageAlt({ businessName: "Kopisenja" })).toBe("Image Kopisenja Situska"));
test("judul artikel menjadi fallback", () => expect(getImageAlt({ articleTitle: "Cara Membuat Website Usaha" })).toBe("Image Cara Membuat Website Usaha Situska"));
test("gambar dekoratif kosong", () => expect(getImageAlt({ decorative: true, businessName: "Kopisenja" })).toBe(""));
