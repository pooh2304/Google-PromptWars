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
        // Use textContent to prevent XSS warnings instead of innerHTML
        logsEl.innerHTML = '';
        ETHER_LOGS.forEach(log => {
            const p = document.createElement('div');
            p.textContent = log;
            logsEl.appendChild(p);
        });
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
    document.getElementById('sim-safe').addEventListener('click', () => simulateScenario("User is walking home, listening to music. No immediate threats detected.", "low"));
    document.getElementById('sim-suspicious').addEventListener('click', () => simulateScenario("Footsteps detected behind the user. User says 'Stop following me!'. Heart rate slightly elevated based on voice.", "medium"));
    document.getElementById('sim-danger').addEventListener('click', () => simulateScenario("Loud screaming, sounds of struggle. User shouted 'Help! Someone call the police!'. Phone indicates sudden drop/impact.", "high"));

    // Init Map
    initMap();
});

// ==========================================
// MAP & GEOLOCATION
// ==========================================
let map, userMarker, safeZoneMarkers = [];

function initMap() {
    devLog("Initializing map...");
    const mapElement = document.getElementById('map');
    
    // Default to New Delhi if not located yet, initialize Google Map
    if (typeof google === 'object' && typeof google.maps === 'object') {
        map = new google.maps.Map(mapElement, {
            center: { lat: 28.6139, lng: 77.2090 },
            zoom: 13,
            disableDefaultUI: true,
            styles: [
                { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] }
            ]
        });
    } else {
        devLog("⚠️ Google Maps API not loaded. Check network or API key.");
    }

    // Get real location if possible
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const overlay = document.getElementById('location-overlay');
                if(overlay) overlay.style.display = 'none';
                updateUserLocation(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
                devLog("Geo error: " + err.message + " - Location rejected");
                const overlay = document.getElementById('location-overlay');
                if(overlay) {
                    overlay.textContent = "❌ Location Denied. SheShield cannot function without location access.";
                    overlay.style.backgroundColor = "white";
                    overlay.style.color = "black";
                    overlay.style.padding = "20px";
                }
            }
        );
    } else {
        const overlay = document.getElementById('location-overlay');
        if(overlay) {
            overlay.textContent = "❌ No Geolocation support.";
        }
    }
}

function updateUserLocation(lat, lng) {
    state.userLocation = {lat, lng};
    const currentLoc = { lat, lng };
    
    if (map && typeof google === 'object') {
        map.panTo(currentLoc);
        map.setZoom(15);
        
        if(!userMarker) {
            userMarker = new google.maps.Marker({
                position: currentLoc,
                map: map,
                title: "Your Location",
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: "#2979ff",
                    fillOpacity: 1,
                    strokeColor: "white",
                    strokeWeight: 2
                }
            });
        } else {
            userMarker.setPosition(currentLoc);
        }
        generateSafeZones(lat, lng);
    }
    
    document.getElementById('alert-location-text').innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function generateSafeZones(lat, lng) {
    // Clear old
    safeZoneMarkers.forEach(m => {
        if (m.setMap) m.setMap(null);
    });
    safeZoneMarkers = [];

    if (!map || typeof google !== 'object') return;

    // Create a few random offsets
    const points = [
        { lat: lat + 0.005, lng: lng + 0.005, title: 'Central Hospital: 🏥' },
        { lat: lat - 0.003, lng: lng - 0.007, title: 'Police Precinct 42: 🚓' },
        { lat: lat - 0.008, lng: lng + 0.002, title: '24/7 Pharmacy: 🏥' }
    ];

    points.forEach(p => {
        let m = new google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map: map,
            title: p.title
        });
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

async function simulateScenario(context, expectedFallback) {
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
        const mapSect = document.getElementById('map-section');
        mapSect.classList.add('expanded');
        if (map && typeof google === 'object') {
            google.maps.event.trigger(map, "resize");
        }
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
        if (map && typeof google === 'object') {
            setTimeout(() => google.maps.event.trigger(map, "resize"), 300);
        }
        
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
    if (map && typeof google === 'object') {
        setTimeout(() => google.maps.event.trigger(map, "resize"), 300);
    }
    document.getElementById('audio-visualizer').classList.add('hidden');
}
