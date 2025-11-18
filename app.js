/* ===================================================
   WebRTC + SIP.js + Audio Analysis + 3D Packet Flow
=================================================== */

let userAgent, activeSession, pc;
let running = false;
let paused = false;
let statsInterval;

const statsBox = document.getElementById("statsBox");
const remoteAudio = document.getElementById("remoteAudio");
const waveCanvas = document.getElementById("wave");
const waveCtx = waveCanvas.getContext("2d");
const specCanvas = document.getElementById("spectrogram");
const specCtx = specCanvas.getContext("2d");

/* -------------------------
   SIP.js WebRTC Registration
------------------------- */
document.getElementById("registerBtn").onclick = async () => {
  log("Registering…");
  userAgent = new SIP.UserAgent({
    uri: "sip:your-username@your-domain",
    transportOptions: { server: "wss://your-wss-url" },
    authorizationUsername: "your-username",
    authorizationPassword: "your-password"
  });

  userAgent.delegate = {
    onInvite: invitation => handleCall(invitation)
  };

  await userAgent.start();
  log("UserAgent started.");
};

document.getElementById("callBtn").onclick = async () => {
  if (!userAgent) return alert("Please register first!");
  const target = "sip:your-extension-to-call@your-domain";
  log("Calling " + target);

  const inviter = new SIP.Inviter(userAgent, target, {
    sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } }
  });
  handleCall(inviter);
  await inviter.invite();
};

document.getElementById("hangupBtn").onclick = () => {
  if (activeSession) activeSession.dispose();
  log("Call hung up.");
};

document.getElementById("pauseVisBtn").onclick = () => paused = !paused;

/* -------------------------
   Call Handling
------------------------- */
function handleCall(session) {
  activeSession = session;

  session.delegate = {
    onSessionDescriptionHandler: handler => {
      pc = handler.peerConnection;
      pc.ontrack = e => { remoteAudio.srcObject = e.streams[0]; };
    }
  };

  session.stateChange.addListener(state => {
    log("Call state: " + state);
    if (state === SIP.SessionState.Established) startVisuals();
    if (state === SIP.SessionState.Terminated) stopVisuals();
  });
}

/* -------------------------
   Logging
------------------------- */
function log(msg) {
  statsBox.textContent += msg + "\n";
}

/* -------------------------
   Waveform + Spectrogram
------------------------- */
let audioCtx, analyser, dataArray;

function startVisuals() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(remoteAudio.srcObject);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  }
  running = true;
  drawWave();
  drawSpectrogram();
  start3D();
  startStats();
}

function stopVisuals() {
  running = false;
  statsInterval && clearInterval(statsInterval);
}

/* Waveform */
function drawWave() {
  if (!running || paused) return;
  requestAnimationFrame(drawWave);
  analyser.getByteTimeDomainData(dataArray);
  waveCtx.fillStyle = "#ffffff";
  waveCtx.fillRect(0,0,waveCanvas.width,waveCanvas.height);

  waveCtx.lineWidth = 2;
  waveCtx.strokeStyle = "#2563eb";
  waveCtx.beginPath();
  const slice = waveCanvas.width / dataArray.length;
  let x=0;
  for(let i=0;i<dataArray.length;i++){
    const v = dataArray[i]/128.0;
    const y = v * waveCanvas.height/2;
    if(i===0) waveCtx.moveTo(x,y);
    else waveCtx.lineTo(x,y);
    x += slice;
  }
  waveCtx.stroke();
}

/* Spectrogram */
function drawSpectrogram() {
  if (!running || paused) return;
  requestAnimationFrame(drawSpectrogram);
  analyser.getByteFrequencyData(dataArray);
  const img = specCtx.getImageData(1,0,specCanvas.width-1,specCanvas.height);
  specCtx.putImageData(img,0,0);
  for(let i=0;i<specCanvas.height;i++){
    const val = dataArray[i % dataArray.length];
    specCtx.fillStyle = `rgb(${val},0,${255-val})`;
    specCtx.fillRect(specCanvas.width-1,i,1,1);
  }
}

/* -------------------------
   3D Packet Flow
------------------------- */
const threeContainer = document.getElementById("threeContainer");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, threeContainer.clientWidth/threeContainer.clientHeight, 0.1, 200);
camera.position.z=40; camera.position.y=10;
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
threeContainer.appendChild(renderer.domElement);
const light = new THREE.DirectionalLight(0xffffff,1);
light.position.set(1,1,1); scene.add(light);
const packets=[];
for(let i=0;i<60;i++){
  const geom = new THREE.SphereGeometry(0.5,12,12);
  const mat = new THREE.MeshPhongMaterial({color:0x00ff55});
  const p = new THREE.Mesh(geom,mat);
  p.position.set(-25+Math.random()*50,-10+Math.random()*20,0);
  p.userData.speed=0.2+Math.random()*0.8;
  packets.push(p); scene.add(p);
}
function animate3D(){
  requestAnimationFrame(animate3D);
  if(running && !paused){
    for(const p of packets){
      p.position.x += p.userData.speed;
      if(p.position.x>25) p.position.x=-25;
      if(p.position.x>15) p.material.color.setHex(0xff4444);
      else if(p.position.x>7) p.material.color.setHex(0xffaa33);
      else p.material.color.setHex(0x00ff55);
    }
  }
  renderer.render(scene,camera);
}
animate3D();

/* -------------------------
   Real-time Stats + MOS
------------------------- */
function startStats(){
  statsInterval = setInterval(()=>{
    if(!running) return;
    if(!pc) return;
    pc.getStats().then(stats=>{
      let out="";
      stats.forEach(report=>{
        if(report.type==="inbound-rtp" && report.kind==="audio"){
          const loss = report.packetsLost||0;
          const received = report.packetsReceived||0;
          const jitter = report.jitter||0;
          const bitrate = report.bitrateMean||0;
          const mos = (1 + 4*Math.exp(-0.1*jitter - 2.5*loss)) .toFixed(2);
          out+=`Packets Received: ${received}\nPackets Lost: ${loss}\nJitter: ${jitter}\nBitrate: ${bitrate}\nMOS: ${mos}\n`;
        }
      });
      statsBox.textContent = out;
    });
  },1000);
}
