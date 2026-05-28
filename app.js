const videoGrid = document.getElementById('videoGrid');
const micBtn = document.getElementById('micBtn');
const camBtn = document.getElementById('camBtn');
const chatBtn = document.getElementById('chatBtn');
const closeChatBtn = document.getElementById('closeChatBtn');
const hangBtn = document.getElementById('hangBtn');
const statusText = document.getElementById('statusText');
const sidebarDrawer = document.getElementById('sidebarDrawer');
const messages = document.getElementById('messages');
const startSessionBtn = document.getElementById('startSessionBtn');
const landingPage = document.getElementById('landingPage');

let stream = null; let micOn = true; let camOn = true;
let peer = null; let currentCall = null; let remoteObj = null;

// Mobile View Adjuster Engine
function handleMobileViewHeight() {
  if (window.innerWidth <= 900) {
    if (!document.body.classList.contains('chat-collapsed') && window.visualViewport) {
      sidebarDrawer.style.height = `${window.visualViewport.height}px`;
    } else {
      sidebarDrawer.style.height = '';
    }
  } else {
    sidebarDrawer.style.height = '';
  }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', handleMobileViewHeight);
  window.visualViewport.addEventListener('scroll', handleMobileViewHeight);
}

// Initial Mobile Load Workspace Visibility Layout Look
if (window.innerWidth <= 900) {
  document.body.classList.add('chat-collapsed');
  document.body.classList.remove('chat-open');
  chatBtn.classList.remove('active-chat');
}

// Alerts / Confirm Logic
let currentConfirmAction = null;

function showCustomAlert(message) {
  document.getElementById('customAlertText').textContent = message;
  document.getElementById('customAlertModal').classList.add('show');
}

document.getElementById('customAlertCloseBtn').addEventListener('click', () => {
  document.getElementById('customAlertModal').classList.remove('show');
});

function showCustomConfirm(message, confirmedCallback) {
  document.getElementById('customConfirmText').textContent = message;
  currentConfirmAction = confirmedCallback;
  document.getElementById('customConfirmModal').classList.add('show');
}

document.getElementById('customConfirmCancelBtn').addEventListener('click', () => {
  document.getElementById('customConfirmModal').classList.remove('show');
  currentConfirmAction = null;
});

document.getElementById('customConfirmOkBtn').addEventListener('click', () => {
  document.getElementById('customConfirmModal').classList.remove('show');
  if (currentConfirmAction) currentConfirmAction();
  currentConfirmAction = null;
});

function createParticipantTile(name, type = 'remote', streamObject = null) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  const initials = name.charAt(0).toUpperCase();

  tile.innerHTML = `
    <video ${type === 'local' ? 'muted' : ''} autoplay playsinline></video>
    <div class='placeholder'>
      ${type === 'local' ? `
      <div class='live-pulse-container'>
        <div class='pulse-ring'></div>
        <div class='medical'>☤</div>
      </div>
      <h2>Live Clinical Feed</h2>
      <p>Camera active inside secure sandbox container.</p>
      ` : `
      <div class="loading-spinner"></div>
      <h2>Connecting...</h2>
      <p>Awaiting incoming secure media handshakes.</p>
      `}
    </div>
    <div class='user-tag'><div class='avatar'>${initials}</div><div class='info'><strong>${name}</strong><span>${type === 'local' ? 'Host' : (streamObject ? 'Connected' : 'Connecting...')}</span></div></div>
  `;

  const video = tile.querySelector('video');
  const placeholder = tile.querySelector('.placeholder');
  if (type === 'local') video.style.transform = 'scaleX(-1)';

  if (streamObject) {
    video.srcObject = streamObject;
    video.onloadedmetadata = () => { 
      video.play(); 
      placeholder.style.display = 'none'; 
      if (type === 'remote') tile.querySelector('.info span').textContent = 'Connected';
    };
  } else {
    placeholder.style.display = 'flex';
  }
  return { tile, video, placeholder };
}

// ─── PeerJS config with reliable STUN + free TURN (handles strict NAT/mobile) ──
const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  }
};

function handleRemoteStream(remoteStream) {
  console.log('REMOTE STREAM RECEIVED');
  if (remoteObj && remoteObj.video) {
    remoteObj.video.srcObject = remoteStream;
    remoteObj.video.play().catch(() => {});
    if (remoteObj.placeholder) remoteObj.placeholder.style.display = 'none';
    const span = remoteObj.tile.querySelector('.info span');
    if (span) span.textContent = 'Connected';
    statusText.textContent = 'Connected (Live)';
  }
}

function handleRemoteDisconnect() {
  if (remoteObj && remoteObj.placeholder) {
    remoteObj.video.srcObject = null;
    remoteObj.placeholder.style.display = 'flex';
    const h2 = remoteObj.placeholder.querySelector('h2');
    if (h2) h2.textContent = 'Disconnected';
    const p = remoteObj.placeholder.querySelector('p');
    if (p) p.textContent = 'The remote peer has left the session.';
    const span = remoteObj.tile.querySelector('.info span');
    if (span) span.textContent = 'Disconnected';
    statusText.textContent = 'Peer disconnected';
  }
}

function setupCallHandlers(call) {
  currentCall = call;
  call.on('stream', handleRemoteStream);
  call.on('close', handleRemoteDisconnect);
  call.on('error', (err) => console.error('Call error:', err));
}

function connectAsGuest(roomId) {
  console.log('GUEST MODE: room taken, will call host ID:', roomId);
  if (peer) { try { peer.destroy(); } catch(e) {} peer = null; }

  peer = new Peer(undefined, PEER_CONFIG);

  peer.on('open', (myId) => {
    console.log('Guest peer open, ID:', myId, '- calling host in 800ms');
    statusText.textContent = 'Calling host...';
    setTimeout(() => {
      if (!stream) { showCustomAlert('No camera stream. Reload and allow camera access.'); return; }
      const call = peer.call(roomId, stream);
      if (!call) { showCustomAlert('Could not reach host. Make sure Device 1 joined first, then try again.'); return; }
      setupCallHandlers(call);
      console.log('Call placed to host:', roomId);
    }, 800);
  });

  peer.on('error', (err) => {
    console.error('GUEST error:', err.type, err.message);
    if (err.type === 'network' || err.type === 'server-error') {
      setTimeout(() => connectAsGuest(roomId), 3000);
    } else {
      showCustomAlert('Connection error: ' + err.type + '. Try reloading on both devices.');
    }
  });

  peer.on('disconnected', () => { console.warn('Guest disconnected from broker, reconnecting'); peer.reconnect(); });
}

function initializePeerConnection(roomId) {
  if (typeof Peer === 'undefined') { showCustomAlert('PeerJS failed to load. Check internet and reload.'); return; }
  if (peer) { try { peer.destroy(); } catch(e) {} peer = null; }

  console.log('HOST MODE: claiming peer ID:', roomId);
  peer = new Peer(roomId, PEER_CONFIG);

  peer.on('open', (id) => {
    console.log('HOST peer open, ID:', id, '- waiting for guest...');
    statusText.textContent = 'Waiting for guest...';

    peer.on('call', (incomingCall) => {
      console.log('INCOMING CALL - answering...');
      if (!stream) { console.error('No stream to answer with'); return; }
      incomingCall.answer(stream);
      setupCallHandlers(incomingCall);
    });
  });

  peer.on('error', (err) => {
    if (err.type === 'unavailable-id' || err.type === 'id-taken') {
      console.log('Host ID taken - switching to GUEST mode');
      connectAsGuest(roomId);
    } else if (err.type === 'network' || err.type === 'server-error') {
      console.warn('Broker hiccup, retrying host in 3s:', err.type);
      statusText.textContent = 'Connecting...';
      setTimeout(() => initializePeerConnection(roomId), 3000);
    } else {
      console.error('HOST error:', err.type, err.message);
      showCustomAlert('Connection error: ' + err.type + '. Reload the page on both devices and try again.');
    }
  });

  peer.on('disconnected', () => { console.warn('Host disconnected from broker, reconnecting'); statusText.textContent = 'Reconnecting...'; peer.reconnect(); });
}

// ─── Join Workspace button ─────────────────────────────────────────────────────
const ROOM_ID = 'telehealth-room-1'; 

startSessionBtn.addEventListener('click', async () => {
  landingPage.style.display = 'none';
  videoGrid.innerHTML = '';
  statusText.textContent = 'Requesting camera…';

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
    } else {
      throw new Error('getUserMedia not supported in this browser/context.');
    }
  } catch (e) {
    console.warn('Could not get camera/mic:', e.message);
    showCustomAlert('Could not access camera or microphone.\n\nMake sure you:\n• Allowed camera/mic permission\n• Are using HTTPS (not http://)\n• Are not in a browser that blocks WebRTC');
    landingPage.style.display = 'flex';
    return; 
  }

  document.body.classList.add('joined');
  statusText.textContent = 'Connecting…';

  const localObj = createParticipantTile('You (Doctor)', 'local', stream);
  remoteObj = createParticipantTile('Consulting Peer', 'remote', null);

  remoteObj.tile.classList.add('maximized');
  localObj.tile.classList.add('minimized');

  [localObj.tile, remoteObj.tile].forEach(tile => {
    tile.addEventListener('click', function() {
      if (this.classList.contains('minimized')) {
        const currentMax = videoGrid.querySelector('.maximized');
        if (currentMax) {
          currentMax.classList.remove('maximized');
          currentMax.classList.add('minimized');
        }
        this.classList.remove('minimized');
        this.classList.add('maximized');
      }
    });
  });

  videoGrid.appendChild(remoteObj.tile);
  videoGrid.appendChild(localObj.tile);

  initializePeerConnection(ROOM_ID);
});

micBtn.addEventListener('click', () => { if(!stream) return; micOn = !micOn; stream.getAudioTracks().forEach(t => t.enabled = micOn); micBtn.classList.toggle('off', !micOn); });
camBtn.addEventListener('click', () => { if(!stream) return; camOn = !camOn; stream.getVideoTracks().forEach(t => t.enabled = camOn); camBtn.classList.toggle('off', !camOn); });

function toggleChatPanel() {
  document.body.classList.toggle('chat-collapsed');
  chatBtn.classList.toggle('active-chat', !document.body.classList.contains('chat-collapsed'));
  handleMobileViewHeight();
  if (!document.body.classList.contains('chat-collapsed')) {
    setTimeout(() => { messages.scrollTop = messages.scrollHeight; }, 50);
  }
}
chatBtn.addEventListener('click', toggleChatPanel);
closeChatBtn.addEventListener('click', toggleChatPanel);

const tabChatBtn = document.getElementById('tabChatBtn');
const tabRxBtn = document.getElementById('tabRxBtn');
const viewChat = document.getElementById('viewChat');
const viewRx = document.getElementById('viewRx');

function openChatTab() {
  tabChatBtn.classList.add('active'); tabRxBtn.classList.remove('active');
  viewChat.classList.add('active'); viewRx.classList.remove('active');
  setTimeout(() => { messages.scrollTop = messages.scrollHeight; }, 30);
}
function openRxTab() {
  tabRxBtn.classList.add('active'); tabChatBtn.classList.remove('active');
  viewRx.classList.add('active'); viewChat.classList.remove('active');
}
tabChatBtn.addEventListener('click', openChatTab);
tabRxBtn.addEventListener('click', openRxTab);

hangBtn.addEventListener('click', () => {
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (currentCall) currentCall.close();
  if (peer) peer.destroy();
  document.body.classList.remove('joined');
  statusText.textContent = 'Disconnected'; videoGrid.innerHTML = '';
  showCustomAlert("Session terminated.");
  landingPage.style.display = 'flex';
});

// Chat Attachments Processing
const photoInput = document.getElementById('photoInput');
const triggerFileBtn = document.getElementById('triggerFileBtn');
const uploadPreviewBar = document.getElementById('uploadPreviewBar');
const previewThumb = document.getElementById('previewThumb');
const removePreviewBtn = document.getElementById('removePreviewBtn');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const messagesContainer = document.getElementById('messages');

triggerFileBtn.addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      previewThumb.src = event.target.result;
      uploadPreviewBar.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }
});
removePreviewBtn.addEventListener('click', () => {
  photoInput.value = '';
  uploadPreviewBar.style.display = 'none';
  previewThumb.src = '';
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  const hasImg = uploadPreviewBar.style.display === 'flex';

  if (!text && !hasImg) return;

  if (hasImg) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-img-wrap';
    const img = document.createElement('img');
    img.src = previewThumb.src;
    img.addEventListener('click', () => {
      document.getElementById('lightboxImg').src = img.src;
      document.getElementById('lightboxOverlay').style.display = 'flex';
    });
    wrap.appendChild(img);
    if (text) {
      const msg = document.createElement('div');
      msg.className = 'msg me';
      msg.textContent = text;
      wrap.appendChild(msg);
    }
    messagesContainer.appendChild(wrap);
    photoInput.value = '';
    uploadPreviewBar.style.display = 'none';
    previewThumb.src = '';
  } else {
    const msg = document.createElement('div');
    msg.className = 'msg me';
    msg.textContent = text;
    messagesContainer.appendChild(msg);
  }
  chatInput.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

document.getElementById('closeLightboxBtn').addEventListener('click', () => {
  document.getElementById('lightboxOverlay').style.display = 'none';
});
document.getElementById('printImageBtn').addEventListener('click', () => {
  const win = window.open('');
  win.document.write(`<img src="${document.getElementById('lightboxImg').src}" style="max-width:100%;">`);
  win.document.close();
  win.focus();
  win.print();
  win.close();
});

// Medication Added Multi-Group Row Manager
let medCount = 1;
document.getElementById('addMedBtn').addEventListener('click', () => {
  medCount++;
  const group = document.createElement('div');
  group.className = 'med-group';
  group.innerHTML = `
    <div class="med-row-header">
      <label style="font-size: 11px; font-weight: 700; color: var(--meet-green-dark); text-transform: uppercase; letter-spacing: 0.5px;">Medication #${medCount}</label>
      <button type="button" class="remove-med-btn">&times; Remove</button>
    </div>
    <div class="rx-field">
      <label>Medication Name</label>
      <input type="text" class="rx-input rx-med-name" placeholder="e.g. Amoxicillin">
    </div>
    <div class="rx-field">
      <label>Dosage strength</label>
      <input type="text" class="rx-input rx-med-dosage" placeholder="e.g. 500mg">
    </div>
    <div class="rx-field">
      <label>Frequency & Duration</label>
      <input type="text" class="rx-input rx-med-freq" placeholder="e.g. 1 Tablet twice daily for 5 days">
    </div>
  `;
  group.querySelector('.remove-med-btn').addEventListener('click', () => { group.remove(); });
  document.getElementById('rxMedsContainer').appendChild(group);
});

// Prescription Management Formatting Logic
function getRxData() {
  const medGroups = document.querySelectorAll('.med-group');
  const medsList = [];
  
  medGroups.forEach(group => {
    const nameVal = group.querySelector('.rx-med-name').value.trim();
    if (nameVal) {
      medsList.push({
        name: nameVal,
        dosage: group.querySelector('.rx-med-dosage').value.trim(),
        freq: group.querySelector('.rx-med-freq').value.trim()
      });
    }
  });

  if (medsList.length === 0) {
    medsList.push({ name: '_______________________', dosage: '', freq: 'As directed' });
  }

  return {
    patient: document.getElementById('rxPatient').value.trim() || '_______________________',
    meds: medsList,
    notes: document.getElementById('rxNotes').value.trim() || '',
    dateStr: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  };
}

document.getElementById('sendChatRxBtn').addEventListener('click', () => {
  showCustomConfirm("Send this digital prescription to the active chat session?", () => {
    const data = getRxData();
    const card = document.createElement('div');
    card.className = 'rx-chat-card';
    
    let medsHtml = '';
    data.meds.forEach((m, idx) => {
      medsHtml += `<p><strong>Medication #${idx+1}:</strong> ${m.name} ${m.dosage} - ${m.freq}</p>`;
    });

    card.innerHTML = `
      <div class="rx-chat-header"><span class="icon">℞</span> Prescription Doc</div>
      <div class="rx-chat-body">
        <p><strong>Patient:</strong> ${data.patient}</p>
        ${medsHtml}
        ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
        <p style="font-size:11px; color:var(--muted); margin-top:4px;">Issued: ${data.dateStr}</p>
      </div>
      <div class="rx-chat-footer">
        <button class="inline-print-btn rx-print-trigger">Print</button>
      </div>
    `;
    
    card.querySelector('.rx-print-trigger').addEventListener('click', () => { printPrescriptionData(data); });
    messagesContainer.appendChild(card);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    openChatTab();
  });
});

document.getElementById('directPrintRxBtn').addEventListener('click', () => {
  const data = getRxData();
  printPrescriptionData(data);
});

function printPrescriptionData(data) {
  const win = window.open('', '_blank');
  let medsLines = '';
  data.meds.forEach((m, i) => {
    medsLines += `<li><strong>${m.name}</strong> ${m.dosage} <br><small>${m.freq}</small></li>`;
  });
  win.document.write(`
    <html>
    <head><title>Prescription - ${data.patient}</title></head>
    <body style="font-family:sans-serif; padding:40px; color:#1e293b;">
      <h2 style="color:#34A853; border-bottom:2px solid #34A853; padding-bottom:10px;">℞ Telemedicine Sync - Prescription</h2>
      <p><strong>Date:</strong> ${data.dateStr}</p>
      <p><strong>Patient Name:</strong> ${data.patient}</p>
      <hr style="border:0; border-top:1px solid #e2e8f0; margin:20px 0;">
      <h3>Medications:</h3>
      <ul>${medsLines}</ul>
      ${data.notes ? '<hr style="border:0; border-top:1px solid #e2e8f0; margin:20px 0;"><h3>Notes / Directions:</h3><p>' + data.notes + '</p>' : ''}
      <br><br><br>
      <p style="border-top:1px solid #cbd5e1; display:inline-block; padding-top:5px; width:200px;">Authorized Electronic Signature</p>
      <script>window.onload = function() { window.print(); window.close(); }</script>
    </body>
    </html>
  `);
  win.document.close();
}
