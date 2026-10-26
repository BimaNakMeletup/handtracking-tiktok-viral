/**
 * ===================================================================
 * RETROLENS — HAND CAMERA PORTAL (WEB EDITION)
 * Minimalist, Clean & Responsive Core Engine
 * ===================================================================
 */

(() => {
  'use strict';

  // ==========================================
  // CONFIGURATION & CONSTANTS
  // ==========================================
  const CONFIG = {
    targetWidth: 1280,
    targetHeight: 720,
    quadSmoothFactor: 0.35,
    grainLevels: [
      { id: 'OFF', val: 0, label: 'OFF' },
      { id: 'MED', val: 18, label: 'MED' },
      { id: 'HIGH', val: 35, label: 'HIGH' }
    ]
  };

  const FILTER_MODES = [
    { id: 'MONO', name: 'MONO', desc: 'B&W 35mm Contrast' },
    { id: 'FILM', name: 'WARM FILM', desc: 'Golden Hour Film' },
    { id: 'KONTRAS', name: 'NOIR', desc: 'Dramatic Noir' },
    { id: 'CYBER', name: 'CYBER', desc: 'Neon Cyan & Magenta' },
    { id: 'THERMAL', name: 'THERMAL', desc: 'Infrared Jet Heatmap' },
    { id: 'VIVID', name: 'VIVID', desc: 'Ultra-Saturated' },
    { id: 'MATRIX', name: 'MATRIX', desc: 'Phosphor Green CRT' },
    { id: 'GLITCH', name: 'GLITCH', desc: 'RGB Chromatic Split' }
  ];

  // ==========================================
  // DOM ELEMENT REFERENCES
  // ==========================================
  const DOM = {
    webcamVideo: document.getElementById('webcamVideo'),
    mainCanvas: document.getElementById('mainCanvas'),
    flashOverlay: document.getElementById('flashOverlay'),
    loadingScreen: document.getElementById('cameraLoadingScreen'),
    loadingStatusText: document.getElementById('loadingStatusText'),
    btnAllowCamera: document.getElementById('btnAllowCamera'),
    btnStartMouseMode: document.getElementById('btnStartMouseMode'),

    // Top Bar
    statusDot: document.getElementById('statusDot'),
    topFilterTag: document.getElementById('topFilterTag'),
    recIndicator: document.getElementById('recIndicator'),
    recTimer: document.getElementById('recTimer'),
    btnMirrorToggle: document.getElementById('btnMirrorToggle'),
    btnSettingsToggle: document.getElementById('btnSettingsToggle'),
    btnHelpToggle: document.getElementById('btnHelpToggle'),

    // Popover Settings
    settingsPopover: document.getElementById('settingsPopover'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    btnAudioToggle: document.getElementById('btnAudioToggle'),
    btnGrainToggle: document.getElementById('btnGrainToggle'),
    btnScanlineToggle: document.getElementById('btnScanlineToggle'),
    btnMouseModeToggle: document.getElementById('btnMouseModeToggle'),
    btnFullscreenToggle: document.getElementById('btnFullscreenToggle'),

    // Hints & Toasts
    quickIntroHint: document.getElementById('quickIntroHint'),
    btnCloseIntro: document.getElementById('btnCloseIntro'),
    toastNotification: document.getElementById('toastNotification'),
    toastMessage: document.getElementById('toastMessage'),

    // Bottom Controls
    filterPillsContainer: document.getElementById('filterPillsContainer'),
    btnClearCanvas: document.getElementById('btnClearCanvas'),
    btnCapturePhoto: document.getElementById('btnCapturePhoto'),
    btnRecordVideo: document.getElementById('btnRecordVideo'),
    btnOpenGallery: document.getElementById('btnOpenGallery'),
    galleryCountBadge: document.getElementById('galleryCountBadge'),

    // Modals
    galleryModal: document.getElementById('galleryModal'),
    galleryTotalItems: document.getElementById('galleryTotalItems'),
    galleryEmptyState: document.getElementById('galleryEmptyState'),
    galleryGrid: document.getElementById('galleryGrid'),
    btnCloseGallery: document.getElementById('btnCloseGallery'),
    btnCloseGalleryFooter: document.getElementById('btnCloseGalleryFooter'),
    btnClearGallery: document.getElementById('btnClearGallery'),
    helpModal: document.getElementById('helpModal'),
    btnCloseHelp: document.getElementById('btnCloseHelp'),

    // Mouse Handles
    mouseHandlesContainer: document.getElementById('mouseHandlesContainer'),
    pins: [
      document.getElementById('pin0'),
      document.getElementById('pin1'),
      document.getElementById('pin2'),
      document.getElementById('pin3')
    ]
  };

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const state = {
    cameraRunning: false,
    mediaStream: null,
    isMirrored: true,
    audioEnabled: true,
    mouseMode: false,
    scanlinesEnabled: true,
    grainIdx: 1, // MED
    activeFilterIdx: 0,

    canvasWidth: CONFIG.targetWidth,
    canvasHeight: CONFIG.targetHeight,

    smoothQuad: [
      { x: 320, y: 180 },
      { x: 320, y: 540 },
      { x: 960, y: 540 },
      { x: 960, y: 180 }
    ],
    mousePts: [
      { x: 320, y: 180 },
      { x: 320, y: 540 },
      { x: 960, y: 540 },
      { x: 960, y: 180 }
    ],
    handDetected: false,
    currentSkeletons: [],
    pinchTriggered: false,
    pinchFlashFrames: 0,

    isDrawing: false,
    drawColor: '#00f3ff',
    prevDrawPt: null,
    frameCount: 0,

    mediaRecorder: null,
    recordedChunks: [],
    isRecording: false,
    recordStartTime: 0,
    recordInterval: null,

    galleryItems: []
  };

  // Canvas Buffers
  const ctx = DOM.mainCanvas.getContext('2d', { willReadFrequently: true });
  const drawingCanvas = document.createElement('canvas');
  const drawCtx = drawingCanvas.getContext('2d');
  const filterCanvas = document.createElement('canvas');
  const filterCtx = filterCanvas.getContext('2d', { willReadFrequently: true });

  // Thermal Jet Heatmap LUT (256 RGB)
  const thermalLUT = (() => {
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const v = i / 255;
      let r = 0, g = 0, b = 0;
      if (v < 0.25) {
        b = Math.floor(v * 4 * 255);
      } else if (v < 0.5) {
        b = 255;
        g = Math.floor((v - 0.25) * 4 * 255);
      } else if (v < 0.75) {
        b = Math.floor((1 - (v - 0.5) * 4) * 255);
        g = 255;
        r = Math.floor((v - 0.5) * 4 * 255);
      } else {
        g = Math.floor((1 - (v - 0.75) * 4) * 255);
        r = 255;
      }
      lut[i * 3] = r;
      lut[i * 3 + 1] = g;
      lut[i * 3 + 2] = b;
    }
    return lut;
  })();

  // ==========================================
  // WEB AUDIO API SOUND SYNTHESIZER
  // ==========================================
  const AudioFX = {
    ctx: null,

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.ctx = new AudioContext();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    playShutter() {
      if (!state.audioEnabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1200, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      whiteNoise.start(now);

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);
      oscGain.gain.setValueAtTime(0.5, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    },

    playFilterSwitch() {
      if (!state.audioEnabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    },

    playPinchSpark() {
      if (!state.audioEnabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.1);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    },

    playWhoosh() {
      if (!state.audioEnabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.16);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  };

  // ==========================================
  // INITIALIZATION & SETUP
  // ==========================================
  function initApp() {
    setupFilterPills();
    setupEventListeners();
    updateGalleryBadge();

    // Auto fade out intro hint after 4 seconds
    setTimeout(() => {
      if (DOM.quickIntroHint) {
        DOM.quickIntroHint.classList.add('hidden');
      }
    }, 4500);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      initCamera();
    } else {
      showToast('Kamera tidak didukung. Memulai Mode Mouse.');
      enableMouseMode();
    }
  }

  function setupFilterPills() {
    DOM.filterPillsContainer.innerHTML = '';
    FILTER_MODES.forEach((filter, idx) => {
      const pill = document.createElement('button');
      pill.className = `filter-pill ${idx === state.activeFilterIdx ? 'active' : ''}`;
      pill.textContent = filter.name;
      pill.dataset.idx = idx;
      pill.addEventListener('click', () => setFilter(idx));
      DOM.filterPillsContainer.appendChild(pill);
    });
  }

  function setFilter(idx) {
    if (idx === state.activeFilterIdx) return;
    state.activeFilterIdx = idx;

    const pills = DOM.filterPillsContainer.querySelectorAll('.filter-pill');
    pills.forEach((p, i) => p.classList.toggle('active', i === idx));
    if (pills[idx]) {
      pills[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    const currentFilter = FILTER_MODES[idx];
    DOM.topFilterTag.textContent = currentFilter.name;
    showToast(currentFilter.name);
    AudioFX.playFilterSwitch();
  }

  function cycleFilter(step = 1) {
    const nextIdx = (state.activeFilterIdx + step + FILTER_MODES.length) % FILTER_MODES.length;
    setFilter(nextIdx);
  }

  function showToast(msg) {
    DOM.toastMessage.textContent = msg;
    DOM.toastNotification.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      DOM.toastNotification.classList.add('hidden');
    }, 2000);
  }

  // ==========================================
  // WEBCAM & MEDIAPIPE INITIALIZATION
  // ==========================================
  let handsTracker = null;

  async function initCamera() {
    DOM.loadingStatusText.textContent = 'Menghubungkan ke kamera...';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: CONFIG.targetWidth },
          height: { ideal: CONFIG.targetHeight },
          facingMode: 'user'
        },
        audio: false
      });

      DOM.webcamVideo.srcObject = stream;
      state.mediaStream = stream;

      await new Promise((resolve) => {
        DOM.webcamVideo.onloadedmetadata = () => {
          DOM.webcamVideo.play();
          resolve();
        };
      });

      resizeCanvases(DOM.webcamVideo.videoWidth || CONFIG.targetWidth, DOM.webcamVideo.videoHeight || CONFIG.targetHeight);
      initMediaPipe();
    } catch (err) {
      console.warn('Webcam error:', err);
      DOM.loadingStatusText.textContent = 'Kamera tidak dapat diakses. Gunakan Mode Mouse.';
    }
  }

  function resizeCanvases(w, h) {
    state.canvasWidth = w;
    state.canvasHeight = h;
    DOM.mainCanvas.width = w;
    DOM.mainCanvas.height = h;
    drawingCanvas.width = w;
    drawingCanvas.height = h;
    filterCanvas.width = w;
    filterCanvas.height = h;

    state.mousePts = [
      { x: Math.round(w * 0.25), y: Math.round(h * 0.25) },
      { x: Math.round(w * 0.25), y: Math.round(h * 0.75) },
      { x: Math.round(w * 0.75), y: Math.round(h * 0.75) },
      { x: Math.round(w * 0.75), y: Math.round(h * 0.25) }
    ];
    updateMousePinDOM();
  }

  function initMediaPipe() {
    if (typeof window.Hands === 'undefined') {
      DOM.loadingScreen.classList.add('hidden');
      requestAnimationFrame(renderLoop);
      return;
    }

    handsTracker = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    handsTracker.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    handsTracker.onResults(onHandResults);

    if (typeof window.Camera !== 'undefined') {
      const cam = new window.Camera(DOM.webcamVideo, {
        onFrame: async () => {
          if (!state.mouseMode) {
            await handsTracker.send({ image: DOM.webcamVideo });
          }
        },
        width: state.canvasWidth,
        height: state.canvasHeight
      });
      cam.start().then(() => {
        DOM.loadingScreen.classList.add('hidden');
        state.cameraRunning = true;
        requestAnimationFrame(renderLoop);
      }).catch(() => {
        DOM.loadingScreen.classList.add('hidden');
        requestAnimationFrame(renderLoop);
      });
    } else {
      DOM.loadingScreen.classList.add('hidden');
      requestAnimationFrame(renderLoop);
    }
  }

  // ==========================================
  // HAND TRACKING & GESTURES
  // ==========================================
  function onHandResults(results) {
    const w = state.canvasWidth;
    const h = state.canvasHeight;
    state.currentSkeletons = [];

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      state.handDetected = false;
      state.isDrawing = false;
      state.prevDrawPt = null;
      DOM.statusDot.className = 'status-dot';
      return;
    }

    const landmarks = results.multiHandLandmarks;

    landmarks.forEach(hand => {
      const pts = hand.map(lm => ({
        x: state.isMirrored ? (1 - lm.x) * w : lm.x * w,
        y: lm.y * h
      }));
      state.currentSkeletons.push(pts);
    });

    // 2 Tangan
    if (landmarks.length >= 2) {
      state.handDetected = true;
      state.isDrawing = false;
      state.prevDrawPt = null;
      DOM.statusDot.className = 'status-dot tracking';

      const handA = landmarks[0];
      const handB = landmarks[1];
      let handALeft = handA[0].x < handB[0].x;
      if (state.isMirrored) handALeft = !handALeft;

      const leftHand = handALeft ? handA : handB;
      const rightHand = handALeft ? handB : handA;

      const l_index = {
        x: state.isMirrored ? (1 - leftHand[8].x) * w : leftHand[8].x * w,
        y: leftHand[8].y * h
      };
      const l_thumb = {
        x: state.isMirrored ? (1 - leftHand[4].x) * w : leftHand[4].x * w,
        y: leftHand[4].y * h
      };
      const r_thumb = {
        x: state.isMirrored ? (1 - rightHand[4].x) * w : rightHand[4].x * w,
        y: rightHand[4].y * h
      };
      const r_index = {
        x: state.isMirrored ? (1 - rightHand[8].x) * w : rightHand[8].x * w,
        y: rightHand[8].y * h
      };

      applySmoothQuad([l_index, l_thumb, r_thumb, r_index]);

      // Pinch check
      const dist_l = Math.hypot(l_index.x - l_thumb.x, l_index.y - l_thumb.y);
      const dist_r = Math.hypot(r_index.x - r_thumb.x, r_index.y - r_thumb.y);
      const dist_touch = Math.hypot(l_index.x - r_index.x, l_index.y - r_index.y);

      const isPinched = (dist_l < 45 && dist_r < 45) || (dist_touch < 50);
      handlePinch(isPinched);

    } 
    // 1 Tangan
    else if (landmarks.length === 1) {
      const pts = state.currentSkeletons[0];
      const wrist = pts[0];
      const idxTip = pts[8];
      const idxPip = pts[6];
      const midTip = pts[12];
      const midPip = pts[10];
      const thumbTip = pts[4];

      const distIdxTip = Math.hypot(idxTip.x - wrist.x, idxTip.y - wrist.y);
      const distIdxPip = Math.hypot(idxPip.x - wrist.x, idxPip.y - wrist.y);
      const distMidTip = Math.hypot(midTip.x - wrist.x, midTip.y - wrist.y);
      const distMidPip = Math.hypot(midPip.x - wrist.x, midPip.y - wrist.y);

      const isIndexExtended = distIdxTip > distIdxPip * 1.05;
      const isMiddleFolded = distMidTip < distMidPip * 1.15 || midTip.y > midPip.y;

      if (isIndexExtended && isMiddleFolded) {
        state.isDrawing = true;
        state.handDetected = false;
        DOM.statusDot.className = 'status-dot active';
        processAirDrawing(idxTip);
      } else {
        state.isDrawing = false;
        state.prevDrawPt = null;
        state.handDetected = true;
        DOM.statusDot.className = 'status-dot tracking';

        const dx = idxTip.x - thumbTip.x;
        const dy = idxTip.y - thumbTip.y;
        const p1 = { x: thumbTip.x - dy, y: thumbTip.y + dx };
        const p2 = thumbTip;
        const p3 = idxTip;
        const p4 = { x: idxTip.x - dy, y: idxTip.y + dx };

        applySmoothQuad([p1, p2, p3, p4]);
        handlePinch(Math.hypot(dx, dy) < 40);
      }
    }
  }

  function handlePinch(isPinched) {
    if (isPinched) {
      if (!state.pinchTriggered) {
        state.pinchTriggered = true;
        state.pinchFlashFrames = 6;
        cycleFilter(1);
        AudioFX.playPinchSpark();
      }
    } else {
      state.pinchTriggered = false;
    }
  }

  function applySmoothQuad(target) {
    for (let i = 0; i < 4; i++) {
      state.smoothQuad[i].x = state.smoothQuad[i].x * (1 - CONFIG.quadSmoothFactor) + target[i].x * CONFIG.quadSmoothFactor;
      state.smoothQuad[i].y = state.smoothQuad[i].y * (1 - CONFIG.quadSmoothFactor) + target[i].y * CONFIG.quadSmoothFactor;
    }
  }

  function processAirDrawing(currPt) {
    const hue = (state.frameCount * 3) % 360;
    const color = `hsl(${hue}, 100%, 65%)`;
    state.drawColor = color;

    if (state.prevDrawPt) {
      drawCtx.save();
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';

      drawCtx.shadowColor = color;
      drawCtx.shadowBlur = 12;
      drawCtx.strokeStyle = color;
      drawCtx.lineWidth = 8;
      drawCtx.beginPath();
      drawCtx.moveTo(state.prevDrawPt.x, state.prevDrawPt.y);
      drawCtx.lineTo(currPt.x, currPt.y);
      drawCtx.stroke();

      drawCtx.shadowBlur = 0;
      drawCtx.strokeStyle = '#ffffff';
      drawCtx.lineWidth = 2.5;
      drawCtx.beginPath();
      drawCtx.moveTo(state.prevDrawPt.x, state.prevDrawPt.y);
      drawCtx.lineTo(currPt.x, currPt.y);
      drawCtx.stroke();
      drawCtx.restore();
    }
    state.prevDrawPt = { ...currPt };
  }

  // ==========================================
  // RENDERING LOOP
  // ==========================================
  function renderLoop() {
    state.frameCount++;
    const w = state.canvasWidth;
    const h = state.canvasHeight;

    // 1. Draw video feed
    ctx.save();
    if (state.isMirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    if (DOM.webcamVideo.readyState >= 2) {
      ctx.drawImage(DOM.webcamVideo, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    // 2. Render Portal inside Quad
    const isPortalActive = state.mouseMode || state.handDetected;
    if (isPortalActive) {
      renderPortalView(w, h);
    }

    // 3. Render Hand Skeleton dots
    if (!state.mouseMode && state.currentSkeletons.length > 0) {
      renderHandSkeletons(ctx);
    }

    // 4. Blend Air Drawing
    ctx.drawImage(drawingCanvas, 0, 0);

    // 5. Air Draw reticle pointer
    if (state.isDrawing && state.prevDrawPt) {
      ctx.save();
      ctx.strokeStyle = state.drawColor;
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.prevDrawPt.x, state.prevDrawPt.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(state.prevDrawPt.x, state.prevDrawPt.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    requestAnimationFrame(renderLoop);
  }

  function renderPortalView(w, h) {
    const quad = state.mouseMode ? state.mousePts : state.smoothQuad;
    const p1 = quad[0];
    const p2 = quad[1];
    const p3 = quad[2];
    const p4 = quad[3];

    const minX = Math.max(0, Math.floor(Math.min(p1.x, p2.x, p3.x, p4.x)));
    const maxX = Math.min(w, Math.ceil(Math.max(p1.x, p2.x, p3.x, p4.x)));
    const minY = Math.max(0, Math.floor(Math.min(p1.y, p2.y, p3.y, p4.y)));
    const maxY = Math.min(h, Math.ceil(Math.max(p1.y, p2.y, p3.y, p4.y)));
    const roiW = maxX - minX;
    const roiH = maxY - minY;

    if (roiW < 20 || roiH < 20) return;

    filterCtx.clearRect(0, 0, w, h);
    filterCtx.drawImage(DOM.mainCanvas, 0, 0);

    applyActiveFilter(filterCtx, minX, minY, roiW, roiH);

    const grainVal = CONFIG.grainLevels[state.grainIdx].val;
    if (grainVal > 0) {
      applyFilmGrain(filterCtx, minX, minY, roiW, roiH, grainVal);
    }
    if (state.scanlinesEnabled) {
      applyScanlines(filterCtx, minX, minY, roiW, roiH);
    }

    // Clip Quad Polygon
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(filterCanvas, 0, 0);
    ctx.restore();

    // Render Clean Glowing Outlines
    renderPortalOutlines(ctx, p1, p2, p3, p4);
  }

  function applyActiveFilter(fCtx, x, y, w, h) {
    const filter = FILTER_MODES[state.activeFilterIdx];
    const imgData = fCtx.getImageData(x, y, w, h);
    const data = imgData.data;
    const len = data.length;

    switch (filter.id) {
      case 'MONO': {
        for (let i = 0; i < len; i += 4) {
          const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const contrast = luma < 128 ? Math.pow(luma / 128, 1.35) * 128 : 255 - Math.pow((255 - luma) / 128, 1.35) * 128;
          data[i] = contrast;
          data[i + 1] = contrast;
          data[i + 2] = contrast;
        }
        break;
      }
      case 'FILM': {
        for (let i = 0; i < len; i += 4) {
          data[i] = Math.min(255, data[i] * 1.15 + 16);
          data[i + 1] = Math.min(255, data[i + 1] * 1.05 + 6);
          data[i + 2] = Math.max(0, data[i + 2] * 0.88 - 8);
        }
        break;
      }
      case 'KONTRAS': {
        for (let i = 0; i < len; i += 4) {
          const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = luma < 85 ? luma * 0.4 : Math.min(255, (luma - 85) * 1.8 + 60);
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
        break;
      }
      case 'CYBER': {
        for (let i = 0; i < len; i += 4) {
          const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (luma < 120) {
            data[i] = Math.min(255, data[i] * 0.3);
            data[i + 1] = Math.min(255, luma * 1.5 + 40);
            data[i + 2] = Math.min(255, luma * 1.9 + 60);
          } else {
            data[i] = Math.min(255, luma * 1.8 + 40);
            data[i + 1] = Math.min(255, data[i + 1] * 0.4);
            data[i + 2] = Math.min(255, luma * 1.2 + 80);
          }
        }
        break;
      }
      case 'THERMAL': {
        for (let i = 0; i < len; i += 4) {
          const luma = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          const lutIdx = luma * 3;
          data[i] = thermalLUT[lutIdx];
          data[i + 1] = thermalLUT[lutIdx + 1];
          data[i + 2] = thermalLUT[lutIdx + 2];
        }
        break;
      }
      case 'VIVID': {
        for (let i = 0; i < len; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          data[i] = Math.min(255, Math.max(0, avg + (data[i] - avg) * 2.2));
          data[i + 1] = Math.min(255, Math.max(0, avg + (data[i + 1] - avg) * 2.2));
          data[i + 2] = Math.min(255, Math.max(0, avg + (data[i + 2] - avg) * 2.2));
        }
        break;
      }
      case 'MATRIX': {
        for (let i = 0; i < len; i += 4) {
          const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = luma * 0.15;
          data[i + 1] = Math.min(255, luma * 1.35 + 20);
          data[i + 2] = luma * 0.2;
        }
        break;
      }
      case 'GLITCH': {
        const rowWidth = w * 4;
        const shift = 8 * 4;
        for (let r = 0; r < h; r++) {
          const rowStart = r * rowWidth;
          for (let c = 0; c < rowWidth; c += 4) {
            const idx = rowStart + c;
            if (idx + shift < len) {
              data[idx] = data[idx + shift];
            }
          }
        }
        break;
      }
    }
    fCtx.putImageData(imgData, x, y);
  }

  function applyFilmGrain(fCtx, x, y, w, h, intensity) {
    const imgData = fCtx.getImageData(x, y, w, h);
    const data = imgData.data;
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const noise = (Math.random() - 0.5) * intensity * 2;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    fCtx.putImageData(imgData, x, y);
  }

  function applyScanlines(fCtx, x, y, w, h) {
    fCtx.save();
    fCtx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let py = y; py < y + h; py += 3) {
      fCtx.fillRect(x, py, w, 1.2);
    }
    fCtx.restore();
  }

  // Clean, sleek portal outlines without messy numbers
  function renderPortalOutlines(targetCtx, p1, p2, p3, p4) {
    targetCtx.save();
    const isFlashing = state.pinchFlashFrames > 0;
    const lineColor = isFlashing ? '#00ffff' : '#ffb800';

    targetCtx.strokeStyle = lineColor;
    targetCtx.lineWidth = isFlashing ? 3 : 2;
    targetCtx.shadowColor = lineColor;
    targetCtx.shadowBlur = isFlashing ? 14 : 6;

    targetCtx.beginPath();
    targetCtx.moveTo(p1.x, p1.y);
    targetCtx.lineTo(p4.x, p4.y);
    targetCtx.lineTo(p3.x, p3.y);
    targetCtx.lineTo(p2.x, p2.y);
    targetCtx.closePath();
    targetCtx.stroke();

    // Corner pins
    [p1, p2, p3, p4].forEach(pt => {
      targetCtx.beginPath();
      targetCtx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      targetCtx.fillStyle = lineColor;
      targetCtx.fill();

      targetCtx.beginPath();
      targetCtx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
      targetCtx.strokeStyle = '#ffffff';
      targetCtx.lineWidth = 1.5;
      targetCtx.stroke();

      if (isFlashing) {
        targetCtx.beginPath();
        targetCtx.arc(pt.x, pt.y, 18 - state.pinchFlashFrames * 2, 0, Math.PI * 2);
        targetCtx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        targetCtx.lineWidth = 2;
        targetCtx.stroke();
      }
    });

    if (state.pinchFlashFrames > 0) state.pinchFlashFrames--;
    targetCtx.restore();
  }

  function renderHandSkeletons(targetCtx) {
    targetCtx.save();
    state.currentSkeletons.forEach(skel => {
      targetCtx.fillStyle = 'rgba(0, 243, 255, 0.6)';
      skel.forEach(pt => {
        targetCtx.beginPath();
        targetCtx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        targetCtx.fill();
      });

      if (skel.length > 8) {
        targetCtx.strokeStyle = 'rgba(255, 184, 0, 0.5)';
        targetCtx.lineWidth = 1.2;
        targetCtx.beginPath();
        targetCtx.moveTo(skel[4].x, skel[4].y);
        targetCtx.lineTo(skel[8].x, skel[8].y);
        targetCtx.stroke();
      }
    });
    targetCtx.restore();
  }

  // ==========================================
  // CAPTURE & RECORDING
  // ==========================================
  function capturePhoto() {
    AudioFX.playShutter();

    DOM.flashOverlay.classList.add('active');
    setTimeout(() => DOM.flashOverlay.classList.remove('active'), 100);

    const dataUrl = DOM.mainCanvas.toDataURL('image/jpeg', 0.95);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `retrolens_${timestamp}.jpg`;

    saveGalleryItem({
      type: 'photo',
      url: dataUrl,
      filename: filename
    });

    showToast('Foto disimpan!');
    downloadBlob(dataUrl, filename);
  }

  function toggleVideoRecording() {
    if (state.isRecording) {
      stopVideoRecording();
    } else {
      startVideoRecording();
    }
  }

  function startVideoRecording() {
    try {
      const stream = DOM.mainCanvas.captureStream(30);
      const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      let selectedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

      state.recordedChunks = [];
      state.mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMime });

      state.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) state.recordedChunks.push(e.data);
      };

      state.mediaRecorder.onstop = () => {
        const blob = new Blob(state.recordedChunks, { type: selectedMime });
        const videoUrl = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `retrolens_${timestamp}.webm`;

        saveGalleryItem({
          type: 'video',
          url: videoUrl,
          filename: filename
        });

        showToast('Video rekaman disimpan!');
        downloadBlob(videoUrl, filename);
      };

      state.mediaRecorder.start();
      state.isRecording = true;
      state.recordStartTime = Date.now();

      DOM.btnRecordVideo.classList.add('recording');
      DOM.recIndicator.classList.remove('hidden');
      DOM.recTimer.textContent = '00:00';

      AudioFX.playFilterSwitch();

      state.recordInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.recordStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        DOM.recTimer.textContent = `${mins}:${secs}`;
      }, 500);

    } catch (err) {
      console.error('Recording error:', err);
      showToast('Gagal rekam: ' + err.message);
    }
  }

  function stopVideoRecording() {
    if (!state.isRecording) return;
    state.isRecording = false;
    clearInterval(state.recordInterval);

    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      state.mediaRecorder.stop();
    }

    DOM.btnRecordVideo.classList.remove('recording');
    DOM.recIndicator.classList.add('hidden');
    AudioFX.playFilterSwitch();
  }

  function downloadBlob(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ==========================================
  // GALLERY
  // ==========================================
  function saveGalleryItem(item) {
    state.galleryItems.unshift(item);
    if (state.galleryItems.length > 30) state.galleryItems.pop();
    updateGalleryBadge();
    renderGalleryGrid();
  }

  function updateGalleryBadge() {
    const count = state.galleryItems.length;
    DOM.galleryCountBadge.textContent = count;
    DOM.galleryCountBadge.classList.toggle('hidden', count === 0);
    DOM.galleryTotalItems.textContent = count;
  }

  function renderGalleryGrid() {
    DOM.galleryGrid.innerHTML = '';
    if (state.galleryItems.length === 0) {
      DOM.galleryEmptyState.style.display = 'block';
      DOM.galleryGrid.style.display = 'none';
      return;
    }

    DOM.galleryEmptyState.style.display = 'none';
    DOM.galleryGrid.style.display = 'grid';

    state.galleryItems.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'gallery-card';

      const badge = document.createElement('span');
      badge.className = 'gallery-card-badge';
      badge.textContent = item.type === 'video' ? 'VIDEO' : 'FOTO';

      let mediaEl = item.type === 'video' ? document.createElement('video') : document.createElement('img');
      mediaEl.src = item.url;
      if (item.type === 'video') mediaEl.controls = true;

      const actions = document.createElement('div');
      actions.className = 'gallery-card-actions';

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'card-action-btn';
      downloadBtn.innerHTML = '<i data-lucide="download"></i>';
      downloadBtn.onclick = () => downloadBlob(item.url, item.filename);

      const delBtn = document.createElement('button');
      delBtn.className = 'card-action-btn del';
      delBtn.innerHTML = '<i data-lucide="trash"></i>';
      delBtn.onclick = () => {
        state.galleryItems.splice(index, 1);
        updateGalleryBadge();
        renderGalleryGrid();
      };

      actions.appendChild(downloadBtn);
      actions.appendChild(delBtn);
      card.appendChild(badge);
      card.appendChild(mediaEl);
      card.appendChild(actions);
      DOM.galleryGrid.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================
  // MOUSE MODE
  // ==========================================
  function enableMouseMode() {
    state.mouseMode = true;
    DOM.btnMouseModeToggle.classList.add('active');
    DOM.btnMouseModeToggle.textContent = 'ON';
    DOM.mouseHandlesContainer.classList.remove('hidden');
    DOM.statusDot.className = 'status-dot active';
    updateMousePinDOM();
    showToast('Mode Mouse Aktif');
  }

  function disableMouseMode() {
    state.mouseMode = false;
    DOM.btnMouseModeToggle.classList.remove('active');
    DOM.btnMouseModeToggle.textContent = 'OFF';
    DOM.mouseHandlesContainer.classList.add('hidden');
    DOM.statusDot.className = 'status-dot';
    showToast('Mode AI Kamera Aktif');
  }

  function toggleMouseMode() {
    if (state.mouseMode) disableMouseMode();
    else enableMouseMode();
  }

  function updateMousePinDOM() {
    const rect = DOM.mainCanvas.getBoundingClientRect();
    const scaleX = rect.width / state.canvasWidth;
    const scaleY = rect.height / state.canvasHeight;

    state.mousePts.forEach((pt, i) => {
      const pin = DOM.pins[i];
      if (pin) {
        pin.style.left = `${rect.left + pt.x * scaleX}px`;
        pin.style.top = `${rect.top + pt.y * scaleY}px`;
      }
    });
  }

  // ==========================================
  // EVENT LISTENERS & SHORTCUTS
  // ==========================================
  function setupEventListeners() {
    DOM.btnAllowCamera.addEventListener('click', () => {
      AudioFX.init();
      initCamera();
    });

    DOM.btnStartMouseMode.addEventListener('click', () => {
      AudioFX.init();
      DOM.loadingScreen.classList.add('hidden');
      enableMouseMode();
      requestAnimationFrame(renderLoop);
    });

    // Mirror flip
    DOM.btnMirrorToggle.addEventListener('click', () => {
      state.isMirrored = !state.isMirrored;
      DOM.btnMirrorToggle.classList.toggle('active', state.isMirrored);
      showToast(`Cermin: ${state.isMirrored ? 'ON' : 'OFF'}`);
    });

    // Settings popover toggle
    DOM.btnSettingsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.settingsPopover.classList.toggle('hidden');
    });
    DOM.btnCloseSettings.addEventListener('click', () => {
      DOM.settingsPopover.classList.add('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!DOM.settingsPopover.contains(e.target) && e.target !== DOM.btnSettingsToggle) {
        DOM.settingsPopover.classList.add('hidden');
      }
    });

    // Popover settings toggles
    DOM.btnAudioToggle.addEventListener('click', () => {
      state.audioEnabled = !state.audioEnabled;
      DOM.btnAudioToggle.classList.toggle('active', state.audioEnabled);
      DOM.btnAudioToggle.textContent = state.audioEnabled ? 'ON' : 'OFF';
    });

    DOM.btnGrainToggle.addEventListener('click', () => {
      state.grainIdx = (state.grainIdx + 1) % CONFIG.grainLevels.length;
      const cur = CONFIG.grainLevels[state.grainIdx];
      DOM.btnGrainToggle.textContent = cur.label;
      DOM.btnGrainToggle.classList.toggle('active', cur.val > 0);
    });

    DOM.btnScanlineToggle.addEventListener('click', () => {
      state.scanlinesEnabled = !state.scanlinesEnabled;
      DOM.btnScanlineToggle.classList.toggle('active', state.scanlinesEnabled);
      DOM.btnScanlineToggle.textContent = state.scanlinesEnabled ? 'ON' : 'OFF';
    });

    DOM.btnMouseModeToggle.addEventListener('click', toggleMouseMode);

    DOM.btnFullscreenToggle.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.warn(err));
      } else {
        document.exitFullscreen().catch(err => console.warn(err));
      }
    });

    // Intro hint dismiss
    if (DOM.btnCloseIntro) {
      DOM.btnCloseIntro.addEventListener('click', () => {
        DOM.quickIntroHint.classList.add('hidden');
      });
    }

    // Shutter & Actions
    DOM.btnCapturePhoto.addEventListener('click', capturePhoto);
    DOM.btnRecordVideo.addEventListener('click', toggleVideoRecording);
    DOM.btnClearCanvas.addEventListener('click', () => {
      drawCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      AudioFX.playWhoosh();
      showToast('Coretan dihapus');
    });

    // Gallery Modal
    DOM.btnOpenGallery.addEventListener('click', () => {
      renderGalleryGrid();
      DOM.galleryModal.classList.remove('hidden');
    });
    DOM.btnCloseGallery.addEventListener('click', () => DOM.galleryModal.classList.add('hidden'));
    DOM.btnCloseGalleryFooter.addEventListener('click', () => DOM.galleryModal.classList.add('hidden'));
    DOM.btnClearGallery.addEventListener('click', () => {
      state.galleryItems = [];
      updateGalleryBadge();
      renderGalleryGrid();
      showToast('Galeri dikosongkan');
    });

    // Help Modal
    DOM.btnHelpToggle.addEventListener('click', () => DOM.helpModal.classList.remove('hidden'));
    DOM.btnCloseHelp.addEventListener('click', () => DOM.helpModal.classList.add('hidden'));

    [DOM.galleryModal, DOM.helpModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });

    window.addEventListener('resize', () => {
      if (state.mouseMode) updateMousePinDOM();
    });

    setupMouseDrag();
    setupKeyboardShortcuts();
  }

  function setupMouseDrag() {
    let isDragging = false;
    let dragIdx = -1;

    DOM.pins.forEach(pin => {
      pin.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragIdx = parseInt(pin.dataset.idx, 10);
        e.preventDefault();
      });
      pin.addEventListener('touchstart', (e) => {
        isDragging = true;
        dragIdx = parseInt(pin.dataset.idx, 10);
      }, { passive: true });
    });

    const onMove = (clientX, clientY) => {
      if (!isDragging || dragIdx === -1) return;
      const rect = DOM.mainCanvas.getBoundingClientRect();
      const normX = (clientX - rect.left) / rect.width;
      const normY = (clientY - rect.top) / rect.height;

      const clampedX = Math.max(0, Math.min(state.canvasWidth, normX * state.canvasWidth));
      const clampedY = Math.max(0, Math.min(state.canvasHeight, normY * state.canvasHeight));

      state.mousePts[dragIdx] = { x: clampedX, y: clampedY };
      updateMousePinDOM();
    };

    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    const onUp = () => { isDragging = false; dragIdx = -1; };
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toUpperCase();

      if (e.key >= '1' && e.key <= '8') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < FILTER_MODES.length) setFilter(idx);
      } else if (e.key === ' ' || key === 'S') {
        e.preventDefault();
        capturePhoto();
      } else if (key === 'R') {
        toggleVideoRecording();
      } else if (key === 'C') {
        drawCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        AudioFX.playWhoosh();
        showToast('Coretan dihapus');
      } else if (key === 'M') {
        toggleMouseMode();
      } else if (key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (e.key === 'Escape') {
        DOM.galleryModal.classList.add('hidden');
        DOM.helpModal.classList.add('hidden');
        DOM.settingsPopover.classList.add('hidden');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
