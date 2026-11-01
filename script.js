const CONTACT_CONFIG = {
    // Add the real business details here when ready. Empty values stay hidden.
    whatsappNumber: "9182641172",
    email: "",
    instagram: "",
    facebook: ""
};

function buildWhatsAppUrl(message = "Hello Siva Multi Services, I would like to make an enquiry.") {
    const number = CONTACT_CONFIG.whatsappNumber.replace(/\D/g, "");
    return number
        ? "https://wa.me/" + number + "?text=" + encodeURIComponent(message)
        : "https://wa.me/?text=" + encodeURIComponent(message);
}

document.addEventListener("DOMContentLoaded", () => {
    const hero = document.querySelector(".hero-3d");
    const scene = document.querySelector(".earth-scene");
    const cards = document.querySelectorAll(".service-card");

    cards.forEach((card, index) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(24px)";
        const reveal = () => {
            card.style.transition = "opacity .7s ease, transform .7s ease";
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        };
        setTimeout(reveal, 250 + index * 120);
    });

    if (hero && scene && window.matchMedia("(pointer:fine)").matches) {
        hero.addEventListener("mousemove", (event) => {
            const x = (window.innerWidth / 2 - event.clientX) / 55;
            const y = (window.innerHeight / 2 - event.clientY) / 55;
            scene.style.transform = `translateY(-50%) translate(${x}px,${y}px)`;
        });
        hero.addEventListener("mouseleave", () => {
            scene.style.transform = "translateY(-50%)";
        });
    }

    const whatsappContact = document.querySelector("#whatsappContact");
    if (whatsappContact) {
        whatsappContact.href = buildWhatsAppUrl();
    }

    const channels = [
        ["#emailContact", CONTACT_CONFIG.email, value => "mailto:" + value],
        ["#instagramContact", CONTACT_CONFIG.instagram, value => value],
        ["#facebookContact", CONTACT_CONFIG.facebook, value => value]
    ];
    channels.forEach(([selector, value, makeUrl]) => {
        const link = document.querySelector(selector);
        if (link && value) {
            link.href = makeUrl(value);
            link.hidden = false;
            link.target = value.startsWith("http") ? "_blank" : "";
            link.rel = "noopener";
        }
    });

    document.querySelectorAll(".job-card").forEach((card) => {
        card.addEventListener("click", () => {
            const country = card.dataset.jobCountry || "";
            const service = document.querySelector("#enquiryService");
            const goal = document.querySelector("#enquiryGoal");
            if (service) service.value = "Overseas Job Assistance";
            if (goal && country) goal.value = country + " job assistance";
        });
    });

    document.querySelectorAll(".destination-card").forEach((card) => {
        card.addEventListener("click", () => {
            const country = card.dataset.destination || "";
            const service = document.querySelector("#enquiryService");
            const goal = document.querySelector("#enquiryGoal");
            if (service && (country === "Israel" || country === "Russia")) service.value = "Overseas Job Assistance";
            if (goal && country) goal.value = country + ((country === "Israel" || country === "Russia") ? " job assistance" : " enquiry");
        });
    });

    document.querySelectorAll(".category-card").forEach((card) => {
        card.addEventListener("click", () => {
            const category = card.dataset.jobCategory || "";
            const service = document.querySelector("#enquiryService");
            const goal = document.querySelector("#enquiryGoal");
            if (service) service.value = "Overseas Job Assistance";
            if (goal && category) goal.value = category;
            const jobType = document.querySelector("#enquiryJobType");
            if (jobType) jobType.value = category === "Skilled Jobs" ? "Skilled Jobs" : "Unskilled / Blue-Collar Jobs";
        });
    });

    document.querySelectorAll(".vacancy-apply").forEach((button) => {
        button.addEventListener("click", () => {
            const role = button.dataset.role || "";
            const service = document.querySelector("#enquiryService");
            const jobType = document.querySelector("#enquiryJobType");
            const jobRole = document.querySelector("#enquiryJobRole");
            const goal = document.querySelector("#enquiryGoal");
            if (service) service.value = "Overseas Job Assistance";
            if (jobType) jobType.value = button.closest(".vacancy-card")?.querySelector(".vacancy-top span")?.textContent.includes("BLUE") ? "Unskilled / Blue-Collar Jobs" : "Skilled Jobs";
            if (jobRole) jobRole.value = role;
            if (goal) goal.value = "Current vacancy enquiry";
        });
    });

    const enquiryForm = document.querySelector("#enquiryForm");
    if (enquiryForm) {
        enquiryForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const name = document.querySelector("#enquiryName").value.trim();
            const service = document.querySelector("#enquiryService").value;
            const jobType = document.querySelector("#enquiryJobType")?.value || "";
            const jobRole = document.querySelector("#enquiryJobRole")?.value.trim() || "";
            const goal = document.querySelector("#enquiryGoal").value.trim();
            const message = document.querySelector("#enquiryMessage").value.trim();
            const cv = document.querySelector("#cvUpload")?.files?.[0] || null;
            if (cv && cv.size > 5 * 1024 * 1024) {
                alert("Please select a CV smaller than 5 MB.");
                return;
            }
            const note = document.querySelector("#formNote");

            const text = [
                "Hello Siva Multi Services,",
                "",
                cv ? `CV / Resume selected: ${cv.name}` : "CV / Resume: Not attached yet.",
                "",
                `Name: ${name}`,
                `Service: ${service}`,
                ...(jobType ? [`Job Type: ${jobType}`] : []),
                ...(jobRole ? [`Job Role: ${jobRole}`] : []),
                `Destination / Goal: ${goal || "Not specified"}`,
                `Message: ${message || "Please contact me regarding this enquiry."}`
            ].join("\\n");

            window.open(buildWhatsAppUrl(text), "_blank", "noopener");
            note.textContent = CONTACT_CONFIG.whatsappNumber
                ? "WhatsApp opened for Siva Multi Services."
                : "WhatsApp opened. The business number will be connected when the official number is added.";
            if (window.innerWidth < 700) {
                note.scrollIntoView({behavior:"smooth", block:"nearest"});
            }
        });
    }
});

/* SIVA AI ASSISTANT */
const aiToggle=document.querySelector("#aiChatToggle"),aiPanel=document.querySelector("#aiChatPanel"),aiClose=document.querySelector("#aiChatClose"),aiForm=document.querySelector("#aiChatForm"),aiInput=document.querySelector("#aiChatInput"),aiMessages=document.querySelector("#aiChatMessages");
const aiHistory=[];
let aiSpeaking=false;
let aiRecognition=null;
const AI_API_URL = window.SIVA_AI_API_URL || "/api/chat";
const aiLanguage=document.querySelector("#aiLanguage");

if (aiToggle && aiPanel) {
  aiToggle.addEventListener("click", () => {
    aiPanel.hidden = !aiPanel.hidden;
    aiToggle.setAttribute("aria-expanded", String(!aiPanel.hidden));
    if (!aiPanel.hidden) aiInput?.focus();
  });
}
if (aiClose && aiPanel) {
  aiClose.addEventListener("click", () => {
    aiPanel.hidden = true;
    aiToggle?.setAttribute("aria-expanded", "false");
  });
}
if (aiForm) {
  aiForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = aiInput?.value.trim();
    if (!message) return;
    aiInput.value = "";
    askAi(message);
  });
}
function addAiMessage(text,role="bot",forceWhatsApp=false){const el=document.createElement("div");el.className="ai-msg "+(role==="user"?"ai-msg-user":"ai-msg-bot");const marker="[[SIVA_WHATSAPP_HANDOFF]]";const handoff=role!=="user"&&(forceWhatsApp||String(text).includes(marker));const clean=String(text).replace(marker,"").trim();el.textContent=clean;if(handoff){const link=document.createElement("a");link.href=buildWhatsAppUrl("Hello Siva Multi Services, I need help with my enquiry.");link.target="_blank";link.rel="noopener noreferrer";link.textContent="Chat with us on WhatsApp";link.style.cssText="display:inline-block;margin-top:10px;padding:9px 13px;border-radius:18px;background:#25D366;color:#fff;font-weight:600;text-decoration:none;";el.appendChild(document.createElement("br"));el.appendChild(link);}aiMessages.appendChild(el);aiMessages.scrollTop=aiMessages.scrollHeight;return clean;}
function getVoiceLocale(){
  const map={"te":"te-IN","hi":"hi-IN","ta":"ta-IN","kn":"kn-IN","ml":"ml-IN","ur-IN":"ur-IN","ar-KW":"ar-KW","bn-IN":"bn-IN","de":"de-DE","fr":"fr-FR","es":"es-ES","ru":"ru-RU","he":"he-IL","it-IT":"it-IT","en-CA":"en-CA","fr-CA":"fr-CA","de-CH":"de-CH","fr-CH":"fr-CH","it-CH":"it-CH","mt-MT":"mt-MT","sl-SI":"sl-SI","el-GR":"el-GR","pl-PL":"pl-PL","sv-SE":"sv-SE","da-DK":"da-DK","nb-NO":"nb-NO","fi-FI":"fi-FI","nl-NL":"nl-NL","pt-PT":"pt-PT","cs-CZ":"cs-CZ","sk-SK":"sk-SK","hu-HU":"hu-HU","et-EE":"et-EE","lv-LV":"lv-LV","lt-LT":"lt-LT","ro-RO":"ro-RO","bg-BG":"bg-BG","hr-HR":"hr-HR","ga-IE":"ga-IE","is-IS":"is-IS","de-LI":"de-LI","lb-LU":"lb-LU","de-AT":"de-AT","zh-CN":"zh-CN","th-TH":"th-TH","ja-JP":"ja-JP","ko-KR":"ko-KR","en-AU":"en-AU","en-IN":"en-IN","en":"en-US"}; 
  return map[aiLanguage?.value]||"en-IN";
}
function setSpeakingUi(speaking){
  if(aiSpeak){aiSpeak.classList.toggle("active",speaking);aiSpeak.textContent=speaking?"⏹️":"🔊";}
  if(aiVoiceStatus && speaking) aiVoiceStatus.textContent="SIVA MULTI SERVICES is speaking…";
}
function speakELITE(text){
  if(!text || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const lang=getVoiceLocale();
  const run=()=>{
    const voices=speechSynthesis.getVoices();
    const base=lang.split("-")[0].toLowerCase();
    const voice=voices.find(v=>v.lang?.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang?.toLowerCase().startsWith(base));
    const chunks=String(text).replace(/\s+/g," ").trim().match(/.{1,180}(?:\s|$)/g)||[String(text)];
    let i=0;
    const next=()=>{
      if(i>=chunks.length){aiSpeaking=false;setSpeakingUi(false);if(aiVoiceStatus)aiVoiceStatus.textContent="Tap the microphone to speak";return;}
      const u=new SpeechSynthesisUtterance(chunks[i++].trim());
      u.lang=lang;u.rate=.96;u.pitch=1;u.volume=1;if(voice)u.voice=voice;
      u.onend=next;u.onerror=()=>{aiSpeaking=false;setSpeakingUi(false);if(aiVoiceStatus)aiVoiceStatus.textContent="Voice playback failed — tap 🔊 to retry";};
      speechSynthesis.speak(u);
    };
    aiSpeaking=true;setSpeakingUi(true);next();
  };
  if(speechSynthesis.getVoices().length) run();
  else {speechSynthesis.onvoiceschanged=run;setTimeout(run,700);}
}
async function askAi(message,options={}){
  if(!message || !aiMessages) return;
  addAiMessage(message,"user");
  aiHistory.push({role:"user",content:message});
  const loading=document.createElement("div");
  loading.className="ai-msg ai-msg-bot";loading.textContent="Thinking…";aiMessages.appendChild(loading);
  const sendButton=aiForm?.querySelector('button[type="submit"],button:not([type])');
  if(sendButton){sendButton.disabled=true;sendButton.setAttribute("aria-busy","true");}
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    const res=await fetch(AI_API_URL,{
      method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({message,language:aiLanguage?.value||"en-IN",history:aiHistory.slice(0,-1).slice(-8)}),
      signal:controller.signal
    });
    clearTimeout(timeout);
    let data={};try{data=await res.json()}catch(_){}
    loading.remove();
    if(!res.ok){ const err=new Error(data.error||"AI request failed"); err.providerMessage=data.providerMessage; err.providerCode=data.providerCode; err.providerStatus=data.providerStatus; throw err; }
    const reply=(data.reply||"Please continue with WhatsApp and our team will assist you.").trim();
    addAiMessage(reply);aiHistory.push({role:"assistant",content:reply});
    if(options.voice) speakELITE(reply);
  }catch(e){
    loading.remove();
    let msg="SIVA MULTI SERVICES could not connect to the AI service. Please try again or use WhatsApp.";
    if(e?.name==="AbortError") msg="SIVA MULTI SERVICES AI timed out. Please try again.";
    else if(e?.message){ const detail=e?.providerMessage||e?.providerCode||e?.providerStatus; msg="SIVA MULTI SERVICES AI error: "+e.message+(detail?" — "+detail:""); }
    addAiMessage(msg);
    if(options.voice) speakELITE(msg);
  }finally{
    if(sendButton){sendButton.disabled=false;sendButton.removeAttribute("aria-busy");}
  }
}
if("speechSynthesis" in window && aiSpeak){
  aiSpeak.addEventListener("click",()=>{
    const msgs=aiMessages?.querySelectorAll(".ai-msg-bot");const last=msgs?.[msgs.length-1];if(!last)return;
    if(aiSpeaking){speechSynthesis.cancel();aiSpeaking=false;setSpeakingUi(false);return;}
    speakELITE(last.textContent);
  });
}
const aiVoiceMode=null;
const aiVoiceMic=null;
const aiVoiceStatus=document.querySelector("#aiVoiceStatus");
const voiceLangMap={"te":"te-IN","hi":"hi-IN","ta":"ta-IN","kn":"kn-IN","ml":"ml-IN","ur-IN":"ur-IN","ar-KW":"ar-KW","bn-IN":"bn-IN","de":"de-DE","fr":"fr-FR","es":"es-ES","ru":"ru-RU","he":"he-IL","it-IT":"it-IT","en-CA":"en-CA","fr-CA":"fr-CA","de-CH":"de-CH","fr-CH":"fr-CH","it-CH":"it-CH","mt-MT":"mt-MT","sl-SI":"sl-SI","el-GR":"el-GR","pl-PL":"pl-PL","sv-SE":"sv-SE","da-DK":"da-DK","nb-NO":"nb-NO","fi-FI":"fi-FI","nl-NL":"nl-NL","pt-PT":"pt-PT","cs-CZ":"cs-CZ","sk-SK":"sk-SK","hu-HU":"hu-HU","et-EE":"et-EE","lv-LV":"lv-LV","lt-LT":"lt-LT","ro-RO":"ro-RO","bg-BG":"bg-BG","hr-HR":"hr-HR","ga-IE":"ga-IE","is-IS":"is-IS","lb-LU":"lb-LU","de-AT":"de-AT","zh-CN":"zh-CN","th-TH":"th-TH","ja-JP":"ja-JP","ko-KR":"ko-KR","en-AU":"en-AU","en-IN":"en-IN","en":"en-US"};
function setVoiceUi(listening){
  if(aiMic){aiMic.classList.toggle("active",listening);aiMic.textContent=listening?"⏹️":"🎙️";}
  if(aiVoiceMic){aiVoiceMic.classList.toggle("active",listening);}
  if(aiVoiceStatus)aiVoiceStatus.textContent=listening?"Listening… speak now":"Tap the microphone to speak";
}
function stopELITERecognition(){
  if(aiRecognition&&aiRecognition._running){try{aiRecognition.stop()}catch(_){}}
  setVoiceUi(false);
}
function startELITERecognition(){
  if(!aiRecognition)return;
  if(aiRecognition._running){stopELITERecognition();return;}
  if(aiVoiceMode)aiVoiceMode.hidden=false;
  aiRecognition.lang=voiceLangMap[aiLanguage?.value]||"en-IN";
  aiRecognition.continuous=false;
  aiRecognition.interimResults=false;
  aiRecognition._running=true;
  setVoiceUi(true);
  try{aiRecognition.start()}catch(_){aiRecognition._running=false;setVoiceUi(false);}
}
if(aiMic && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)){
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;
  aiRecognition=new R();
  window.aiRecognition=aiRecognition;
  aiMic.addEventListener("click",startELITERecognition);
  aiVoiceMic?.addEventListener("click",startELITERecognition);
  aiRecognition.onresult=e=>{
    const v=e.results?.[0]?.[0]?.transcript?.trim();
    if(v){
      if(aiInput)aiInput.value=v;
      askAi(v,{voice:true});
      if(aiInput)aiInput.value="";
    }
  };
  aiRecognition.onend=()=>{aiRecognition._running=false;setVoiceUi(false);};
  aiRecognition.onerror=(event)=>{aiRecognition._running=false;setVoiceUi(false);const code=event?.error;const msg=code==="not-allowed"||code==="service-not-allowed"?"Microphone permission blocked — allow microphone access.":code==="audio-capture"?"No microphone available.":code==="no-speech"?"No speech detected — tap and speak again.":code==="network"?"Voice recognition needs an internet connection.":code==="language-not-supported"?"Selected voice language is not supported here.":"Voice input stopped — tap and try again.";if(aiVoiceStatus)aiVoiceStatus.textContent=msg;};
} else if(aiMic){
  aiMic.disabled=true;
  aiMic.title="Voice input is not supported in this browser";
  if(aiVoiceMic)aiVoiceMic.disabled=true;
}

document.querySelectorAll("[data-ai]").forEach(b=>b.addEventListener("click",()=>askAi(b.dataset.ai)));


/* PREMIUM HERO 3D EARTH */
let heroGlobe3DReady=false;
function initHeroGlobe3D(){
  const host=document.querySelector("#heroGlobe3D");
  if(!host || !window.THREE || heroGlobe3DReady) return;
  heroGlobe3DReady=true;
  const THREE=window.THREE;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(32,1,.1,100);
  camera.position.set(0,0,5.9);

  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setClearColor(0x000000,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
  host.innerHTML="";
  host.appendChild(renderer.domElement);

  const group=new THREE.Group();
  scene.add(group);

  // Touch / mouse drag interaction for the hero Earth.
  let dragging=false, lastX=0, lastY=0;
  const dragHost=host;
  const startDrag=(e)=>{
    dragging=true;
    lastX=e.clientX;
    lastY=e.clientY;
    dragHost.setPointerCapture?.(e.pointerId);
  };
  const moveDrag=(e)=>{
    if(!dragging) return;
    const dx=e.clientX-lastX;
    const dy=e.clientY-lastY;
    group.rotation.y += dx*0.008;
    group.rotation.x += dy*0.004;
    group.rotation.x=Math.max(-0.45,Math.min(0.45,group.rotation.x));
    lastX=e.clientX;
    lastY=e.clientY;
  };
  const endDrag=()=>{dragging=false};
  host.addEventListener("pointerdown",startDrag,{passive:true});
  host.addEventListener("pointermove",moveDrag,{passive:true});
  host.addEventListener("pointerup",endDrag,{passive:true});
  host.addEventListener("pointercancel",endDrag,{passive:true});
  host.addEventListener("pointerleave",endDrag,{passive:true});

  const textureLoader=new THREE.TextureLoader();
  textureLoader.crossOrigin="anonymous";
  const texture=textureLoader.load(
    "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg"
  );
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;
  const normalTexture=textureLoader.load(
    "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg"
  );

  const earth=new THREE.Mesh(
    new THREE.SphereGeometry(1.62,64,64),
    new THREE.MeshPhongMaterial({
      map:texture,
      normalMap:normalTexture,
      normalScale:new THREE.Vector2(.45,.45),
      shininess:28,
      specular:new THREE.Color(0x244d72)
    })
  );
  group.add(earth);

  const atmosphere=new THREE.Mesh(
    new THREE.SphereGeometry(1.70,64,64),
    new THREE.MeshPhongMaterial({
      color:0x55bfff,
      transparent:true,
      opacity:.14,
      side:THREE.BackSide
    })
  );
  group.add(atmosphere);

  const glow=new THREE.Mesh(
    new THREE.SphereGeometry(1.77,48,48),
    new THREE.MeshBasicMaterial({
      color:0x3aa8ff,
      transparent:true,
      opacity:.055,
      side:THREE.BackSide
    })
  );
  group.add(glow);

  scene.add(new THREE.AmbientLight(0xcfeaff,1.8));
  const sun=new THREE.DirectionalLight(0xffffff,3.6);
  sun.position.set(4,3,5);
  scene.add(sun);
  const warm=new THREE.PointLight(0xff9d2e,3.2,10);
  warm.position.set(-3,-1,3);
  scene.add(warm);

  const ring=new THREE.Mesh(
    new THREE.TorusGeometry(1.83,.012,8,128),
    new THREE.MeshBasicMaterial({color:0xff9d2e,transparent:true,opacity:.55})
  );
  ring.rotation.x=.42;
  ring.rotation.z=-.18;
  scene.add(ring);

  let flightRouteGroup=null,flightRoutePlane=null;
  function geoPoint(lat,lon,r=1.685){const p=(90-lat)*Math.PI/180,t=(lon+180)*Math.PI/180;return new THREE.Vector3(-r*Math.sin(p)*Math.cos(t),r*Math.cos(p),r*Math.sin(p)*Math.sin(t));}
  function arcPoint(a,b,t){const ang=a.angleTo(b);if(ang<.0001)return a.clone().lerp(b,t).normalize();const s=Math.sin(ang);return a.clone().multiplyScalar(Math.sin((1-t)*ang)/s).add(b.clone().multiplyScalar(Math.sin(t*ang)/s)).normalize();}
  window.renderFlightRoute=(from,to)=>{
    if(flightRouteGroup)group.remove(flightRouteGroup);
    flightRouteGroup=new THREE.Group();
    const start=geoPoint(from.lat,from.lon),end=geoPoint(to.lat,to.lon),pts=[];
    for(let i=0;i<=80;i++){const t=i/80,p=arcPoint(start.clone().normalize(),end.clone().normalize(),t);p.multiplyScalar(1.685+Math.sin(Math.PI*t)*.12);pts.push(p);}
    flightRouteGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xff8a18,transparent:true,opacity:1,depthTest:false,depthWrite:false})));
    const markerMat=new THREE.MeshStandardMaterial({color:0xff8a18,emissive:0x8a3d00,emissiveIntensity:1.5,depthTest:false,depthWrite:false});
    [start,end].forEach(p=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.045,16,12),markerMat.clone());m.position.copy(p);flightRouteGroup.add(m);});
    flightRoutePlane=new THREE.Mesh(new THREE.SphereGeometry(.075,16,10),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xff8a18,emissiveIntensity:1.4,depthTest:false,depthWrite:false}));
    flightRouteGroup.add(flightRoutePlane);group.add(flightRouteGroup);flightRouteState={start,end,t:0};
  };

  function resize(){
    const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize",resize,{passive:true});

  function animate(){
    requestAnimationFrame(animate);
    earth.rotation.y+=.009;
    atmosphere.rotation.y+=.004;
    ring.rotation.y+=.0025;
    if(flightRouteState&&flightRoutePlane){flightRouteState.t=(flightRouteState.t+.002)%1;const t=flightRouteState.t,p=arcPoint(flightRouteState.start.clone().normalize(),flightRouteState.end.clone().normalize(),t);p.multiplyScalar(1.685+Math.sin(Math.PI*t)*.12);flightRoutePlane.position.copy(p);}
    group.rotation.x=Math.sin(performance.now()*.00025)*.025;
    renderer.render(scene,camera);
  }
  animate();
  if(window.renderFlightRoute)window.renderFlightRoute({lat:14.4673,lon:78.8242},{lat:29.3759,lon:47.9774});
}
document.addEventListener("DOMContentLoaded",initHeroGlobe3D);


/* PREMIUM HERO 3D AIRCRAFT */
let heroAircraftReady=false;
function initHeroAircraft3D(){
  const host=document.querySelector("#heroAirplane3D");
  if(!host || !window.THREE || heroAircraftReady) return;
  heroAircraftReady=true;
  const THREE=window.THREE;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(35,1,.1,50);
  camera.position.set(0,0,4.5);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setClearColor(0x000000,0);
  host.innerHTML="";
  host.appendChild(renderer.domElement);

  const aircraft=new THREE.Group();
  aircraft.rotation.set(.10,.15,-.12);
  aircraft.scale.setScalar(1.15);
  scene.add(aircraft);

  const white=new THREE.MeshStandardMaterial({color:0xf7fafc,metalness:.45,roughness:.24});
  const orange=new THREE.MeshStandardMaterial({color:0xff8f1f,metalness:.35,roughness:.25});
  const dark=new THREE.MeshStandardMaterial({color:0x24364a,metalness:.35,roughness:.3});

  const fuselage=new THREE.Mesh(new THREE.CapsuleGeometry(.17,1.55,8,20),white);
  fuselage.rotation.z=Math.PI/2;
  aircraft.add(fuselage);

  const nose=new THREE.Mesh(new THREE.SphereGeometry(.175,20,12),orange);
  nose.position.x=.86;
  aircraft.add(nose);

  const wing=new THREE.Mesh(new THREE.BoxGeometry(.95,.045,.55),white);
  wing.position.set(.05,0,0);
  wing.rotation.y=-.10;
  aircraft.add(wing);

  const tailWing=new THREE.Mesh(new THREE.BoxGeometry(.38,.04,.25),white);
  tailWing.position.set(-.66,.12,0);
  aircraft.add(tailWing);

  const tailFin=new THREE.Mesh(new THREE.BoxGeometry(.24,.36,.045),white);
  tailFin.position.set(-.64,.17,0);
  tailFin.rotation.z=-.28;
  aircraft.add(tailFin);

  for(const z of [-.25,.25]){
    const engine=new THREE.Mesh(new THREE.CylinderGeometry(.075,.095,.38,18),dark);
    engine.rotation.x=Math.PI/2;
    engine.position.set(.18,-.10,z);
    aircraft.add(engine);
  }

  const stripe=new THREE.Mesh(new THREE.BoxGeometry(1.05,.025,.015),orange);
  stripe.position.set(.05,-.16,.08);
  aircraft.add(stripe);

  scene.add(new THREE.HemisphereLight(0xb9ddff,0x172437,2.1));
  const key=new THREE.DirectionalLight(0xffffff,3);
  key.position.set(3,4,5);
  scene.add(key);
  const rim=new THREE.PointLight(0xff9d2e,3,10);
  rim.position.set(-2,1,2);
  scene.add(rim);

  function resize(){
    const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize",resize,{passive:true});

  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const t=clock.getElapsedTime();
    aircraft.rotation.y=.16+Math.sin(t*.7)*.08;
    aircraft.rotation.z=-.10+Math.sin(t*1.2)*.035;
    aircraft.position.y=Math.sin(t*1.4)*.06;
    renderer.render(scene,camera);
  }
  animate();
}
document.addEventListener("DOMContentLoaded",initHeroAircraft3D);


/* PREMIUM HERO 3D CRUISE SHIP */
let heroCruiseReady=false;
function initHeroCruise3D(){
  const host=document.querySelector("#heroCruise3D");
  if(!host || !window.THREE || heroCruiseReady) return;
  heroCruiseReady=true;
  const THREE=window.THREE;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(34,1,.1,60);
  camera.position.set(0,0,5.6);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setClearColor(0x000000,0);
  host.innerHTML="";
  host.appendChild(renderer.domElement);

  const ship=new THREE.Group();
  ship.rotation.set(.05,-.25,-.05);
  ship.scale.setScalar(1.12);
  scene.add(ship);

  const hullMat=new THREE.MeshStandardMaterial({color:0xf4f7fa,metalness:.35,roughness:.25});
  const darkMat=new THREE.MeshStandardMaterial({color:0x1b334a,metalness:.3,roughness:.28});
  const glassMat=new THREE.MeshPhysicalMaterial({color:0x77bfe8,metalness:.1,roughness:.08,transparent:true,opacity:.82});
  const orangeMat=new THREE.MeshStandardMaterial({color:0xff8f1f,metalness:.3,roughness:.24});

  const hull=new THREE.Mesh(new THREE.BoxGeometry(2.55,.48,.72),hullMat);
  hull.position.y=-.35;
  hull.scale.x=1.08;
  ship.add(hull);

  const bow=new THREE.Mesh(new THREE.ConeGeometry(.52,.95,32),hullMat);
  bow.rotation.z=-Math.PI/2;
  bow.position.x=1.55;
  bow.position.y=-.28;
  bow.scale.z=1.05;
  ship.add(bow);

  const lowerHull=new THREE.Mesh(new THREE.BoxGeometry(2.35,.12,.70),orangeMat);
  lowerHull.position.set(0,-.59,0);
  ship.add(lowerHull);

  for(let i=0;i<4;i++){
    const deck=new THREE.Mesh(new THREE.BoxGeometry(1.85-i*.16,.18,.60),hullMat);
    deck.position.set(-.10,.02+i*.20,0);
    ship.add(deck);
  }

  const bridge=new THREE.Mesh(new THREE.BoxGeometry(.72,.35,.54),glassMat);
  bridge.position.set(.62,.52,0);
  ship.add(bridge);

  for(let i=0;i<6;i++){
    const window=new THREE.Mesh(new THREE.BoxGeometry(.13,.08,.025),darkMat);
    window.position.set(-.70+i*.28,.22,.315);
    ship.add(window);
    const other=window.clone();
    other.position.z=-.315;
    ship.add(other);
  }

  for(let i=0;i<3;i++){
    const funnel=new THREE.Mesh(new THREE.CylinderGeometry(.075,.095,.38,18),orangeMat);
    funnel.position.set(-.62+i*.25,.66,0);
    ship.add(funnel);
  }

  const topDeck=new THREE.Mesh(new THREE.BoxGeometry(.72,.06,.58),glassMat);
  topDeck.position.set(-.18,.80,0);
  ship.add(topDeck);

  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.45,10),darkMat);
  mast.position.set(.05,1.02,0);
  ship.add(mast);

  scene.add(new THREE.HemisphereLight(0xbde4ff,0x18283a,2.0));
  const key=new THREE.DirectionalLight(0xffffff,3.1);
  key.position.set(4,4,5);
  scene.add(key);
  const warm=new THREE.PointLight(0xff9d2e,3.5,12);
  warm.position.set(-3,1,3);
  scene.add(warm);

  function resize(){
    const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize",resize,{passive:true});

  const clock=new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const t=clock.getElapsedTime();
    ship.rotation.y=-.25+Math.sin(t*.45)*.07;
    ship.rotation.z=-.05+Math.sin(t*.8)*.025;
    ship.position.y=Math.sin(t*1.15)*.055;
    renderer.render(scene,camera);
  }
  animate();
}
document.addEventListener("DOMContentLoaded",initHeroCruise3D);

/* FLIGHT LOCATION SEARCH */
const FLIGHT_DEFAULTS={"Kadapa, India":{lat:14.4673,lon:78.8242,label:"Kadapa, India"},"Kuwait City, Kuwait":{lat:29.3759,lon:47.9774,label:"Kuwait City, Kuwait"},"Dubai, United Arab Emirates":{lat:25.2048,lon:55.2708,label:"Dubai, United Arab Emirates"},"Frankfurt, Germany":{lat:50.1109,lon:8.6821,label:"Frankfurt, Germany"},"Rome, Italy":{lat:41.9028,lon:12.4964,label:"Rome, Italy"}};
async function findFlightPlace(value){const key=Object.keys(FLIGHT_DEFAULTS).find(k=>k.toLowerCase()===value.trim().toLowerCase());if(key)return FLIGHT_DEFAULTS[key];const r=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(value.trim()));if(!r.ok)throw Error("lookup");const d=await r.json();if(!d[0])throw Error("notfound");return{lat:+d[0].lat,lon:+d[0].lon,label:d[0].display_name.split(",").slice(0,2).join(",")};}
document.addEventListener("DOMContentLoaded",()=>{
  const picker=document.querySelector("#globeDestinationPicker");
  const destinationInput=document.querySelector("#flightTo");
  const showRoute=document.querySelector("#flightShow");
  if(!picker||!destinationInput||!showRoute)return;
  picker.querySelectorAll("[data-globe-destination]").forEach(button=>{
    button.addEventListener("click",()=>{
      destinationInput.value=button.dataset.globeDestination;
      showRoute.click();
      picker.querySelectorAll("button").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
    });
  });
});

document.addEventListener("DOMContentLoaded",()=>{
 const show=document.querySelector("#flightShow"),swap=document.querySelector("#flightSwap"),from=document.querySelector("#flightFrom"),to=document.querySelector("#flightTo"),status=document.querySelector("#flightStatus");
 if(!show||!from||!to)return;
 swap?.addEventListener("click",()=>{const x=from.value;from.value=to.value;to.value=x;});
 show.addEventListener("click",async()=>{show.disabled=true;status.className="flight-status loading";status.textContent="Finding accurate coordinates…";try{const[a,b]=await Promise.all([findFlightPlace(from.value),findFlightPlace(to.value)]);window.renderFlightRoute(a,b);document.querySelector(".route-from").textContent=a.label.split(",")[0].toUpperCase();document.querySelector(".route-to").textContent=b.label.split(",")[0].toUpperCase();status.className="flight-status success";status.textContent=a.label+" → "+b.label+" • 3D route ready";}catch(e){status.className="flight-status error";status.textContent="Location not found. Try City, Country."}finally{show.disabled=false;}});
});

/* DESTINATION CATEGORY POPUP */
document.addEventListener("DOMContentLoaded",()=>{
  const panel=document.querySelector("#destinationCountryPanel");
  const close=document.querySelector("#destinationPanelClose");
  const title=document.querySelector("#destinationPanelTitle");
  const kicker=document.querySelector("#destinationPanelKicker");
  const textEl=document.querySelector("#destinationPanelText");
  const countries=document.querySelector("#destinationPanelCountries");
  const data={
    gulf:{
      kicker:"GULF COUNTRIES",
      title:"Gulf Countries",
      text:"Choose a Gulf destination for travel, visa or overseas career enquiry.",
      items:[
        ["🇰🇼","Kuwait"],["🇦🇪","United Arab Emirates"],["🇶🇦","Qatar"],["🇧🇭","Bahrain"]
      ]
    },
    europe:{
      kicker:"EUROPE • SCHENGEN",
      title:"Europe (Schengen) Countries",
      text:"Explore Schengen destinations. Visa eligibility and final decisions are handled by the relevant authorities.",
      items:[
        ["🇦🇹","Austria"],["🇧🇪","Belgium"],["🇧🇬","Bulgaria"],["🇭🇷","Croatia"],["🇨🇿","Czechia"],["🇩🇰","Denmark"],["🇪🇪","Estonia"],["🇫🇮","Finland"],["🇫🇷","France"],["🇩🇪","Germany"],["🇬🇷","Greece"],["🇭🇺","Hungary"],["🇮🇸","Iceland"],["🇮🇹","Italy"],["🇱🇻","Latvia"],["🇱🇮","Liechtenstein"],["🇱🇹","Lithuania"],["🇱🇺","Luxembourg"],["🇲🇹","Malta"],["🇳🇱","Netherlands"],["🇳🇴","Norway"],["🇵🇱","Poland"],["🇵🇹","Portugal"],["🇷🇴","Romania"],["🇸🇰","Slovakia"],["🇸🇮","Slovenia"],["🇪🇸","Spain"],["🇸🇪","Sweden"],["🇨🇭","Switzerland"]
      ]
    },
    other:{
      kicker:"OTHER COUNTRIES",
      title:"Other Countries",
      text:"Explore selected destinations outside the Gulf and Schengen groups.",
      items:[
        ["🇷🇺","Russia"],["🇮🇱","Israel"],["🇯🇵","Japan"],["🇨🇦","Canada"],["🇬🇧","United Kingdom"],["🇦🇺","Australia"],["🇳🇿","New Zealand"],["🇸🇬","Singapore"]
      ]
    }
  };
  function openPanel(key){
    const d=data[key]; if(!d||!panel)return;
    kicker.textContent=d.kicker; title.textContent=d.title; textEl.textContent=d.text;
    countries.innerHTML=d.items.map(([flag,name])=>'<a href="#enquiry" data-destination="'+name.replace(/"/g,"&quot;")+'"><span>'+flag+'</span>'+name+'</a>').join("");
    panel.hidden=false; document.body.classList.add("destination-panel-open");
  }
  document.querySelectorAll("[data-destination-panel]").forEach(btn=>btn.addEventListener("click",()=>openPanel(btn.dataset.destinationPanel)));
  function closePanel(){if(panel)panel.hidden=true;document.body.classList.remove("destination-panel-open");}
  close?.addEventListener("click",closePanel);
  panel?.addEventListener("click",e=>{if(e.target===panel)closePanel();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closePanel();});
});

/* FINAL OVERSEAS JOB CATEGORY UI */
document.addEventListener("DOMContentLoaded",()=>{
  const panel=document.querySelector("#jobRolePanel");
  const close=document.querySelector("#jobRolePanelClose");
  const title=document.querySelector("#jobRolePanelTitle");
  const kicker=document.querySelector("#jobRolePanelKicker");
  const textEl=document.querySelector("#jobRolePanelText");
  const list=document.querySelector("#jobRoleList");

  const roleData={
    "Skilled & Unskilled Jobs":{
      kicker:"JOB OPPORTUNITIES",
      title:"Skilled & Unskilled Job Roles",
      text:"Choose a job role to continue to the job enquiry form.",
      roles:["Painter","Electrician","Welder / Fabricator","Technician","Forklift Operator","Helper","Cleaner","Loader","Warehouse Worker","Construction Helper"]
    }
  };

  function openJobPanel(category){
    const d=roleData[category];
    if(!d||!panel) return;
    kicker.textContent=d.kicker;
    title.textContent=d.title;
    textEl.textContent=d.text;
    list.innerHTML=d.roles.map(role=>`<button type="button" class="job-role-option" data-role="${role}"><span>${role}</span><span>↗</span></button>`).join("");
    panel.hidden=false;
    document.body.classList.add("job-role-panel-open");
    list.querySelectorAll(".job-role-option").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const service=document.querySelector("#enquiryService");
        const jobType=document.querySelector("#enquiryJobType");
        const jobRole=document.querySelector("#enquiryJobRole");
        const goal=document.querySelector("#enquiryGoal");
        if(service) service.value="Overseas Job Assistance";
        if(jobType) jobType.value=category==="Skilled Jobs" ? "Skilled Jobs" : "Unskilled / Blue-Collar Jobs";
        if(jobRole) jobRole.value=btn.dataset.role||"";
        if(goal) goal.value=(btn.dataset.role||"")+" job enquiry";
        closeJobPanel();
        document.querySelector("#enquiry")?.scrollIntoView({behavior:"smooth",block:"start"});
      });
    });
  }

  function closeJobPanel(){
    if(panel) panel.hidden=true;
    document.body.classList.remove("job-role-panel-open");
  }

  document.querySelectorAll(".jobs-category-choice-card[data-job-category]").forEach(card=>{
    card.addEventListener("click",()=>openJobPanel(card.dataset.jobCategory));
  });
  close?.addEventListener("click",closeJobPanel);
  panel?.addEventListener("click",e=>{if(e.target===panel) closeJobPanel();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape") closeJobPanel();});
});


/* ONE-TAP DAY / NIGHT MODE */
document.addEventListener("DOMContentLoaded",()=>{
  const toggle=document.querySelector("#themeModeToggle");
  const icon=document.querySelector("#themeModeIcon");
  const saved=localStorage.getItem("sivaTheme")||"day";
  function setTheme(mode){
    document.body.classList.toggle("night-mode",mode==="night");
    if(icon) icon.textContent=mode==="night"?"☾":"☀";
    if(toggle){
      toggle.setAttribute("aria-label",mode==="night"?"Switch to day mode":"Switch to night mode");
      toggle.title=mode==="night"?"Day mode":"Night mode";
    }
    localStorage.setItem("sivaTheme",mode);
  }
  toggle?.addEventListener("click",()=>setTheme(document.body.classList.contains("night-mode")?"day":"night"));
  setTheme(saved);
});


/* SIVA FINAL FALLBACK */
window.addEventListener("load",()=>{
  if(!window.THREE){
    document.documentElement.classList.add("no-three");
    const host=document.querySelector("#heroGlobe3D");
    if(host) host.setAttribute("aria-label","3D globe fallback");
  }
});

/* SIVA 3D INTERACTION LAYER — lightweight, mobile-safe */
document.addEventListener("DOMContentLoaded",()=>{
  const fine=window.matchMedia("(pointer:fine)").matches;
  if(!fine) return;
  document.querySelectorAll(".service-card,.destination-choice,.jobs-category-choice-card,.payment-card,.app-download-btn").forEach(card=>{
    card.addEventListener("pointermove",e=>{
      const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      card.style.setProperty("--rx",(-y*6).toFixed(2)+"deg"); card.style.setProperty("--ry",(x*8).toFixed(2)+"deg");
      card.style.setProperty("--mx",(x*100).toFixed(1)+"%"); card.style.setProperty("--my",(y*100).toFixed(1)+"%");
    });
    card.addEventListener("pointerleave",()=>{
      card.style.setProperty("--rx","0deg"); card.style.setProperty("--ry","0deg");
      card.style.setProperty("--mx","50%"); card.style.setProperty("--my","50%");
    });
  });
  const hero=document.querySelector(".hero-3d");
  if(hero){
    hero.addEventListener("pointermove",e=>{
      const r=hero.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      hero.style.setProperty("--hero-x",(x*18).toFixed(2)+"px"); hero.style.setProperty("--hero-y",(y*12).toFixed(2)+"px");
    });
    hero.addEventListener("pointerleave",()=>{hero.style.setProperty("--hero-x","0px");hero.style.setProperty("--hero-y","0px");});
  }
});

/* SIVA 3D PERFORMANCE GUARD */
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){
    document.querySelectorAll("canvas").forEach(c=>{c.style.visibility="hidden";});
  }else{
    document.querySelectorAll("canvas").forEach(c=>{c.style.visibility="visible";});
  }
});

/* 3D SHAPE PARALLAX — pointer devices only */
document.addEventListener("DOMContentLoaded",()=>{
  if(!window.matchMedia("(pointer:fine)").matches) return;
  const field=document.querySelector(".shape3d-field");
  if(!field) return;
  const shapes=field.querySelectorAll(".shape3d");
  const move=(e)=>{
    const r=field.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
    shapes.forEach((el,i)=>{
      const depth=(i+1)*5;
      el.style.marginLeft=(x*depth).toFixed(1)+"px";
      el.style.marginTop=(y*depth).toFixed(1)+"px";
    });
  };
  field.parentElement?.addEventListener("pointermove",move,{passive:true});
  field.parentElement?.addEventListener("pointerleave",()=>{
    shapes.forEach(el=>{el.style.marginLeft="0";el.style.marginTop="0";});
  });
});


/* CINEMATIC 3D HERO INTERACTION */
document.addEventListener("DOMContentLoaded",()=>{const hero=document.querySelector(".hero-3d"),earth=document.querySelector(".earth-scene");if(hero&&earth&&matchMedia("(pointer:fine)").matches){hero.addEventListener("pointermove",e=>{const r=hero.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;earth.style.transform="translateY(-50%) translate3d("+(x*18).toFixed(1)+"px,"+(y*12).toFixed(1)+"px,0) rotateX("+(-y*2).toFixed(2)+"deg) rotateY("+(x*3).toFixed(2)+"deg)"});hero.addEventListener("pointerleave",()=>{earth.style.transform="translateY(-50%) translate3d(0,0,0)"})}const targets=document.querySelectorAll(".services,.destination-showcase,.jobs-showcase,.trust-enquiry,.about-section,.faq-section,.payment-section,.app-download,.contact");targets.forEach(el=>el.classList.add("reveal-3d"));if("IntersectionObserver"in window){const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("is-visible");io.unobserve(entry.target)}}),{threshold:.12});targets.forEach(el=>io.observe(el))}else targets.forEach(el=>el.classList.add("is-visible"))});


/* SIVA FINAL REQUIREMENTS — flight search + ELITE reliability */
(function(){
  const cityDB={
    "hyderabad, india":{lat:17.385,lon:78.4867,label:"Hyderabad, India"},
    "new delhi, india":{lat:28.6139,lon:77.209,label:"New Delhi, India"},
    "delhi, india":{lat:28.6139,lon:77.209,label:"New Delhi, India"},
    "mumbai, india":{lat:19.076,lon:72.8777,label:"Mumbai, India"},
    "chennai, india":{lat:13.0827,lon:80.2707,label:"Chennai, India"},
    "bangalore, india":{lat:12.9716,lon:77.5946,label:"Bengaluru, India"},
    "bengaluru, india":{lat:12.9716,lon:77.5946,label:"Bengaluru, India"},
    "kadapa, india":{lat:14.4673,lon:78.8242,label:"Kadapa, India"},
    "kuwait city, kuwait":{lat:29.3759,lon:47.9774,label:"Kuwait City, Kuwait"},
    "frankfurt, germany":{lat:50.1109,lon:8.6821,label:"Frankfurt, Germany"},
    "berlin, germany":{lat:52.52,lon:13.405,label:"Berlin, Germany"},
    "rome, italy":{lat:41.9028,lon:12.4964,label:"Rome, Italy"},
    "milan, italy":{lat:45.4642,lon:9.19,label:"Milan, Italy"},
    "luxembourg, luxembourg":{lat:49.6116,lon:6.1319,label:"Luxembourg"},
    "paris, france":{lat:48.8566,lon:2.3522,label:"Paris, France"},
    "london, uk":{lat:51.5074,lon:-.1278,label:"London, UK"},
    "london, united kingdom":{lat:51.5074,lon:-.1278,label:"London, UK"},
    "tel aviv, israel":{lat:32.0853,lon:34.7818,label:"Tel Aviv, Israel"},
    "moscow, russia":{lat:55.7558,lon:37.6173,label:"Moscow, Russia"}
  };
  window.SIVA_CITY_DB=cityDB;
  const oldFind=window.findFlightPlace;
  window.sivaFindFlightPlace=async function(value){
    const key=String(value||"").trim().toLowerCase();
    if(cityDB[key]) return cityDB[key];
    if(typeof oldFind==="function") return oldFind(value);
    const r=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(value));
    if(!r.ok) throw Error("lookup");
    const d=await r.json();
    if(!d[0]) throw Error("notfound");
    return {lat:+d[0].lat,lon:+d[0].lon,label:d[0].display_name.split(",").slice(0,2).join(",")};
  };
  document.addEventListener("DOMContentLoaded",()=>{
    const btn=document.querySelector("#flightShow");
    const from=document.querySelector("#flightFrom"),to=document.querySelector("#flightTo"),status=document.querySelector("#flightStatus");
    if(!btn||!from||!to||!status) return;
    const run=async()=>{
      const a=from.value.trim(),b=to.value.trim();
      if(!a||!b){status.className="flight-status error";status.textContent="Enter both From and To places.";return;}
      btn.disabled=true;status.className="flight-status loading";status.textContent="Finding places and drawing flight route…";
      try{
        const [A,B]=await Promise.all([window.sivaFindFlightPlace(a),window.sivaFindFlightPlace(b)]);
        if(typeof window.renderFlightRoute==="function") window.renderFlightRoute(A,B);
        const rf=document.querySelector(".route-from"),rt=document.querySelector(".route-to");
        if(rf)rf.textContent=A.label.split(",")[0].toUpperCase();
        if(rt)rt.textContent=B.label.split(",")[0].toUpperCase();
        status.className="flight-status success";status.textContent=A.label+" → "+B.label+" • ✈ route active";
      }catch(e){status.className="flight-status error";status.textContent="Place not found. Try City, Country.";}
      finally{btn.disabled=false;}
    };
    btn.addEventListener("click",run);
    [from,to].forEach(input=>input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();run();}}));
  });
})();

/* ELITE voice: separate microphone recognition from AI API errors and give useful diagnostics. */
(function(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const mic=document.querySelector("#aiMic"),voiceMic=document.querySelector("#aiVoiceMic"),status=document.querySelector("#aiVoiceStatus");
  if(!SpeechRecognition||(!mic&&!voiceMic)) return;
  const originalErrorHandler=(window.__sivaELITERecognitionErrorHandler||null);
  function messageFor(error){
    const code=error&&error.error;
    if(code==="not-allowed"||code==="service-not-allowed") return "Microphone permission is blocked. Allow microphone access for this site and try again.";
    if(code==="audio-capture") return "No microphone is available. Check your phone microphone permission.";
    if(code==="no-speech") return "No speech detected. Tap the microphone and speak clearly.";
    if(code==="language-not-supported") return "This voice language is not supported by this browser. Try English or Telugu.";
    if(code==="network") return "Voice recognition needs an online speech service. Check your internet connection.";
    return "Voice input stopped. Tap the microphone and try again.";
  }
  const patch=()=>{
    try{
      if(window.aiRecognition){
        window.aiRecognition.onerror=(e)=>{window.aiRecognition._running=false;if(status)status.textContent=messageFor(e);if(typeof setVoiceUi==="function")setVoiceUi(false);};
      }
    }catch(_){ }
  };
  setTimeout(patch,250);
  window.addEventListener("error",()=>setTimeout(patch,0));
})();

/* Keep AI API failures honest and actionable instead of the generic temporary-unavailable text. */
(function(){
  const oldAsk=window.askAi;
  if(typeof oldAsk!=="function") return;
  // Expose a configuration hook without ever embedding a secret in the website.
  window.SIVA_AI_CONFIG={endpoint:window.SIVA_AI_API_URL||"/api/chat"};
})();


/* Newsletter opt-in: WhatsApp confirmation flow; no email is stored by this static form. */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("newsletterSignup");
  if (!form) return;
  const emailInput = document.getElementById("newsletterEmail");
  const consentInput = document.getElementById("newsletterConsent");
  const status = document.getElementById("newsletterStatus");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = (emailInput?.value || "").trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      status.textContent = "Please enter a valid email address.";
      status.className = "newsletter-status is-error";
      emailInput?.focus();
      return;
    }
    if (!consentInput?.checked) {
      status.textContent = "Please confirm your consent before subscribing.";
      status.className = "newsletter-status is-error";
      consentInput?.focus();
      return;
    }
    const message = "Hello Siva Multi Services, I would like to subscribe to travel newsletters and service updates. My email address is: " + email + ". I consent to receive these updates.";
    const url = "https://wa.me/9182641172?text=" + encodeURIComponent(message);
    status.textContent = "Opening WhatsApp so you can send and confirm your subscription request. Your email is not stored on this website.";
    status.className = "newsletter-status is-success";
    window.open(url, "_blank", "noopener,noreferrer");
  });
});
