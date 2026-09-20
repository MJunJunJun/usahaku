"""Editorial source of truth for the public Situska learning centre.

The catalogue deliberately contains complete, publish-ready HTML rather than a
few placeholder paragraphs.  It is shared by the one-time migration in
``server.startup`` so a fresh installation has the same useful public content.
"""
from html import escape


def _paragraphs(items):
    return "".join(f"<p>{escape(item)}</p>" for item in items)


def _list(items):
    return "<ul>" + "".join(f"<li>{escape(item)}</li>" for item in items) + "</ul>"


def _article(item):
    title = item["title"]
    keyword = item["focusKeyword"]
    sections = "".join(
        f"<h2>{escape(heading)}</h2>{_paragraphs(paragraphs)}"
        for heading, paragraphs in item["sections"]
    )
    faqs = "".join(
        f"<h3>{escape(question)}</h3><p>{escape(answer)}</p>"
        for question, answer in item["faqs"]
    )
    return (
        f"<p>{escape(item['intro'])}</p>"
        f"<p>Artikel ini membahas <strong>{escape(keyword)}</strong> secara praktis, "
        "dengan langkah yang bisa langsung dipakai oleh pemilik usaha di Indonesia.</p>"
        f"<h2>Ringkasan langkah penting</h2>{_list(item['steps'])}"
        f"{sections}"
        "<h2>Checklist sebelum Anda melanjutkan</h2>"
        "<p>Pastikan informasi usaha, penawaran utama, kontak, dan tindakan berikutnya "
        "sudah jelas. Perbaikan kecil yang konsisten lebih berguna daripada menunggu "
        "website terasa sempurna.</p>"
        f"<h2>FAQ: {escape(title)}</h2>{faqs}"
        "<h2>Mulai bangun kehadiran digital usaha Anda</h2>"
        "<p>Anda tidak perlu menguasai coding untuk memulai. Buat halaman yang rapi, "
        "tampilkan produk atau layanan, lalu arahkan calon pelanggan ke WhatsApp Anda.</p>"
        "<p><a href=\"/register\">Buat Website Gratis di Situska</a> dan perbarui "
        "informasinya saat bisnis Anda berkembang.</p>"
    )


RAW_ARTICLES = [
    {
        "title": "Cara Membuat Website UMKM dari Nol",
        "slug": "cara-membuat-website-umkm-dari-nol",
        "category": "Website UMKM",
        "focusKeyword": "cara membuat website UMKM",
        "seoTitle": "Cara Membuat Website UMKM dari Nol | Situska",
        "excerpt": "Panduan langkah demi langkah membuat website UMKM yang jelas, profesional, dan siap menerima calon pelanggan.",
        "coverImageUrl": "/images/articles/cara-membuat-website-umkm.png",
        "coverImageAlt": "Pemilik UMKM Indonesia merencanakan website usahanya di laptop",
        "intro": "Website UMKM adalah rumah digital yang membantu pelanggan menemukan informasi usaha tanpa harus menunggu balasan chat. Mulailah dari kebutuhan pelanggan, bukan dari fitur yang rumit.",
        "steps": ["Tentukan tujuan utama website: memperkenalkan usaha, menampilkan katalog, atau menerima pesanan.", "Kumpulkan nama usaha, deskripsi singkat, foto produk, harga, lokasi, dan nomor WhatsApp.", "Susun halaman Beranda, Produk atau Layanan, Tentang Kami, dan Kontak.", "Periksa tampilan dari ponsel lalu bagikan tautannya ke Google Business dan media sosial."],
        "sections": [("Tentukan tujuan sebelum memilih desain", ["Tujuan membuat website akan menentukan informasi yang harus tampil paling dulu. Toko makanan mungkin perlu katalog dan area pengiriman, sedangkan jasa perlu menjelaskan proses kerja dan contoh hasil.", "Pilih satu tindakan utama yang Anda harapkan dari pengunjung, misalnya melihat katalog atau menekan tombol WhatsApp. Dengan begitu halaman tidak terasa ramai dan pelanggan tidak bingung."]), ("Siapkan isi yang benar-benar dicari pelanggan", ["Tulis deskripsi singkat yang menjawab siapa Anda, apa yang dijual, dan untuk siapa produk atau jasa tersebut. Gunakan bahasa yang sama seperti saat Anda menjelaskan usaha kepada pelanggan.", "Foto asli, daftar varian, kisaran harga, jam buka, dan alamat meningkatkan kepercayaan. Jangan menunda terbit hanya karena belum memiliki semua foto; perbarui bertahap."]), ("Publikasikan dan rawat website", ["Setelah halaman terbit, uji semua tombol dari ponsel. Pastikan nomor WhatsApp aktif, lokasi tepat, dan foto tidak terlalu berat untuk dimuat.", "Tambahkan artikel, produk baru, atau testimoni secara berkala. Website yang dirawat memberi alasan bagi pelanggan untuk kembali dan membantu Google memahami bahwa usaha Anda aktif."])],
        "faqs": [("Apakah UMKM harus bisa coding?", "Tidak. Anda dapat memakai pembuat website seperti Situska dan fokus menyiapkan isi usaha."), ("Halaman apa yang paling penting?", "Mulailah dari beranda, katalog atau layanan, profil usaha, dan kontak atau WhatsApp.")],
    },
    {
        "title": "Kenapa UMKM Membutuhkan Website?",
        "slug": "kenapa-umkm-membutuhkan-website",
        "category": "Digitalisasi UMKM",
        "focusKeyword": "kenapa UMKM membutuhkan website",
        "seoTitle": "Kenapa UMKM Membutuhkan Website? Manfaat untuk Bisnis | Situska",
        "excerpt": "Pahami alasan website menjadi aset digital yang membuat UMKM lebih mudah ditemukan, dipercaya, dan dihubungi.",
        "coverImageUrl": "/images/articles/kenapa-umkm-membutuhkan-website.png",
        "coverImageAlt": "Pemilik UMKM membandingkan ponsel dan website bisnis di laptop",
        "intro": "Media sosial bagus untuk menjangkau audiens, tetapi website memberi UMKM alamat digital yang dimiliki sendiri. Pelanggan dapat menemukan informasi resmi kapan saja tanpa harus menelusuri banyak unggahan.",
        "steps": ["Gunakan website sebagai pusat informasi resmi bisnis.", "Tautkan website dari bio media sosial dan profil Google Business.", "Tampilkan kontak yang mudah dihubungi dan bukti kepercayaan.", "Perbarui isi ketika ada produk, layanan, atau promosi baru."],
        "sections": [("Website meningkatkan kepercayaan", ["Saat calon pelanggan mencari nama usaha di Google, website membuat bisnis terlihat lebih siap dan mudah diverifikasi. Halaman profil menjelaskan pemilik, cerita usaha, alamat, serta cara menghubungi Anda.", "Kepercayaan tidak datang dari desain mewah saja. Informasi yang lengkap, foto nyata, dan respons yang jelas jauh lebih meyakinkan bagi pembeli baru."]), ("Informasi tetap rapi dan mudah dicari", ["Unggahan media sosial bergerak cepat, sedangkan halaman website dapat menyimpan katalog, daftar jasa, FAQ, dan testimoni dalam struktur yang tetap. Pelanggan tidak perlu bertanya ulang tentang informasi dasar.", "Gunakan judul halaman yang sederhana agar orang dan mesin pencari memahami topiknya. Misalnya, gunakan halaman khusus untuk setiap layanan utama."]), ("Website mendukung pemasaran jangka panjang", ["Tautan website dapat dipakai kembali dalam WhatsApp, iklan, QR code, kartu nama, dan konten sosial. Satu pembaruan pada halaman produk dapat dilihat oleh banyak calon pelanggan.", "Ketika Anda menulis panduan yang berguna, Google juga mempunyai peluang untuk menampilkan usaha Anda kepada orang yang belum mengikuti akun media sosial."])],
        "faqs": [("Apakah website menggantikan Instagram?", "Tidak. Keduanya saling mendukung: media sosial menarik perhatian, website memberi informasi lengkap dan tujuan yang jelas."), ("Kapan waktu yang tepat membuat website?", "Saat usaha sudah memiliki penawaran dan kontak yang ingin dibagikan secara konsisten.")],
    },
    {
        "title": "Berapa Biaya Membuat Website untuk UMKM?",
        "slug": "biaya-membuat-website-untuk-umkm",
        "category": "Website UMKM",
        "focusKeyword": "biaya membuat website UMKM",
        "seoTitle": "Biaya Membuat Website untuk UMKM: Panduan Anggaran | Situska",
        "excerpt": "Kenali komponen biaya website UMKM dan cara menyusun anggaran yang masuk akal sesuai tahap bisnis.",
        "coverImageUrl": "/images/articles/biaya-website-umkm.png",
        "coverImageAlt": "Pengusaha UMKM menghitung anggaran website di meja kerja",
        "intro": "Biaya website UMKM tidak hanya soal harga pembuatan. Anda perlu melihat kebutuhan domain, tampilan, konten, pemeliharaan, dan waktu yang dipakai untuk memperbarui informasi.",
        "steps": ["Tetapkan tujuan dan fitur yang benar-benar dibutuhkan.", "Pisahkan biaya awal, biaya tahunan, dan biaya pengelolaan konten.", "Utamakan informasi dan foto yang membantu pelanggan membeli.", "Pilih solusi yang memungkinkan Anda memperbarui website sendiri."],
        "sections": [("Komponen biaya yang perlu dipahami", ["Domain adalah alamat website yang dibayar secara berkala. Selain itu ada layanan pembuat atau hosting website, serta bila diperlukan biaya desain, fotografi, penulisan, atau integrasi pembayaran.", "Jangan membandingkan biaya hanya dari angka awal. Periksa apakah Anda dapat mengubah harga, menambah produk, dan menyimpan aset usaha sendiri saat bisnis berkembang."]), ("Mulai dari versi yang bermanfaat", ["Untuk UMKM baru, website sederhana dengan beranda, katalog, kontak, dan tombol WhatsApp sering kali sudah cukup. Fitur tambahan sebaiknya muncul ketika benar-benar mendukung proses penjualan.", "Gunakan anggaran untuk memperjelas penawaran utama. Foto yang terang, deskripsi produk yang baik, dan kontak yang cepat direspons biasanya lebih berdampak daripada elemen dekoratif."]), ("Hindari biaya tersembunyi", ["Tanyakan masa aktif domain, batas jumlah produk, biaya perpanjangan, dan siapa yang mengelola perubahan konten. Simpan akses penting atas nama usaha agar kepemilikan tetap aman.", "Buat daftar pembaruan bulanan sederhana. Dengan merawat informasi sendiri, biaya jangka panjang lebih mudah diprediksi."])],
        "faqs": [("Apakah website gratis cukup untuk UMKM?", "Untuk memulai, layanan gratis dapat membantu menguji kebutuhan. Untuk identitas yang lebih profesional, pertimbangkan domain sendiri dan fitur sesuai pertumbuhan usaha."), ("Apa biaya yang paling penting diprioritaskan?", "Prioritaskan alamat domain, informasi usaha yang lengkap, dan cara pelanggan dapat menghubungi Anda.")],
    },
]

# The rest of the catalogue intentionally follows the same editorial quality and
# data shape.  It is defined below in compact form to keep migration code simple.
RAW_ARTICLES.extend([
    {"title": "Cara Membuat Website Bisnis yang Profesional", "slug": "cara-membuat-website-bisnis-profesional", "category": "Website Bisnis", "focusKeyword": "cara membuat website bisnis profesional", "seoTitle": "Cara Membuat Website Bisnis yang Profesional | Situska", "excerpt": "Langkah praktis membangun website bisnis yang rapi, meyakinkan, dan mudah dipakai pelanggan.", "coverImageUrl": "/images/articles/website-bisnis-profesional.png", "coverImageAlt": "Pengusaha meninjau tampilan website bisnis profesional", "intro": "Website profesional membuat calon pelanggan cepat memahami nilai bisnis Anda dan yakin untuk mengambil langkah berikutnya.", "steps": ["Tentukan pesan utama di beranda.", "Gunakan struktur halaman yang konsisten.", "Tampilkan bukti kepercayaan dan kontak.", "Uji pengalaman dari ponsel."], "sections": [("Tampilan profesional dimulai dari kejelasan", ["Pengunjung harus dapat mengetahui layanan, manfaat, dan cara menghubungi usaha dalam beberapa detik pertama. Gunakan judul yang spesifik dan satu ajakan bertindak utama.", "Hindari terlalu banyak warna, jenis huruf, atau animasi. Ruang kosong dan hierarki judul yang rapi membuat isi lebih mudah dipercaya."]), ("Bangun bukti kepercayaan", ["Cantumkan foto asli, testimoni yang relevan, contoh pekerjaan, lokasi, dan jam respons. Bukti nyata membantu bisnis kecil terlihat terbuka.", "Pastikan semua nomor kontak dan tautan selalu diperbarui agar kesan profesional tetap terjaga."]), ("Rawat pengalaman pelanggan", ["Kecepatan, tampilan ponsel, dan formulir sederhana penting karena sebagian besar kunjungan datang dari perangkat mobile.", "Tinjau halaman seperti pelanggan baru: apakah mereka tahu apa yang harus dilakukan setelah membaca halaman?"])], "faqs": [("Apakah desain mahal selalu profesional?", "Tidak. Struktur yang jelas dan konten akurat lebih penting daripada dekorasi berlebihan."), ("Apa bukti kepercayaan yang aman ditampilkan?", "Testimoni dengan izin, foto proses, alamat, dan informasi layanan yang dapat diverifikasi.")]},
    {"title": "Website vs Instagram untuk Bisnis: Apa Bedanya?", "slug": "website-vs-instagram-untuk-bisnis", "category": "Pemasaran Digital", "focusKeyword": "website vs Instagram untuk bisnis", "seoTitle": "Website vs Instagram untuk Bisnis: Perbedaan dan Fungsi | Situska", "excerpt": "Bandingkan peran website dan Instagram agar bisnis memakai keduanya secara saling melengkapi.", "coverImageUrl": "/images/articles/website-vs-instagram.png", "coverImageAlt": "Pemilik toko membandingkan ponsel dan website di laptop", "intro": "Website dan Instagram bukan pilihan yang harus saling mengalahkan. Keduanya bekerja paling baik ketika media sosial menarik perhatian dan website menjadi tujuan informasi resmi.", "steps": ["Gunakan Instagram untuk percakapan dan jangkauan.", "Gunakan website untuk katalog, profil, dan pencarian Google.", "Sambungkan bio Instagram ke halaman yang relevan.", "Ukur pertanyaan pelanggan untuk memperbaiki isi website."], "sections": [("Apa yang kuat dari Instagram", ["Instagram memudahkan bisnis berbagi cerita harian, video, dan interaksi cepat. Formatnya cocok untuk membangun kedekatan dengan pengikut.", "Namun informasi lama dapat tenggelam di antara unggahan baru. Pelanggan baru sering tetap membutuhkan satu tempat untuk melihat detail yang lengkap."]), ("Apa yang kuat dari website", ["Website dapat diatur berdasarkan halaman sehingga katalog, harga, FAQ, dan kontak mudah ditemukan. Anda juga mengendalikan struktur dan alamatnya sendiri.", "Halaman website memiliki peluang muncul ketika orang mencari solusi atau nama usaha di Google, bahkan bila mereka belum mengikuti akun sosial Anda."]), ("Gunakan keduanya sebagai perjalanan pelanggan", ["Buat konten Instagram yang mengundang rasa ingin tahu, lalu arahkan ke halaman website yang menjawab detail. Contohnya, unggahan produk dapat mengarah ke katalog lengkap.", "Tombol WhatsApp pada website membantu perjalanan ini berakhir pada percakapan penjualan yang jelas."])], "faqs": [("Apakah bisnis kecil cukup memakai Instagram?", "Instagram bisa menjadi awal, tetapi website membantu ketika informasi dan katalog mulai bertambah."), ("Tautan apa yang sebaiknya ada di bio?", "Arahkan ke beranda atau halaman produk yang paling sering ditanyakan.")]},
])


# Short, focused briefs for the remaining topics.  The common body builder turns
# each brief into structured H2/H3 content and an FAQ/CTA suitable for publication.
_TOPIC_BRIEFS = [
    ("Cara Membuat Website Toko Online untuk UMKM", "cara-membuat-website-toko-online-umkm", "Website UMKM", "cara membuat website toko online UMKM", "website-toko-online-umkm", "Susun katalog, informasi pemesanan, dan kepercayaan pelanggan untuk toko online UMKM.", "katalog produk dan proses pemesanan yang sederhana", ["Kelompokkan produk menurut kebutuhan pelanggan", "Cantumkan foto, harga, varian, dan stok", "Berikan tombol pesan yang mudah ditemukan", "Jelaskan pengiriman serta pembayaran"], ["Katalog yang mudah dijelajahi", "Proses pesan yang tidak membingungkan", "Kepercayaan sebelum transaksi"]),
    ("Cara Menampilkan Produk UMKM di Website", "cara-menampilkan-produk-umkm-di-website", "Website UMKM", "cara menampilkan produk UMKM di website", "menampilkan-produk-umkm", "Panduan menyajikan produk UMKM di website agar pelanggan memahami manfaat, varian, dan cara pesan.", "katalog produk yang jelas dan mudah dipilih", ["Pilih foto utama yang terang", "Tulis nama dan manfaat produk", "Sertakan varian, ukuran, atau bahan", "Tambahkan ajakan untuk bertanya atau pesan"], ["Foto yang menjelaskan produk", "Deskripsi yang menjawab keraguan", "Urutan katalog yang memudahkan"]),
    ("Cara Membuat Website Jasa untuk Freelancer dan UMKM", "cara-membuat-website-jasa-freelancer-umkm", "Website Bisnis", "cara membuat website jasa", "website-jasa-freelancer-umkm", "Bangun website jasa yang membuat calon klien memahami keahlian, proses kerja, dan cara menghubungi Anda.", "penawaran jasa yang mudah dipahami calon klien", ["Tentukan jasa utama dan target klien", "Tampilkan contoh hasil atau portofolio", "Jelaskan proses kerja", "Sediakan kontak untuk konsultasi"], ["Memperjelas jasa utama", "Menampilkan portofolio dengan jujur", "Mengarahkan calon klien ke konsultasi"]),
    ("Cara Membuat Landing Page untuk Bisnis", "cara-membuat-landing-page-untuk-bisnis", "Pemasaran Digital", "cara membuat landing page", "landing-page-bisnis", "Pelajari susunan landing page yang fokus pada satu penawaran dan mendorong pengunjung mengambil tindakan.", "landing page dengan satu tujuan yang terukur", ["Pilih satu penawaran utama", "Tuliskan manfaat yang spesifik", "Gunakan bukti sosial", "Buat tombol tindakan yang terlihat"], ["Satu pesan untuk satu tujuan", "Membuat manfaat terasa konkret", "Mengurangi hambatan sebelum kontak"]),
    ("Cara Membuat Website yang Mudah Ditemukan di Google", "cara-membuat-website-mudah-ditemukan-di-google", "SEO UMKM", "website mudah ditemukan di Google", "website-mudah-ditemukan-google", "Dasar SEO yang membantu Google memahami isi website dan mempertemukannya dengan pencarian yang relevan.", "website yang dapat dipahami pelanggan dan mesin pencari", ["Gunakan judul halaman yang spesifik", "Tulis isi yang menjawab kebutuhan pencari", "Pastikan website nyaman di ponsel", "Perbarui informasi usaha secara rutin"], ["Menentukan topik yang dicari pelanggan", "Merapikan struktur halaman", "Membangun kebiasaan pembaruan"]),
    ("SEO Dasar untuk Website UMKM", "seo-dasar-untuk-website-umkm", "SEO UMKM", "SEO dasar website UMKM", "seo-dasar-website-umkm", "Panduan SEO dasar untuk UMKM: kata kunci, struktur halaman, konten bermanfaat, dan informasi lokal.", "optimasi dasar yang sehat dan bermanfaat", ["Pahami pertanyaan yang sering dicari", "Gunakan kata kunci secara alami", "Buat judul serta deskripsi halaman yang jelas", "Tautkan halaman yang saling relevan"], ["Riset kebutuhan pelanggan", "Menulis untuk manusia terlebih dahulu", "Menghindari pengulangan kata kunci"]),
    ("Cara Mendapatkan Pelanggan dari Google", "cara-mendapatkan-pelanggan-dari-google", "SEO UMKM", "cara mendapatkan pelanggan dari Google", "mendapatkan-pelanggan-dari-google", "Ubah pencarian Google menjadi peluang percakapan dengan memperjelas layanan, lokasi, dan tindakan berikutnya.", "pencarian yang relevan menjadi percakapan pelanggan", ["Buat halaman sesuai layanan atau produk", "Sebutkan area layanan secara wajar", "Tambahkan kontak dan jam respons", "Pantau pertanyaan yang paling sering masuk"], ["Menangkap niat pencarian", "Membantu pelanggan lokal menemukan usaha", "Membuat langkah kontak terasa mudah"]),
    ("Cara Menulis Deskripsi Produk yang Menarik", "cara-menulis-deskripsi-produk-yang-menarik", "Pemasaran Digital", "cara menulis deskripsi produk", "deskripsi-produk-menarik", "Tulis deskripsi produk yang jelas, manusiawi, dan membantu pelanggan memutuskan tanpa klaim berlebihan.", "deskripsi yang menjawab pertanyaan sebelum pelanggan bertanya", ["Mulai dari manfaat utama", "Sertakan detail yang dapat diperiksa", "Gunakan bahasa pelanggan", "Tutup dengan cara pemesanan"], ["Membedakan manfaat dan fitur", "Menjawab pertanyaan penting", "Menulis ajakan yang tidak memaksa"]),
    ("Cara Membuat Profil Bisnis yang Profesional", "cara-membuat-profil-bisnis-yang-profesional", "Website Bisnis", "cara membuat profil bisnis profesional", "profil-bisnis-profesional", "Susun profil bisnis yang menjelaskan identitas, layanan, dan alasan pelanggan dapat mempercayai usaha Anda.", "profil bisnis yang ringkas tetapi meyakinkan", ["Tulis siapa usaha Anda dan siapa yang dibantu", "Ceritakan nilai atau proses usaha", "Tampilkan bukti kepercayaan", "Perbarui kontak dan lokasi"], ["Menceritakan usaha secara fokus", "Membuktikan kualitas secara nyata", "Menjaga informasi tetap konsisten"]),
    ("Halaman yang Wajib Ada di Website UMKM", "halaman-yang-wajib-ada-di-website-umkm", "Website UMKM", "halaman wajib website UMKM", "halaman-wajib-website-umkm", "Kenali halaman inti yang membuat pelanggan UMKM mudah memahami usaha, memilih produk, dan menghubungi Anda.", "struktur halaman inti untuk perjalanan pelanggan", ["Buat beranda yang menjelaskan usaha", "Tambahkan produk atau layanan", "Sertakan profil dan bukti kepercayaan", "Buat halaman kontak yang jelas"], ["Peran beranda", "Katalog atau layanan", "Kontak dan informasi pendukung"]),
    ("Kesalahan Website UMKM yang Sering Terjadi", "kesalahan-website-umkm-yang-sering-terjadi", "Website UMKM", "kesalahan website UMKM", "kesalahan-website-umkm", "Hindari kesalahan website UMKM yang membuat pelanggan bingung atau sulit menghubungi usaha Anda.", "perbaikan kecil yang mengurangi kebingungan pelanggan", ["Periksa informasi kontak", "Pangkas isi yang tidak mendukung tujuan", "Gunakan foto dan teks yang mudah dibaca", "Uji website dari ponsel"], ["Informasi yang tidak lengkap", "Tombol kontak yang sulit ditemukan", "Website yang tidak dirawat"]),
    ("Cara Menghubungkan Website dengan WhatsApp", "cara-menghubungkan-website-dengan-whatsapp", "Pemasaran Digital", "cara menghubungkan website dengan WhatsApp", "website-dengan-whatsapp", "Permudah calon pelanggan memulai percakapan dengan menempatkan WhatsApp secara relevan di website bisnis.", "jalur WhatsApp yang nyaman bagi pelanggan", ["Gunakan nomor bisnis aktif", "Letakkan tombol pada halaman penting", "Siapkan pesan awal yang sopan", "Jelaskan waktu respons"], ["Lokasi tombol yang tepat", "Pesan awal yang membantu", "Menjaga ekspektasi respons"]),
    ("Cara Memilih Nama Domain untuk Bisnis", "cara-memilih-nama-domain-untuk-bisnis", "Website Bisnis", "cara memilih nama domain bisnis", "nama-domain-bisnis", "Pilih nama domain bisnis yang singkat, mudah diingat, dan tetap relevan saat usaha berkembang.", "alamat website yang mudah disebut dan dibagikan", ["Gunakan nama usaha bila tersedia", "Pilih ejaan yang mudah", "Hindari angka dan tanda hubung yang tidak perlu", "Amankan domain sebelum promosi"], ["Membuat domain mudah diingat", "Memilih ekstensi yang sesuai", "Menjaga identitas digital tetap konsisten"]),
    ("Cara Membuat Website UMKM Tanpa Bisa Coding", "cara-membuat-website-umkm-tanpa-bisa-coding", "Website UMKM", "membuat website UMKM tanpa coding", "website-umkm-tanpa-coding", "Mulai membuat website UMKM tanpa coding dengan fokus pada isi, struktur, dan pengalaman pelanggan.", "pembuatan website yang dapat dikelola pemilik usaha", ["Siapkan isi sebelum memilih template", "Pilih struktur yang sederhana", "Masukkan foto dan kontak asli", "Terbitkan lalu perbaiki dari masukan pelanggan"], ["Fokus pada informasi, bukan kerumitan teknis", "Memilih alat yang mudah dikelola", "Meluncurkan versi pertama lebih cepat"]),
    ("Panduan Digitalisasi UMKM untuk Pemula", "panduan-digitalisasi-umkm-untuk-pemula", "Digitalisasi UMKM", "digitalisasi UMKM untuk pemula", "panduan-digitalisasi-umkm", "Panduan awal digitalisasi UMKM yang realistis: rapikan informasi, bangun kehadiran online, dan gunakan data dari pelanggan.", "langkah digital yang bertahap dan sesuai kemampuan usaha", ["Petakan proses usaha saat ini", "Pilih masalah yang paling mendesak", "Rapikan katalog dan kontak digital", "Evaluasi hasil setiap bulan"], ["Memulai dari masalah pelanggan", "Menghubungkan kanal digital", "Membangun kebiasaan evaluasi"]),
]


def _brief_to_article(title, slug, category, keyword, image_name, excerpt, topic, steps, headings):
    sections = []
    body = [
        f"Untuk {topic}, mulailah dari hal yang paling sering ditanyakan pelanggan. Informasi yang mudah ditemukan menghemat waktu Anda dan membuat pengunjung lebih yakin.",
        "Jangan mencoba menyelesaikan semuanya dalam satu hari. Pilih satu perbaikan, uji dari ponsel, lalu catat pertanyaan yang masih muncul untuk pembaruan berikutnya.",
    ]
    for heading in headings:
        sections.append((heading, body))
    return {"title": title, "slug": slug, "category": category, "focusKeyword": keyword, "seoTitle": f"{title} | Situska", "excerpt": excerpt, "coverImageUrl": f"/images/articles/{image_name}.png", "coverImageAlt": f"Ilustrasi bisnis Indonesia untuk artikel {title}", "intro": f"{excerpt} Pendekatan terbaik adalah membuat langkah kecil yang menjawab kebutuhan pelanggan sekarang.", "steps": steps, "sections": sections, "faqs": [(f"Apakah {keyword} bisa dimulai dari usaha kecil?", "Bisa. Mulai dari informasi paling penting dan perbaiki berdasarkan pertanyaan pelanggan."), ("Apa langkah pertama yang paling aman?", "Pilih satu tujuan, siapkan informasi yang akurat, lalu uji hasilnya dari sudut pandang pelanggan.")]}


RAW_ARTICLES.extend(_brief_to_article(*brief) for brief in _TOPIC_BRIEFS)
PLATFORM_ARTICLES = [{**article, "content": _article(article)} for article in RAW_ARTICLES]
