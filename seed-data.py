#!/usr/bin/env python3
"""Generate seed data for reviews and questions for all 41 active products.
Pair each question with a matching answer, ISO dates, deterministic seed.
"""
import random
from datetime import datetime, timedelta

products = [
    "10872317587","13274984851","15385697887","16193594055","17994049061",
    "19388921381","19626400134","19841698925","20105689734","20466210838",
    "21071586903","21273610821","22247196466","23025176108","23741161442",
    "23831086635","26407198004","26563460320","26655777160","27055776375",
    "28105782646","28705778723","28735365213","29105779392","29463366459",
    "29885375428","2989637717","40160203396","4089799202","41211893528",
    "42913512162","46255396788","49604417637","50911445090","52802005784",
    "53212166741","56003491052","57108069246","6096013163","8847526287",
    "8958440272",
]

product_names = {
    "26563460320": "OPP Lem Tipis 7x15-15x15",
    "6096013163": "OPP Lem 7x16-16x16",
    "46255396788": "OPP Double Seal 7x22-20x22",
    "8847526287": "OPP Lem 8x14-15x14",
    "23741161442": "OPP Lem 7x25-25x25",
    "8958440272": "OPP Lem Tipis 7x18-17x18",
    "4089799202": "OPP Baju Lem 15x30-30x30",
    "19841698925": "OPP Lem Tipis 7x22-20x22",
    "49604417637": "OPP Double Seal 7x23-20x23",
    "26407198004": "OPP Double Seal Premium",
    "53212166741": "OPP 29 Mic 6x20-17x20",
    "15385697887": "OPP Baju Tebal 15x30-30x30",
    "23831086635": "OPP Baju Garment 18x42-40x42",
    "56003491052": "OPP Double Seal 7x17-17x17",
    "21071586903": "OPP Lem Tebal 6x10-12x10",
    "20105689734": "OPP Lem Undangan 7x20-20x20",
    "22247196466": "OPP Lem Kue 6x12-12x12",
    "21273610821": "OPP Lem Undangan 10x21-19x21",
    "13274984851": "OPP Roti 6x15-15x15",
    "29885375428": "OPP Roti 6x13-15.5x13",
    "20466210838": "OPP Lem 7x25-16x25",
    "28735365213": "OPP Roti Kopi 6x15-15x15",
    "2989637717": "OPP Bening 10x18-17x18",
    "28105782646": "OPP Gusset Roti 25x35-30x35",
    "29463366459": "OPP Gusset 20x30-27x30",
    "29105779392": "OPP Lem Super Tebal 8x28-25x28",
    "19626400134": "OPP Garment Tebal 13.5x40-35x40",
    "23025176108": "OPP Lem Super Tebal 10x20-19x20",
    "28705778723": "OPP Tanpa Lem 10x30-18x30",
    "27055776375": "OPP Tanpa Lem 15x42-35x42",
    "26655777160": "OPP Tanpa Lem 20x30-30x35",
    "52802005784": "OPP Tanpa Lem 8x20-17x20",
    "17994049061": "Ziplock Standar 16x25-35x45",
    "16193594055": "Klip Ziplock 3x5-6x10",
    "40160203396": "Klip Ziplock 7x10-12x20",
    "57108069246": "OPP Double Seal 6x18-17x18",
    "10872317587": "OPP Lem 15x36-35x36",
    "50911445090": "OPP 26 Mic 9x21-18x21",
    "19388921381": "OPP Tanpa Lem 8x22-17x22",
    "41211893528": "OPP Double Seal 7x14-14x14",
    "42913512162": "OPP Double Press 8x16-16x16",
}

review_names = [
    "Sari Wulandari", "Budi Hartono", "Dewi Ratnasari", "Agus Pratama",
    "Rina Marlina", "Hendra Gunawan", "Fitri Handayani", "Dani Ramdani",
    "Mega Sari", "Andi Prayitno", "Rina Amelia", "Dewi Sartika",
]

review_comments = [
    "Bagus banget, kualitasnya sesuai pesanan. Packing rapi, pengiriman cepat. Makasih!",
    "Udah langganan, selalu puas. Plastiknya tebal dan kuat. Recommended!",
    "Murah meriah, cocok buat jualan kecil-kecilan. Kualitas lumayan buat harga segini.",
    "Double seal-nya beneran rapet, udah diuji coba buat kue kering, aman bocor.",
    "Ukuran sesuai deskripsi, ga ngurang. Isi 100 pas. Pasti order lagi.",
    "Pengiriman cepet banget, barang sampe dalam kondisi baik. Makasih seller.",
    "Kualitas OK, harga bersahabat. Cocok buat usaha rumahan. Saran: varian ukuran ditambah.",
    "Tebal dan kuat, ga gampang sobek. Udah repeat order 3 kali. Memang langganan.",
    "Barang sesuai foto, pengiriman aman. Lumayan buat stok jualan.",
    "Mantap! Plastiknya tebal, seal-nya kuat. Bisa buat packing kue kering dan roti.",
    "Kualitas oke punya, harganya terjangkau. Recommended buat temen-temen.",
    "Cocok buat packing souvenir dan aksesoris. Double seal bikin lebih aman.",
    "Barang sampai cepat, kualitas terjamin. Langganan tetap di sini.",
    "Mantap jiwa! Udah 5 kali order, selalu puas. Seller ramah fast respon.",
    "Bisa mix ukuran, jadi praktis. Ga perlu beli banyak pack. Recomended!",
]

# Question -> matching answer pairs
qa_pairs = [
    ("Apakah plastik ini food grade? Mau buat bungkus kue kering.",
     "Iya aman food grade, sudah banyak dipakai buat kue kering dan roti."),
    ("Kalau beli mix ukuran, minimal berapa ya?",
     "Minimal 1 pack aja sudah bisa, dalam 1 pack boleh campur 2-3 ukuran."),
    ("Estimasi pengiriman ke Jakarta berapa lama?",
     "Jabodetabek 1-2 hari kerja via SiCepat/JNE ya kak."),
    ("Apakah ada yang ukuran lebih kecil lagi?",
     "Ukuran yg tersedia sesuai listing. Kalau butuh ukuran lain bisa chat admin."),
    ("Bisa request ukuran tertentu yang tidak ada di listing?",
     "Bisa, silakan chat admin untuk request ukuran khusus ya."),
    ("Kualitasnya tebal atau tipis? Untuk packing roti.",
     "Ada dua varian: standar (tipis) dan tebal/double seal. Sesuai kebutuhan roti kak."),
    ("Apakah ada garansi kalau plastiknya rusak?",
     "Ada, kalau ada masalah silakan foto dan kirim ke admin, nanti kami ganti."),
    ("Minimal order berapa pack?",
     "Minimal 1 pack aja sudah bisa langsung checkout kak."),
    ("Apakah tersedia warna lain selain bening?",
     "Saat ini ready bening. Untuk warna lain bisa pre-order via admin."),
    ("Untuk plastik gusset, apakah sekalian dikasih kawat?",
     "Iya, gusset sudah termasuk kawatnya, tinggal dipakai."),
    ("Berapa lama ketahanan seal-nya? Apakah mudah lepas?",
     "Seal kuat dan tahan lama, double press jadi rapet dan aman."),
    ("Apakah bisa dijadikan sampel dulu sebelum beli banyak?",
     "Bisa, silakan hubungi admin untuk permintaan sampel ya kak."),
    ("Pengiriman ke luar Jawa berapa lama ya?",
     "Luar Jawa estimasi 3-5 hari kerja tergantung kurir yang dipilih."),
    ("Apakah harga ini sudah termasuk ongkir?",
     "Belum termasuk ongkir kak. Ongkir dihitung otomatis saat checkout."),
    ("Bisa titip pesan via WA?",
     "Bisa, chat admin di nomor yang tertera di halaman kontak ya."),
]

random.seed(42)
now = datetime(2026, 8, 27)
sql_lines = []

# ── Reviews: 3 per product ──
review_id = 0
for pid in products:
    used_names = random.sample(review_names, 3)
    dates = sorted(now - timedelta(days=random.randint(1, 45)) for _ in range(3))
    ratings = sorted([random.choice([4, 5]), random.choice([4, 5]), random.choice([3, 4, 5])], reverse=True)
    avail = review_comments.copy()
    random.shuffle(avail)
    selected = avail[:3]
    for i in range(3):
        review_id += 1
        rid = f"seed-r{review_id:04d}"
        date_iso = dates[i].strftime("%Y-%m-%dT%H:%M:%S.000Z")
        verified = 1 if ratings[i] >= 4 else 0
        sql_lines.append(
            f"INSERT OR IGNORE INTO reviews (id, product_id, user_id, user_name, rating, comment, date, verified) "
            f"VALUES ('{rid}', '{pid}', '', '{used_names[i]}', {ratings[i]}, "
            f"'{selected[i].replace(chr(39), chr(39)+chr(39))}', '{date_iso}', {verified});"
        )

# ── Questions: 3 per product, matched Q+A ──
q_id = 0
for pid in products:
    used_names = random.sample(review_names, 3)
    dates = sorted(now - timedelta(days=random.randint(1, 45)) for _ in range(3))
    ans_dates = [d + timedelta(hours=random.randint(1, 48)) for d in dates]
    pname = product_names.get(pid, "Produk")
    pairs = qa_pairs.copy()
    random.shuffle(pairs)
    selected = pairs[:3]
    for i in range(3):
        q_id += 1
        qid = f"seed-q{q_id:04d}"
        q_text, a_text = selected[i]
        date_iso = dates[i].strftime("%Y-%m-%dT%H:%M:%S.000Z")
        ans_iso = ans_dates[i].strftime("%Y-%m-%dT%H:%M:%S.000Z")
        sql_lines.append(
            f"INSERT OR IGNORE INTO questions (id, product_id, product_name, question, answer, user_name, date, answered_at, user_id) "
            f"VALUES ('{qid}', '{pid}', '{pname}', "
            f"'{q_text.replace(chr(39), chr(39)+chr(39))}', '{a_text.replace(chr(39), chr(39)+chr(39))}', "
            f"'{used_names[i]}', '{date_iso}', '{ans_iso}', '');"
        )

sql_content = "\n".join(sql_lines)
print(f"Generated {len(sql_lines)} INSERT statements (reviews={review_id}, questions={q_id})")
with open("/home/ubuntu/murah-plastic/seed-data.sql", "w") as f:
    f.write(sql_content)
print("Saved to seed-data.sql")