// Global Application State
let localStream = null;
let currentCall = null;
let activeConn = null;
let peer = null;
let myPeerId = null;
let targetPeerId = null;
let currentAttachmentData = null; // Holds base64 encoded attached images

// DOM Element Registry
const landingPage = document.getElementById('landingPage');
const startSessionBtn = document.getElementById('startSessionBtn');
const statusText = document.getElementById('statusText');
const videoGrid = document.getElementById('videoGrid');
const micBtn = document.getElementById('micBtn');
const camBtn = document.getElementById('camBtn');
const chatBtn = document.getElementById('chatBtn');
const hangBtn = document.getElementById('hangBtn');
const sidebarDrawer = document.getElementById('sidebarDrawer');
const closeChatBtn = document.getElementById('closeChatBtn');
const tabChatBtn = document.getElementById('tabChatBtn');
const tabRxBtn = document.getElementById('tabRxBtn');
const viewChat = document.getElementById('viewChat');
const viewRx = document.getElementById('viewRx');
const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const photoInput = document.getElementById('photoInput');
const triggerFileBtn = document.getElementById('triggerFileBtn');
const uploadPreviewBar = document.getElementById('uploadPreviewBar');
const previewThumb = document.getElementById('previewThumb');
const removePreviewBtn = document.getElementById('removePreviewBtn');

// Prescription Form Elements
const rxPatient = document.getElementById('rxPatient');
const rxMedsContainer = document.getElementById('rxMedsContainer');
const addMedBtn = document.getElementById('addMedBtn');
const rxNotes = document.getElementById('rxNotes');
const sendChatRxBtn = document.getElementById('sendChatRxBtn');
const directPrintRxBtn = document.getElementById('directPrintRxBtn');

// Lightbox Elements
const lightboxOverlay = document.getElementById('lightboxOverlay');
const lightboxImg = document.getElementById('lightboxImg');
const closeLightboxBtn = document.getElementById('closeLightboxBtn');
const printImageBtn = document.getElementById('printImageBtn');

// Custom Dialog Elements
const customAlertModal = document.getElementById('customAlertModal');
const customAlertText = document.getElementById('customAlertText');
const customAlertCloseBtn = document.getElementById('customAlertCloseBtn');
const customConfirmModal = document.getElementById('customConfirmModal');
const customConfirmText = document.getElementById('customConfirmText');
const customConfirmCancelBtn = document.getElementById('customConfirmCancelBtn');
const customConfirmOkBtn = document.getElementById('customConfirmOkBtn');

// --------------------------------------------------------
// Custom Dialog & Alert Utilities
// --------------------------------------------------------
function showAlert(message) {
  customAlertText.textContent = message;
  customAlertModal.classList.add('active');
}
customAlertCloseBtn.addEventListener('click', () => {
  customAlertModal.classList.remove('active');
});

function showConfirm(message, onConfirm) {
  customConfirmText.textContent = message;
  customConfirmModal.classList.add('active');
  
  const handleOk = () => {
    onConfirm();
    cleanup();
  };
  const handleCancel = () => {
    cleanup();
  };
  const cleanup = () => {
    customConfirmOkBtn.removeEventListener('click', handleOk);
    customConfirmCancelBtn.removeEventListener('click', handleCancel);
    customConfirmModal.classList.remove('active');
  };
  
  customConfirmOkBtn.addEventListener('click', handleOk);
  customConfirmCancelBtn.addEventListener('click', handleCancel);
}

// --------------------------------------------------------
// Navigation, Sidebar, and Tab Control UI
// --------------------------------------------------------
chatBtn.addEventListener('click', () => {
  document.body.classList.toggle('chat-open');
});
closeChatBtn.addEventListener('click', () => {
  document.body.classList.remove('chat-open');
});

tabChatBtn.addEventListener('click', () => {
  tabChatBtn.classList.add('active');
  tabRxBtn.classList.remove('active');
  viewChat.classList.add('active');
  viewRx.classList.remove('active');
});

tabRxBtn.addEventListener('click', () => {
  tabRxBtn.classList.add('active');
  tabChatBtn.classList.remove('active');
  viewRx.classList.add('active');
  viewChat.classList.remove('active');
});

// Dynamic Medication Rows for Rx Builder
let medCount = 1;
addMedBtn.addEventListener('click', () => {
  medCount++;
  const medGroup = document.createElement('div');
  medGroup.classList.add('med-group');
  medGroup.style.marginTop = '15px';
  medGroup.style.borderTop = '1px dashed #e2e8f0';
  medGroup.style.paddingTop = '15px';
  
  medGroup.innerHTML = `
    <div class="med-row-header" style="display:flex; justify-content:space-between; align-items:center;">
      <label style="font-size: 11px; font-weight: 700; color: var(--meet-green-dark); text-transform: uppercase; letter-spacing: 0.5px;">Medication #${medCount}</label>
      <button type="button" class="btn-remove-med" style="background:none; border:none; color:#e53e3e; font-size:12px; cursor:pointer;">Remove</button>
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
  
  medGroup.querySelector('.btn-remove-med').addEventListener('click', () => {
    medGroup.remove();
  });
  rxMedsContainer.appendChild(medGroup);
});

// --------------------------------------------------------
// Main Initialization Routine
// --------------------------------------------------------
startSessionBtn.addEventListener('click', async () => {
  landingPage.style.display = 'none';
  statusText.textContent = 'Connecting to AV hardware...';
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    displayLocalStream(localStream);
    initializePeer();
  } catch (err) {
    console.error(err);
    statusText.textContent = 'Hardware access blocked';
    showAlert('Could not initialize video/audio hardware. Please verify system permissions.');
  }
});

function displayLocalStream(stream) {
  if (document.getElementById('localVideoContainer')) return;
  
  const container = document.createElement('div');
  container.className = 'video-wrapper local';
  container.id = 'localVideoContainer';
  
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true; 
  
  const badge = document.createElement('div');
  badge.className = 'video-label';
  badge.textContent = 'You (Local)';
  
  container.appendChild(video);
  container.appendChild(badge);
  videoGrid.appendChild(container);
}

// --------------------------------------------------------
// Core Signaling & Network Configuration
// --------------------------------------------------------
function initializePeer() {
  statusText.textContent = 'Synchronizing secure server pipeline...';
  
  // URL Hash routing setup: checks if explicit channel room is set
  const hash = window.location.hash.replace('#', '');
  
  if (hash === 'host' || !hash) {
    myPeerId = 'telehealth-session-host-secured';
    targetPeerId = 'telehealth-session-client-secured';
    if (!hash) window.location.hash = 'host';
  } else {
    myPeerId = 'telehealth-session-client-secured';
    targetPeerId = 'telehealth-session-host-secured';
  }

  // Connects directly to localized or configured broker stack
  peer = new Peer(myPeerId, {
    host: window.location.hostname,
    port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
    path: '/peerjs',
    debug: 1
  });

  peer.on('open', (id) => {
    console.log('Secure channel allocated ID:', id);
    statusText.textContent = 'Ready. Awaiting remote provider connection...';
    document.querySelector('.connection .dot').style.backgroundColor = '#ecc94b';
    
    // Client initiates synchronization pipeline immediately
    if (myPeerId === 'telehealth-session-client-secured') {
      establishSecurePipeline();
    }
  });

  // CRITICAL FIX: Remote Data Listener for incoming message pipelines
  peer.on('connection', (conn) => {
    console.log('Inbound secure text pipeline open requested by peer.');
    activeConn = conn;
    bindDataPipelineEvents(activeConn);
  });

  // Remote Audio/Video Streaming Request Interceptor
  peer.on('call', (call) => {
    console.log('Inbound encrypted AV stream requested.');
    currentCall = call;
    call.answer(localStream);
    
    call.on('stream', (remoteStream) => {
      displayRemoteStream(remoteStream);
    });
    
    call.on('close', () => {
      removeRemoteVideo();
    });
  });

  peer.on('error', (err) => {
    console.error('Peer pipeline exception:', err);
    if (err.type === 'peer-not-found') {
      statusText.textContent = 'Target line offline. Retrying...';
      setTimeout(() => {
        if (myPeerId === 'telehealth-session-client-secured') establishSecurePipeline();
      }, 3000);
    } else {
      statusText.textContent = 'Pipeline error';
    }
  });
}

// Client Handshake Initialization Wrapper
function establishSecurePipeline() {
  statusText.textContent = 'Connecting to workspace...';
  
  // Initialize the mandatory text data pipeline
  activeConn = peer.connect(targetPeerId, { reliable: true });
  bindDataPipelineEvents(activeConn);
  
  // Initialize the parallel AV multi-media stream
  currentCall = peer.call(targetPeerId, localStream);
  currentCall.on('stream', (remoteStream) => {
    displayRemoteStream(remoteStream);
  });
  currentCall.on('close', () => {
    removeRemoteVideo();
  });
}

function displayRemoteStream(stream) {
  if (document.getElementById('remoteVideoContainer')) return;
  
  const container = document.createElement('div');
  container.className = 'video-wrapper remote';
  container.id = 'remoteVideoContainer';
  
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  
  const badge = document.createElement('div');
  badge.className = 'video-label';
  badge.textContent = 'Remote Participant';
  
  container.appendChild(video);
  container.appendChild(badge);
  videoGrid.appendChild(container);
  
  statusText.textContent = 'Pipeline Active (Encrypted)';
  document.querySelector('.connection .dot').style.backgroundColor = 'var(--meet-green-primary)';
}

function removeRemoteVideo() {
  const remoteVideo = document.getElementById('remoteVideoContainer');
  if (remoteVideo) remoteVideo.remove();
  statusText.textContent = 'Remote participant disconnected';
  document.querySelector('.connection .dot').style.backgroundColor = '#e53e3e';
}

// --------------------------------------------------------
// CRITICAL CORRECTION: Bidirectional Data Stream Binder
// --------------------------------------------------------
function bindDataPipelineEvents(conn) {
  conn.on('open', () => {
    console.log('Secure bidirectional text pipeline verified.');
    statusText.textContent = 'Pipeline Active (Encrypted)';
    document.querySelector('.connection .dot').style.backgroundColor = 'var(--meet-green-primary)';
  });

  // EXPLICIT SYSTEM CORRECTION: Listen for and render incoming text/image blocks
  conn.on('data', (data) => {
    console.log('Encrypted packet payload payload received:', data);
    if (data && (data.text || data.image || data.type === 'prescription')) {
      appendMessage('remote', data);
    }
  });

  conn.on('close', () => {
    console.warn('Secure data channel connection dropped by peer.');
    activeConn = null;
    statusText.textContent = 'Data tunnel connection lost';
    document.querySelector('.connection .dot').style.backgroundColor = '#ecc94b';
  });
  
  conn.on('error', (err) => {
    console.error('Data tunnel channel runtime exception:', err);
  });
}

// --------------------------------------------------------
// Messaging Pipeline & Renderer Logic
// --------------------------------------------------------
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const messageText = chatInput.value.trim();
  if (!messageText && !currentAttachmentData) return;

  const payload = {
    sender: myPeerId,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text: messageText || null,
    image: currentAttachmentData || null
  };

  // Fail-safe state interception if user attempts transmission over dead connection
  if (!activeConn || !activeConn.open) {
    showAlert('Message delivery failed: Safe channel connection is offline. Attempting pipeline restoration...');
    if (myPeerId === 'telehealth-session-client-secured') {
      establishSecurePipeline();
    }
    return;
  }

  // Synchronous network dispatch across Data Channel
  activeConn.send(payload);
  
  // Render message natively inside local window frame
  appendMessage('local', payload);
  
  // Clean UI input area buffers
  chatInput.value = '';
  clearImageAttachment();
});

function appendMessage(origin, payload) {
  const msgBlock = document.createElement('div');
  msgBlock.className = `msg ${origin === 'local' ? 'sent' : 'received'}`;
  
  // Context Renderer for Prescription payloads
  if (payload.type === 'prescription') {
    msgBlock.classList.add('rx-payload-card');
    let medsHtml = '';
    payload.medications.forEach(m => {
      medsHtml += `<div style="margin-top:6px; font-size:12px; background:#f7fafc; padding:6px; border-left:3px solid var(--meet-green-primary);">
        <strong>${escapeHtml(m.name)}</strong> - ${escapeHtml(m.dosage)}<br>
        <span style="font-size:11px; color:#4a5568;">${escapeHtml(m.frequency)}</span>
      </div>`;
    });
    
    msgBlock.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; border-bottom:1px solid #edf2f7; padding-bottom:6px; margin-bottom:6px;">
        <span style="font-size:18px; color:var(--meet-green-primary)">℞</span>
        <strong style="font-size:13px; color:var(--meet-green-dark)">Official Digital Prescription</strong>
      </div>
      <div style="font-size:12px; margin-bottom:4px;"><strong>Patient:</strong> ${escapeHtml(payload.patient)}</div>
      ${medsHtml}
      ${payload.notes ? `<div style="margin-top:8px; font-size:11px; font-style:italic; color:#718096; border-top:1px dashed #edf2f7; paddingTop:6px;">Notes: ${escapeHtml(payload.notes)}</div>` : ''}
      <div style="text-align:right; font-size:9px; opacity:0.6; margin-top:6px;">${payload.timestamp}</div>
    `;
    messagesContainer.appendChild(msgBlock);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return;
  }

  // Renderer Context for typical Text & File attachments
  let content = '';
  if (payload.image) {
    content += `<img src="${payload.image}" class="chat-embedded-img" style="max-width:100%; border-radius:8px; margin-bottom:4px; cursor:pointer;" onclick="launchLightbox('${payload.image}')" alt="Shared Media">`;
  }
  if (payload.text) {
    content += `<p style="margin:0; word-break:break-word;">${escapeHtml(payload.text)}</p>`;
  }
  
  content += `<span class="time" style="display:block; text-align:right; font-size:9px; opacity:0.6; margin-top:2px;">${payload.timestamp}</span>`;
  msgBlock.innerHTML = content;
  
  messagesContainer.appendChild(msgBlock);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// --------------------------------------------------------
// Media File Buffer Handling & Attachments Pipeline
// --------------------------------------------------------
triggerFileBtn.addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showAlert('Format blocked: Only active image file types can be shared over clinical sessions.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    currentAttachmentData = event.target.result;
    previewThumb.src = currentAttachmentData;
    uploadPreviewBar.classList.add('active');
  };
  reader.readAsDataURL(file);
});

removePreviewBtn.addEventListener('click', clearImageAttachment);

function clearImageAttachment() {
  currentAttachmentData = null;
  photoInput.value = '';
  uploadPreviewBar.classList.remove('active');
  previewThumb.src = '';
}

// --------------------------------------------------------
// Clinical Rx Form Actions & Verification Pipelines
// --------------------------------------------------------
sendChatRxBtn.addEventListener('click', () => {
  const patientName = rxPatient.value.trim();
  if (!patientName) {
    showAlert('Validation Failed: A valid Patient Name registry value is mandatory.');
    return;
  }

  const compiledMedications = [];
  const medRows = rxMedsContainer.querySelectorAll('.med-group');
  let validMeds = true;

  medRows.forEach(row => {
    const name = row.querySelector('.rx-med-name').value.trim();
    const dosage = row.querySelector('.rx-med-dosage').value.trim();
    const frequency = row.querySelector('.rx-med-freq').value.trim();

    if (!name || !dosage || !frequency) {
      validMeds = false;
      return;
    }
    compiledMedications.push({ name, dosage, frequency });
  });

  if (!validMeds || compiledMedications.length === 0) {
    showAlert('Validation Failed: All dynamic fields inside open Medication Rows must be fully populated.');
    return;
  }

  showConfirm('Verify transmission: Submit generated prescription sheet directly into current secure conversation channel?', () => {
    const rxPayload = {
      type: 'prescription',
      sender: myPeerId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      patient: patientName,
      medications: compiledMedications,
      notes: rxNotes.value.trim()
    };

    if (activeConn && activeConn.open) {
      activeConn.send(rxPayload);
      appendMessage('local', rxPayload);
      
      // Reset Clinical Script Panel Inputs
      rxPatient.value = '';
      rxNotes.value = '';
      rxMedsContainer.innerHTML = `
        <div class="med-group">
          <div class="med-row-header">
            <label style="font-size: 11px; font-weight: 700; color: var(--meet-green-dark); text-transform: uppercase; letter-spacing: 0.5px;">Medication #1</label>
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
        </div>
      `;
      medCount = 1;
      tabChatBtn.click(); // Automatically shift viewport back to raw messages line
    } else {
      showAlert('Transmission failed: Network pipe context offline.');
    }
  });
});

directPrintRxBtn.addEventListener('click', () => {
  window.print();
});

// --------------------------------------------------------
// Lightbox Expansion UI Engine
// --------------------------------------------------------
window.launchLightbox = function(sourceUri) {
  lightboxImg.src = sourceUri;
  lightboxOverlay.classList.add('active');
};

closeLightboxBtn.addEventListener('click', () => {
  lightboxOverlay.classList.remove('active');
  lightboxImg.src = '';
});

printImageBtn.addEventListener('click', () => {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`<html><body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh;"><img src="${lightboxImg.src}" style="max-width:100%; max-height:100%; object-fit:contain;"></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = function() {
    printWindow.print();
    printWindow.close();
  };
});

// --------------------------------------------------------
// Call Session Hardware Control Handlers
// --------------------------------------------------------
micBtn.addEventListener('click', () => {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    micBtn.classList.toggle('disabled', !audioTrack.enabled);
    micBtn.setAttribute('aria-label', audioTrack.enabled ? 'Mute' : 'Unmute');
  }
});

camBtn.addEventListener('click', () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    camBtn.classList.toggle('disabled', !videoTrack.enabled);
    camBtn.setAttribute('aria-label', videoTrack.enabled ? 'Camera Off' : 'Camera On');
  }
});

hangBtn.addEventListener('click', () => {
  showConfirm('Are you sure you want to disconnect and exit this clinical sandbox session?', () => {
    if (currentCall) currentCall.close();
    if (activeConn) activeConn.close();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    window.location.reload();
  });
});
