# Hand Camera Portal (RetroLens)

Eksperimen kamera interaktif berbasis hand tracking (MediaPipe). Tangan pengguna berfungsi sebagai bingkai (portal) yang menerapkan efek filter kamera di area dalam bingkai.

Tersedia dalam dua versi:
- **Web (HTML, CSS, JS Canvas)**: Berjalan langsung di browser via MediaPipe Hands WebAssembly/WebGL.
- **Python (OpenCV)**: Berjalan secara lokal di desktop.

---

## Cara Menjalankan

### 1. Versi Web
Bisa langsung dijalankan secara lokal tanpa perlu kompilasi:

```bash
python server.py
```
atau menggunakan Node.js:
```bash
npx serve .
```
Buka browser di `http://localhost:8000`, lalu izinkan akses kamera.

*(Untuk pengguna Windows, bisa juga langsung klik file `start_web.bat`)*

### 2. Versi Desktop (Python)
```bash
pip install -r requirements.txt
python hand_portal.py
```

---

## Fitur & Kontrol

- **Portal 2 Tangan**: Arahkan kedua tangan ke kamera. Ujung jari telunjuk dan jempol kiri & kanan akan membentuk 4 sudut portal.
- **Pinch (Ganti Filter)**: Sentuhkan telunjuk dan jempol untuk berganti filter otomatis.
- **Air Draw (1 Jari)**: Angkat satu jari telunjuk untuk menggambar langsung di layar.
- **Pilihan Filter**: Mono, Warm Film, Noir, Cyberpunk, Thermal (Heatmap), Vivid, Matrix, Glitch.
- **Foto & Video**: Mendukung foto snapshot dan perekaman video singkat (.webm).
- **Mode Mouse**: Tekan tombol `M` untuk mencoba portal secara manual menggunakan drag mouse tanpa kamera.

### Pintasan Keyboard (Web)

| Tombol | Aksi |
|---|---|
| `1` - `8` | Pilih filter lensa |
| `Space` / `S` | Ambil foto snapshot |
| `R` | Mulai / stop rekam video |
| `C` | Bersihkan coretan kanvas |
| `M` | Mode mouse (simulasi manual) |
| `F` | Layar penuh (fullscreen) |

---

## Deploy ke Vercel

Versi web murni client-side (static), sehingga bisa langsung di-host di Vercel:

1. Push repository ini ke GitHub.
2. Import project di dashboard [Vercel](https://vercel.com).
3. Pada opsi **Application Preset**, pilih **Other** (bukan Python).
4. Klik **Deploy**.