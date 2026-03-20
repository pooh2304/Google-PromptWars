// SheShield - Core Logic

let state = {
    apiKey: 'AIzaSyCuLN2yfY_TG278tNisMzxQ-epBSNLUQKk',
    riskLevel: 'low', // 'low', 'medium', 'high'
    userLocation: null,
    stealthMode: false,
    logoTaps: 0,
    logoTapTimeout: null
};

const APP_LOGS = [];
function devLog(msg) {
    console.log(msg);
    const logsEl = document.getElementById('demo-logs');
    APP_LOGS.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (APP_LOGS.length > 20) APP_LOGS.shift();
    if(logsEl && logsEl.parentElement.style.display !== 'none') {
        logsEl.innerHTML = '';
        APP_LOGS.forEach(log => {
            const p = document.createElement('div');
            p.textContent = log;
            logsEl.appendChild(p);
        });
        logsEl.scrollTop = logsEl.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initMap();
    initDevMode();
});

function initUI() {
    // Bottom Navigation Logic
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');

            if(targetId === 'tab-map' && map) {
                google.maps.event.trigger(map, "resize");
                if (state.userLocation) map.panTo(state.userLocation);
            }
        });
    });

    // Bottom Sheet Logic
    const stayProtectedBtn = document.getElementById('stay-protected-btn');
    const bottomSheet = document.getElementById('bottom-sheet');
    const bottomSheetBackdrop = document.getElementById('bottom-sheet-backdrop');

    function openSheet() {
        bottomSheet.classList.add('visible');
        bottomSheetBackdrop.classList.add('visible');
    }
    function closeSheet() {
        bottomSheet.classList.remove('visible');
        bottomSheetBackdrop.classList.remove('visible');
    }

    stayProtectedBtn.addEventListener('click', openSheet);
    bottomSheetBackdrop.addEventListener('click', closeSheet);
    
    // Bottom Sheet Actions
    document.getElementById('sheet-sos').addEventListener('click', () => {
        closeSheet();
        activateSOS("User manually triggered emergency sequence via action menu.");
    });
    document.getElementById('sheet-share').addEventListener('click', () => {
        closeSheet();
        alert("Live location sharing link generated and sent to Emergency Contacts.");
    });
    document.getElementById('sheet-check').addEventListener('click', () => {
        closeSheet();
        alert("Recording 10s audio and taking wide-angle photo to check surroundings...");
    });

    // Stealth Mode Toggle
    const stealthToggle = document.getElementById('stealth-mode-toggle');
    stealthToggle.addEventListener('change', (e) => {
        state.stealthMode = e.target.checked;
        if(state.stealthMode) {
            document.body.classList.add('stealth-mode');
            devLog("🌙 Stealth mode enabled.");
        } else {
            document.body.classList.remove('stealth-mode');
            devLog("☀️ Stealth mode disabled.");
        }
    });

    // Test Alert
    document.getElementById('test-alert-btn').addEventListener('click', () => {
        simulateScenario("Test scenario: Suspicious activity.", "medium");
        // switch to activity tab
        document.querySelector('[data-tab="tab-activity"]').click();
    });

    // Orb Long Press Logic
    const orb = document.getElementById('safety-orb');
    let pressTimer;
    
    const startPress = () => {
        if(state.riskLevel === 'high') return;
        orb.classList.add('progressing');
        if(navigator.vibrate) navigator.vibrate(50); // Haptic
        pressTimer = setTimeout(() => {
            if(navigator.vibrate) navigator.vibrate([100, 50, 100]); // Strong haptic
            activateSOS("SOS triggered via 2-second orb hold.");
            orb.classList.remove('progressing');
        }, 2000);
    };
    
    const cancelPress = () => {
        orb.classList.remove('progressing');
        clearTimeout(pressTimer);
    };

    orb.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(); });
    orb.addEventListener('touchend', cancelPress);
    orb.addEventListener('mousedown', startPress);
    orb.addEventListener('mouseup', cancelPress);
    orb.addEventListener('mouseleave', cancelPress);
}

function initDevMode() {
    // 5-tap logic
    const logoTrigger = document.getElementById('logo-trigger');
    logoTrigger.addEventListener('click', () => {
        state.logoTaps++;
        clearTimeout(state.logoTapTimeout);
        
        if (state.logoTaps >= 5) {
            document.getElementById('demo-panel').classList.toggle('show');
            state.logoTaps = 0;
            if(navigator.vibrate) navigator.vibrate(100);
        } else {
            state.logoTapTimeout = setTimeout(() => {
                state.logoTaps = 0;
            }, 1000);
        }
    });

    // Dev Panel Internal Toggles
    const toggle = document.getElementById('demo-toggle');
    const content = document.getElementById('demo-content');
    toggle.addEventListener('click', () => {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        toggle.querySelector('span').innerText = isHidden ? '▼' : '▲';
        if(!isHidden) devLog("Panel opened");
    });

    const apiKeyInput = document.getElementById('gemini-api-key');
    apiKeyInput.addEventListener('input', (e) => state.apiKey = e.target.value.trim());

    document.getElementById('sim-safe').addEventListener('click', () => handleAIReaction({ risk_level: "low", summary: "Safe" }));
    document.getElementById('sim-suspicious').addEventListener('click', () => handleAIReaction({ risk_level: "medium", summary: "Following detected" }));
    document.getElementById('sim-danger').addEventListener('click', () => handleAIReaction({ risk_level: "high", summary: "Help screamed" }));
}

// Map Logic
let map, userMarker, safeZoneMarkers = [];

function initMap() {
    const mapElement = document.getElementById('map');
    
    if (typeof google === 'object' && typeof google.maps === 'object') {
        map = new google.maps.Map(mapElement, {
            center: { lat: 28.6139, lng: 77.2090 },
            zoom: 14,
            disableDefaultUI: true,
            styles: [
                { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
                { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
                { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
                { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
                { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
                { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
                { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
                { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] }
            ]
        });
    }

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const overlay = document.getElementById('location-overlay');
                if(overlay) overlay.style.display = 'none';
                updateUserLocation(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
                const overlay = document.getElementById('location-overlay');
                if(overlay) {
                    overlay.innerHTML = "<div class='overlay-content'><h2>Location Required</h2><p>Please enable location services to use SheShield.</p></div>";
                }
            }
        );
    }
}

function updateUserLocation(lat, lng) {
    state.userLocation = {lat, lng};
    const currentLoc = { lat, lng };
    
    if (map && typeof google === 'object') {
        map.panTo(currentLoc);
        
        if(!userMarker) {
            userMarker = new google.maps.Marker({
                position: currentLoc,
                map: map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: "#A3B18A",
                    fillOpacity: 1,
                    strokeColor: "white",
                    strokeWeight: 2
                }
            });
        } else {
            userMarker.setPosition(currentLoc);
        }

        // Mock safe zones based on location
        populateSafeZones([
            { name: "City General Hospital", km: "0.4 km", icon: "🏥" },
            { name: "Central Police Station", km: "0.8 km", icon: "🚓" },
            { name: "Starbucks 24/7", km: "1.2 km", icon: "☕" }
        ]);
        
        document.getElementById('alert-location-text').innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
}

function populateSafeZones(zones) {
    const container = document.getElementById('safe-zones-list');
    container.innerHTML = '';
    zones.forEach(z => {
        const card = document.createElement('div');
        card.className = 'safe-zone-card';
        card.innerHTML = `
            <div style="display:flex; align-items:center; gap: 12px;">
                <div class="safe-zone-icon">${z.icon}</div>
                <div class="safe-zone-info">
                    <h4>${z.name}</h4>
                    <p>${z.km} away</p>
                </div>
            </div>
            <button class="safe-zone-btn">Navigate Safely</button>
        `;
        container.appendChild(card);
    });
}

// AI and State Transitions
async function simulateScenario(context, riskLevel) {
    devLog(`[Telemetry] Initializing Real-World Inputs...`);
    
    // Explicit Mocking of the Problem Statement requirements
    const motionData = "Accelerometer: Running, Gyroscope: Erratic";
    const ambientSound = "Decibels: 95dB (Shouting detected)";
    const voiceInput = "Transcribing voice: 'Leave me alone'";
    const locationData = "GPS: Anomalous deviation from route";

    devLog(`[Sensors] Captured Motion: ${motionData}`);
    devLog(`[Sensors] Recorded Ambient Sound: ${ambientSound}`);
    devLog(`[Sensors] Processed Voice Input: ${voiceInput}`);
    
    const enrichedContext = `${context}. Inputs: [${motionData}, ${ambientSound}, ${voiceInput}, ${locationData}]`;

    devLog(`Sending enriched sensor data array to AI: ${enrichedContext}. Expected: ${riskLevel}`);
    
    // Instead of directly handling, send to backend 
    async function analyzeContextWithGemini(contextString) {
    devLog("🧠 Sending contextual sensor evidence to secure distress detection backend...");
    // In a real application, this would be an API call to a backend service
    // For this demo, we'll simulate a response based on the expected riskLevel
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
    return { risk_level: riskLevel, summary: `AI analyzed: ${contextString.substring(0, 50)}...` };
}
    const backendResult = await analyzeContextWithGemini(enrichedContext);
    handleAIReaction(backendResult);
}

function handleAIReaction(analysis) {
    const risk = analysis.risk_level.toLowerCase();
    
    if (risk === 'high') {
        activateSOS(analysis.summary);
    } else if (risk === 'medium') {
        activateAmber(analysis.summary);
    } else {
        deactivateAlerts();
    }
}

function updateStatusText(primary, sub, colorClass) {
    document.getElementById('status-primary').innerText = primary;
    document.getElementById('status-subtext').innerText = sub;
    const dot = document.getElementById('header-status-dot');
    dot.className = `status-dot ${colorClass}`;
    
    if(colorClass === 'green') document.getElementById('status-primary').style.color = 'var(--text-main)';
    if(colorClass === 'amber') document.getElementById('status-primary').style.color = 'var(--alert-amber)';
    if(colorClass === 'red') document.getElementById('status-primary').style.color = 'var(--alert-red)';

    if (state.stealthMode) {
        document.getElementById('status-primary').style.color = 'var(--text-main)';
    }
}

function updateActivityLog(show, title, message, isDanger) {
    const emptyState = document.getElementById('activity-empty-state');
    const alertCard = document.getElementById('alert-summary');
    const visualizer = document.getElementById('audio-visualizer');

    if(show) {
        emptyState.classList.add('hidden');
        alertCard.classList.remove('hidden');
        visualizer.classList.remove('hidden');
        
        document.getElementById('alert-status-text').innerText = message;
        
        if (isDanger && !state.stealthMode) {
            alertCard.classList.add('danger');
            visualizer.classList.add('danger');
        } else {
            alertCard.classList.remove('danger');
            visualizer.classList.remove('danger');
        }
    } else {
        emptyState.classList.remove('hidden');
        alertCard.classList.add('hidden');
        visualizer.classList.add('hidden');
    }
}

function activateAmber(reason) {
    if(state.riskLevel === 'high') return; // Don't downgrade high risk
    state.riskLevel = 'medium';
    devLog("🟡 AMBER ALERT: " + reason);
    
    const orb = document.getElementById('safety-orb');
    orb.className = 'safety-orb state-amber';
    
    if (!state.stealthMode) {
        updateStatusText("Something feels unusual", "Stay aware of surroundings", "amber");
    }
    
    updateActivityLog(true, "Safety Update", reason, false);
}

function activateSOS(reason) {
    state.riskLevel = 'high';
    devLog("🔴 RED ALERT: " + reason);
    
    const orb = document.getElementById('safety-orb');
    orb.className = 'safety-orb state-red';
    
    if (!state.stealthMode) {
        updateStatusText("Danger detected", "Help is on the way", "red");
    } else {
       devLog("🌙 Active SOS in Stealth Mode. Sending alerts silently."); 
    }
    
    updateActivityLog(true, "Emergency SOS", "We detected possible danger. Notified Emergency Contacts.", true);
}

function deactivateAlerts() {
    state.riskLevel = 'low';
    devLog("🟢 SAFE");
    
    const orb = document.getElementById('safety-orb');
    orb.className = 'safety-orb'; // removes state classes
    
    updateStatusText("Monitoring quietly", "You're safe", "green");
    updateActivityLog(false);
}
