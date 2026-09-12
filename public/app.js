const API = '';

let session, publisher;
const closetItemsById = {};
let activeItemId = null;
let chatHistory = [];
let lastPersonFrame = null;

// Closet Scan: continuous garment auto-detection loop (no full body needed).
let garmentLoopTimer = null;
let garmentCheckInFlight = false;
let seenGarmentSignatures = new Set();

// Try-On: dedicated full-body check loop, only runs while explicitly started.
let bodyLoopTimer = null;
let bodyCheckInFlight = false;
let bodyLoopActive = false;
let capturedForCurrentFit = false;
let lastOutfitSignature = null;

const publisherContainer = document.getElementById('publisher-container');
const startCameraBtn = document.getElementById('start-camera');
const toggleScanBtn = document.getElementById('toggle-scan');
const captureItemBtn = document.getElementById('capture-item');
const closetUpload = document.getElementById('closet-upload');
const clearClosetBtn = document.getElementById('clear-closet');
const closetGrid = document.getElementById('closet-grid');
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
const bodyGuide = document.getElementById('body-guide');
const bodyCheckStatus = document.getElementById('body-check-status');
const garmentSelect = document.getElementById('garment-select');
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

startCameraBtn.addEventListener('click', startVonageSession);
toggleScanBtn.addEventListener('click', toggleGarmentScanLoop);
captureItemBtn.addEventListener('click', () => scanImage(captureFrameDataUrl(), captureItemBtn, 'Capture Manually'));
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
capturePersonBtn.addEventListener('click', toggleBodyCaptureLoop);
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

async function startVonageSession() {
  startCameraBtn.disabled = true;
  startCameraBtn.textContent = 'Connecting...';
  const res = await fetch(`${API}/api/session`, { method: 'POST' });
  const { apiKey, sessionId, token } = await res.json();

  session = OT.initSession(apiKey, sessionId);
  publisher = OT.initPublisher(publisherContainer, {
    width: '100%',
    height: '100%',
    fitMode: 'contain',
    style: { buttonDisplayMode: 'off' },
  });

  session.connect(token, (err) => {
    if (err) {
      console.error('Vonage connect error', err);
      alert('Could not connect to Vonage session: ' + err.message);
      startCameraBtn.disabled = false;
      startCameraBtn.textContent = 'Start Camera';
      return;
    }
    session.publish(publisher);
    startCameraBtn.textContent = 'Camera Live';
    captureItemBtn.disabled = false;
    startGarmentScanLoop();
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
    const image = captureFrameDataUrl();
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

// --- Try-On: dedicated full-body check, only while explicitly toggled on ---

function toggleBodyCaptureLoop() {
  if (bodyLoopActive) {
    stopBodyCaptureLoop('Cancelled.');
    return;
  }
  bodyLoopActive = true;
  capturedForCurrentFit = false;
  lastOutfitSignature = null;
  bodyGuide.hidden = false;
  capturePersonBtn.textContent = 'Cancel Camera Check';
  bodyCheckStatus.textContent = 'Checking your framing...';
  bodyLoopTimer = setInterval(checkBodyFraming, 2500);
  checkBodyFraming();
}

function stopBodyCaptureLoop(finalMessage) {
  bodyLoopActive = false;
  clearInterval(bodyLoopTimer);
  bodyGuide.hidden = true;
  capturePersonBtn.textContent = 'Use Camera Instead (Full Body)';
  if (finalMessage) bodyCheckStatus.textContent = finalMessage;
}

async function checkBodyFraming() {
  if (bodyCheckInFlight) return;
  bodyCheckInFlight = true;
  try {
    const image = captureFrameDataUrl();
    if (!image) {
      bodyCheckStatus.textContent = 'Waiting for camera feed...';
      return;
    }
    const res = await fetch(`${API}/api/frame-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    bodyCheckStatus.textContent = data.caption;

    if (!data.ready || data.outfitSignature === 'none') {
      capturedForCurrentFit = false;
      lastOutfitSignature = null;
      return;
    }

    const isNewFit =
      !capturedForCurrentFit ||
      (lastOutfitSignature && data.outfitSignature !== lastOutfitSignature);

    if (isNewFit) {
      lastPersonFrame = image;
      lastOutfitSignature = data.outfitSignature;
      capturedForCurrentFit = true;
      const card = personUpload.closest('.upload-card');
      card.classList.add('filled');
      card.querySelector('.upload-sub').textContent = 'Auto-captured from camera';
      stopBodyCaptureLoop('✓ Captured! ' + data.caption);
    }
  } catch (err) {
    console.error('Body framing check failed', err);
    bodyCheckStatus.textContent = 'Check error: ' + err.message;
  } finally {
    bodyCheckInFlight = false;
  }
}

// Minimum plausible size for a real captured frame's base64 payload — catches
// publisher.getImgData() occasionally returning truncated/corrupt data that
// looks like a valid data URL but fails to decode on Gemini's end.
const MIN_VALID_IMAGE_LENGTH = 5000;

function captureFrameDataUrl() {
  // Canvas capture from the actual <video> element is the reliable path;
  // prefer it over the Vonage SDK's getImgData(), which has been observed
  // to occasionally return corrupt image data.
  const source = publisherContainer.querySelector('video');
  if (source && source.videoWidth) {
    const canvas = document.createElement('canvas');
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length >= MIN_VALID_IMAGE_LENGTH) return dataUrl;
  }

  try {
    if (publisher && publisher.getImgData) {
      const dataUrl = 'data:image/png;base64,' + publisher.getImgData();
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

function renderClosetItem(item) {
  closetItemsById[item.id] = item;
  const div = document.createElement('div');
  div.className = 'item';
  div.dataset.id = item.id;
  div.innerHTML = `
    <button class="item-delete" title="Remove from closet" type="button">&times;</button>
    <div class="item-hook"></div>
    <img src="${item.image}" />
    <div class="item-label">${item.name || item.type}</div>
  `;
  div.querySelector('img').addEventListener('click', () => selectItem(item));
  div.querySelector('.item-label').addEventListener('click', () => selectItem(item));
  div.querySelector('.item-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteClosetItem(item.id);
  });
  closetGrid.appendChild(div);

  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = item.name || item.type;
  garmentSelect.appendChild(option);
}

async function deleteClosetItem(id) {
  try {
    await fetch(`${API}/api/closet/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.error('Failed to delete item', err);
  }
  delete closetItemsById[id];
  const card = closetGrid.querySelector(`.item[data-id="${id}"]`);
  if (card) card.remove();
  const option = garmentSelect.querySelector(`option[value="${id}"]`);
  if (option) option.remove();
  if (activeItemId === id) {
    activeItemId = null;
    activeItemLabel.textContent = 'Select an item above to focus the chat on it.';
    chatInput.disabled = true;
    chatSubmit.disabled = true;
    quickReplyButtons.forEach((btn) => (btn.disabled = true));
    pairingImageBtn.disabled = true;
  }
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
  closetGrid.innerHTML = '';
  [...garmentSelect.options].forEach((opt) => {
    if (opt.value) opt.remove();
  });
  seenGarmentSignatures.clear();
  activeItemId = null;
  activeItemLabel.textContent = 'Select an item above to focus the chat on it.';
  chatInput.disabled = true;
  chatSubmit.disabled = true;
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
  chatInput.disabled = false;
  chatSubmit.disabled = false;
  quickReplyButtons.forEach((btn) => (btn.disabled = false));
  pairingImageBtn.disabled = false;
  [...closetGrid.children].forEach((el) =>
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
  if (!message || !activeItemId) return;
  appendChatLine('You', message);
  chatInput.disabled = true;
  chatSubmit.disabled = true;
  try {
    const res = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: activeItemId, message, history: chatHistory }),
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
  if (garmentSelect.value) {
    return closetItemsById[garmentSelect.value]?.image || null;
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
  if (!publisher) {
    return alert('Start the camera in the Closet Scan section first — live try-on reuses that feed.');
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
  const frame = captureFrameDataUrl();
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
