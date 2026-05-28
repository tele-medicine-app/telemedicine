// ========================================================
// AUTOMATIC ASPECT RATIO & MOBILE GEOMETRY PROTECTOR
// ========================================================
(function injectDefensiveStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Prevent camera distortion everywhere */
    video, .video-wrapper video, #videoGrid video {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important; /* Locks natural aspect ratio; crops instead of squishing */
    }

    /* Secure mobile layout viewports */
    @media (max-width: 640px) {
      #videoGrid {
        position: relative !important;
        display: block !important;
        width: 100% !important;
        height: calc(100vh - 140px) !important;
        overflow: hidden !important;
        background-color: #1a202c !important;
      }

      /* Remote/Main background view */
      .video-wrapper.remote, #remoteVideoContainer {
        width: 100% !important;
        height: 100% !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        z-index: 1 !important;
      }

      /* Local Picture-in-Picture window container */
      .video-wrapper.local, #localVideoContainer {
        position: absolute !important;
        bottom: 16px !important;
        right: 16px !important;
        width: 100px !important;
        height: 150px !important;
        border-radius: 12px !important;
        border: 2px solid #ffffff !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
        z-index: 10 !important;
        overflow: hidden !important;
      }

      /* Prevent UI action bar layout collapses */
      #hangBtn, .btn-hang, [id*="hang"], #micBtn, #camBtn, #chatBtn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      #hangBtn *, .btn-hang *, [id*="hang"] *, #micBtn *, #camBtn *, #chatBtn * {
        flex-shrink: 0 !important;
        width: 24px !important;
        height: 24px !important;
        max-width: 24px !important;
        max-height: 24px !important;
        object-fit: contain !important;
      }
    }
  `;
  document.head.appendChild(style);
})();

// ========================================================
// Global Application State
// ========================================================
let localStream = null;
let currentCall = null;
let activeConn = null;
let peer = null;
let myPeerId = null;
let targetPeerId = null;
let currentAttachmentData = null; 

// ========================================================
// DOM Element Registry
// ========================================================
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
// Navigation & Sidebar Controls
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

let medCount = 1;
addMedBtn.addEventListener('click', () => {
  medCount++;
  const medGroup = document.createElement('div');
  medGroup.classList.add('med-group');
  
  medGroup.innerHTML = `
    <div class="med-row-header">
      <label>Medication #${medCount}</label>
      <button type="button" class="btn-remove-med">Remove</button>
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
  
  medGroup.querySelector('.btn-remove-med').addEventListener('click', () => medGroup.remove());
  rxMedsContainer.appendChild(medGroup);
});

// --------------------------------------------------------
// Media Initialization
// --------------------------------------------------------
startSessionBtn.addEventListener('click', async () => {
  landingPage.style.display = 'none';
  statusText.textContent = 'Connecting to camera/mic...';
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    displayLocalStream(localStream);
    initializePeer();
  } catch (err) {
    console.error(err);
    statusText.textContent = 'Hardware access blocked';
    showAlert('Could not initialize video/audio hardware.');
  }
});

function displayLocalStream(stream) {
  if (document.getElementById('localVideoContainer')) return;
  
  const container = document.createElement('div');
  container.className = 'video-wrapper local';
  container.id = 'localVideoContainer';
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true; 
  
  // Direct dynamic layout enforcement
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  
  const badge = document.createElement('div');
  badge.className = 'video-label';
  badge.textContent = 'You (Local)';
  
  container.appendChild(video);
  container.appendChild(badge);
  videoGrid.appendChild(container);
}

// --------------------------------------------------------
// PeerJS Configuration
// --------------------------------------------------------
function initializePeer() {
  statusText.textContent = 'Connecting to local server...';
  
  const hash = window.location.hash.replace('#', '');
  if (hash === 'host' || !hash) {
    myPeerId = 'host';
    targetPeerId = 'client';
    if (!hash) window.location.hash = 'host';
  } else {
    myPeerId = 'client';
    targetPeerId = 'host';
  }

  peer = new Peer(myPeerId, {
    host: window.location.hostname,
    port: window.location.port || 3000,
    path: '/peerjs'
  });

  peer.on('open', (id) => {
    statusText.textContent = 'Ready. Awaiting connection...';
    document.querySelector('.connection .dot').style.backgroundColor = '#ecc94b';
    
    if (myPeerId === 'client') {
      connectToPeer();
    }
  });

  peer.on('connection', (conn) => {
    activeConn = conn;
    bindDataEvents(activeConn);
  });

  peer.on('call', (call) => {
    currentCall = call;
    call.answer(localStream);
    call.on('stream', (remoteStream) => displayRemoteStream(remoteStream));
    call.on('close', () => removeRemoteVideo());
  });

  peer.on('error', (err) => {
    console.error('PeerJS Error:', err);
    statusText.textContent = 'Error: ' + err.type;
  });
}

function connectToPeer() {
  statusText.textContent = 'Connecting to peer...';
  
  activeConn = peer.connect(targetPeerId, { reliable: true });
  bindDataEvents(activeConn);
  
  currentCall = peer.call(targetPeerId, localStream);
  currentCall.on('stream', (remoteStream) => displayRemoteStream(remoteStream));
  currentCall.on('close', () => removeRemoteVideo());
}

function displayRemoteStream(stream) {
  if (document.getElementById('remoteVideoContainer')) return;
  
  const container = document.createElement('div');
  container.className = 'video-wrapper remote';
  container.id = 'remoteVideoContainer';
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  
  // Direct dynamic layout enforcement
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  
  const badge = document.createElement('div');
  badge.className = 'video-label';
  badge.textContent = 'Remote Participant';
  
  container.appendChild(video);
  container.appendChild(badge);
  videoGrid.appendChild(container);
  
  statusText.textContent = 'Connected';
  document.querySelector('.connection .dot').style.backgroundColor = 'var(--meet-green-primary)';
}

function removeRemoteVideo() {
  const remoteVideo = document.getElementById('remoteVideoContainer');
  if (remoteVideo) remoteVideo.remove();
  statusText.textContent = 'Disconnected';
  document.querySelector('.connection .dot').style.backgroundColor = '#e53e3e';
}

function bindDataEvents(conn) {
  conn.on('open', () => {
    statusText.textContent = 'Connected';
    document.querySelector('.connection .dot').style.backgroundColor = 'var(--meet-green-primary)';
  });

  conn.on('data', (data) => {
    if (data) {
      appendMessage('remote', data);
    }
  });

  conn.on('close', () => {
    activeConn = null;
    statusText.textContent = 'Connection closed';
    document.querySelector('.connection .dot').style.backgroundColor = '#ecc94b';
  });
}

// --------------------------------------------------------
// Messaging & Chat
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

  if (activeConn && activeConn.open) {
    activeConn.send(payload);
    appendMessage('local', payload);
  }
  
  chatInput.value = '';
  clearImageAttachment();
});

function appendMessage(origin, payload) {
  const msgBlock = document.createElement('div');
  msgBlock.className = `msg ${origin === 'local' ? 'sent' : 'received'}`;
  
  if (payload.type === 'prescription') {
    msgBlock.classList.add('rx-payload-card');
    let medsHtml = '';
    payload.medications.forEach(m => {
      medsHtml += `<div><strong>${escapeHtml(m.name)}</strong> - ${escapeHtml(m.dosage)}<br>${escapeHtml(m.frequency)}</div>`;
    });
    
    msgBlock.innerHTML = `
      <div><strong>Prescription</strong></div>
      <div>Patient: ${escapeHtml(payload.patient)}</div>
      ${medsHtml}
      ${payload.notes ? `<div>Notes: ${escapeHtml(payload.notes)}</div>` : ''}
      <div class="time">${payload.timestamp}</div>
    `;
    messagesContainer.appendChild(msgBlock);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return;
  }

  let content = '';
  if (payload.image) {
    content += `<img src="${payload.image}" class="chat-embedded-img" onclick="launchLightbox('${payload.image}')">`;
  }
  if (payload.text) {
    content += `<p>${escapeHtml(payload.text)}</p>`;
  }
  
  content += `<span class="time">${payload.timestamp}</span>`;
  msgBlock.innerHTML = content;
  
  messagesContainer.appendChild(msgBlock);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// --------------------------------------------------------
// File Attachments
// --------------------------------------------------------
triggerFileBtn.addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

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
// Prescription Submission
// --------------------------------------------------------
sendChatRxBtn.addEventListener('click', () => {
  const patientName = rxPatient.value.trim();
  if (!patientName) return;

  const compiledMedications = [];
  const medRows = rxMedsContainer.querySelectorAll('.med-group');

  medRows.forEach(row => {
    const name = row.querySelector('.rx-med-name').value.trim();
    const dosage = row.querySelector('.rx-med-dosage').value.trim();
    const frequency = row.querySelector('.rx-med-freq').value.trim();
    if (name && dosage && frequency) {
      compiledMedications.push({ name, dosage, frequency });
    }
  });

  showConfirm('Submit prescription?', () => {
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
      tabChatBtn.click(); 
    }
  });
});

directPrintRxBtn.addEventListener('click', () => window.print());

// --------------------------------------------------------
// Lightbox Expansion UI
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
  printWindow.document.write(`<html><body><img src="${lightboxImg.src}" style="max-width:100%;"></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = function() {
    printWindow.print();
    printWindow.close();
  };
});

// --------------------------------------------------------
// Hardware Toggles & Call Termination
// --------------------------------------------------------
micBtn.addEventListener('click', () => {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    micBtn.classList.toggle('disabled', !audioTrack.enabled);
  }
});

camBtn.addEventListener('click', () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    camBtn.classList.toggle('disabled', !videoTrack.enabled);
  }
});

hangBtn.addEventListener('click', () => {
  showConfirm('Disconnect session?', () => {
    if (currentCall) currentCall.close();
    if (activeConn) activeConn.close();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    window.location.reload();
  });
});
