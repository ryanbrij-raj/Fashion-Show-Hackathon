const API = '';

// Two fully independent Vonage camera sessions — Closet Scan and Try-On
// never share a publisher, so starting/using one never affects the other.
let scanSession, scanPublisher;
let tryonSession, tryonPublisher;
const closetItemsById = {};
let activeItemId = null;
let chatHistory = [];
let lastPersonFrame = null;

// Closet Scan: continuous garment auto-detection loop (no full body needed).
let garmentLoopTimer = null;
let garmentCheckInFlight = false;
let seenGarmentSignatures = new Set();

const scanPublisherContainer = document.getElementById('publisher-container');
const tryonPublisherContainer = document.getElementById('tryon-publisher-container');
const startTryOnCameraBtn = document.getElementById('start-tryon-camera');
const startCameraBtn = document.getElementById('start-camera');
const toggleScanBtn = document.getElementById('toggle-scan');
const captureItemBtn = document.getElementById('capture-item');
const closetUpload = document.getElementById('closet-upload');
const clearClosetBtn = document.getElementById('clear-closet');
const closetGrid = document.getElementById('closet-grid');
const chatClosetGrid = document.getElementById('chat-closet-grid');
const tryonClosetGrid = document.getElementById('tryon-closet-grid');
const allClosetGrids = [closetGrid, chatClosetGrid, tryonClosetGrid];
const activeItemLabel = document.getElementById('active-item-label');
const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatSubmit = chatForm.querySelector('button');
const quickReplyButtons = [...document.querySelectorAll('.quick-reply')];
const pairingImageBtn = document.getElementById('pairing-image-btn');
const personUpload = document.getElementById('person-upload');
const capturePersonBtn = document.getElementById('capture-person');
const garmentUpload = document.getElementById('garment-upload');
const runTryonBtn = document.getElementById('run-tryon');
const tryonResult = document.getElementById('tryon-result');
const liveTryOnToggleBtn = document.getElementById('live-tryon-toggle');
const liveTryOnStatus = document.getElementById('live-tryon-status');
const framingCaption = document.getElementById('framing-caption');
const bodyCheckStatus = document.getElementById('body-check-status');
const capturedPersonPreview = document.getElementById('captured-person-preview');
const tryonCameraWrap = document.getElementById('tryon-camera-wrap');
const snapCountdownOverlay = document.getElementById('snap-countdown-overlay');
const selectedGarmentEl = document.getElementById('selected-garment');
const selectedGarmentImg = document.getElementById('selected-garment-img');
const selectedGarmentName = document.getElementById('selected-garment-name');
const clearSelectedGarmentBtn = document.getElementById('clear-selected-garment');
let selectedGarmentId = null;
const profileDialog = document.getElementById('profile-dialog');
const openProfileBtn = document.getElementById('open-profile');
const closeProfileBtn = document.getElementById('close-profile');
const profileForm = document.getElementById('profile-form');
const profileStatus = document.getElementById('profile-status');
const profileFields = {
  height: document.getElementById('p-height'),
  chest: document.getElementById('p-chest'),
  waist: document.getElementById('p-waist'),
  hips: document.getElementById('p-hips'),
  shoe: document.getElementById('p-shoe'),
  fitPreference: document.getElementById('p-fit'),
};

const tabButtons = [...document.querySelectorAll('.tab')];
const tabPanels = [...document.querySelectorAll('.tab-panel')];
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
    tabPanels.forEach((p) => (p.hidden = p.id !== btn.dataset.tab));
  });
});

startCameraBtn.addEventListener('click', startVonageSession);
startTryOnCameraBtn.addEventListener('click', startTryOnCamera);
toggleScanBtn.addEventListener('click', toggleGarmentScanLoop);
captureItemBtn.addEventListener('click', () => scanImage(captureScanFrame(), captureItemBtn, 'Capture Manually'));
closetUpload.addEventListener('change', async () => {
  const file = closetUpload.files[0];
  if (!file) return;
  const image = await fileToDataUrl(file);
  await scanImage(image, null, null);
  closetUpload.value = '';
});
clearClosetBtn.addEventListener('click', clearAllGarments);
chatForm.addEventListener('submit', sendChatMessage);
quickReplyButtons.forEach((btn) => {
  btn.addEventListener('click', () => sendMessage(btn.dataset.message));
});
pairingImageBtn.addEventListener('click', requestPairingImage);
capturePersonBtn.addEventListener('click', toggleSnapCountdown);
runTryonBtn.addEventListener('click', runTryOn);
liveTryOnToggleBtn.addEventListener('click', toggleLiveTryOn);

openProfileBtn.addEventListener('click', () => profileDialog.showModal());
closeProfileBtn.addEventListener('click', () => profileDialog.close());
profileForm.addEventListener('submit', saveProfile);
loadProfile();
loadExistingCloset();

[personUpload, garmentUpload].forEach((input) => {
  input.addEventListener('change', () => {
    const card = input.closest('.upload-card');
    const sub = card.querySelector('.upload-sub');
    card.classList.toggle('filled', !!input.files[0]);
    sub.textContent = input.files[0] ? input.files[0].name : 'Upload a photo';
  });
});
personUpload.addEventListener('change', () => {
  // A fresh upload overrides a previously snapped camera photo.
  if (personUpload.files[0]) capturedPersonPreview.hidden = true;
});
garmentUpload.addEventListener('change', () => {
  // A fresh upload overrides whatever was picked from the closet grid.
  if (garmentUpload.files[0]) clearSelectedGarment();
});
clearSelectedGarmentBtn.addEventListener('click', clearSelectedGarment);

async function startVonageSession() {
  startCameraBtn.disabled = true;
  startCameraBtn.textContent = 'Connecting...';
  const res = await fetch(`${API}/api/session`, { method: 'POST' });
  const { apiKey, sessionId, token } = await res.json();

  scanSession = OT.initSession(apiKey, sessionId);
  scanPublisher = OT.initPublisher(scanPublisherContainer, {
    width: '100%',
    height: '100%',
    fitMode: 'contain',
    style: { buttonDisplayMode: 'off' },
  });

  scanSession.connect(token, (err) => {
    if (err) {
      console.error('Vonage connect error', err);
      alert('Could not connect to Vonage session: ' + err.message);
      startCameraBtn.disabled = false;
      startCameraBtn.textContent = 'Start Camera';
      return;
    }
    scanSession.publish(scanPublisher);
    startCameraBtn.textContent = 'Camera Live';
    captureItemBtn.disabled = false;
    startGarmentScanLoop();
  });
}

async function startTryOnCamera() {
  startTryOnCameraBtn.disabled = true;
  startTryOnCameraBtn.textContent = 'Connecting...';
  const res = await fetch(`${API}/api/session`, { method: 'POST' });
  const { apiKey, sessionId, token } = await res.json();

  tryonSession = OT.initSession(apiKey, sessionId);
  tryonPublisher = OT.initPublisher(tryonPublisherContainer, {
    width: '100%',
    height: '100%',
    fitMode: 'contain',
    style: { buttonDisplayMode: 'off' },
  });

  tryonSession.connect(token, (err) => {
    if (err) {
      console.error('Vonage connect error', err);
      alert('Could not connect to Vonage session: ' + err.message);
      startTryOnCameraBtn.disabled = false;
      startTryOnCameraBtn.textContent = 'Start Camera';
      return;
    }
    tryonSession.publish(tryonPublisher);
    startTryOnCameraBtn.textContent = 'Camera Live';
    tryonCameraWrap.classList.add('live');
  });
}

// --- Closet Scan: continuous garment auto-detection (no full body needed) ---

let garmentScanActive = false;
let repeatDetectionCount = 0;
const MAX_REPEAT_DETECTIONS = 5;

function startGarmentScanLoop() {
  garmentScanActive = true;
  toggleScanBtn.disabled = false;
  toggleScanBtn.textContent = 'Pause Auto-Scan';
  framingCaption.textContent = 'Scanning for a garment...';
  garmentLoopTimer = setInterval(checkGarmentAutoScan, 2500);
}

function toggleGarmentScanLoop() {
  if (garmentScanActive) {
    garmentScanActive = false;
    clearInterval(garmentLoopTimer);
    toggleScanBtn.textContent = 'Resume Auto-Scan';
    framingCaption.textContent = 'Auto-scan paused.';
  } else {
    garmentScanActive = true;
    repeatDetectionCount = 0;
    seenGarmentSignatures.clear();
    toggleScanBtn.textContent = 'Pause Auto-Scan';
    framingCaption.textContent = 'Scanning for a garment...';
    garmentLoopTimer = setInterval(checkGarmentAutoScan, 2500);
  }
}

function garmentSignature(item) {
  return `${item.type}-${item.color}`.toLowerCase();
}

async function checkGarmentAutoScan() {
  if (garmentCheckInFlight) return;
  garmentCheckInFlight = true;
  try {
    const image = captureScanFrame();
    if (!image) {
      framingCaption.textContent = 'Waiting for camera feed...';
      return;
    }
    const res = await fetch(`${API}/api/closet/auto-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    if (!data.detected) {
      framingCaption.textContent = data.caption;
      framingCaption.classList.remove('ready');
      seenGarmentSignatures.clear();
      repeatDetectionCount = 0;
      return;
    }

    const newItems = data.items.filter(
      (item) => !seenGarmentSignatures.has(garmentSignature(item))
    );

    if (newItems.length > 0) {
      repeatDetectionCount = 0;
      newItems.forEach((item) => {
        seenGarmentSignatures.add(garmentSignature(item));
        renderClosetItem(item);
      });
      const names = newItems.map((i) => i.name).join(', ');
      framingCaption.textContent = `✓ Added: ${names}`;
      framingCaption.classList.add('ready');
    } else {
      repeatDetectionCount += 1;
      if (repeatDetectionCount >= MAX_REPEAT_DETECTIONS) {
        clearInterval(garmentLoopTimer);
        garmentScanActive = false;
        toggleScanBtn.textContent = 'Resume Auto-Scan';
        framingCaption.textContent = `Paused — kept seeing the same item(s). Click Resume when you have something new.`;
        framingCaption.classList.remove('ready');
        return;
      }
      framingCaption.textContent = `Already added: ${data.items.map((i) => i.name).join(', ')}. Show something different to add more.`;
      framingCaption.classList.add('ready');
    }
  } catch (err) {
    console.error('Garment scan failed', err);
    framingCaption.textContent = 'Scan error: ' + err.message;
    framingCaption.classList.remove('ready');
  } finally {
    garmentCheckInFlight = false;
  }
}

// --- Try-On: countdown then snap a single frame (no AI framing check —
// deterministic and doesn't depend on a vision call judging "readiness") ---

const SNAP_COUNTDOWN_SECONDS = 5;
let snapCountdownTimer = null;
let snapCountdownActive = false;

function toggleSnapCountdown() {
  if (snapCountdownActive) {
    cancelSnapCountdown('Cancelled.');
    return;
  }
  if (!tryonPublisher) {
    return alert('Start the camera in this Try-On section first.');
  }
  snapCountdownActive = true;
  capturePersonBtn.textContent = 'Cancel';
  snapCountdownOverlay.hidden = false;
  let remaining = SNAP_COUNTDOWN_SECONDS;
  snapCountdownOverlay.textContent = remaining;
  bodyCheckStatus.textContent = 'Step back — get in frame!';
  snapCountdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(snapCountdownTimer);
      snapNow();
      return;
    }
    snapCountdownOverlay.textContent = remaining;
  }, 1000);
}

function cancelSnapCountdown(message) {
  snapCountdownActive = false;
  clearInterval(snapCountdownTimer);
  snapCountdownOverlay.hidden = true;
  capturePersonBtn.textContent = '📸 Snap Photo (5s delay)';
  bodyCheckStatus.textContent = message || '';
}

function snapNow() {
  const image = captureTryOnFrame();
  if (!image) {
    cancelSnapCountdown('Could not capture — camera feed not ready, try again.');
    return;
  }
  lastPersonFrame = image;
  capturedPersonPreview.src = image;
  capturedPersonPreview.hidden = false;
  const card = personUpload.closest('.upload-card');
  card.classList.add('filled');
  card.querySelector('.upload-sub').textContent = 'Captured from camera';
  cancelSnapCountdown('✓ Captured!');
}

// Minimum plausible size for a real captured frame's base64 payload — catches
// publisher.getImgData() occasionally returning truncated/corrupt data that
// looks like a valid data URL but fails to decode on Gemini's end.
const MIN_VALID_IMAGE_LENGTH = 5000;

function captureScanFrame() {
  return captureFrameDataUrl(scanPublisherContainer, scanPublisher);
}

function captureTryOnFrame() {
  return captureFrameDataUrl(tryonPublisherContainer, tryonPublisher);
}

function captureFrameDataUrl(container, pub) {
  // Canvas capture from the actual <video> element is the reliable path;
  // prefer it over the Vonage SDK's getImgData(), which has been observed
  // to occasionally return corrupt image data.
  const source = container.querySelector('video');
  if (source && source.videoWidth) {
    const canvas = document.createElement('canvas');
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length >= MIN_VALID_IMAGE_LENGTH) return dataUrl;
  }

  try {
    if (pub && pub.getImgData) {
      const dataUrl = 'data:image/png;base64,' + pub.getImgData();
      if (dataUrl.length >= MIN_VALID_IMAGE_LENGTH) return dataUrl;
    }
  } catch (err) {
    console.warn('publisher.getImgData failed', err);
  }

  return null;
}

async function scanImage(image, btn, idleLabel) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Scanning...';
  }
  try {
    const res = await fetch(`${API}/api/closet/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    data.items.forEach(renderClosetItem);
  } catch (err) {
    alert('Scan failed: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = idleLabel;
    }
  }
}

function createClosetCard(item) {
  const div = document.createElement('div');
  div.className = 'item';
  div.dataset.id = item.id;
  div.innerHTML = `
    <button class="item-delete" title="Remove from closet" type="button">&times;</button>
    <div class="item-hook"></div>
    <img src="${item.image}" />
    <div class="item-label">${item.name || item.type}</div>
    <button class="item-tryon" type="button">Try On</button>
  `;
  div.querySelector('img').addEventListener('click', () => selectItem(item));
  div.querySelector('.item-label').addEventListener('click', () => selectItem(item));
  div.querySelector('.item-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteClosetItem(item.id);
  });
  div.querySelector('.item-tryon').addEventListener('click', (e) => {
    e.stopPropagation();
    selectGarmentForTryOn(item);
  });
  return div;
}

// The closet shows up in all three tabs (Scan, Chat, Try-On) so you can
// pick an item without switching away from whichever you're using.
function renderClosetItem(item) {
  closetItemsById[item.id] = item;
  allClosetGrids.forEach((grid) => grid.appendChild(createClosetCard(item)));
}

function selectGarmentForTryOn(item) {
  selectedGarmentId = item.id;
  selectedGarmentImg.src = item.image;
  selectedGarmentName.textContent = item.name || item.type;
  selectedGarmentEl.hidden = false;
  garmentUpload.value = '';
  garmentUpload.closest('.upload-card').classList.remove('filled');
  garmentUpload.closest('.upload-card').querySelector('.upload-sub').textContent = 'Or upload a new one';
  document.getElementById('tryon-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearSelectedGarment() {
  selectedGarmentId = null;
  selectedGarmentEl.hidden = true;
}

async function deleteClosetItem(id) {
  try {
    await fetch(`${API}/api/closet/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.error('Failed to delete item', err);
  }
  delete closetItemsById[id];
  document.querySelectorAll(`.item[data-id="${id}"]`).forEach((card) => card.remove());
  if (selectedGarmentId === id) clearSelectedGarment();
  if (activeItemId === id) unfocusChatItem();
}

async function clearAllGarments() {
  if (!Object.keys(closetItemsById).length) return;
  if (!confirm('Remove all items from your closet? This can\'t be undone.')) return;
  try {
    await fetch(`${API}/api/closet`, { method: 'DELETE' });
  } catch (err) {
    console.error('Failed to clear closet', err);
  }
  Object.keys(closetItemsById).forEach((id) => delete closetItemsById[id]);
  allClosetGrids.forEach((grid) => (grid.innerHTML = ''));
  clearSelectedGarment();
  seenGarmentSignatures.clear();
  unfocusChatItem();
}

function unfocusChatItem() {
  activeItemId = null;
  activeItemLabel.textContent = 'General chat — ask anything, or tap an item above to focus on it.';
  quickReplyButtons.forEach((btn) => (btn.disabled = true));
  pairingImageBtn.disabled = true;
}

async function loadExistingCloset() {
  try {
    const res = await fetch(`${API}/api/closet`);
    const items = await res.json();
    items.forEach(renderClosetItem);
  } catch (err) {
    console.error('Failed to load existing closet', err);
  }
}

function selectItem(item) {
  // Switches which item the next chat message is scoped to, but keeps the
  // same running thread — the plan calls for one continuous conversation,
  // not a fresh chat per item.
  activeItemId = item.id;
  activeItemLabel.textContent = `Now focused on: ${item.name || item.type} (${item.color})`;
  quickReplyButtons.forEach((btn) => (btn.disabled = false));
  pairingImageBtn.disabled = false;
  document.querySelectorAll('.grid .item').forEach((el) =>
    el.classList.toggle('active', el.dataset.id === item.id)
  );
  requestAssessment(item);
}

async function requestAssessment(item) {
  appendChatLine('Stylist', 'Taking a look...');
  const placeholder = chatLog.lastElementChild;
  try {
    const res = await fetch(`${API}/api/closet/${item.id}/assess`, { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    placeholder.remove();
    appendChatLine('Stylist', data.reply);
    chatHistory.push({
      role: 'user',
      parts: [{ text: `(Selected ${item.name || item.type}) Give me a quick score and feedback on it.` }],
    });
    chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });
  } catch (err) {
    placeholder.textContent = 'Could not load an assessment: ' + err.message;
  }
}

async function sendChatMessage(e) {
  e.preventDefault();
  const message = chatInput.value.trim();
  chatInput.value = '';
  await sendMessage(message);
}

async function sendMessage(message) {
  if (!message) return;
  appendChatLine('You', message);
  chatInput.disabled = true;
  chatSubmit.disabled = true;
  try {
    const res = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: activeItemId || null, message, history: chatHistory }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    chatHistory.push({ role: 'user', parts: [{ text: message }] });
    chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });
    appendChatLine('Stylist', data.reply);
  } catch (err) {
    appendChatLine('Error', err.message);
  } finally {
    chatInput.disabled = false;
    chatSubmit.disabled = false;
    chatInput.focus();
  }
}

async function requestPairingImage() {
  if (!activeItemId) return;
  pairingImageBtn.disabled = true;
  pairingImageBtn.textContent = 'Generating...';
  appendChatLine('Stylist', 'Coming up with a visual...');
  const placeholder = chatLog.lastElementChild;
  try {
    const res = await fetch(`${API}/api/closet/${activeItemId}/pairing-image`, { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    placeholder.remove();
    appendChatLine('Stylist', data.reply);
    if (data.image) {
      const img = document.createElement('img');
      img.src = data.image;
      img.className = 'chat-image';
      chatLog.appendChild(img);
      chatLog.scrollTop = chatLog.scrollHeight;
    }
    chatHistory.push({ role: 'user', parts: [{ text: 'Show me a pairing picture' }] });
    chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });
  } catch (err) {
    placeholder.textContent = 'Could not generate an image: ' + err.message;
  } finally {
    pairingImageBtn.disabled = false;
    pairingImageBtn.textContent = '🖼 Show me a pairing picture';
  }
}

function appendChatLine(who, text) {
  const p = document.createElement('p');
  p.className = `bubble ${who === 'You' ? 'from-user' : 'from-stylist'}`;
  p.innerHTML = `<span class="who">${who}</span>${text}`;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadProfile() {
  try {
    const res = await fetch(`${API}/api/profile`);
    const profile = await res.json();
    profileFields.height.value = profile.height || '';
    profileFields.chest.value = profile.chest || '';
    profileFields.waist.value = profile.waist || '';
    profileFields.hips.value = profile.hips || '';
    profileFields.shoe.value = profile.shoe || '';
    profileFields.fitPreference.value = profile.fitPreference || '';
    if (Object.keys(profile).length) {
      openProfileBtn.textContent = '⚙ Style Profile ✓';
    }
  } catch (err) {
    console.error('Failed to load profile', err);
  }
}

async function saveProfile(e) {
  e.preventDefault();
  const profile = {
    height: profileFields.height.value.trim(),
    chest: profileFields.chest.value.trim(),
    waist: profileFields.waist.value.trim(),
    hips: profileFields.hips.value.trim(),
    shoe: profileFields.shoe.value.trim(),
    fitPreference: profileFields.fitPreference.value,
  };
  try {
    await fetch(`${API}/api/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    profileStatus.textContent = 'Saved.';
    openProfileBtn.textContent = '⚙ Style Profile ✓';
    setTimeout(() => profileDialog.close(), 500);
  } catch (err) {
    profileStatus.textContent = 'Failed to save: ' + err.message;
  }
}

async function getSelectedGarmentImage() {
  if (selectedGarmentId) {
    return closetItemsById[selectedGarmentId]?.image || null;
  }
  if (garmentUpload.files[0]) {
    return fileToDataUrl(garmentUpload.files[0]);
  }
  return null;
}

async function runTryOn() {
  const garmentImage = await getSelectedGarmentImage();
  if (!garmentImage) return alert('Pick a garment from your closet or upload a photo first.');

  let personImage = lastPersonFrame;
  if (personUpload.files[0]) {
    personImage = await fileToDataUrl(personUpload.files[0]);
  }
  if (!personImage) return alert('Upload a person photo or capture a camera frame first.');

  runTryonBtn.disabled = true;
  runTryonBtn.textContent = 'Generating...';
  tryonResult.innerHTML = '';
  try {
    const data = await requestTryOn(personImage, garmentImage, true);
    renderTryOnResult(data);
  } catch (err) {
    tryonResult.textContent = 'Try-on failed: ' + err.message;
  } finally {
    runTryonBtn.disabled = false;
    runTryonBtn.textContent = 'Generate Try-On';
  }
}

async function requestTryOn(personImage, garmentImage, includeLoopBack) {
  const res = await fetch(`${API}/api/tryon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personImage, garmentImage, includeLoopBack }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function renderTryOnResult(data) {
  tryonResult.innerHTML = '';
  const img = document.createElement('img');
  img.src = data.resultImage;
  tryonResult.appendChild(img);

  if (data.loopBack) {
    appendChatLine('Stylist', `Nice new piece — ${data.loopBack.reply}`);
    chatHistory.push({
      role: 'model',
      parts: [{ text: `(After try-on) ${data.loopBack.reply}` }],
    });
  }
}

// --- Live Try-On: re-captures the live camera + regenerates every 10s ---

let liveTryOnTimer = null;
let liveTryOnActive = false;
let liveTryOnInFlight = false;
let liveTryOnGarmentImage = null;
let liveTryOnGotFirstLoopBack = false;

async function toggleLiveTryOn() {
  if (liveTryOnActive) {
    stopLiveTryOn('Stopped.');
    return;
  }
  if (!tryonPublisher) {
    return alert('Start the camera in this Try-On section first.');
  }
  liveTryOnGarmentImage = await getSelectedGarmentImage();
  if (!liveTryOnGarmentImage) {
    return alert('Pick a garment from your closet or upload a photo first.');
  }

  liveTryOnActive = true;
  liveTryOnGotFirstLoopBack = false;
  liveTryOnToggleBtn.textContent = 'Stop Live Try-On';
  runTryonBtn.disabled = true;
  liveTryOnStatus.textContent = 'Generating first frame...';
  await runLiveTryOnCycle();
  liveTryOnTimer = setInterval(runLiveTryOnCycle, 10000);
}

function stopLiveTryOn(message) {
  liveTryOnActive = false;
  clearInterval(liveTryOnTimer);
  liveTryOnToggleBtn.textContent = 'Start Live Try-On (updates every 10s)';
  runTryonBtn.disabled = false;
  liveTryOnStatus.textContent = message || '';
}

async function runLiveTryOnCycle() {
  if (liveTryOnInFlight) {
    liveTryOnStatus.textContent = 'Still generating previous update, skipping this tick...';
    return;
  }
  const frame = captureTryOnFrame();
  if (!frame) {
    liveTryOnStatus.textContent = 'Waiting for camera feed...';
    return;
  }
  liveTryOnInFlight = true;
  liveTryOnStatus.textContent = 'Generating...';
  try {
    const data = await requestTryOn(frame, liveTryOnGarmentImage, !liveTryOnGotFirstLoopBack);
    liveTryOnGotFirstLoopBack = true;
    renderTryOnResult(data);
    liveTryOnStatus.textContent = `Live — last updated ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error('Live try-on cycle failed', err);
    liveTryOnStatus.textContent = 'Update failed: ' + err.message;
  } finally {
    liveTryOnInFlight = false;
  }
}
