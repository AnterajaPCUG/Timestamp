const mediaInput = document.getElementById('mediaInput');
const previewCanvas = document.getElementById('previewCanvas');
const ctx = previewCanvas.getContext('2d');
const hiddenVideo = document.getElementById('hiddenVideo');
const statusText = document.getElementById('statusText');
const btnProcess = document.getElementById('btnProcess');
const btnGps = document.getElementById('btnGps');

const inputName = document.getElementById('inputName');
const inputTime = document.getElementById('inputTime');
const inputCoords = document.getElementById('inputCoords');
const inputLocation = document.getElementById('inputLocation');

// TAMBAHAN BARU: Variabel slider ukuran tulisan
const inputFontSize = document.getElementById('inputFontSize');
const fontSizeLabel = document.getElementById('fontSizeLabel');

let mediaType = null;
let loadedImage = new Image();
let baseDate = new Date();
let animationId = null;

function setDefaultTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  inputTime.value = now.toISOString().slice(0, 19);
  baseDate = new Date(inputTime.value);
}
setDefaultTime();

inputTime.addEventListener('change', () => {
  baseDate = new Date(inputTime.value);
  if (mediaType === 'image') drawImageFrame();
});

[inputName, inputCoords, inputLocation].forEach((el) => {
  el.addEventListener('input', () => {
    if (mediaType === 'image') drawImageFrame();
  });
});

// TAMBAHAN BARU: Update label dan gambar ulang saat slider digeser
inputFontSize.addEventListener('input', () => {
  fontSizeLabel.innerText = `${inputFontSize.value}%`;
  if (mediaType === 'image') drawImageFrame();
});

btnGps.addEventListener('click', getLocation);
btnProcess.addEventListener('click', processAndDownload);

function getLocation() {
  if (!navigator.geolocation) {
    alert('Browser tidak mendukung GPS.');
    return;
  }
  statusText.innerText = 'Mencari titik koordinat...';
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      inputCoords.value = `${lat}, ${lon}`;

      try {
        const res = await fetch(
          `https://openstreetmap.org{lat}&lon=${lon}`
        );
        const data = await res.json();
        if (data && data.display_name) {
          inputLocation.value = data.display_name.split(',').slice(0, 3).join(',');
        }
      } catch (e) {
        console.log('Gagal mengambil nama alamat otomatis.');
      }
      statusText.innerText = 'Lokasi berhasil diperbarui!';
      if (mediaType === 'image') drawImageFrame();
    },
    () => {
      statusText.innerText = 'Izin lokasi ditolak (pastikan memakai HTTPS atau localhost).';
    }
  );
}

mediaInput.addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;

  cancelAnimationFrame(animationId);
  const url = URL.createObjectURL(file);
  statusText.innerText = 'Memuat media...';

  if (file.type.startsWith('image/')) {
    mediaType = 'image';
    loadedImage.onload = () => {
      previewCanvas.width = loadedImage.width;
      previewCanvas.height = loadedImage.height;
      drawImageFrame();
      statusText.innerText = 'Foto siap! Silakan edit teks atau unduh.';
    };
    loadedImage.src = url;
  } else if (file.type.startsWith('video/')) {
    mediaType = 'video';
    hiddenVideo.src = url;
    hiddenVideo.muted = true;
    hiddenVideo.loop = true;
    hiddenVideo.load();

    hiddenVideo.onloadeddata = () => {
      previewCanvas.width = hiddenVideo.videoWidth || 640;
      previewCanvas.height = hiddenVideo.videoHeight || 360;
      hiddenVideo
        .play()
        .then(() => {
          renderVideoLoop();
          statusText.innerText = 'Video siap! Pratinjau sedang berjalan.';
        })
        .catch(() => {
          ctx.drawImage(hiddenVideo, 0, 0, previewCanvas.width, previewCanvas.height);
          drawOverlay(0);
          statusText.innerText = 'Video dimuat. Tekan Proses & Unduh untuk mulai merekam.';
        });
    };
  }
});

function formatDisplayDate(dateObj) {
  const pad = (n) => String(n).padStart(2, '0');
  const d = pad(dateObj.getDate());
  const m = pad(dateObj.getMonth() + 1);
  const y = dateObj.getFullYear();
  const h = pad(dateObj.getHours());
  const min = pad(dateObj.getMinutes());
  const s = pad(dateObj.getSeconds());
  return `${d}/${m}/${y} ${h}:${min}:${s}`;
}

function drawOverlay(elapsedSeconds = 0) {
  const currentDate = new Date(baseDate.getTime() + elapsedSeconds * 1000);
  const lines = [
    formatDisplayDate(currentDate),
    inputCoords.value ? ` ${inputCoords.value}` : '',
    inputLocation.value ? ` ${inputLocation.value}` : '',
    inputName.value ? ` ${inputName.value}` : '',
  ].filter(Boolean);

  // Hitung ukuran font berdasarkan skala slider (50% - 250%)
  const scale = parseInt(inputFontSize.value, 10) / 100;
  const baseFontSize = Math.max(14, Math.round(previewCanvas.width * 0.028));
  const fontSize = Math.round(baseFontSize * scale);
  
  const lineHeight = fontSize * 1.35;
  const padding = Math.max(12, Math.round(previewCanvas.width * 0.025));

  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';

  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#ffffff';

  let startY = previewCanvas.height - padding;
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], previewCanvas.width - padding, startY);
    startY -= lineHeight;
  }

  ctx.shadowColor = 'transparent';
}

function drawImageFrame() {
  ctx.drawImage(loadedImage, 0, 0, previewCanvas.width, previewCanvas.height);
  drawOverlay(0);
}

function renderVideoLoop() {
  if (mediaType !== 'video') return;
  if (!hiddenVideo.paused && !hiddenVideo.ended) {
    ctx.drawImage(hiddenVideo, 0, 0, previewCanvas.width, previewCanvas.height);
    drawOverlay(hiddenVideo.currentTime);
  }
  animationId = requestAnimationFrame(renderVideoLoop);
}

function processAndDownload() {
  if (!mediaType) {
    alert('Pilih file foto atau video terlebih dahulu.');
    return;
  }

  if (mediaType === 'image') {
    drawImageFrame();
    const link = document.createElement('a');
    link.download = `timestamp-foto-${Date.now()}.png`;
    link.href = previewCanvas.toDataURL('image/png');
    link.click();
    statusText.innerText = 'Foto berhasil diunduh!';
  } else if (mediaType === 'video') {
    recordAndExportVideo();
  }
}

function recordAndExportVideo() {
  btnProcess.disabled = true;
  statusText.innerText = 'Sedang merender video... Tunggu hingga selesai.';

  hiddenVideo.loop = false;
  hiddenVideo.currentTime = 0;

  const stream = previewCanvas.captureStream(30);

  try {
    const videoStream = hiddenVideo.captureStream
      ? hiddenVideo.captureStream()
      : hiddenVideo.mozCaptureStream
      ? hiddenVideo.mozCaptureStream()
      : null;
    if (videoStream) {
      const audioTracks = videoStream.getAudioTracks();
      if (audioTracks.length > 0) {
        stream.addTrack(audioTracks[0]);
      }
    }
  } catch (e) {
    console.log('Audio tidak digabungkan:', e);
  }

  let mimeType = 'video/webm';
  let ext = 'webm';
  if (MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
    ext = 'mp4';
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
    mimeType = 'video/webm;codecs=vp8';
  }

  const recorder = new MediaRecorder(stream, { mimeType: mimeType });
  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `timestamp-video-${Date.now()}.${ext}`;
    link.href = url;
    link.click();

    btnProcess.disabled = false;
    statusText.innerText = `Video (.${ext}) selesai dirender dan diunduh!`;
    hiddenVideo.loop = true;
    hiddenVideo.muted = true;
    hiddenVideo.play();
  };

  hiddenVideo.muted = false;
  recorder.start();
  hiddenVideo.play();
  renderVideoLoop();

  hiddenVideo.onended = () => {
    if (recorder.state === 'recording') {
      recorder.stop();
    }
  };
}
