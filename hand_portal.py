import cv2
import numpy as np
import math
import time
import random
import os
import urllib.request
from datetime import datetime

# ==========================================
# MEDIAPIPE TASK MODEL AUTO-DOWNLOADER
# ==========================================
MODEL_PATH = "hand_landmarker.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

def ensure_model_file():
    if not os.path.exists(MODEL_PATH):
        print(f"[SYSTEM] Mengunduh model {MODEL_PATH}...")
        try:
            urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
            print("[SYSTEM] Model MediaPipe HandLandmarker berhasil diunduh!")
        except Exception as e:
            print(f"[WARN] Gagal mengunduh model: {e}")

ensure_model_file()

HAS_MEDIAPIPE_TASKS = False
try:
    import mediapipe as mp
    if hasattr(mp, 'tasks') and hasattr(mp.tasks, 'vision'):
        HAS_MEDIAPIPE_TASKS = True
except Exception:
    HAS_MEDIAPIPE_TASKS = False

# ==========================================
# RETRO LENS FILTERS & IMAGE PROCESSING
# ==========================================
CLAHE = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
rng = np.random.default_rng(42)

def abu(roi):
    return cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

def ke_bgr(g):
    return cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)

def add_grain(img, intensity=18):
    h, w = img.shape[:2]
    noise = rng.normal(0, intensity, (h, w)).astype(np.int16)
    if len(img.shape) == 3:
        noise = np.stack([noise] * 3, axis=-1)
    res = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return res

def filter_mono(roi, t, grain_level=18):
    if roi.size == 0:
        return roi
    gray = abu(roi)
    clahe_img = CLAHE.apply(gray)
    bgr = ke_bgr(clahe_img)
    if grain_level > 0:
        bgr = add_grain(bgr, grain_level)
    return bgr

def filter_kontras(roi, t, grain_level=12):
    if roi.size == 0:
        return roi
    gray = abu(roi)
    contrast = cv2.equalizeHist(gray)
    bgr = ke_bgr(contrast)
    if grain_level > 0:
        bgr = add_grain(bgr, grain_level)
    return bgr

def filter_film(roi, t, grain_level=20):
    if roi.size == 0:
        return roi
    gray = abu(roi)
    clahe_img = CLAHE.apply(gray)
    bgr = ke_bgr(clahe_img)
    
    b, g, r = cv2.split(bgr)
    r = np.clip(r.astype(np.int16) + 20, 0, 255).astype(np.uint8)
    g = np.clip(g.astype(np.int16) + 10, 0, 255).astype(np.uint8)
    b = np.clip(b.astype(np.int16) - 15, 0, 255).astype(np.uint8)
    warm_bgr = cv2.merge([b, g, r])
    
    if grain_level > 0:
        warm_bgr = add_grain(warm_bgr, grain_level)
    return warm_bgr

def filter_cyber(roi, t, grain_level=10):
    if roi.size == 0:
        return roi
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    h = ((h.astype(np.int16) + 90) % 180).astype(np.uint8)
    s = np.clip(s.astype(np.int16) + 50, 0, 255).astype(np.uint8)
    cyber = cv2.cvtColor(cv2.merge([h, s, v]), cv2.COLOR_HSV2BGR)
    if grain_level > 0:
        cyber = add_grain(cyber, grain_level)
    return cyber

def filter_thermal(roi, t, grain_level=5):
    if roi.size == 0:
        return roi
    gray = abu(roi)
    heatmap = cv2.applyColorMap(gray, cv2.COLORMAP_JET)
    if grain_level > 0:
        heatmap = add_grain(heatmap, grain_level)
    return heatmap

def filter_vivid(roi, t, grain_level=0):
    if roi.size == 0:
        return roi
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    s = np.clip(s.astype(np.int16) * 1.5, 0, 255).astype(np.uint8)
    v = np.clip(v.astype(np.int16) * 1.1, 0, 255).astype(np.uint8)
    vivid = cv2.cvtColor(cv2.merge([h, s, v]), cv2.COLOR_HSV2BGR)
    if grain_level > 0:
        vivid = add_grain(vivid, grain_level)
    return vivid

FILTER_MODES = [
    ("MONO", filter_mono),
    ("FILM", filter_film),
    ("KONTRAS", filter_kontras),
    ("CYBER", filter_cyber),
    ("THERMAL", filter_thermal),
    ("VIVID", filter_vivid)
]

# ==========================================
# DUAL HAND TRACKER USING MEDIAPIPE TASKS
# ==========================================
class RetrolensHandTracker:
    def __init__(self):
        self.landmarker = None
        self.use_tasks = False
        
        if HAS_MEDIAPIPE_TASKS and os.path.exists(MODEL_PATH):
            try:
                BaseOptions = mp.tasks.BaseOptions
                HandLandmarker = mp.tasks.vision.HandLandmarker
                HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
                VisionRunningMode = mp.tasks.vision.RunningMode

                options = HandLandmarkerOptions(
                    base_options=BaseOptions(model_asset_path=MODEL_PATH),
                    running_mode=VisionRunningMode.IMAGE,
                    num_hands=2,
                    min_hand_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                self.landmarker = HandLandmarker.create_from_options(options)
                self.use_tasks = True
                print("[SYSTEM] MediaPipe Tasks HandLandmarker 2-Hands berhasil diaktifkan.")
            except Exception as e:
                print(f"[WARN] MediaPipe Tasks error: {e}")
                self.use_tasks = False

    def detect_hands(self, frame):
        """
        Mendeteksi 2 tangan dan mengembalikan 4 titik sudut bingkai (quad):
        [Top-Left (L_Index), Bottom-Left (L_Thumb), Bottom-Right (R_Thumb), Top-Right (R_Index)]
        serta status pinch (sentuhan telunjuk-jempol kedua tangan).
        """
        h, w, _ = frame.shape
        if self.use_tasks and self.landmarker is not None:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            result = self.landmarker.detect(mp_image)

            if result.hand_landmarks and len(result.hand_landmarks) >= 2:
                hand1 = result.hand_landmarks[0]
                hand2 = result.hand_landmarks[1]

                cx1 = hand1[0].x
                cx2 = hand2[0].x
                
                left_hand = hand1 if cx1 < cx2 else hand2
                right_hand = hand2 if cx1 < cx2 else hand1

                # Top-Left (Left Index), Bottom-Left (Left Thumb)
                l_index = (int(left_hand[8].x * w), int(left_hand[8].y * h))
                l_thumb = (int(left_hand[4].x * w), int(left_hand[4].y * h))
                # Bottom-Right (Right Thumb), Top-Right (Right Index)
                r_thumb = (int(right_hand[4].x * w), int(right_hand[4].y * h))
                r_index = (int(right_hand[8].x * w), int(right_hand[8].y * h))

                # Hitung jarak pinch telunjuk & jempol pada kedua tangan
                dist_l = math.hypot(l_index[0] - l_thumb[0], l_index[1] - l_thumb[1])
                dist_r = math.hypot(r_index[0] - r_thumb[0], r_index[1] - r_thumb[1])
                dist_touch = math.hypot(l_index[0] - r_index[0], l_index[1] - r_index[1])

                # Pinch/touch terdeteksi jika jari tangan menyentuh (distance < 45px)
                is_pinched = (dist_l < 45 and dist_r < 45) or (dist_touch < 50)

                skeleton = []
                for hand in [left_hand, right_hand]:
                    pts = [(int(lm.x * w), int(lm.y * h)) for lm in hand]
                    skeleton.append(pts)

                return True, [l_index, l_thumb, r_thumb, r_index], skeleton, is_pinched

            elif result.hand_landmarks and len(result.hand_landmarks) == 1:
                hand = result.hand_landmarks[0]
                pts = [(int(lm.x * w), int(lm.y * h)) for lm in hand]
                
                idx_tip = (int(hand[8].x * w), int(hand[8].y * h))
                tmb_tip = (int(hand[4].x * w), int(hand[4].y * h))
                
                dx = idx_tip[0] - tmb_tip[0]
                dy = idx_tip[1] - tmb_tip[1]
                
                dist_pinch = math.hypot(dx, dy)
                is_pinched = dist_pinch < 40

                p1 = (tmb_tip[0] - dy, tmb_tip[1] + dx)
                p2 = tmb_tip
                p3 = idx_tip
                p4 = (idx_tip[0] - dy, idx_tip[1] + dx)
                
                return True, [p1, p2, p3, p4], [pts], is_pinched

        return False, [], [], False

    def close(self):
        if self.landmarker is not None:
            self.landmarker.close()

# ==========================================
# MOUSE SIMULATION CORNERS
# ==========================================
mouse_pts = [(300, 200), (300, 520), (980, 520), (980, 200)]
active_corner_idx = -1

def mouse_callback(event, x, y, flags, param):
    global active_corner_idx, mouse_pts
    if event == cv2.EVENT_LBUTTONDOWN:
        dists = [math.hypot(x - px, y - py) for px, py in mouse_pts]
        min_d = min(dists)
        if min_d < 50:
            active_corner_idx = dists.index(min_d)
        else:
            active_corner_idx = -1
    elif event == cv2.EVENT_MOUSEMOVE and active_corner_idx != -1:
        mouse_pts[active_corner_idx] = (x, y)
    elif event == cv2.EVENT_LBUTTONUP:
        active_corner_idx = -1

# ==========================================
# MAIN RETROLENS HAND PORTAL APPLICATION
# ==========================================
def main():
    print("==================================================")
    print("      RETROLENS - HAND PORTAL CAMERA FRAME")
    print("==================================================")
    print("Fitur Gestur Pintu Portal:")
    print("  * Dekatkan/Sentuhkan Telunjuk & Jempol Kedua Tangan -> Ganti Filter Otomatis!")
    print("  * Bila Tangan Tidak Terdeteksi -> Tampilan Frame Bersih Tanpa Box Overlay")
    print("Panduan Tombol:")
    print("  [1 - 6]   : Ganti Manual Filter Lens")
    print("  [SPACE/S] : Ambil Foto / Tangkap Layar Frame Portal")
    print("  [G]       : Ganti Tingkat Film Grain Noise (OFF / LIGHT / HEAVY)")
    print("  [H]       : Toggle Tampilan HUD Overlay")
    print("  [M]       : Toggle Mode Manual / Mouse Demo")
    print("  [Q / ESC] : Keluar Aplikasi")
    print("==================================================")

    os.makedirs("captures", exist_ok=True)

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("ERROR: Tidak dapat membuka webcam! Menggunakan Canvas Hitam.")

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    tracker = RetrolensHandTracker()

    cv2.namedWindow("RETROLENS - Hand Camera Portal")
    cv2.setMouseCallback("RETROLENS - Hand Camera Portal", mouse_callback)

    filter_idx = 0
    grain_levels = [18, 35, 0]
    grain_idx = 0
    show_hud = True
    mouse_mode = False
    photo_count = 0
    flash_frames = 0
    
    # Cooldown & Debounce untuk Gestur Pinch/Touch Filter Switch
    pinch_triggered = False
    pinch_flash_frames = 0

    smooth_quad = np.array([[320, 180], [320, 540], [960, 540], [960, 180]], dtype=np.float32)

    frame_count = 0
    prev_time = time.time()

    while True:
        if cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        else:
            frame = np.zeros((720, 1280, 3), dtype=np.uint8)

        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape

        hand_detected = False
        quad_pts = []
        skeletons = []
        is_pinched = False

        if not mouse_mode:
            hand_detected, quad_pts, skeletons, is_pinched = tracker.detect_hands(frame)

        # Handle Gestur Touch / Pinch untuk Ganti Filter Otomatis
        if is_pinched:
            if not pinch_triggered:
                filter_idx = (filter_idx + 1) % len(FILTER_MODES)
                pinch_triggered = True
                pinch_flash_frames = 6
                print(f"[GESTUR GANTI FILTER] Filter Otomatis Diubah Ke: {FILTER_MODES[filter_idx][0]}")
        else:
            pinch_triggered = False

        output_frame = frame.copy()

        # ==========================================
        # JIKA TANGAN TERDETEKSI ATAU MODE MOUSE
        # ==========================================
        if (hand_detected and len(quad_pts) == 4) or mouse_mode:
            if mouse_mode:
                target_quad = np.array(mouse_pts, dtype=np.float32)
            else:
                target_quad = np.array(quad_pts, dtype=np.float32)
                
            smooth_quad = smooth_quad * 0.65 + target_quad * 0.35
            pts_int = smooth_quad.astype(np.int32)
            p1, p2, p3, p4 = pts_int[0], pts_int[1], pts_int[2], pts_int[3]

            min_x = max(0, min(p1[0], p2[0], p3[0], p4[0]))
            max_x = min(w, max(p1[0], p2[0], p3[0], p4[0]))
            min_y = max(0, min(p1[1], p2[1], p3[1], p4[1]))
            max_y = min(h, max(p1[1], p2[1], p3[1], p4[1]))
            
            roi_w = max_x - min_x
            roi_h = max_y - min_y

            # 1. APPLY FILTER INSIDE QUAD MASK
            if roi_w > 20 and roi_h > 20:
                mask = np.zeros((h, w), dtype=np.uint8)
                cv2.fillPoly(mask, [pts_int], 255)

                filter_name, filter_func = FILTER_MODES[filter_idx]
                current_grain = grain_levels[grain_idx]
                
                roi = frame[min_y:max_y, min_x:max_x]
                filtered_roi = filter_func(roi, frame_count, current_grain)

                filtered_full = frame.copy()
                filtered_full[min_y:max_y, min_x:max_x] = cv2.resize(filtered_roi, (roi_w, roi_h))

                portal_view = cv2.bitwise_and(filtered_full, filtered_full, mask=mask)
                cam_view = cv2.bitwise_and(output_frame, output_frame, mask=cv2.bitwise_not(mask))
                output_frame = cv2.add(cam_view, portal_view)

            # 2. DRAW HAND SKELETON WIREFRAME
            for skel in skeletons:
                for pt in skel:
                    cv2.circle(output_frame, pt, 2, (180, 180, 180), -1)
                if len(skel) > 8:
                    cv2.line(output_frame, skel[4], skel[8], (100, 200, 255), 1)

            # 3. DRAW GLOWING QUAD LINES & CORNER NODES
            line_color = (0, 255, 255) if pinch_flash_frames > 0 else (255, 230, 0)
            cv2.line(output_frame, tuple(p1), tuple(p4), line_color, 2)
            cv2.line(output_frame, tuple(p4), tuple(p3), line_color, 2)
            cv2.line(output_frame, tuple(p3), tuple(p2), line_color, 2)
            cv2.line(output_frame, tuple(p2), tuple(p1), line_color, 2)
            cv2.line(output_frame, tuple(p1), tuple(p3), (120, 220, 255), 1)

            for pt in [p1, p2, p3, p4]:
                node_color = (0, 255, 255) if pinch_flash_frames > 0 else (255, 200, 0)
                cv2.circle(output_frame, tuple(pt), 7, node_color, -1)
                cv2.circle(output_frame, tuple(pt), 9, (255, 255, 255), 2)
                cv2.circle(output_frame, tuple(pt), 3, (0, 0, 0), -1)

            # Spark effect when pinched
            if pinch_flash_frames > 0:
                for pt in [p1, p2, p3, p4]:
                    cv2.circle(output_frame, tuple(pt), 16, (0, 255, 255), 2)
                pinch_flash_frames -= 1

            # 4. DRAW RETRO HUD OVERLAY
            frame_count += 1
            curr_time = time.time()
            fps = int(1.0 / (curr_time - prev_time + 1e-6))
            prev_time = curr_time

            filter_name, _ = FILTER_MODES[filter_idx]

            dx1 = p4[0] - p1[0]
            dy1 = p4[1] - p1[1]
            roll = int(math.degrees(math.atan2(dy1, dx1 + 1e-5)))
            pitch = int((p2[1] - p1[1]) * 0.1) - 10
            yaw = int((p3[0] - p2[0]) * 0.1) - 10

            if show_hud:
                # REC Indicator
                rec_x = min_x + 15
                rec_y = min_y + 25
                if rec_x < w and rec_y < h:
                    if (frame_count // 15) % 2 == 0:
                        cv2.circle(output_frame, (rec_x, rec_y), 6, (0, 0, 255), -1)
                    cv2.putText(output_frame, "REC", (rec_x + 12, rec_y + 4),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

                # Date Timestamp
                now_str = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
                time_x = max_x - 190
                time_y = min_y + 25
                if time_x > 0 and time_y < h:
                    cv2.putText(output_frame, now_str, (time_x, time_y),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (230, 230, 230), 1)

                # Filter & ROI Header
                top_info = f"{filter_name} {roi_w}x{roi_h}"
                cv2.putText(output_frame, top_info, (min_x + (roi_w // 2) - 50, max(25, min_y - 10)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 230, 255), 1)

                # Bottom Left Frame Info
                hud_bot_left = f"LENSA | {filter_name} | FPS {fps} | FOTO {photo_count}"
                cv2.putText(output_frame, hud_bot_left, (min_x + 10, max(h - 15, min(h - 10, max_y + 20))),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

                # Bottom Right Pitch/Roll/Yaw
                hud_bot_right = f"ROLL {roll} PITCH {pitch} YAW {yaw}"
                cv2.putText(output_frame, hud_bot_right, (max_x - 200, max(h - 15, min(h - 10, max_y + 20))),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 255), 1)

        else:
            # ==========================================
            # JIKA TANGAN TIDAK TERDETEKSI (FRAME BERSIH)
            # ==========================================
            frame_count += 1
            curr_time = time.time()
            fps = int(1.0 / (curr_time - prev_time + 1e-6))
            prev_time = curr_time

        # Top Header & Help Bar
        if show_hud:
            cv2.rectangle(output_frame, (10, 10), (560, 45), (15, 15, 15), -1)
            cv2.rectangle(output_frame, (10, 10), (560, 45), (255, 200, 0), 1)
            
            status_text = "2-HANDS TRACKED" if hand_detected else ("MOUSE MODE" if mouse_mode else "MENCARI 2 TANGAN...")
            header_str = f"RETROLENS PORTAL | {status_text}"
            status_color = (0, 255, 100) if hand_detected else (200, 200, 200)
            cv2.putText(output_frame, header_str, (20, 32),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.48, status_color, 1)

            cv2.rectangle(output_frame, (10, h - 35), (w - 10, h - 8), (15, 15, 15), -1)
            help_str = "[Pinch Jari / 1-6] Ganti Filter | [SPACE] Foto | [G] Grain | [M] Mouse | [Q] Keluar"
            cv2.putText(output_frame, help_str, (20, h - 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.43, (200, 200, 200), 1)

        # Photo Flash Effect
        if flash_frames > 0:
            flash_overlay = np.full((h, w, 3), 255, dtype=np.uint8)
            alpha = flash_frames / 5.0
            output_frame = cv2.addWeighted(flash_overlay, alpha, output_frame, 1.0 - alpha, 0)
            flash_frames -= 1

        cv2.imshow("RETROLENS - Hand Camera Portal", output_frame)

        key = cv2.waitKey(1) & 0xFF
        if key in [ord('q'), ord('Q'), 27]:
            break
        elif key in [ord('1'), ord('2'), ord('3'), ord('4'), ord('5'), ord('6')]:
            filter_idx = (int(chr(key)) - 1) % len(FILTER_MODES)
            print(f"[INFO] Filter Lensa Diubah Ke: {FILTER_MODES[filter_idx][0]}")
        elif key in [ord(' '), ord('s'), ord('S')]:
            photo_count += 1
            filename = f"captures/retrolens_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
            cv2.imwrite(filename, output_frame)
            flash_frames = 5
            print(f"[FOTO] Tangkapan layar disimpan ke: {filename}")
        elif key in [ord('g'), ord('G')]:
            grain_idx = (grain_idx + 1) % len(grain_levels)
            print(f"[INFO] Grain Level: {grain_levels[grain_idx]}")
        elif key in [ord('h'), ord('H')]:
            show_hud = not show_hud
            print(f"[INFO] HUD: {'ON' if show_hud else 'OFF'}")
        elif key in [ord('m'), ord('M')]:
            mouse_mode = not mouse_mode
            print(f"[INFO] Mouse Demo Mode: {'ON' if mouse_mode else 'OFF'}")

    if cap.isOpened():
        cap.release()
    cv2.destroyAllWindows()
    tracker.close()
    print("RETROLENS Hand Portal Selesai.")

if __name__ == "__main__":
    main()
