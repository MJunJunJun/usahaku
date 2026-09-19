const VARIANTS = [
  { id: "quality", label: "Kualitas yang Terjaga" },
  { id: "friendly", label: "Hangat & Bersahabat" },
  { id: "local", label: "Dekat dengan Pelanggan" },
  { id: "premium", label: "Premium & Berkelas" },
  { id: "practical", label: "Praktis & Mudah" },
  { id: "personal", label: "Personal & Perhatian" },
  { id: "modern", label: "Modern & Relevan" },
  { id: "trusted", label: "Tepercaya & Profesional" },
  { id: "community", label: "Tumbuh Bersama Komunitas" },
  { id: "simple", label: "Singkat & Langsung" },
];

const PROFILES = {
  "Coffee Shop": {
    identity: "kedai kopi lokal dengan suasana yang nyaman",
    offer: "racikan kopi nusantara, minuman non-kopi, dan camilan pilihan",
    audience: "teman bekerja, berbincang, dan menikmati jeda",
    craft: "biji pilihan yang diracik barista dengan konsisten",
    promise: "secangkir rasa yang nikmat dan pengalaman yang hangat",
    specialty: "rasa kopi yang jujur, pelayanan ramah, dan ruang yang terasa dekat",
    heroTitles: ["Kopi Pilihan, Diracik untuk Setiap Cerita.", "Temukan Jeda di Setiap Tegukan.", "Tempat Nyaman untuk Kopi dan Cerita.", "Racikan Istimewa untuk Momen Berharga.", "Pesan Kopi Favoritmu Tanpa Ribet.", "Kopi yang Dibuat Sesuai Selera Anda.", "Rasa Lokal dalam Suasana Masa Kini.", "Setiap Cangkir, Kualitas yang Bisa Dipercaya.", "Dari Biji Lokal untuk Komunitas Kita.", "Ngopi Enak, Hari Jadi Lebih Baik."],
  },
  Restaurant: {
    identity: "rumah makan yang menyajikan hidangan segar penuh cita rasa",
    offer: "menu rumahan dan hidangan favorit yang dimasak saat dipesan",
    audience: "makan bersama keluarga, teman, maupun rekan kerja",
    craft: "bahan segar, bumbu terukur, dan proses memasak yang higienis",
    promise: "makanan lezat dengan porsi memuaskan dan pelayanan ramah",
    specialty: "cita rasa yang konsisten, bahan berkualitas, dan suasana bersantap yang nyaman",
    heroTitles: ["Hidangan Lezat, Kualitas yang Selalu Terjaga.", "Rasa Rumahan yang Selalu Dirindukan.", "Makan Enak, Berkumpul Jadi Lebih Hangat.", "Sajian Istimewa untuk Setiap Kesempatan.", "Menu Favorit Kini Lebih Mudah Dipesan.", "Hidangan yang Disiapkan untuk Selera Anda.", "Cita Rasa Nusantara dengan Sentuhan Modern.", "Nikmati Sajian Tepercaya di Setiap Kunjungan.", "Dari Dapur Kami untuk Meja Bersama.", "Lapar Datang, Pulang dengan Senang."],
  },
  Bakery: {
    identity: "bakery yang membuat roti dan pastry segar setiap hari",
    offer: "roti lembut, pastry renyah, kue, dan paket hantaran",
    audience: "sarapan, teman minum, perayaan, dan hadiah untuk orang tersayang",
    craft: "adonan terukur, bahan pilihan, dan proses panggang harian",
    promise: "produk panggang yang segar, harum, dan konsisten",
    specialty: "kesegaran harian, tekstur yang pas, dan rasa yang dibuat dengan sepenuh hati",
    heroTitles: ["Roti Segar, Dipanggang dengan Standar Terbaik.", "Kehangatan Baru dari Oven Setiap Hari.", "Roti dan Cerita Manis untuk Dinikmati Bersama.", "Pastry Istimewa untuk Momen Spesial.", "Pesan Roti Favoritmu dengan Lebih Mudah.", "Dibuat Segar Sesuai Pilihan Anda.", "Teknik Klasik, Rasa yang Tetap Modern.", "Kesegaran yang Bisa Kamu Andalkan.", "Dari Oven Lokal untuk Meja Keluarga.", "Harum Rotinya, Bahagia Rasanya."],
  },
  Fashion: {
    identity: "brand fashion lokal yang menghadirkan gaya nyaman dan berkarakter",
    offer: "pakaian, aksesori, dan koleksi pilihan untuk berbagai kesempatan",
    audience: "pribadi aktif yang ingin tampil percaya diri dengan gayanya sendiri",
    craft: "pemilihan bahan, potongan, dan detail pengerjaan yang teliti",
    promise: "koleksi nyaman yang mudah dipadukan dan tahan dikenakan",
    specialty: "desain berkarakter, bahan nyaman, dan detail yang memperkuat penampilan",
    heroTitles: ["Gaya Terpilih dengan Kualitas yang Terasa.", "Tampil Percaya Diri dengan Caramu Sendiri.", "Fashion yang Dekat dengan Cerita Harianmu.", "Koleksi Berkelas untuk Setiap Momen.", "Temukan Gaya Favoritmu dengan Mudah.", "Pilihan Personal untuk Karakter Anda.", "Karya Lokal untuk Gaya Masa Kini.", "Detail Rapi yang Layak Dipercaya.", "Dukung Karya Lokal, Kenakan dengan Bangga.", "Nyaman Dipakai, Mudah Disukai."],
  },
  Beauty: {
    identity: "studio kecantikan yang memberikan perawatan nyaman dan personal",
    offer: "perawatan wajah, rambut, kuku, dan layanan kecantikan pilihan",
    audience: "siapa pun yang ingin merawat diri dan tampil lebih percaya diri",
    craft: "konsultasi kebutuhan, produk terpilih, dan penanganan terapis terlatih",
    promise: "perawatan aman dengan hasil yang terasa dan pelayanan penuh perhatian",
    specialty: "pendekatan personal, kebersihan terjaga, dan hasil yang tampak alami",
    heroTitles: ["Perawatan Berkualitas untuk Pesona Terbaikmu.", "Saatnya Merawat Diri dengan Nyaman.", "Ruang Cantik yang Memahami Kebutuhanmu.", "Pengalaman Beauty yang Lebih Istimewa.", "Booking Perawatan Favoritmu Tanpa Ribet.", "Perawatan Personal, Hasil Lebih Maksimal.", "Cantik Alami dengan Sentuhan Modern.", "Ditangani Profesional, Dipilih dengan Percaya.", "Tumbuh Cantik Bersama Perempuan Indonesia.", "Rawat Diri, Pancarkan Percaya Diri."],
  },
  Barbershop: {
    identity: "barbershop modern dengan barber terampil dan suasana santai",
    offer: "potong rambut, styling, perawatan jenggot, dan paket grooming",
    audience: "pria dan anak yang ingin tampil rapi serta percaya diri",
    craft: "konsultasi gaya, teknik presisi, dan alat yang selalu higienis",
    promise: "potongan rapi yang sesuai karakter dan mudah dirawat",
    specialty: "barber berpengalaman, detail presisi, dan layanan yang nyaman",
    heroTitles: ["Potongan Presisi, Kualitas Tanpa Kompromi.", "Tampil Rapi, Jalani Hari dengan Percaya Diri.", "Barber Langganan untuk Gaya Andalan.", "Grooming Berkelas untuk Penampilan Terbaik.", "Booking Barber Kini Lebih Praktis.", "Gaya yang Disesuaikan dengan Karakter Anda.", "Teknik Klasik dalam Barbershop Modern.", "Hasil Rapi dari Tangan yang Tepercaya.", "Barber Lokal, Gaya untuk Komunitas.", "Datang Santai, Pulang Makin Rapi."],
  },
  Retail: {
    identity: "toko pilihan yang menyediakan kebutuhan berkualitas dalam satu tempat",
    offer: "produk pilihan untuk kebutuhan rumah, pribadi, dan aktivitas sehari-hari",
    audience: "pelanggan yang mencari produk tepat dengan proses belanja mudah",
    craft: "kurasi produk, pengecekan kualitas, dan informasi yang transparan",
    promise: "belanja praktis dengan pilihan yang jelas dan pelayanan responsif",
    specialty: "produk terkurasi, harga wajar, dan bantuan cepat saat dibutuhkan",
    heroTitles: ["Produk Pilihan dengan Kualitas Terjamin.", "Kebutuhan Harian Kini Lebih Dekat.", "Toko Andalan untuk Berbagai Kebutuhan.", "Pilihan Premium untuk Belanja Lebih Puas.", "Cari, Pilih, dan Pesan Tanpa Ribet.", "Rekomendasi Produk Sesuai Kebutuhan Anda.", "Belanja Lokal dengan Pengalaman Modern.", "Pilihan Jelas dari Toko Tepercaya.", "Belanja Dekat, Tumbuh Bersama Komunitas.", "Semua yang Dicari, Lebih Mudah Ditemukan."],
  },
  Jasa: {
    identity: "penyedia jasa profesional yang fokus pada solusi tepat guna",
    offer: "layanan konsultasi dan pengerjaan yang disesuaikan dengan kebutuhan",
    audience: "individu maupun bisnis yang membutuhkan bantuan cepat dan jelas",
    craft: "analisis kebutuhan, proses terukur, dan komunikasi yang transparan",
    promise: "solusi efektif dengan hasil rapi dan waktu pengerjaan yang jelas",
    specialty: "respons cepat, pengerjaan teliti, dan pendampingan dari awal hingga selesai",
    heroTitles: ["Layanan Profesional dengan Hasil Terukur.", "Solusi Tepat untuk Kebutuhan Anda.", "Partner Jasa yang Siap Membantu Lebih Dekat.", "Pelayanan Berkelas untuk Hasil Terbaik.", "Konsultasi dan Pemesanan Jadi Lebih Mudah.", "Solusi Personal untuk Setiap Tantangan.", "Cara Modern Menyelesaikan Kebutuhan Anda.", "Dikerjakan Ahli, Diselesaikan dengan Pasti.", "Keahlian Lokal untuk Kemajuan Bersama.", "Ceritakan Kebutuhanmu, Kami Bantu Selesaikan."],
  },
  Pendidikan: {
    identity: "lembaga pendidikan yang menghadirkan proses belajar terarah dan menyenangkan",
    offer: "kelas, pendampingan, dan materi belajar sesuai kebutuhan peserta",
    audience: "pelajar dan pembelajar yang ingin berkembang dengan percaya diri",
    craft: "kurikulum terstruktur, pengajar berpengalaman, dan evaluasi berkala",
    promise: "pengalaman belajar yang mudah dipahami dan berdampak nyata",
    specialty: "pendampingan personal, materi relevan, dan lingkungan belajar yang suportif",
    heroTitles: ["Pembelajaran Berkualitas untuk Masa Depan Cerah.", "Belajar Nyaman, Bertumbuh Lebih Percaya Diri.", "Tempat Belajar yang Mendampingi Setiap Langkah.", "Program Pilihan untuk Potensi Terbaik.", "Daftar Kelas Kini Lebih Mudah.", "Pendampingan Belajar Sesuai Kebutuhan Anda.", "Metode Modern untuk Hasil Belajar Optimal.", "Belajar Bersama Pengajar Tepercaya.", "Tumbuh Bersama dalam Komunitas Pembelajar.", "Mulai Belajar, Wujudkan Kemajuan."],
  },
  Lainnya: {
    identity: "usaha lokal yang hadir dengan produk dan layanan pilihan",
    offer: "solusi berkualitas yang disesuaikan dengan kebutuhan pelanggan",
    audience: "pelanggan yang mengutamakan kemudahan, kualitas, dan pelayanan baik",
    craft: "proses yang teliti, komunikasi jelas, dan perhatian pada setiap detail",
    promise: "pengalaman yang nyaman dengan hasil yang dapat diandalkan",
    specialty: "kualitas terjaga, pelayanan responsif, dan pendekatan yang lebih personal",
    heroTitles: ["Kualitas Terpilih untuk Setiap Kebutuhan.", "Hadir Lebih Dekat untuk Melayani Anda.", "Usaha Lokal dengan Cerita yang Berarti.", "Pengalaman Istimewa dalam Setiap Pilihan.", "Temukan dan Pesan dengan Lebih Mudah.", "Solusi yang Dibuat Sesuai Kebutuhan Anda.", "Pilihan Lokal dengan Cara yang Modern.", "Pelayanan Tepercaya dari Awal hingga Selesai.", "Tumbuh Bersama Pelanggan dan Komunitas.", "Pilihan Tepat, Proses Lebih Mudah."],
  },
};

const DESCRIPTION_BUILDERS = [
  (p) => `Kami adalah ${p.identity}, menghadirkan ${p.offer} untuk ${p.audience}. Setiap detail dijaga melalui ${p.craft}.`,
  (p) => `Berawal dari keinginan menghadirkan ${p.promise}, usaha kami tumbuh sebagai ${p.identity}. Kami menyediakan ${p.offer} dengan pelayanan yang hangat.`,
  (p) => `Sebagai ${p.identity}, kami ingin lebih dekat dengan ${p.audience}. Karena itu, kami menghadirkan ${p.offer} dengan proses yang mudah dan bersahabat.`,
  (p) => `Kami menghadirkan pengalaman premium melalui ${p.offer}. Didukung ${p.craft}, setiap pelanggan mendapatkan ${p.promise}.`,
  (p) => `Usaha kami memudahkan pelanggan menemukan ${p.offer}. Informasi jelas, pemesanan praktis, dan ${p.specialty} menjadi bagian dari layanan kami.`,
  (p) => `Setiap pelanggan memiliki kebutuhan berbeda. Sebagai ${p.identity}, kami menyiapkan ${p.offer} dengan pendekatan personal dan ${p.craft}.`,
  (p) => `Kami memadukan pengalaman lokal dengan pelayanan modern untuk menghadirkan ${p.offer}. Tujuan kami sederhana: memberikan ${p.promise}.`,
  (p) => `Kepercayaan pelanggan kami jaga melalui ${p.craft}. Kami adalah ${p.identity} dengan fokus pada ${p.specialty}.`,
  (p) => `Usaha ini tumbuh bersama pelanggan dan lingkungan sekitar. Kami menghadirkan ${p.offer} bagi ${p.audience} dengan semangat kolaborasi.`,
  (p) => `Kami menyediakan ${p.offer} dengan proses sederhana dan pelayanan jelas. Cocok untuk ${p.audience} yang menginginkan ${p.promise}.`,
];

const SUBTITLE_BUILDERS = [
  (p) => `Nikmati ${p.offer} dengan ${p.specialty}.`,
  (p) => `${p.promise}, disiapkan untuk menemani kebutuhan Anda.`,
  (p) => `Hadir dekat untuk ${p.audience} dengan pelayanan yang hangat.`,
  (p) => `Pengalaman pilihan yang didukung oleh ${p.craft}.`,
  (p) => `Temukan pilihan, lihat informasi, lalu pesan dengan mudah.`,
  (p) => `Setiap kebutuhan ditangani secara personal dengan perhatian pada detail.`,
  (p) => `${p.offer} dalam pengalaman yang praktis dan modern.`,
  (p) => `${p.specialty} untuk hasil yang dapat Anda percaya.`,
  (p) => `Pilihan lokal yang tumbuh bersama pelanggan dan komunitas.`,
  (p) => `${p.promise} tanpa proses yang rumit.`,
];

const ABOUT_BUILDERS = [
  (p) => `Kami percaya kualitas terbaik lahir dari proses yang dijaga. Karena itu, ${p.craft} menjadi dasar kami dalam menghadirkan ${p.offer}. Kami ingin setiap pelanggan merasakan ${p.promise}.`,
  (p) => `Usaha ini dibangun untuk memberi pengalaman yang lebih hangat kepada ${p.audience}. Melalui ${p.offer}, kami menjaga ${p.specialty} agar setiap kunjungan terasa menyenangkan.`,
  (p) => `Kami tumbuh sebagai bagian dari lingkungan sekitar dan memahami kebutuhan pelanggan dari dekat. Fokus kami adalah menghadirkan ${p.offer} dengan pelayanan ramah, mudah dihubungi, dan konsisten.`,
  (p) => `Bagi kami, pengalaman premium bukan sekadar tampilan, tetapi perhatian pada setiap detail. Dengan ${p.craft}, kami menghadirkan ${p.promise} bagi setiap pelanggan.`,
  (p) => `Kami ingin membuat proses memilih dan memesan menjadi sederhana. Pelanggan dapat menemukan informasi ${p.offer}, berkonsultasi, dan menghubungi kami tanpa langkah yang membingungkan.`,
  (p) => `Kebutuhan setiap pelanggan tidak selalu sama. Tim kami mendengarkan, memberi rekomendasi, dan menyiapkan ${p.offer} dengan pendekatan personal agar hasilnya lebih sesuai.`,
  (p) => `Kami membawa semangat usaha lokal ke dalam pengalaman yang lebih modern. Teknologi membantu proses menjadi mudah, sementara ${p.craft} memastikan kualitas tetap menjadi prioritas.`,
  (p) => `Kepercayaan dibangun melalui konsistensi. Itulah sebabnya kami menjaga ${p.specialty}, menyampaikan informasi secara transparan, dan bertanggung jawab atas layanan yang diberikan.`,
  (p) => `Kami bangga tumbuh bersama pelanggan dan komunitas sekitar. Setiap dukungan mendorong kami untuk terus memperbaiki ${p.offer} dan menciptakan manfaat yang lebih luas.`,
  (p) => `Kami hadir dengan tujuan sederhana: memberi ${p.promise}. Dengan proses yang jelas dan respons yang cepat, pelanggan dapat memperoleh yang dibutuhkan dengan lebih nyaman.`,
];

const normalizeCategory = (category = "") => {
  const value = category.toLowerCase();
  if (/coffee|kopi|cafe|kedai/.test(value)) return "Coffee Shop";
  if (/restaurant|restoran|kuliner|makanan|warung/.test(value)) return "Restaurant";
  if (/bakery|roti|kue/.test(value)) return "Bakery";
  if (/fashion|butik|pakaian/.test(value)) return "Fashion";
  if (/beauty|salon|kecantikan/.test(value)) return "Beauty";
  if (/barber/.test(value)) return "Barbershop";
  if (/retail|toko/.test(value)) return "Retail";
  if (/pendidikan|sekolah|kursus|bimbel/.test(value)) return "Pendidikan";
  if (/jasa|service|layanan/.test(value)) return "Jasa";
  return PROFILES[category] ? category : "Lainnya";
};

export const TEMPLATE_CATEGORIES = Object.keys(PROFILES);
let managedTemplates = null;

// The generator keeps useful built-ins, while the admin catalogue can replace
// them at runtime without requiring a frontend deployment.
export const setManagedContentTemplates = (templates) => {
  managedTemplates = Array.isArray(templates) ? templates : null;
};

export const getContentTemplates = (category) => {
  const normalized = normalizeCategory(category);
  const managed = (managedTemplates || []).filter((template) => template.category === normalized);
  if (managedTemplates) return managed;
  const profile = PROFILES[normalized];
  return VARIANTS.map((variant, index) => ({
    ...variant,
    id: `${normalized}-${variant.id}`,
    category: normalized,
    heroTitle: profile.heroTitles[index],
    heroSubtitle: SUBTITLE_BUILDERS[index](profile),
    description: DESCRIPTION_BUILDERS[index](profile),
    about: ABOUT_BUILDERS[index](profile),
  }));
};

export const pickRandomContentTemplate = (category, excludeId = "") => {
  const all = getContentTemplates(category);
  const choices = all.filter((template) => template.id !== excludeId);
  return choices[Math.floor(Math.random() * choices.length)] || all[0];
};

export const coverPatchFromTemplate = (template) => ({
  heroTitle: template.heroTitle,
  heroSubtitle: template.heroSubtitle,
  about: template.about,
});
