// injected_ui.js
// V1.2: Movable Hud + Hide/Unhide Feature + 'H' Key Cycle (Syncs with GeoFS UI Logic)

(function() {
    // --- 1. Initialization Checks ---
    if (document.getElementById('g-meter-root')) return;
    if (!document.body) return;

    // --- 2. Inject CSS ---
    const style = document.createElement('style');
    style.innerHTML = `
        .g-switch { position: relative; display: inline-block; width: 24px; height: 14px; margin-right: 6px; vertical-align: middle; }
        .g-switch input { opacity: 0; width: 0; height: 0; }
        .g-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255, 255, 255, 0.2); transition: .3s; border-radius: 34px; }
        .g-slider:before { position: absolute; content: ""; height: 10px; width: 10px; left: 2px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; }
        input:checked + .g-slider { background-color: #33ffbb; }
        input:checked + .g-slider:before { transform: translateX(10px); }
        
        /* Eye Button */
        .g-eye-btn { opacity: 0.75; transition: 0.2s; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .g-eye-btn:hover { opacity: 1.0; transform: scale(1.1); }

        /* MINIMIZED STATE (Floating Icon) */
        .g-minimized {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            padding: 0 !important;
            width: auto !important;
        }
        .g-minimized #g-content-wrapper, 
        .g-minimized #g-slider-container { display: none !important; }
        .g-minimized #g-footer { margin-top: 0 !important; }
        .g-minimized .g-eye-btn { opacity: 0.9; transform: scale(1.2); text-shadow: 0 0 5px black; }

        /* --- H-KEY STATES --- */
        .g-opacity-50 { opacity: 0.5 !important; } /* Stage 1 & 2 */
        .g-hidden-ui { display: none !important; }  /* Stage 3 */
    `;
    document.head.appendChild(style);

    // --- 3. Create Blackout Overlay ---
    const blackoutLayer = document.createElement('div');
    blackoutLayer.id = 'g-loc-overlay';
    Object.assign(blackoutLayer.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '2147483640',
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.95) 100%)',
        opacity: '0', transition: 'opacity 0.15s ease-out',
        backdropFilter: 'blur(0px)', webkitBackdropFilter: 'blur(0px)', willChange: 'opacity, backdrop-filter'
    });
    document.body.appendChild(blackoutLayer);

    // --- 3b. Create G-LOC banner (shown when pilot blacks out) ---
    const locBanner = document.createElement('div');
    locBanner.id = 'g-loc-banner';
    locBanner.innerText = 'G-LOC';
    Object.assign(locBanner.style, {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        pointerEvents: 'none', zIndex: '2147483641', opacity: '0',
        color: '#ff2b2b', fontFamily: '"Courier New", Consolas, monospace', fontWeight: 'bold',
        fontSize: '42px', letterSpacing: '8px', textShadow: '0 0 20px rgba(255,0,0,0.8)',
        transition: 'opacity 0.3s ease-out'
    });
    document.body.appendChild(locBanner);

    // --- 4. Create HUD Container ---
    const container = document.createElement('div');
    container.id = 'g-meter-root';
    
    // Load saved position
    const savedTop = localStorage.getItem('g-meter-top') || '10px';
    const savedLeft = localStorage.getItem('g-meter-left') || '10px';

    Object.assign(container.style, {
        position: 'fixed', top: savedTop, left: savedLeft, 
        width: '160px', padding: '8px 10px',
        backgroundColor: 'rgba(10, 20, 40, 0.25)', 
        backdropFilter: 'blur(8px)', webkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(100, 200, 255, 0.2)', 
        boxShadow: '0 0 10px rgba(100, 200, 255, 0.05)',
        color: '#e0f0ff', fontFamily: '"Courier New", Consolas, monospace', borderRadius: '6px',
        zIndex: '2147483647', pointerEvents: 'auto',
        cursor: 'grab', userSelect: 'none',
        transition: 'opacity 0.2s, background 0.2s' 
    });

    const eyeOpenSVG = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#ffffff" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const eyeClosedSVG = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="#ffffff" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path></svg>`;

    container.innerHTML = `
        <div id="g-content-wrapper">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                <span style="font-weight:bold; color:#8ab; font-size:11px; letter-spacing:1px;">G-LOAD</span>
                <span id="g-current" style="font-weight:bold; font-size:18px; text-shadow: 0 0 5px currentColor;">1.0</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:9px; color:#8ab; margin-bottom:5px;">
                <span>MIN: <span id="g-min" style="color:#fff">1.0</span></span>
                <span>MAX: <span id="g-max" style="color:#fff">1.0</span></span>
            </div>
            <canvas id="g-graph" width="140" height="30" style="background:rgba(0, 0, 0, 0.1); border-radius:3px; border:1px solid rgba(100, 200, 255, 0.1);"></canvas>
        </div>

        <div id="g-footer" style="margin-top:5px; display:flex; justify-content:space-between; align-items:center;">
            <div id="g-hide-btn" class="g-eye-btn">
                ${eyeOpenSVG}
            </div>
            
            <div id="g-slider-container" style="display:flex; align-items:center;">
                <label class="g-switch">
                    <input type="checkbox" id="g-loc-toggle" checked>
                    <span class="g-slider"></span>
                </label>
                <span style="font-size:9px; color:#aaa;">Blackout</span>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // --- 5. LOGIC: Minimize ---
    const hideBtn = document.getElementById('g-hide-btn');
    let isMinimized = false;

    function toggleMinimize(forceOpen = false) {
        if (forceOpen) isMinimized = false;
        else isMinimized = !isMinimized;

        if (isMinimized) {
            container.classList.add('g-minimized');
            hideBtn.innerHTML = eyeClosedSVG;
        } else {
            container.classList.remove('g-minimized');
            hideBtn.innerHTML = eyeOpenSVG;
        }
    }

    hideBtn.addEventListener('click', () => {
        if (hasMoved) return; 
        toggleMinimize();
    });

    // --- 6. DRAG & DROP ---
    let isDragging = false;
    let hasMoved = false; 
    let startX, startY, initialLeft, initialTop;

    container.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = container.offsetLeft;
        initialTop = container.offsetTop;
        container.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
        container.style.top = initialTop + dy + 'px';
        container.style.left = initialLeft + dx + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            container.style.cursor = 'grab';
            localStorage.setItem('g-meter-top', container.style.top);
            localStorage.setItem('g-meter-left', container.style.left);
        }
    });

    // *** 7. 4-STAGE H-KEY LOGIC ***
    let hPressCount = 0; // 0=Visible, 1=50%, 2=50%, 3=Hidden

    window.addEventListener('keydown', (e) => {
        if (e.key === 'h' || e.key === 'H') {
            hPressCount++;
            
            // Cycle: 0 -> 1 -> 2 -> 3 -> 0
            if (hPressCount > 3) hPressCount = 0;

            // Apply State
            if (hPressCount === 0) {
                // RESET: Fully Visible + Rescue Position
                container.classList.remove('g-opacity-50', 'g-hidden-ui');
                container.style.top = '10px';
                container.style.left = '10px';
                localStorage.setItem('g-meter-top', '10px');
                localStorage.setItem('g-meter-left', '10px');
                toggleMinimize(true); // Ensure open
            } 
            else if (hPressCount === 1) {
                // Stage 1: 50% Opacity
                container.classList.add('g-opacity-50');
                container.classList.remove('g-hidden-ui');
            }
            else if (hPressCount === 2) {
                // Stage 2: Still 50% (Wait for 3rd press to hide)
                container.classList.add('g-opacity-50');
                container.classList.remove('g-hidden-ui');
            }
            else if (hPressCount === 3) {
                // Stage 3: Fully Hidden
                container.classList.remove('g-opacity-50');
                container.classList.add('g-hidden-ui');
            }
        }
    });

    // --- 8. GAME LOOP ---
    let maxRecord = 1.0;
    let minRecord = 1.0;
    const history = new Array(80).fill(1.0); 
    const canvas = document.getElementById('g-graph');
    const ctx = canvas.getContext('2d');
    const blackoutToggle = document.getElementById('g-loc-toggle');

    if (blackoutToggle) {
        blackoutToggle.addEventListener('change', function() {
            maxRecord = 1.0; minRecord = 1.0;
            gStress = 0; isLockedOut = false;
        });
    }

    // --- 8b. G-LOC PHYSIOLOGY MODEL ---
    // gStress accumulates while G is out of the safe envelope (faster the more
    // intense it is) and recovers when G returns to normal. This punishes BOTH
    // brief extreme spikes AND prolonged moderate-high loading.
    const G_POS_SAFE = 4.5;   // start straining above this many +G
    const G_NEG_SAFE = -1.5;  // start straining below this many -G (redout)
    const G_POS_FULL = 8.0;   // overload saturates here (instant-ish blackout)
    const G_NEG_FULL = -4.0;  // overload saturates here (instant-ish redout)
    const STRESS_RATE   = 0.9;   // how fast stress builds at full overload (per sec)
    const RECOVERY_RATE = 0.45;  // how fast it drains when safe (per sec)
    const LOCK_ON  = 0.98;   // pass out at/above this
    const LOCK_OFF = 0.45;   // regain control once recovered below this (hysteresis)

    let gStress = 0;
    let isLockedOut = false;
    let stressIsRed = false; // tracks whether current strain is from -G (redout)
    let lastFrameTime = performance.now();

    // --- 8c. CONTROL LOCK ---
    // While blacked out the pilot can't act. We swallow keydowns in the capture
    // phase so GeoFS never sees new control inputs. keyup is deliberately left
    // alone so any key held at blackout still releases/re-centers on the way out,
    // which lets G fall and recovery actually happen (no permanent soft-lock).
    function swallowInput(e) {
        if (!isLockedOut) return;
        e.stopImmediatePropagation();
        e.preventDefault();
    }
    window.addEventListener('keydown', swallowInput, true);
    window.addEventListener('keypress', swallowInput, true);
    // Block mouse-yoke / click controls on the sim canvas too.
    window.addEventListener('mousedown', swallowInput, true);
    window.addEventListener('wheel', swallowInput, { capture: true, passive: false });

    function gameLoop() {
        if (typeof geofs === 'undefined' || !geofs.animation || !geofs.animation.values) {
            // Force hide if game not loaded, BUT allow H-key logic to control it otherwise
            // (We handle display logic mostly via CSS classes now)
            if (hPressCount !== 3) container.style.display = 'none'; 
            requestAnimationFrame(gameLoop);
            return;
        }

        // Logic to ensure 'display:none' from gameLoop doesn't override our H-key 'visible' states
        // But DOES override if game is missing.
        if (hPressCount !== 3) {
            container.style.display = 'block';
        }

        let currentG = 1.0;
        const simValues = geofs.animation.values;
        if (simValues.loadFactor !== undefined) currentG = simValues.loadFactor;
        else if (simValues.accZ !== undefined) currentG = simValues.accZ / 9.81;
        currentG = parseFloat(currentG);

        // --- Time step (clamped so tab-switch pauses don't dump huge stress) ---
        const now = performance.now();
        let dt = (now - lastFrameTime) / 1000;
        lastFrameTime = now;
        if (dt > 0.1) dt = 0.1;

        // --- Update G-stress accumulator ---
        // overload is 0 inside the safe envelope, ramps to 1 at the "full" limit,
        // and keeps growing past it so extreme spikes build stress very fast.
        let overload = 0;
        if (currentG > G_POS_SAFE) {
            overload = (currentG - G_POS_SAFE) / (G_POS_FULL - G_POS_SAFE);
            stressIsRed = false;
        } else if (currentG < G_NEG_SAFE) {
            overload = (G_NEG_SAFE - currentG) / (G_NEG_SAFE - G_NEG_FULL);
            stressIsRed = true;
        }

        if (overload > 0) {
            gStress += overload * STRESS_RATE * dt;
        } else {
            gStress -= RECOVERY_RATE * dt;
        }
        if (gStress < 0) gStress = 0;
        if (gStress > 1) gStress = 1;

        // Hysteresis: black out at LOCK_ON, only wake up once recovered to LOCK_OFF.
        if (gStress >= LOCK_ON) isLockedOut = true;
        else if (gStress <= LOCK_OFF) isLockedOut = false;

        // --- Render the visual penalty ---
        if (blackoutToggle && blackoutToggle.checked && gStress > 0.01) {
            // When fully passed out, force a total blackout regardless of the curve.
            const intensity = isLockedOut ? 1.0 : gStress;
            blackoutLayer.style.opacity = intensity;

            // Tunnel vision closes in + the whole view blurs harder as stress rises.
            const visionRadius = 85 - (75 * intensity);
            const blurPx = (12 * intensity).toFixed(1);
            const tint = stressIsRed ? 'rgba(140,0,0,0.85)' : 'rgba(0,0,0,0.97)';
            blackoutLayer.style.background =
                `radial-gradient(ellipse at center, transparent ${visionRadius}%, ${tint} 100%)`;
            blackoutLayer.style.backdropFilter = `blur(${blurPx}px)`;
            blackoutLayer.style.webkitBackdropFilter = `blur(${blurPx}px)`;

            locBanner.style.opacity = isLockedOut ? '1' : '0';
            locBanner.style.color = stressIsRed ? '#ff7b4b' : '#ff2b2b';
            locBanner.innerText = stressIsRed ? 'RED-OUT' : 'G-LOC';
        } else {
            blackoutLayer.style.opacity = '0';
            blackoutLayer.style.backdropFilter = 'blur(0px)';
            blackoutLayer.style.webkitBackdropFilter = 'blur(0px)';
            locBanner.style.opacity = '0';
            if (!(blackoutToggle && blackoutToggle.checked)) isLockedOut = false;
        }

        // Stats
        if (currentG > maxRecord) maxRecord = currentG;
        if (currentG < minRecord) minRecord = currentG;

        const gText = document.getElementById('g-current');
        gText.innerText = currentG.toFixed(1);
        document.getElementById('g-min').innerText = minRecord.toFixed(1);
        document.getElementById('g-max').innerText = maxRecord.toFixed(1);

        if (currentG > 5.0 || currentG < -2.0) {
            gText.style.color = '#ff3333'; container.style.borderColor = 'rgba(255, 50, 50, 0.4)';
        } else {
            gText.style.color = '#33ffbb'; container.style.borderColor = 'rgba(100, 200, 255, 0.2)';
        }

        // Graph
        history.push(currentG);
        history.shift(); 
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const baseLineY = canvas.height - 10; 
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.1)'; 
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, baseLineY); ctx.lineTo(canvas.width, baseLineY); ctx.stroke();
        
        ctx.shadowBlur = 6;
        const barWidth = canvas.width / history.length;
        for (let i = 0; i < history.length; i++) {
            const val = history[i];
            const height = (val - 1) * 10; 
            if (val > 5.0 || val < -2.0) { ctx.fillStyle = '#ff3333'; ctx.shadowColor = '#ff0000'; }
            else { ctx.fillStyle = '#33ffbb'; ctx.shadowColor = '#33ffbb'; }
            ctx.fillRect(i * barWidth, baseLineY, barWidth - 0.5, -height);
        }
        ctx.shadowBlur = 0;
        requestAnimationFrame(gameLoop);
    }
    gameLoop();
})();