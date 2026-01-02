// --- REGISTRACE SERVICE WORKERU (PWA) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registrován:', reg.scope))
            .catch(err => console.log('SW chyba:', err));
    });
}

// ==========================================
// 🛠️ NASTAVENÍ PRO LOKÁLNÍ VÝVOJ
const DEBUG_MODE = true; 
// ==========================================

// --- 1. KONFIGURACE ---
const firebaseConfig = {
    apiKey: "AIzaSyBVr6ktDX_NSD0Jgp3KlbMQV-EeYsD5ZqQ", 
    authDomain: "snekostav-digital-service.firebaseapp.com",
    projectId: "snekostav-system",
    storageBucket: "snekostav-system.appspot.com",
    messagingSenderId: "861601501524",
    appId: "1:861601501524:web:cf3f9a6dac9b0602d178c1"
};

// Pokud nejsme v debug módu, nastartujeme Firebase
if (!DEBUG_MODE) {
    firebase.initializeApp(firebaseConfig);
}

// --- STAV APLIKACE ---
let currentUserDoc = null; 
let currentAction = "";    
let actingForId = null;    
let actingForFullName = null; 
let currentGps = null;     

// --- INIT ---
window.onload = function() {
    if (DEBUG_MODE) {
        console.log("⚠️ Aplikace běží v DEBUG módu.");
        document.getElementById('debug-indicator').classList.remove('hidden');
        document.getElementById('debug-login-btns').classList.remove('hidden');
    } else {
        const auth = firebase.auth();
        const db = firebase.firestore();
        db.enablePersistence().catch(err => console.log("Persistence error", err));
        
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                loadUserFromFirebase(user.email);
            } else {
                showLoginScreen();
            }
        });
    }
};

// --- FUNKCE ---

async function loadUserFromFirebase(email) {
    const db = firebase.firestore();
    try {
        const snapshot = await db.collection('users').where('email', '==', email).get();
        if (snapshot.empty) { showLoginError("Neznámý uživatel."); firebase.auth().signOut(); return; }
        
        currentUserDoc = snapshot.docs[0].data();
        if (currentUserDoc.aktivni === false) { showLoginError("Deaktivovaný účet."); firebase.auth().signOut(); return; }

        initializeDashboard();
    } catch (err) { console.error(err); showLoginError("Chyba DB: " + err.message); }
}

function debugLogin(type) {
    if (type === 'Partak') {
        currentUserDoc = {
            id: "D01", jmeno: "Radim", prijmeni: "Pejcha", email: "debug@radim.cz", role: "Parťák", aktivni: true,
            pomocnici: "D02, D03, D04" 
        };
    } else {
        currentUserDoc = {
            id: "D02", jmeno: "Franta", prijmeni: "Jetel", email: "franta@test.cz", role: "Dělník", aktivni: true, pomocnici: ""
        };
    }
    initializeDashboard();
}

function initializeDashboard() {
    document.getElementById('screen-login').classList.add('hidden');
    document.getElementById('screen-dashboard').classList.remove('hidden');
    document.getElementById('screen-dashboard').classList.add('flex');
    
    document.getElementById('user-name').innerText = currentUserDoc.jmeno + " " + currentUserDoc.prijmeni;
    document.getElementById('user-role').innerText = currentUserDoc.role;

    watchLocation();

    if (currentUserDoc.role === 'Parťák' && currentUserDoc.pomocnici) {
        loadHelpers(currentUserDoc.pomocnici);
    }
}

function loginWithGoogle() {
    if (DEBUG_MODE) { alert("V debug módu použij barevná tlačítka níže."); return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(err => showLoginError(err.message));
}

function logout() { 
    if (DEBUG_MODE) { showLoginScreen(); } else { firebase.auth().signOut(); }
}

function showLoginScreen() {
    document.getElementById('screen-dashboard').classList.add('hidden');
    document.getElementById('screen-dashboard').classList.remove('flex');
    document.getElementById('screen-login').classList.remove('hidden');
    currentUserDoc = null;
}

function showLoginError(msg) { const el = document.getElementById('login-error'); el.innerText = msg; el.classList.remove('hidden'); }

// --- PARŤÁK & POMOCNÍCI ---
async function loadHelpers(csvIds) {
    const ids = csvIds.split(',').map(s => s.trim()).filter(s => s !== "");
    if (ids.length === 0) return;

    const container = document.getElementById('helpers-list');
    container.innerHTML = '<span class="text-xs text-gray-400">Načítám...</span>';

    renderHelperBtn(currentUserDoc.id, "JÁ (Sám za sebe)", currentUserDoc.jmeno + " " + currentUserDoc.prijmeni, true);

    let helpersData = [];
    if (DEBUG_MODE) {
        helpersData = [
            { id: "D02", jmeno: "Franta", prijmeni: "Jetel" },
            { id: "D03", jmeno: "Lojza", prijmeni: "Lívanec" },
            { id: "D04", jmeno: "Jindra", prijmeni: "Kloboučník" }
        ];
        helpersData = helpersData.filter(h => ids.includes(h.id));
    } else {
        const allUsersSnap = await firebase.firestore().collection('users').where('aktivni', '==', true).get();
        allUsersSnap.forEach(doc => {
            const d = doc.data();
            if (ids.includes(d.id)) helpersData.push(d);
        });
    }
    
    container.innerHTML = '';
    renderHelperBtn(currentUserDoc.id, "JÁ (Sám za sebe)", currentUserDoc.jmeno + " " + currentUserDoc.prijmeni, true);

    helpersData.forEach(d => {
        renderHelperBtn(d.id, d.jmeno + " " + d.prijmeni.charAt(0) + ".", d.jmeno + " " + d.prijmeni);
    });
    
    document.getElementById('partak-panel').classList.remove('hidden');
}

function renderHelperBtn(id, label, fullName, isMe = false) {
    const btn = document.createElement('button');
    btn.className = `shrink-0 px-4 py-2 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap transition-colors border ${isMe ? 'bg-yellow-200 border-yellow-400 text-yellow-900 ring-2 ring-yellow-400 ring-offset-1' : 'bg-white border-yellow-200 text-gray-700 hover:bg-yellow-50'}`;
    btn.innerText = label;
    btn.onclick = () => {
        document.querySelectorAll('#helpers-list button').forEach(b => {
            b.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-1', 'bg-yellow-200');
            b.classList.add('bg-white');
        });
        btn.classList.remove('bg-white');
        btn.classList.add('bg-yellow-200', 'ring-2', 'ring-yellow-400', 'ring-offset-1');
        actingForId = id;
        actingForFullName = fullName;
    };
    document.getElementById('helpers-list').appendChild(btn);
    if (isMe) { actingForId = id; actingForFullName = fullName; }
}

// --- GPS & MODAL ---
function watchLocation() {
    if (DEBUG_MODE) {
        setTimeout(() => {
            currentGps = { lat: 50.0755, lon: 14.4378 }; 
            document.getElementById('gps-status').innerText = `DEBUG Poloha (Praha)`;
        }, 1000);
        return;
    }
    if (!navigator.geolocation) { document.getElementById('gps-status').innerText = "Bez GPS"; return; }
    navigator.geolocation.watchPosition(
        (pos) => { currentGps = { lat: pos.coords.latitude, lon: pos.coords.longitude }; document.getElementById('gps-status').innerText = `Poloha OK (±${Math.round(pos.coords.accuracy)}m)`; },
        (err) => { document.getElementById('gps-status').innerText = "Chyba GPS"; }, { enableHighAccuracy: true }
    );
}

async function openStavbyModal(action) {
    if (!currentGps) { alert("Čekám na GPS..."); return; }
    currentAction = action;
    document.getElementById('modal-stavby').classList.remove('hidden');
    const list = document.getElementById('stavby-list');
    list.innerHTML = "Načítám...";
    
    let stavbyArray = [];
    if (DEBUG_MODE) {
        stavbyArray = [
            { id: "S01", nazev: "Rezidence Park", lat: 50.0755, lon: 14.4378, radius: 200, dist: 50 },
            { id: "S02", nazev: "Vila Hradec", lat: 50.1, lon: 14.5, radius: 100, dist: 5000 }
        ];
    } else {
        const snap = await firebase.firestore().collection('stavby').where('stav', '==', 'Aktivní').get();
        snap.forEach(doc => {
            const s = doc.data();
            const dist = getDistanceFromLatLonInKm(currentGps.lat, currentGps.lon, s.lat, s.lon) * 1000;
            stavbyArray.push({ ...s, dist: dist });
        });
        stavbyArray.sort((a, b) => a.dist - b.dist);
    }

    list.innerHTML = "";
    stavbyArray.forEach(s => {
        const isClose = s.dist <= s.radius;
        const item = document.createElement('button');
        item.className = "w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 flex items-center gap-3";
        item.innerHTML = `<div class="w-3 h-3 rounded-full ${isClose ? 'bg-green-500' : 'bg-gray-300'}"></div><div><div class="font-bold text-gray-800">${s.nazev}</div><div class="text-xs text-gray-500">${Math.round(s.dist)}m</div></div>`;
        item.onclick = () => odeslatDochazku(s);
        list.appendChild(item);
    });
}

function closeModal() { document.getElementById('modal-stavby').classList.add('hidden'); }

async function odeslatDochazku(stavba) {
    if (!actingForId) actingForId = currentUserDoc.id;
    if (DEBUG_MODE) {
        alert(`DEBUG: Odesláno pro ${actingForFullName}`);
        closeModal();
        return;
    }
    const zaznam = {
        timestamp: new Date().toISOString(),
        id_delnika: actingForId,
        jmeno_delnika: actingForFullName || (currentUserDoc.jmeno + " " + currentUserDoc.prijmeni),
        jmeno_autora: currentUserDoc.jmeno + " " + currentUserDoc.prijmeni,
        email_autora: currentUserDoc.email,
        id_stavby: stavba.id,
        nazev_stavby: stavba.nazev,
        akce: currentAction,
        gps_lat: currentGps.lat,
        gps_lon: currentGps.lon,
        vzdalenost: Math.round(stavba.dist),
        status: stavba.dist <= stavba.radius ? "OK" : "Mimo stavbu"
    };
    try {
        await firebase.firestore().collection('dochazka').add(zaznam);
        closeModal();
        alert(`✅ ${currentAction} zapsán pro: ${actingForFullName}`);
    } catch (e) { alert("Chyba: " + e.message); }
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; var dLat = deg2rad(lat2-lat1); var dLon = deg2rad(lon2-lon1); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c;
}
function deg2rad(deg) { return deg * (Math.PI/180); }