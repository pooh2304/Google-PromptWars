// SheShield - Core Application Logic

// ==========================================
// STATE & CONFIG
// ==========================================
let state = {
    apiKey: '',
    isDangerous: false,
    isRecording: false,
    userLocation: null,
    silentMode: false
};

const ETHER_LOGS = [];
function devLog(msg) {
    console.log(msg);
    const logsEl = document.getElementById('demo-logs');
    ETHER_LOGS.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (ETHER_LOGS.length > 20) ETHER_LOGS.shift();
    if(logsEl) {
        logsEl.innerHTML = ETHER_LOGS.join('<br>');
        logsEl.scrollTop = logsEl.scrollHeight;
    }
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Demo panel toggle
    const toggle = document.getElementById('demo-toggle');
    const content = document.getElementById('demo-content');
    toggle.addEventListener('click', () => {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        toggle.querySelector('span').innerText = isHidden ? '▼' : '▲';
    });

    // Inputs
    state.apiKey = document.getElementById('gemini-api-key').value.trim();
    document.getElementById('gemini-api-key').addEventListener('input', (e) => {
        state.apiKey = e.target.value.trim();
        devLog(state.apiKey ? "API Key Updated" : "API Key Cleared");
    });

    // Buttons
    document.getElementById('sos-btn').addEventListener('click', triggerManualSOS);
    document.getElementById('silent-trigger-btn').addEventListener('click', () => {
        state.silentMode = !state.silentMode;
        if(state.silentMode) devLog("🤫 Silent mode enabled. UI will hide alerts.");
        else devLog("🔊 Silent mode disabled. Standard alerts active.");
        alert(state.silentMode ? 'Silent Mode ON. Screen will look normal but SOS triggers in background.' : 'Silent Mode OFF.');
    });

    // Simulation Buttons
    document.getElementById('sim-safe').addEventListener('click', () => simulateScenrio("User is walking home, listening to music. No immediate threats detected.", "low"));
    document.getElementById('sim-suspicious').addEventListener('click', () => simulateScenrio("Footsteps detected behind the user. User says 'Stop following me!'. Heart rate slightly elevated based on voice.", "medium"));
    document.getElementById('sim-danger').addEventListener('click', () => simulateScenrio("Loud screaming, sounds of struggle. User shouted 'Help! Someone call the police!'. Phone indicates sudden drop/impact.", "high"));

    // Init Map
    initMap();
});

// ==========================================
// MAP & GEOLOCATION
// ==========================================
let map, userMarker, safeZoneMarkers = [];

function initMap() {
    devLog("Initializing map...");
    map = L.map('map', { zoomControl: false }).setView([28.6139, 77.2090], 13); // Default New Delhi, India

    // Modern dark theme map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Get real location if possible
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const overlay = document.getElementById('location-overlay');
                if(overlay) overlay.style.display = 'none';
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                updateUserLocation(lat, lng);
            },
            (err) => {
                devLog("Geo error: " + err.message + " - Location rejected");
                const overlay = document.getElementById('location-overlay');
                if(overlay) {
                    overlay.innerHTML = `<div class="overlay-content"><h2>❌ Location Denied</h2><p>SheShield cannot function without location access. Please enable location permissions in your browser settings and refresh.</p></div>`;
                }
            }
        );
    } else {
        const overlay = document.getElementById('location-overlay');
        if(overlay) {
            overlay.innerHTML = `<div class="overlay-content"><h2>❌ No Geolocation</h2><p>Your browser does not support geolocation. SheShield cannot function.</p></div>`;
        }
    }
}

function updateUserLocation(lat, lng) {
    state.userLocation = {lat, lng};
    map.flyTo([lat, lng], 15);
    
    // Custom marker
    const userIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style='background-color:#2979ff; width:15px; height:15px; border-radius:50%; box-shadow: 0 0 10px #2979ff; border: 2px solid white;'></div>`,
        iconSize: [15, 15],
        iconAnchor: [7, 7]
    });

    if(!userMarker) {
        userMarker = L.marker([lat, lng], {icon: userIcon}).addTo(map);
    } else {
        userMarker.setLatLng([lat, lng]);
    }
    
    document.getElementById('alert-location-text').innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
    // Add fake safe zones around
    generateSafeZones(lat, lng);
}

function generateSafeZones(lat, lng) {
    // Clear old
    safeZoneMarkers.forEach(m => map.removeLayer(m));
    safeZoneMarkers = [];

    const safeIcon = L.divIcon({
        className: 'safe-div-icon',
        html: `<div style='font-size: 20px;'>🏥</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const policeIcon = L.divIcon({
        className: 'safe-div-icon',
        html: `<div style='font-size: 20px;'>🚓</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    // Create a few random offsets
    const points = [
        { lat: lat + 0.005, lng: lng + 0.005, title: 'Central Hospital', icon: safeIcon },
        { lat: lat - 0.003, lng: lng - 0.007, title: 'Police Precinct 42', icon: policeIcon },
        { lat: lat - 0.008, lng: lng + 0.002, title: '24/7 Pharmacy', icon: safeIcon }
    ];

    points.forEach(p => {
        let m = L.marker([p.lat, p.lng], {icon: p.icon}).addTo(map);
        m.bindPopup(p.title);
        safeZoneMarkers.push(m);
    });
}

// ==========================================
// CORE AI DETECTION (GEMINI API)
// ==========================================

async function analyzeContextWithGemini(contextString) {
    if (!state.apiKey) {
        devLog("⚠️ API Key missing. Skipping real Gemini API call.");
        // Mock fallback if no API key
        return new Promise(resolve => {
            setTimeout(() => {
                let risk = "Low";
                let action = "Continue monitoring";
                if(contextString.includes("following")) { risk = "Medium"; action = "Stay alert, head to safe zone"; }
                if(contextString.includes("Help") || contextString.includes("danger")) { risk = "High"; action = "Triggering SOS immediately"; }
                resolve({
                    risk_level: risk,
                    confidence: 0.9,
                    suggested_action: action,
                    summary: "Mock analysis: " + risk + " risk detected."
                });
            }, 1000);
        });
    }

    devLog("🧠 Sending inference to Gemini API...");
    
    // Construct Prompt
    const prompt = `
    You are the core AI of "SheShield", a personal safety app used by women.
    Analyze the following messy context input (which could be a mix of voice transcripts, ambient sounds, and motion data).
    Classify the distress risk level into EXACTLY ONE of: "Low", "Medium", "High".
    Return the result strictly as a JSON object with the following keys:
    - "risk_level" (string: "Low", "Medium", "High")
    - "confidence" (number between 0 and 1)
    - "suggested_action" (string, short actionable advice)
    - "summary" (string, a 1-sentence explanation of why)

    Context Input: "${contextString}"
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text;
        devLog("Gemini Raw JSON: " + textResponse);
        return JSON.parse(textResponse);

    } catch (e) {
        devLog("❌ AI Call Failed: " + e.message);
        return { risk_level: "Medium", confidence: 0, suggested_action: "API Failed - Relying on manual triggers", summary: "Error" };
    }
}


// ==========================================
// ACTION TRIGGERS
// ==========================================

async function simulateScenrio(context, expectedFallback) {
    devLog(`--- Simulating Scenario: ${expectedFallback.toUpperCase()} ---`);
    const result = await analyzeContextWithGemini(context);
    devLog(`AI Output: Risk=${result.risk_level}, Conf=${result.confidence}`);
    
    handleAIReaction(result);
}

function handleAIReaction(analysis) {
    const risk = analysis.risk_level.toLowerCase();
    
    // UI Update Strategy
    if (risk === 'high') {
        activateSOS(analysis.summary);
    } else if (risk === 'medium') {
        devLog("⚠️ Medium risk. Suggesting safe zones...");
        // Expand map
        document.getElementById('map-section').classList.add('expanded');
        map.invalidateSize();
    } else {
        devLog("✅ Safe. Continuing to monitor.");
        deactivateSOS();
    }
}

function triggerManualSOS() {
    devLog("🚨 User tapped Manual SOS!");
    activateSOS("User manually triggered emergency sequence.");
}

function activateSOS(reason) {
    if(state.isDangerous) return; // Already active
    state.isDangerous = true;
    
    devLog("🔴 ACTIVATING EMERGENCY PROTOCOL");

    if(!state.silentMode) {
        // UI Visuals
        const btn = document.getElementById('sos-btn');
        btn.classList.add('recording');
        
        document.querySelector('.status-dot').className = 'status-dot red';
        document.getElementById('status-text').innerText = 'DANGER: SOS DISPATCHED';
        document.getElementById('status-text').style.color = 'var(--accent-red)';
        
        document.getElementById('alert-summary').classList.remove('hidden');
        document.getElementById('alert-status-text').innerText = reason;
        
        // Expand Map
        document.getElementById('map-section').classList.add('expanded');
        setTimeout(()=>map.invalidateSize(), 300);
        
        // Visualizer
        document.getElementById('audio-visualizer').classList.remove('hidden');
    } else {
        devLog("🤫 Silent SOS dispatched (No UI changes)");
    }
}

function deactivateSOS() {
    state.isDangerous = false;
    const btn = document.getElementById('sos-btn');
    btn.classList.remove('recording');
    document.querySelector('.status-dot').className = 'status-dot green';
    document.getElementById('status-text').innerText = 'Monitoring Active';
    document.getElementById('status-text').style.color = '';
    
    document.getElementById('alert-summary').classList.add('hidden');
    document.getElementById('map-section').classList.remove('expanded');
    setTimeout(()=>map.invalidateSize(), 300);
    document.getElementById('audio-visualizer').classList.add('hidden');
}
