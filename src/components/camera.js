
export function openCamera(onCapture) {
  // Create the camera overlay UI
  const overlay = document.createElement('div');
  overlay.className = 'camera-overlay';
  overlay.innerHTML = `
    <div class="camera-modal">
      <div class="camera-header">
        <span class="camera-title">Take Photo</span>
        <button class="camera-close" id="cam-close">✕</button>
      </div>
      <div class="camera-viewfinder">
        <video id="cam-video" autoplay playsinline muted></video>
        <div class="camera-frame-guide"></div>
      </div>
      <div class="camera-controls">
        <button class="cam-btn-switch" id="cam-switch" title="Switch camera">
          ↻ Switch
        </button>
        <button class="cam-btn-capture" id="cam-capture">
          <span class="shutter-ring"></span>
          <span class="shutter-center"></span>
        </button>
        <button class="cam-btn-gallery" id="cam-gallery" title="Choose from gallery">
          Gallery
        </button>
      </div>
      <canvas id="cam-canvas" style="display:none"></canvas>
    </div>
  `;
  document.body.appendChild(overlay);
  
  let stream = null;
  let facingMode = 'environment'; // Start with rear camera for field use
  
  async function startCamera() {
    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      const video = document.getElementById('cam-video');
      if (video) video.srcObject = stream;
    } catch (err) {
      console.error('Camera error:', err);
      // Camera permission denied or not available
      const viewfinder = overlay.querySelector('.camera-viewfinder');
      if (viewfinder) {
        let errorTitle = 'Camera not available';
        let errorDesc = 'Please grant camera permissions in your browser or use the Gallery button below.';
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message.includes('dismissed')) {
          errorTitle = 'Camera Access Required';
          errorDesc = 'Camera permission was restricted. Please check your browser address bar to allow camera access for this application.';
        }

        viewfinder.innerHTML = `
          <div class="camera-error" style="padding: 24px; text-align: center;">
            <div style="background: rgba(239, 68, 68, 0.1); width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </div>
            <p style="font-weight: 900; color: #1A2332; font-size: 18px; margin: 0;">${errorTitle}</p>
            <p style="font-size: 14px; color: #64748B; margin-top: 8px; max-width: 260px; line-height: 1.5; margin-left: auto; margin-right: auto;">
              ${errorDesc}
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 24px;">
              <button class="btn btn-primary" id="cam-retry" style="font-weight: 800; height: 46px;">
                Try Enabling Camera Again
              </button>
              <button class="btn btn-secondary" id="cam-use-gallery" style="font-weight: 700; background: #F1F5F9; border: none; height: 46px;">
                 Use Gallery / Upload Instead
              </button>
            </div>
          </div>
        `;

        const retryBtn = document.getElementById('cam-retry');
        if (retryBtn) {
          retryBtn.onclick = (e) => {
            e.stopPropagation();
            startCamera();
          };
        }

        const useGalleryBtn = document.getElementById('cam-use-gallery');
        if (useGalleryBtn) {
          useGalleryBtn.onclick = () => {
            document.getElementById('cam-gallery').click();
          };
        }
      }
      const captureBtn = document.getElementById('cam-capture');
      if (captureBtn) captureBtn.disabled = true;
    }
  }
  
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }
  
  function capturePhoto() {
    const video = document.getElementById('cam-video');
    const canvas = document.getElementById('cam-canvas');
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.85); // 85% quality
    stopCamera();
    overlay.remove();
    onCapture(base64);
  }
  
  // Switch camera (front/rear)
  document.getElementById('cam-switch').addEventListener('click', () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
  });
  
  // Capture button
  document.getElementById('cam-capture').addEventListener('click', capturePhoto);
  
  // Gallery fallback (file input)
  document.getElementById('cam-gallery').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        stopCamera();
        overlay.remove();
        onCapture(ev.target.result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });
  
  // Close
  document.getElementById('cam-close').addEventListener('click', () => {
    stopCamera();
    overlay.remove();
  });
  
  startCamera();
}
