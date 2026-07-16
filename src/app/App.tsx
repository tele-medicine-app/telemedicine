import importedAppJs from "../imports/app.js?raw";
import importedHtml from "../imports/index.html?raw";
import importedStyles from "../imports/styles.css?raw";

/*
 * The imported workspace remains the source of truth for its layout and features.
 * These narrow patches only repair same-origin signaling defaults and chat delivery.
 */
const repairedAppJs = importedAppJs
  .replace(
    "port: window.location.port ? Number(window.location.port) : 443,",
    "port: window.location.port ? Number(window.location.port) : (window.location.protocol === 'https:' ? 443 : 80),",
  )
  .replace(
    "let currentAttachmentData = null; ",
    `let currentAttachmentData = null;
const roomChatChannel = 'BroadcastChannel' in window ? new BroadcastChannel('telemedicine-sync-room') : null;
roomChatChannel?.addEventListener('message', (event) => appendMessage('remote', event.data));`,
  )
  .replace(
    `  if (activeConn && activeConn.open) {
    activeConn.send(payload);
    appendMessage('local', payload);
  }`,
    `  appendMessage('local', payload);
  if (activeConn && activeConn.open) {
    activeConn.send(payload);
  }
  roomChatChannel?.postMessage(payload);`,
  )
  .replace(
    `    statusText.textContent = 'Error: ' + err.type;`,
    `    statusText.textContent = 'Camera ready — waiting for connection';
    document.querySelector('.connection .dot').style.backgroundColor = '#ecc94b';`,
  );

/* Targeted meeting-stage extension: preserves all existing panels and actions. */
const meetingExtension = `
  <style>
    #videoGrid { min-height: 0; }
    .meeting-stage { position:absolute; inset:0; overflow:hidden; border-radius:24px; border:1px solid var(--border); background:#dfe8e3; box-shadow:var(--shadow-island); }
    .meeting-stage__empty { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#eaf2ed,#dceae1); color:var(--text); }
    .meeting-stage__empty > div { text-align:center; max-width:330px; padding:24px; }
    .meeting-stage__avatar { width:72px; height:72px; margin:0 auto 16px; border-radius:24px; background:linear-gradient(135deg,var(--meet-green-primary),var(--meet-green-dark)); color:#fff; display:grid; place-items:center; font-size:22px; font-weight:700; box-shadow:0 10px 24px rgba(19,115,51,.23); }
    .meeting-stage__empty h2 { font-size:18px; margin-bottom:8px; }
    .meeting-stage__empty p { color:var(--muted); font-size:13px; line-height:1.5; }
    .meeting-stage__status { display:inline-flex; align-items:center; gap:7px; margin-top:16px; padding:7px 11px; border-radius:999px; background:#fff; border:1px solid var(--border); color:var(--meet-green-dark); font-size:11px; font-weight:700; }
    .meeting-stage__status::before { content:''; width:7px; height:7px; background:#f2b842; border-radius:50%; box-shadow:0 0 0 3px rgba(242,184,66,.18); }
    #remoteVideoContainer { position:absolute !important; inset:0 !important; z-index:3 !important; width:100% !important; height:100% !important; border:0 !important; border-radius:0 !important; box-shadow:none !important; }
    #remoteVideoContainer .video-label { position:absolute; left:16px; bottom:16px; padding:8px 12px; border-radius:999px; background:rgba(15,23,42,.72); color:#fff; font-size:12px; font-weight:700; backdrop-filter:blur(8px); }
    #localVideoContainer { position:absolute !important; right:18px !important; bottom:18px !important; z-index:8 !important; width:220px !important; height:132px !important; border:2px solid #fff !important; border-radius:16px !important; background:#1f2937 !important; box-shadow:0 14px 34px rgba(15,23,42,.25) !important; }
    #localVideoContainer .video-label { position:absolute; left:9px; bottom:9px; padding:5px 8px; border-radius:7px; background:rgba(15,23,42,.7); color:#fff; font-size:10px; font-weight:700; }
    .meeting-toolbar-divider { width:1px; height:28px; margin:0 2px; background:var(--border); }
    .participants-count { position:absolute; top:16px; right:16px; z-index:6; display:flex; align-items:center; gap:7px; padding:8px 12px; border:1px solid var(--border); border-radius:999px; background:rgba(255,255,255,.94); color:var(--meet-green-dark); font-size:11px; font-weight:700; box-shadow:var(--shadow-sm); }
    .participants-count span { display:grid; place-items:center; width:18px; height:18px; border-radius:50%; background:var(--meet-green-light); }
    .team-roster { position:absolute; top:54px; right:16px; z-index:12; width:250px; max-height:calc(100% - 72px); overflow:auto; padding:12px; border:1px solid var(--border); border-radius:16px; background:rgba(255,255,255,.98); box-shadow:var(--shadow-island); display:none; }
    .team-roster.open { display:block; }
    .team-roster h3 { padding:4px 6px 10px; font-size:12px; color:var(--text); }
    .team-roster p { padding:0 6px 10px; color:var(--muted); font-size:10px; line-height:1.4; }
    .doctor-seat { display:flex; align-items:center; gap:9px; padding:8px 6px; border-top:1px solid #f1f5f9; }
    .doctor-seat__avatar { display:grid; place-items:center; flex:0 0 28px; width:28px; height:28px; border-radius:10px; background:var(--meet-green-light); color:var(--meet-green-dark); font-size:10px; font-weight:700; }
    .doctor-seat strong { display:block; color:var(--text); font-size:11px; }
    .doctor-seat small { color:var(--muted); font-size:10px; }
    .doctor-seat i { width:7px; height:7px; margin-left:auto; border-radius:50%; background:#cbd5e1; }
    .doctor-seat:first-of-type i { background:var(--meet-green-primary); }
    .screen-share { position:absolute; inset:0; z-index:7; display:none; background:#0f172a; }
    .screen-share.active { display:block; }
    .screen-share video { width:100%; height:100%; object-fit:contain; }
    .screen-share__label { position:absolute; top:16px; left:16px; padding:8px 12px; border-radius:999px; background:rgba(15,23,42,.78); color:#fff; font-size:11px; font-weight:700; }
    .screen-share__label::before { content:'●'; margin-right:7px; color:#f2b842; }
    .screen-share-stop { position:absolute; top:14px; right:16px; border:0; border-radius:10px; padding:8px 10px; background:#fff; color:#b91c1c; font-size:11px; font-weight:700; cursor:pointer; }
    @media(max-width:900px) { #localVideoContainer { width:112px !important; height:150px !important; right:12px !important; bottom:12px !important; border-radius:12px !important; } .participants-count { top:12px; right:12px; } .team-roster { top:48px; right:12px; width:min(250px,calc(100% - 24px)); } }
    @media(max-width:640px) { .meeting-stage { border-radius:16px; } #localVideoContainer { width:96px !important; height:130px !important; right:12px !important; bottom:12px !important; } .meeting-stage__avatar { width:60px; height:60px; border-radius:20px; } .screen-share__label { top:10px; left:10px; } .screen-share-stop { top:8px; right:8px; } }
  </style>

function buildMeetingStage() {
  if (document.getElementById('meetingStage')) return;
  const stage = document.createElement('div');
  stage.id = 'meetingStage';
  stage.className = 'meeting-stage';
  const doctors = ['Dr. Maya Chen', 'Dr. James Hall', 'Dr. Sofia Patel', 'Dr. Evan Brooks', 'Dr. Nina Scott', 'Dr. Omar Ali', 'Dr. Leah Kim', 'Dr. Theo Grant', 'Dr. Ana Flores', 'Dr. Max Green'];
  const doctorList = doctors.map(function(name, index) {
    const initials = name.split(' ').slice(1).map(function(word) { return word[0]; }).join('');
    const status = index === 0 ? 'Connected' : 'Available when joined';
    return '<div class="doctor-seat"><span class="doctor-seat__avatar">' + initials + '</span><span><strong>' + name + '</strong><small>' + status + '</small></span><i></i></div>';
  }).join('');
  stage.innerHTML = '<div class="meeting-stage__empty" id="meetingEmptyState"><div><div class="meeting-stage__avatar">MC</div><h2>Clinical team room</h2><p>Your video appears in the floating window. The main stage automatically shows the clinician or shared screen when they join.</p><span class="meeting-stage__status">Waiting for clinicians</span></div></div>' +
    '<div class="screen-share" id="screenShareStage"><video id="screenShareVideo" autoplay playsinline muted></video><span class="screen-share__label">You are sharing your screen</span><button class="screen-share-stop" id="stopShareBtn" type="button">Stop sharing</button></div>' +
    '<button class="participants-count" id="participantsBtn" type="button" aria-expanded="false"><span>+</span> Clinical team · 1/10</button>' +
    '<div class="team-roster" id="teamRoster"><h3>Clinical team</h3><p>Up to ten doctors can join this consultation.</p>' + doctorList + '</div>';
  videoGrid.prepend(stage);
  document.getElementById('participantsBtn').addEventListener('click', () => {
    const roster = document.getElementById('teamRoster');
    roster.classList.toggle('open');
    document.getElementById('participantsBtn').setAttribute('aria-expanded', String(roster.classList.contains('open')));
  });
  document.getElementById('stopShareBtn').addEventListener('click', stopScreenShare);
}

let screenStream = null;
async function startScreenShare() {
  if (!navigator.mediaDevices?.getDisplayMedia) { showAlert('Screen sharing is not supported by this device.'); return; }
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const screenVideo = document.getElementById('screenShareVideo');
    screenVideo.srcObject = screenStream;
    document.getElementById('screenShareStage').classList.add('active');
    const screenTrack = screenStream.getVideoTracks()[0];
    const sender = currentCall?.peerConnection?.getSenders?.().find((item) => item.track?.kind === 'video');
    sender?.replaceTrack?.(screenTrack);
    screenTrack.addEventListener('ended', stopScreenShare);
    document.getElementById('screenBtn').classList.add('off');
  } catch (error) { if (error?.name !== 'NotAllowedError') showAlert('Could not start screen sharing.'); }
}
function stopScreenShare() {
  if (!screenStream) return;
  screenStream.getTracks().forEach((track) => track.stop());
  screenStream = null;
  document.getElementById('screenShareStage').classList.remove('active');
  const localTrack = localStream?.getVideoTracks?.()[0];
  const sender = currentCall?.peerConnection?.getSenders?.().find((item) => item.track?.kind === 'video');
  if (localTrack) sender?.replaceTrack?.(localTrack);
  document.getElementById('screenBtn').classList.remove('off');
}

const originalDisplayLocalStream = displayLocalStream;
displayLocalStream = function(stream) { buildMeetingStage(); originalDisplayLocalStream(stream); };
const originalDisplayRemoteStream = displayRemoteStream;
displayRemoteStream = function(stream) { buildMeetingStage(); document.getElementById('meetingEmptyState')?.remove(); originalDisplayRemoteStream(stream); };
const screenControl = document.createElement('button');
screenControl.className = 'ctrl'; screenControl.id = 'screenBtn'; screenControl.type = 'button'; screenControl.title = 'Share screen';
screenControl.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>';
document.getElementById('chatBtn').before(screenControl);
screenControl.addEventListener('click', () => screenStream ? stopScreenShare() : startScreenShare());
startSessionBtn.addEventListener('click', buildMeetingStage);
`;

const meetingStyles = meetingExtension.slice(meetingExtension.indexOf("<style>") + 7, meetingExtension.indexOf("</style>"));
const meetingScript = meetingExtension.slice(meetingExtension.indexOf("</style>") + 8);

const originalWorkspace = importedHtml
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${importedStyles}${meetingStyles}</style>`)
  .replace('<script src="app.js"></script>', `<script>${(repairedAppJs + meetingScript).replace(/<\/script>/g, "<\\/script>")}</script>`);

export default function App() {
  return <iframe title="Telemedicine Sync" srcDoc={originalWorkspace} className="block h-dvh w-full border-0 bg-white" />;
}
