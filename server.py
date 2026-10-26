"""
RETROLENS HAND PORTAL — Local Web Server
Menjalankan server web lokal dan membuka aplikasi di browser secara otomatis.
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Tambahkan header CORS & Cache-Control untuk pengembangan lokal
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def run_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    global PORT
    for attempt in range(10):
        try:
            with socketserver.TCPServer(("", PORT), Handler) as httpd:
                url = f"http://localhost:{PORT}"
                print("==================================================")
                print(f"  RETROLENS — HAND PORTAL (WEB EDITION)")
                print(f"  Server berjalan di: {url}")
                print("  Tekan Ctrl+C untuk menghentikan server.")
                print("==================================================")
                try:
                    webbrowser.open(url)
                except Exception:
                    pass
                httpd.serve_forever()
                break
        except OSError as e:
            if "address already in use" in str(e).lower() or e.errno == 10048:
                PORT += 1
            else:
                raise e

if __name__ == '__main__':
    try:
        run_server()
    except KeyboardInterrupt:
        print("\n[INFO] Server RetroLens dihentikan.")
        sys.exit(0)
