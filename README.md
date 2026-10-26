# 📷 RETROLENS — Hand Camera Portal (TikTok Viral)

Aplikasi kamera futuristik bergaya **Retro-Camcorder & Cyberpunk** dengan AI Hand Tracking real-time (MediaPipe). Tersedia dalam **Versi Web Browser (HTML/JS/Canvas)** dan **Versi Desktop (Python/OpenCV)**.

---

## 🌟 Versi Web (Web Edition) — BARU!

Versi Web berjalan langsung di browser (Google Chrome / Microsoft Edge / Safari / Firefox) tanpa perlu instalasi Python atau compiler C++. Menggunakan akselerasi WebGL/WASM MediaPipe Hands.

### 🚀 Cara Menjalankan Versi Web

#### Cara 1: Menggunakan Python Server (Otomatis Buka Browser)
```bash
python server.py
```
atau klik dua kali file **`start_web.bat`** di Windows Explorer.

#### Cara 2: Menggunakan Node.js
```bash
npm start
# atau
npx serve .
```

Buka URL: **`http://localhost:8000`**

### 🌐 Cara Hosting ke Vercel (Gratis & Mendukung Kamera HTTPS)

Aplikasi web ini **100% Client-Side** (Static HTML, CSS, JavaScript) sehingga **sangat cocok dan langsung bisa dideploy ke Vercel**:

#### Opsi A: Menggunakan Vercel CLI di Terminal
```bash
npx vercel
```
Ikuti instruksi di layar (pilih `Y`, set project name, dan tekan Enter). Dalam 30 detik web akan langsung aktif di domain `https://nama-proyek.vercel.app`!

#### Opsi B: Menggunakan GitHub
1. Commit & Push repository ini ke akun GitHub Anda:
   ```bash
   git add .
   git commit -m "feat: web edition retrolens hand portal"
   git push origin main
   ```
2. Buka [vercel.com](https://vercel.com) lalu login.
3. Klik **"Add New Project"** -> Import repository GitHub Anda.
4. Pada bagian *Build & Development Settings*, biarkan default (*Other/None* karena ini pure static web).
5. Klik **"Deploy"**!

> **Penting untuk Kamera:** Browser (Chrome/Safari/Edge) **mewajibkan protokol HTTPS** agar izin webcam bisa dibuka saat diakses online. Vercel secara otomatis memberikan sertifikat SSL / HTTPS gratis, sehingga kamera langsung bisa digunakan di HP maupun Laptop!

---

## ✨ Fitur-Fitur Utama Versi Web

1. **Dual Hand Portal Frame (2 Tangan)**:
   - Arahkan kedua tangan ke kamera.
   - Ujung telunjuk dan jempol kiri & kanan membentuk bingkai portal 4 sudut (quadrilateral) fleksibel.
   - Pergerakan portal distabilkan dengan *exponential smoothing* (lerp) agar mulus tanpa getar.

2. **8 Pilihan Filter Lensa Retro & Sci-Fi**:
   - `MONO 35MM`: Hitam putih klasik dengan kontras kurva S (CLAHE).
   - `WARM FILM`: Warna hangat vintage film 35mm golden hour.
   - `NOIR KONTRAS`: Film noir dramatis dengan kontras tinggi.
   - `CYBERPUNK`: Gradasi neon cyan & hot magenta synthwave.
   - `THERMAL FLIR`: Sensor panas inframerah (Jet Heatmap colormap).
   - `VIVID POP`: Saturasi warna pop-art cerah.
   - `MATRIX GREEN`: Tampilan terminal CRT fosfor hijau.
   - `RGB GLITCH`: Efek dispersi chromatic aberration RGB split.

3. **Gestur Pintar AI**:
   - 🤏 **Pinch / Sentuh**: Sentuhkan ujung telunjuk & jempol, atau sentuhkan kedua tangan = **Ganti Filter Otomatis** dengan efek kilat kuning/cyan & efek suara synth!
   - ☝️ **Air Drawing (Coretan 1 Jari Telunjuk)**: Angkat jari telunjuk dengan jari lain ditekuk = Langsung melukis cahaya neon pelangi dinamis di udara!

4. **Audio Synthesizer (Web Audio API)**:
   - Efek suara kamera SLR mekanikal saat ambil foto.
   - Efek suara sci-fi saat filter berganti.
   - Efek laser spark saat gestur pinch.
   - Efek swoosh saat membersihkan kanvas.

5. **Tangkapan Layar & Rekam Video TikTok**:
   - **Foto Snapshot**: Tombol Shutter / `SPACE` untuk mengambil foto dengan animasi flash layar putih.
   - **Rekam Video**: Tombol Rekam / `R` untuk merekam klip video pendek TikTok (.webm) lengkap dengan filter & efek visual.
   - **Galeri Internal**: Modal galeri untuk melihat hasil foto & rekaman video serta mengunduhnya langsung.

6. **Efek CRT Scanlines & Film Grain**:
   - Tingkat grain film analog: `OFF`, `MED`, `HIGH`.
   - Toggle garis scanline retro CRT.

7. **Mode Mouse Demo (Tanpa Kamera)**:
   - Tombol `M` / Mouse Mode: Dapat menggeser 4 pin sudut portal secara manual dengan mouse atau sentuhan jari di layar touchscreen.

---

## ⌨️ Pintasan Tombol Keyboard (Web)

| Tombol | Fungsi |
|---|---|
| `1` s/d `8` | Pilih Filter Lensa secara instan |
| `SPACE` / `S` | Ambil Foto Snapshot |
| `R` | Mulai / Berhenti Rekam Klip Video |
| `C` | Bersihkan Kanvas Coretan Telunjuk (*Clear Canvas*) |
| `G` | Ganti Tingkat Noise Film Grain (`OFF` / `MED` / `HIGH`) |
| `H` | Sembunyikan / Tampilkan Overlay HUD Retro |
| `M` | Toggle Mode Simulasi Mouse (Draggable Pins) |
| `F` | Mode Layar Penuh (*Fullscreen*) |
| `?` | Buka / Tutup Modal Panduan |

---

## 🐍 Versi Python Desktop (Original)

Jika ingin menjalankan versi OpenCV Python di desktop:

1. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
2. Jalankan aplikasi:
   ```bash
   python hand_portal.py
   ```