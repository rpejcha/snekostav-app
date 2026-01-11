// --- REGISTRACE SERVICE WORKERU ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW chyba:', err));
    });
}

// ==========================================
// 🛠️ NASTAVENÍ (DEBUG)
const DEBUG_MODE = false; 
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyBVr6ktDX_NSD0Jgp3KlbMQV-EeYsD5ZqQ", 
    authDomain: "snekostav-system.firebaseapp.com",
    projectId: "snekostav-system",
    storageBucket: "snekostav-system.appspot.com",
    messagingSenderId: "861601501524",
    appId: "1:861601501524:web:cf3f9a6dac9b0602d178c1"
};

if (!DEBUG_MODE) firebase.initializeApp(firebaseConfig);

// --- STAV APLIKACE ---
let currentUser = null;     
let currentAction = "";     
let currentGps = null;

// --- INIT ---
window.onload = function() {
    if (DEBUG_MODE) {
        document.getElementById('debug-indicator').classList.remove('hidden');
        document.getElementById('debug-login-btns').classList.remove('hidden');
    } else {
        const auth = firebase.auth();
        const db = firebase.firestore();
        db.enablePersistence().catch(err => console.log("Persistence err", err));
        
        auth.onAuthStateChanged(user => {
            if (user) loadUserFromFirebase(user.email);
            else showLoginScreen();
        });
    }
};

// --- AUTH ---
async function loadUserFromFirebase(email) {
    try {
        const db = firebase.firestore();
        const snap = await db.collection('users').where('email', '==', email).get();
        if (snap.empty) { alert("Neznámý uživatel"); firebase.auth().signOut(); return; }
        
        currentUser = snap.docs[0].data();
        if (!currentUser.aktivni) { alert("Účet deaktivován"); firebase.auth().signOut(); return; }

        showDashboard();
    } catch (e) { console.error(e); }
}

function debugLogin(type) {
    if (type === 'Partak') {
        currentUser = { id: "D01", jmeno: "Radim", prijmeni: "Pejcha", email: "debug@radim.cz", role: "Parťák", aktivni: true };
    } else {
        currentUser = { id: "D02", jmeno: "Franta", prijmeni: "Jetel", email: "franta@test.cz", role: "Dělník", aktivni: true };
    }
    showDashboard();
}

function showDashboard() {
    document.getElementById('screen-login').classList.add('hidden');
    document.getElementById('screen-dashboard').classList.remove('hidden');
    document.getElementById('screen-dashboard').classList.add('flex');
    
    document.getElementById('user-name').innerText = currentUser.jmeno + " " + currentUser.prijmeni;
    
    // Zobrazení role: Jen pokud je Parťák, jinak prázdno
    const roleEl = document.getElementById('user-role');
    if (currentUser.role === 'Parťák') {
        roleEl.innerText = "PARŤÁK";
        roleEl.classList.remove('hidden');
    } else {
        roleEl.innerText = "";
        roleEl.classList.add('hidden');
    }
    
    watchLocation();
}

// --- GPS LOGIKA ---
function watchLocation() {
    if (DEBUG_MODE) {
        // Simulace: Jsem trochu mimo stavbu S01 (vzdálenost 250m)
        setTimeout(() => {
            currentGps = { lat: 50.077, lon: 14.4378 }; 
            document.getElementById('gps-status').innerText = `DEBUG Poloha (Praha)`;
        }, 1000);
        return;
    }
    if (!navigator.geolocation) { document.getElementById('gps-status').innerText = "Bez GPS"; return; }
    navigator.geolocation.watchPosition(
        pos => { 
            currentGps = { lat: pos.coords.latitude, lon: pos.coords.longitude }; 
            document.getElementById('gps-status').innerText = `Poloha OK (±${Math.round(pos.coords.accuracy)}m)`;
        },
        err => document.getElementById('gps-status').innerText = "Chyba GPS"
    );
}

// --- VÝBĚR STAVBY ---
async function openStavbyModal(action) {
    if (!currentGps && !DEBUG_MODE) { alert("Čekám na GPS... Jdi ven."); return; }
    
    currentAction = action;
    document.getElementById('modal-stavby').classList.remove('hidden');
    document.getElementById('modal-title').innerText = action;
    
    const list = document.getElementById('stavby-list');
    list.innerHTML = '<div class="text-center p-4 text-gray-400"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i><br>Hledám stavby v okolí...</div>';

    let stavby = [];
    if (DEBUG_MODE) {
        stavby = [
            { id: "S01", nazev: "Vila Park", lat: 50.0755, lon: 14.4378, radius: 200 },
            { id: "S02", nazev: "Sklad", lat: 50.1, lon: 14.5, radius: 200 }
        ];
    } else {
        const db = firebase.firestore();
        const snap = await db.collection('stavby').where('stav', '==', 'Aktivní').get();
        snap.forEach(doc => { stavby.push(doc.data()); });
    }

    // Vypočítat vzdálenosti
    stavby = stavby.map(s => {
        const dist = getDistanceFromLatLonInKm(currentGps.lat, currentGps.lon, s.lat, s.lon) * 1000;
        return { ...s, dist: Math.round(dist) };
    });

    // Seřadit podle vzdálenosti
    stavby.sort((a, b) => a.dist - b.dist);

    renderStavbyList(stavby);
}

function renderStavbyList(stavby) {
    const list = document.getElementById('stavby-list');
    list.innerHTML = "";

    const near = stavby.filter(s => s.dist <= s.radius);
    const far = stavby.filter(s => s.dist > s.radius);

    if (near.length > 0) {
        const label = document.createElement('p');
        label.className = "text-xs font-bold text-green-600 uppercase mb-2 mt-2 px-2";
        label.innerText = "Stavby v dosahu (Tady jsi)";
        list.appendChild(label);

        near.forEach(s => list.appendChild(createStavbaBtn(s, true)));
    }

    if (far.length > 0) {
        const label = document.createElement('p');
        label.className = "text-xs font-bold text-gray-400 uppercase mb-2 mt-4 px-2";
        label.innerText = "Ostatní stavby (Jsi daleko)";
        list.appendChild(label);

        far.forEach(s => list.appendChild(createStavbaBtn(s, false)));
    }
}

function createStavbaBtn(s, isNear) {
    const btn = document.createElement('div');
    btn.className = `w-full p-4 mb-2 border rounded-xl flex items-center gap-4 cursor-pointer transition-all ${isNear ? 'bg-white border-green-200 hover:border-green-400 shadow-sm' : 'bg-gray-100 border-gray-200 opacity-70 hover:opacity-100'}`;
    
    // ZDE JSEM ODEBRAL ČÍSELNOU VZDÁLENOST
    btn.innerHTML = `
        <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isNear ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}">
            <i class="fa-solid ${isNear ? 'fa-location-dot' : 'fa-ban'}"></i>
        </div>
        <div class="flex-1">
            <h4 class="font-bold text-gray-800">${s.nazev}</h4>
            <p class="text-xs ${isNear ? 'text-green-600 font-bold' : 'text-red-500'}">
                ${isNear ? 'V dosahu' : 'Mimo povolený dosah'}
            </p>
        </div>
        <i class="fa-solid fa-chevron-right text-gray-300"></i>
    `;

    btn.onclick = () => confirmAndSend(s, isNear);
    return btn;
}

// --- ODESLÁNÍ ---
function confirmAndSend(stavba, isNear) {
    // PSYCHOLOGICKÁ BRZDA - BEZ KONKRÉTNÍCH ČÍSEL
    if (!isNear) {
        const msg = `⚠️ VAROVÁNÍ: Jste příliš daleko od stavby "${stavba.nazev}"!\n\nTato akce bude zaznamenána jako "Mimo stavbu" a odeslána vedení k prověření.\n\nOpravdu chcete pokračovat?`;
        if (!confirm(msg)) return; // Uživatel se lekl a zrušil to
    }

    sendToFirebase(stavba, isNear);
}

async function sendToFirebase(stavba, isNear) {
    if (DEBUG_MODE) {
        alert(`DEBUG: Odesláno!\n${currentAction} -> ${stavba.nazev}\nStatus: ${isNear ? 'OK' : 'Mimo stavbu'}`);
        closeModal();
        return;
    }

    const zaznam = {
        timestamp: new Date().toISOString(),
        id_delnika: currentUser.id,
        jmeno_delnika: currentUser.jmeno + " " + currentUser.prijmeni,
        jmeno_autora: currentUser.jmeno + " " + currentUser.prijmeni,
        email_autora: currentUser.email,
        id_stavby: stavba.id,
        nazev_stavby: stavba.nazev,
        akce: currentAction,
        gps_lat: currentGps.lat,
        gps_lon: currentGps.lon,
        vzdalenost: stavba.dist,
        status: isNear ? "OK" : "Mimo stavbu - VAROVÁNÍ"
    };

    try {
        await firebase.firestore().collection('dochazka').add(zaznam);
        closeModal();
        alert(`✅ ${currentAction} úspěšně zapsán.`);
    } catch (e) {
        alert("Chyba při zápisu: " + e.message);
    }
}

// --- POMOCNÉ ---
function closeModal() { document.getElementById('modal-stavby').classList.add('hidden'); }
function loginWithGoogle() { 
    if (DEBUG_MODE) alert("Debug mode"); 
    else firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
}
function logout() { firebase.auth().signOut(); window.location.reload(); }

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; var dLat = deg2rad(lat2-lat1); var dLon = deg2rad(lon2-lon1); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c;
}
function deg2rad(deg) { return deg * (Math.PI/180); }