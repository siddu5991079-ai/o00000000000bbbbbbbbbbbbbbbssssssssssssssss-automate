const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const { OBSWebSocket } = require('obs-websocket-js'); 

const obs = new OBSWebSocket(); 

// 🚀 Multi-Stream Key Manager
const STREAM_KEYS = {
    '1'   : '15254238731883_15281627925099_najspfkgne', 
    '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
    '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
    '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
    '2.1' : '15254308986475_15281761618539_3xca7oij3u',
    '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

    '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
    '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
    '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

    '4'   : '15255022345835_15283095800427_vwrupxzstm', 
    '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
    '4.2' : '15255045480043_15283135842923_tldl4bhmii',
    '4.3' : '15255208599147_15283449629291_abltofuc7m', 
    '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
    '4.5' : '15255227670123_15283486263915_jpntt54mve',

    '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
    '5.1' : '15273713933931_15317494860395_avj47smmim', 
    '5.2' : '15273722257003_15317510195819_6edjluvdqi',
    '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
    '5.4' : '15273750175339_15317561707115_csel26ku5a', 
    '5.5' : '15273760071275_15317579467371_cnewcj54me',
    '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
    '5.7' : '15273778683499_15317616560747_4piekvs4wu',

    's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
    's1.2'  : '14204288179759_14846247373359_tnsknmapva',
    's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
    's1.4'  : '14204331957807_14846326147631_dji2acqcze',
    's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
    's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
    's1.7'  : '14204370492975_14846393649711_6fduhdqite',
    's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
    's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
    's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

    's2.1'  : '14204490948143_14846603495983_kzevn36tii',
    's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
    's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
    's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
    's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
    's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
    's2.7'  : '14204577259055_14846756194863_3ecad2535u',
    's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
    's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
    's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
};

// URL logic
let rawUrl = (process.env.TARGET_URL || '').trim();
let TARGET_URL = rawUrl !== '' ? rawUrl : 'https://dadocric.st/player.php?id=starsp3&v=m';
if (TARGET_URL && !TARGET_URL.startsWith('http')) TARGET_URL = 'https://' + TARGET_URL;

const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];

let browser = null;
let obsProcess = null;
let activePage = null;
let backupPage = null;

let activeContext = null;
let backupContext = null;

const FROZEN_THRESHOLD_MS = 5000; 

if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
let pendingScreenshots = [];
let uploadCycleCount = 0;

async function takeAndBatchScreenshot(page, stepName) {
    if (!page) return;
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = `./screenshots/snap_${timestamp}_${stepName}.png`;
        await page.screenshot({ path: filePath });
        console.log(`[📸] Screenshot saved: ${filePath}`);
        pendingScreenshots.push(filePath);

        if (pendingScreenshots.length >= 3) {
            console.log(`[🚀] 3 Screenshots collected. Triggering LIVE batch upload...`);
            try {
                const tag = 'live-stream-logs';
                try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Logs"`, { stdio: 'ignore' }); } catch(e) {}
                try {
                    const oldAssets = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim().split('\n');
                    for (const asset of oldAssets) if (asset) execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
                } catch(e) {}

                const fileList = pendingScreenshots.join(' ');
                execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
                uploadCycleCount++;
                console.log(`[+] Live batch upload successful!`);
                pendingScreenshots = []; 
            } catch (err) { }
        }
    } catch (e) { }
}

async function applyInstantBlackout(page) {
    await page.evaluateOnNewDocument(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            html, body { background-color: black !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
            iframe { 
                position: fixed !important; top: 0 !important; left: 0 !important; 
                width: 100vw !important; height: 100vh !important; 
                z-index: 999999 !important; border: none !important; background-color: black !important;
            }
        `;
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    }).catch(()=>{});
}

// =========================================================================
// 🛠️ SETUP OBS CONFIGURATION
// =========================================================================
function setupOBSConfig() {
    console.log('[*] Generating OBS Config files with WebSocket & Scenes...');
    const obsDir = path.join(os.homedir(), '.config', 'obs-studio');
    const profilesDir = path.join(obsDir, 'basic', 'profiles', 'Untitled');
    const scenesDir = path.join(obsDir, 'basic', 'scenes');

    fs.mkdirSync(profilesDir, { recursive: true });
    fs.mkdirSync(scenesDir, { recursive: true });

    const globalIniContent = `[General]\nLicenseAccepted=true\n[BasicWindow]\nShowAutoConfig=false\nWarned=true\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nServerPassword=secret\n`;
    fs.writeFileSync(path.join(obsDir, 'global.ini'), globalIniContent);
    fs.writeFileSync(path.join(profilesDir, 'basic.ini'), `[General]\nName=Untitled\n[Video]\nBaseCX=1280\nBaseCY=720\nOutputCX=1280\nOutputCY=720\nFPSCommon=30\n[Output]\nMode=Simple\n`);

    const serviceJson = {
        "settings": { "server": "rtmp://vsu.okcdn.ru/input/", "key": ACTIVE_STREAM_KEY },
        "type": "rtmp_custom"
    };
    fs.writeFileSync(path.join(profilesDir, 'service.json'), JSON.stringify(serviceJson, null, 2));

    const sceneJson = {
        "current_scene": "WaitingScene", 
        "current_program_scene": "WaitingScene", 
        "name": "Untitled",
        "scene_order": [{"name": "WaitingScene"}, {"name": "MainScene"}],
        "sources": [
            { "id": "xshm_input", "name": "Screen", "settings": { "show_cursor": false } },
            { "id": "pulse_output_capture", "name": "Audio", "settings": {} },
            {
                "id": "scene", "name": "MainScene",
                "settings": { "items": [ {"name": "Screen", "id": 1, "visible": true}, {"name": "Audio", "id": 2, "visible": true} ] }
            },
            {
                "id": "scene", "name": "WaitingScene",
                "settings": { "items": [] } 
            }
        ]
    };
    fs.writeFileSync(path.join(scenesDir, 'Untitled.json'), JSON.stringify(sceneJson, null, 2));
    console.log('[+] OBS Configurations injected successfully!');
}

// =========================================================================
// 🎬 VIDEO INITIALIZATION 
// =========================================================================
async function initializeVideo(page, startMuted, isActivePage) {
    try {
        console.log('[*] Enforcing Instant Black Background & Full Screen UI...');
        await page.evaluate(() => {
            document.documentElement.style.backgroundColor = 'black';
            document.body.style.backgroundColor = 'black';
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.overflow = 'hidden';
            
            document.querySelectorAll('iframe').forEach(iframe => {
                iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
                iframe.style.width = '100vw'; iframe.style.height = '100vh';
                iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
            });
        }).catch(() => {});

        if (SERVER_SELECTION !== 'None') {
            let serverClicked = false; let serverAttempts = 0;
            while (!serverClicked && serverAttempts < 10) { 
                serverAttempts++;
                try {
                    const clickSuccess = await page.evaluate((serverName) => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
                        if (targetBtn) { targetBtn.click(); return true; }
                        return false;
                    }, SERVER_SELECTION);

                    if (clickSuccess) {
                        serverClicked = true; await takeAndBatchScreenshot(page, `server-clicked`);
                        await new Promise(r => setTimeout(r, 2000)); 
                        if (isActivePage) await page.bringToFront(); 
                    } else await new Promise(r => setTimeout(r, 2000));
                } catch (err) { await new Promise(r => setTimeout(r, 2000)); }
            }
        }

        console.log('[*] Hunting for the Play Button...');
        let buttonClicked = false; let attempts = 0;
        
        while (!buttonClicked && attempts < 15) {
            for (const frame of page.frames()) {
                try {
                    const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"], .vjs-big-play-button, [class*="unmute"]');
                    if (playBtn) {
                        const isVisible = await frame.evaluate(el => {
                            const style = window.getComputedStyle(el);
                            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                        }, playBtn);

                        if (isVisible) {
                            await frame.evaluate(el => el.click(), playBtn); 
                            buttonClicked = true;
                            await takeAndBatchScreenshot(page, `play-btn-clicked`);
                            break; 
                        }
                    }
                } catch (err) {}
            }
            if (!buttonClicked) await new Promise(r => setTimeout(r, 2000));
            attempts++;
        }

        console.log('[*] Scanning for Video Player & Injecting Anti-Mute Sync...');
        let targetFrame = null;
        for (const frame of page.frames()) {
            try {
                const isRealLiveStream = await frame.evaluate(() => {
                    const vid = document.querySelector('video');
                    return vid && vid.clientWidth > 100 && vid.clientHeight > 100;
                });
                if (isRealLiveStream) { targetFrame = frame; break; }
            } catch (e) { }
        }

        if (!targetFrame) targetFrame = page.mainFrame();

        await targetFrame.evaluate(async (muteVideo) => {
            const style = document.createElement('style');
            style.innerHTML = `.jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { display: none !important; opacity: 0 !important; visibility: hidden !important; }`;
            document.head.appendChild(style);

            // 🛡️ ANTI-MUTE SYNC: 1. Stop JS Player from saving state
            try {
                const originalSetItem = Storage.prototype.setItem;
                Storage.prototype.setItem = function(key, value) {
                    const k = key.toLowerCase();
                    if (k.includes('mute') || k.includes('volume') || k.includes('audio')) {
                        return; // BLOCKED! Website cannot save audio state
                    }
                    originalSetItem.apply(this, arguments);
                };
            } catch(e) {}

            const video = document.querySelector('video');
            if (video) { 
                // 🛡️ ANTI-MUTE SYNC: 2. Stop player from listening to our DOM mute triggers
                video.addEventListener('volumechange', (e) => e.stopImmediatePropagation(), true);

                video.muted = muteVideo; 
                video.volume = muteVideo ? 0 : 1.0; 
                
                video.style.position = 'fixed'; 
                video.style.top = '0px'; 
                video.style.left = '0px';
                video.style.width = '100vw'; 
                video.style.height = '100vh';
                video.style.zIndex = '2147483647'; 
                video.style.backgroundColor = 'black'; 
                video.style.objectFit = 'contain';
            }
        }, startMuted).catch(() => {});

    } catch (e) { }
}

// =========================================================================
// 🔄 DUAL-TAB WATCHDOG 
// =========================================================================
async function checkPageStatus(page) {
    try {
        for (const frame of page.frames()) {
            const result = await frame.evaluate(() => {
                const bodyText = document.body.innerText.toLowerCase();
                if (bodyText.includes("stream error")) return { status: 'CRITICAL_ERROR' };
                const v = document.querySelector('video');
                if (v && !v.ended) return { status: 'HEALTHY', currentTime: v.currentTime };
                return { status: 'DEAD' };
            });
            if (result.status !== 'DEAD') return result;
        }
    } catch (e) { return { status: 'DEAD' }; }
    return { status: 'DEAD' };
}

async function startWatchdog() {
    let lastActiveTime = -1;
    let frozenCheckTimestamp = Date.now();
    let watchdogTicks = 0;

    while (true) {
        if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

        let activeStatus = await checkPageStatus(activePage);

        // 🔊 ENFORCE FULL AUDIO ON ACTIVE TAB EVERY CYCLE (Deep Frame Scan)
        try {
            for (const frame of activePage.frames()) {
                await frame.evaluate(() => {
                    const v = document.querySelector('video');
                    if (v && (v.muted || v.volume === 0)) {
                        v.addEventListener('volumechange', (e) => e.stopImmediatePropagation(), true);
                        v.muted = false;
                        v.volume = 1.0;
                    }
                }).catch(()=>{});
            }
        } catch(e) {}

        if (activeStatus.status === 'HEALTHY') {
            if (activeStatus.currentTime === lastActiveTime) {
                if (Date.now() - frozenCheckTimestamp > FROZEN_THRESHOLD_MS) activeStatus.status = 'FROZEN';
            } else {
                lastActiveTime = activeStatus.currentTime;
                frozenCheckTimestamp = Date.now();
            }
        }

        if (activeStatus.status === 'FROZEN' || activeStatus.status === 'CRITICAL_ERROR' || activeStatus.status === 'DEAD') {
            console.log(`\n[!] ❌ WATCHDOG DETECTED ISSUE ON ACTIVE TAB: ${activeStatus.status}`);
            await takeAndBatchScreenshot(activePage, `error-${activeStatus.status.toLowerCase()}`);
            
            console.log(`[*] Checking Backup Tab status before switching...`);
            let backupStatus = await checkPageStatus(backupPage);

            if (backupStatus.status === 'HEALTHY') {
                console.log(`[+] Backup Tab is Healthy! Executing INSTANT HOT-SWAP ⚡`);
                
                // Mute purana (Active), Unmute naya (Backup) stealthily
                try {
                    for (const frame of activePage.frames()) {
                        await frame.evaluate(() => { const v = document.querySelector('video'); if(v) { v.muted = true; v.volume = 0; } }).catch(()=>{});
                    }
                    for (const frame of backupPage.frames()) {
                        await frame.evaluate(() => { const v = document.querySelector('video'); if(v) { v.muted = false; v.volume = 1.0; } }).catch(()=>{});
                    }
                } catch(e){}
                
                await backupPage.bringToFront();
                console.log(`[+] Switch successful. Stream continues smoothly!`);

                let brokenPage = activePage;
                activePage = backupPage;
                backupPage = brokenPage;

                lastActiveTime = -1;
                frozenCheckTimestamp = Date.now();

                console.log(`[*] Recovering broken tab in background to serve as new backup...`);
                backupPage.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
                    .then(() => initializeVideo(backupPage, true, false)) 
                    .catch(() => {});

            } else {
                console.error(`[!] ❌ Backup Tab is ALSO DEAD/FROZEN. Hard Restarting System...`);
                throw new Error("Both Active and Backup tabs failed.");
            }
        }

        watchdogTicks++;
        if (watchdogTicks % 120 === 0) await takeAndBatchScreenshot(activePage, `heartbeat-tick-${watchdogTicks}`);
        
        await new Promise(r => setTimeout(r, 5000)); 
    }
}

// =========================================================================
// 🚀 MAIN LOOP & DIRECT STREAMING
// =========================================================================
async function startDirectStreaming() {
    console.log(`[*] Starting OBS Studio FIRST...`);
    setupOBSConfig();

    obsProcess = spawn('obs', ['--startstreaming', '--minimize-to-tray']);
    
    obsProcess.stdout.on('data', (data) => console.log(`[OBS]: ${data.toString().trim()}`));
    obsProcess.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('error') || msg.includes('fail')) console.log(`[OBS Error]: ${msg}`);
    });

    console.log('[*] Waiting for OBS to initialize before launching browser...');
    await new Promise(r => setTimeout(r, 8000));

    try {
        await obs.connect('ws://127.0.0.1:4455', 'secret');
        console.log('[+] OBS WebSocket Connected! Enforcing WaitingScene (Black Screen)...');
        await obs.call('SetCurrentProgramScene', { sceneName: 'WaitingScene' });
    } catch (e) { console.log('[-] Could not connect to OBS WebSocket.'); }

    console.log(`[*] Starting browser...`);
    browser = await puppeteer.launch({
        headless: false, 
        defaultViewport: { width: 1280, height: 720 },
        ignoreDefaultArgs: ['--enable-automation'], 
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--window-size=1280,720', '--window-position=0,0', '--kiosk', '--start-fullscreen',
            '--autoplay-policy=no-user-gesture-required'
        ]
    });

    // ✨ THE FIX: Correct context creation function name for newer Puppeteer
    activeContext = await browser.createBrowserContext();
    activePage = await activeContext.newPage();
    
    backupContext = await browser.createBrowserContext();
    backupPage = await backupContext.newPage();

    const defaultPages = await browser.pages();
    for (const p of defaultPages) {
        if (p !== activePage && p !== backupPage) await p.close();
    }
    
    await applyInstantBlackout(activePage);
    await applyInstantBlackout(backupPage);

    await activePage.bringToFront(); 

    console.log(`[*] STEP 1: Loading Target on Active Page: ${TARGET_URL}`);
    await activePage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    await initializeVideo(activePage, false, true); 

    console.log('\n[*] Active Video is Ready! Shifting OBS from Black Screen to LIVE Video (MainScene)...');
    try {
        await obs.call('SetCurrentProgramScene', { sceneName: 'MainScene' });
    } catch (e) { console.log('[-] Failed to shift OBS scene.'); }

    console.log(`[*] STEP 2: Silently preparing Backup Page in the background...`);
    try {
        await backupPage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await initializeVideo(backupPage, true, false); 
    } catch (e) { console.log("[-] Background backup setup skipped."); }
    
    await activePage.bringToFront();

    console.log('\n[*] Everything Setup! Dual-Tab Monitoring is Active.');
    await startWatchdog();
}

async function mainLoop() {
    while (true) {
        try {
            await startDirectStreaming();
        } catch (error) {
            console.error(`\n[!] ALERT: ${error.message}`);
            console.log('[*] 🔄 Hard Restarting everything in 3 seconds...');
            await cleanup();
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

// =========================================================================
// 🧹 CLEANUP & ZOMBIE KILLER
// =========================================================================
async function cleanup() {
    console.log('[*] Cleaning up resources...');
    try { await obs.disconnect(); } catch (e) { } 
    
    if (browser) { 
        try { await browser.close(); } catch(e) { } 
        browser = null; 
    }

    if (obsProcess) { 
        try { obsProcess.kill('SIGKILL'); } catch(e) { } 
        obsProcess = null; 
    }

    try {
        execSync('pkill -9 obs || true', { stdio: 'ignore' });
        execSync('pkill -9 chrome || true', { stdio: 'ignore' });
        execSync('pkill -9 puppeteer || true', { stdio: 'ignore' });
    } catch (e) { }
}

process.on('SIGINT', async () => { await cleanup(); process.exit(0); });

// =========================================================================
// ⏱️ AUTO-OVERLAP OR EXACT DURATION LOGIC
// =========================================================================
const customDurationStr = process.env.CUSTOM_DURATION || 'None';

function parseDurationToMs(str) {
    if (!str || str.toLowerCase() === 'none') return null;
    let ms = 0;
    const hMatch = str.match(/(\d+)\s*h/i);
    const mMatch = str.match(/(\d+)\s*m/i);
    if (hMatch) ms += parseInt(hMatch[1]) * 60 * 60 * 1000;
    if (mMatch) ms += parseInt(mMatch[1]) * 60 * 1000;
    return ms > 0 ? ms : null;
}

const exactDurationMs = parseDurationToMs(customDurationStr);

if (exactDurationMs) {
    console.log(`\n[*] 🕒 Custom Duration Detected: ${customDurationStr} (${exactDurationMs / 60000} mins). System will auto-shutdown after this time.`);
    setTimeout(async () => {
        console.log(`\n[*] 🛑 Time's up! The assigned duration (${customDurationStr}) is complete. Shutting down cleanly...`);
        await cleanup();
        process.exit(0);
    }, exactDurationMs);
} else {
    console.log(`\n[*] 🔄 No Custom Duration specified. Defaulting to 5h 50m Auto-Overlap loop.`);
    setTimeout(() => {
        console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
        try {
            const targetUrl = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
            const channel = process.env.OKRU_STREAM_ID || '1';
            const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
            const server = process.env.SERVER_SELECTION || 'None';

            const cmd = `gh workflow run main.yml -f target_url="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}" -f custom_duration="None"`;
            execSync(cmd, { stdio: 'inherit' });
            
            setTimeout(async () => {
                console.log("\n[*] Handing over stream to next action. Shutting down cleanly...");
                await cleanup();
                process.exit(0);
            }, 300000); 
        } catch (err) { }
    }, 21000000);
}

// 🚀 Start Execution
mainLoop();

































// ===================== Alhamdullaj ===================================


// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { spawn, execSync } = require('child_process');
// const { OBSWebSocket } = require('obs-websocket-js'); 

// const obs = new OBSWebSocket(); 

// // 🚀 Multi-Stream Key Manager
// const STREAM_KEYS = {
//     '1'   : '15254238731883_15281627925099_najspfkgne', 
//     '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
//     '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
//     '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
//     '2.1' : '15254308986475_15281761618539_3xca7oij3u',
//     '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

//     '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
//     '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
//     '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

//     '4'   : '15255022345835_15283095800427_vwrupxzstm', 
//     '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
//     '4.2' : '15255045480043_15283135842923_tldl4bhmii',
//     '4.3' : '15255208599147_15283449629291_abltofuc7m', 
//     '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
//     '4.5' : '15255227670123_15283486263915_jpntt54mve',

//     '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
//     '5.1' : '15273713933931_15317494860395_avj47smmim', 
//     '5.2' : '15273722257003_15317510195819_6edjluvdqi',
//     '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
//     '5.4' : '15273750175339_15317561707115_csel26ku5a', 
//     '5.5' : '15273760071275_15317579467371_cnewcj54me',
//     '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
//     '5.7' : '15273778683499_15317616560747_4piekvs4wu',

//     's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
//     's1.2'  : '14204288179759_14846247373359_tnsknmapva',
//     's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
//     's1.4'  : '14204331957807_14846326147631_dji2acqcze',
//     's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
//     's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
//     's1.7'  : '14204370492975_14846393649711_6fduhdqite',
//     's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
//     's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
//     's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

//     's2.1'  : '14204490948143_14846603495983_kzevn36tii',
//     's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
//     's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
//     's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
//     's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
//     's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
//     's2.7'  : '14204577259055_14846756194863_3ecad2535u',
//     's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
//     's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
//     's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
// };

// // URL logic
// let rawUrl = (process.env.TARGET_URL || '').trim();
// let TARGET_URL = rawUrl !== '' ? rawUrl : 'https://dadocric.st/player.php?id=starsp3&v=m';
// if (TARGET_URL && !TARGET_URL.startsWith('http')) TARGET_URL = 'https://' + TARGET_URL;

// const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
// const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
// const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];

// let browser = null;
// let obsProcess = null;
// let activePage = null;
// let backupPage = null;

// const FROZEN_THRESHOLD_MS = 5000; 

// if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
// let pendingScreenshots = [];
// let uploadCycleCount = 0;

// async function takeAndBatchScreenshot(page, stepName) {
//     if (!page) return;
//     try {
//         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//         const filePath = `./screenshots/snap_${timestamp}_${stepName}.png`;
//         await page.screenshot({ path: filePath });
//         console.log(`[📸] Screenshot saved: ${filePath}`);
//         pendingScreenshots.push(filePath);

//         if (pendingScreenshots.length >= 3) {
//             console.log(`[🚀] 3 Screenshots collected. Triggering LIVE batch upload...`);
//             try {
//                 const tag = 'live-stream-logs';
//                 try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Logs"`, { stdio: 'ignore' }); } catch(e) {}
//                 try {
//                     const oldAssets = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim().split('\n');
//                     for (const asset of oldAssets) if (asset) execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
//                 } catch(e) {}

//                 const fileList = pendingScreenshots.join(' ');
//                 execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
//                 uploadCycleCount++;
//                 console.log(`[+] Live batch upload successful!`);
//                 pendingScreenshots = []; 
//             } catch (err) { }
//         }
//     } catch (e) { }
// }

// // =========================================================================
// // ✨ INSTANT BLACKOUT FUNCTION (Hides Website Before Loading)
// // =========================================================================
// async function applyInstantBlackout(page) {
//     await page.evaluateOnNewDocument(() => {
//         const style = document.createElement('style');
//         style.innerHTML = `
//             html, body { background-color: black !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
//             /* Force any iframe to cover the entire screen immediately */
//             iframe { 
//                 position: fixed !important; top: 0 !important; left: 0 !important; 
//                 width: 100vw !important; height: 100vh !important; 
//                 z-index: 999999 !important; border: none !important; background-color: black !important;
//             }
//         `;
//         document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
//     }).catch(()=>{});
// }

// // =========================================================================
// // 🛠️ SETUP OBS CONFIGURATION
// // =========================================================================
// function setupOBSConfig() {
//     console.log('[*] Generating OBS Config files with WebSocket & Scenes...');
//     const obsDir = path.join(os.homedir(), '.config', 'obs-studio');
//     const profilesDir = path.join(obsDir, 'basic', 'profiles', 'Untitled');
//     const scenesDir = path.join(obsDir, 'basic', 'scenes');

//     fs.mkdirSync(profilesDir, { recursive: true });
//     fs.mkdirSync(scenesDir, { recursive: true });

//     const globalIniContent = `[General]\nLicenseAccepted=true\n[BasicWindow]\nShowAutoConfig=false\nWarned=true\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nServerPassword=secret\n`;
//     fs.writeFileSync(path.join(obsDir, 'global.ini'), globalIniContent);
//     fs.writeFileSync(path.join(profilesDir, 'basic.ini'), `[General]\nName=Untitled\n[Video]\nBaseCX=1280\nBaseCY=720\nOutputCX=1280\nOutputCY=720\nFPSCommon=30\n[Output]\nMode=Simple\n`);

//     const serviceJson = {
//         "settings": { "server": "rtmp://vsu.okcdn.ru/input/", "key": ACTIVE_STREAM_KEY },
//         "type": "rtmp_custom"
//     };
//     fs.writeFileSync(path.join(profilesDir, 'service.json'), JSON.stringify(serviceJson, null, 2));

//     const sceneJson = {
//         "current_scene": "WaitingScene", 
//         "current_program_scene": "WaitingScene", 
//         "name": "Untitled",
//         "scene_order": [{"name": "WaitingScene"}, {"name": "MainScene"}],
//         "sources": [
//             { "id": "xshm_input", "name": "Screen", "settings": { "show_cursor": false } },
//             { "id": "pulse_output_capture", "name": "Audio", "settings": {} },
//             {
//                 "id": "scene", "name": "MainScene",
//                 "settings": { "items": [ {"name": "Screen", "id": 1, "visible": true}, {"name": "Audio", "id": 2, "visible": true} ] }
//             },
//             {
//                 "id": "scene", "name": "WaitingScene",
//                 "settings": { "items": [] } 
//             }
//         ]
//     };
//     fs.writeFileSync(path.join(scenesDir, 'Untitled.json'), JSON.stringify(sceneJson, null, 2));
//     console.log('[+] OBS Configurations injected successfully!');
// }

// // =========================================================================
// // 🎬 VIDEO INITIALIZATION 
// // =========================================================================
// async function initializeVideo(page, startMuted, isActivePage) {
//     try {
//         // ✨ FIX 1: Enforce Blackout IMMEDIATELY (Doosri layer safety ke liye)
//         console.log('[*] Enforcing Instant Black Background & Full Screen UI...');
//         await page.evaluate(() => {
//             document.documentElement.style.backgroundColor = 'black';
//             document.body.style.backgroundColor = 'black';
//             document.body.style.margin = '0';
//             document.body.style.padding = '0';
//             document.body.style.overflow = 'hidden';
            
//             document.querySelectorAll('iframe').forEach(iframe => {
//                 iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
//                 iframe.style.width = '100vw'; iframe.style.height = '100vh';
//                 iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
//             });
//         }).catch(() => {});

//         // Server Selection
//         if (SERVER_SELECTION !== 'None') {
//             let serverClicked = false; let serverAttempts = 0;
//             while (!serverClicked && serverAttempts < 10) { 
//                 serverAttempts++;
//                 try {
//                     const clickSuccess = await page.evaluate((serverName) => {
//                         const buttons = Array.from(document.querySelectorAll('button'));
//                         const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
//                         if (targetBtn) { targetBtn.click(); return true; }
//                         return false;
//                     }, SERVER_SELECTION);

//                     if (clickSuccess) {
//                         serverClicked = true; await takeAndBatchScreenshot(page, `server-clicked`);
//                         await new Promise(r => setTimeout(r, 2000)); 
//                         if (isActivePage) await page.bringToFront(); 
//                     } else await new Promise(r => setTimeout(r, 2000));
//                 } catch (err) { await new Promise(r => setTimeout(r, 2000)); }
//             }
//         }

//         // Play Button Hunt
//         console.log('[*] Hunting for the Play Button...');
//         let buttonClicked = false; let attempts = 0;
        
//         while (!buttonClicked && attempts < 15) {
//             for (const frame of page.frames()) {
//                 try {
//                     // Added generic classes to catch "Click to Unmute" overlays automatically
//                     const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"], .vjs-big-play-button, [class*="unmute"]');
//                     if (playBtn) {
//                         const isVisible = await frame.evaluate(el => {
//                             const style = window.getComputedStyle(el);
//                             return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
//                         }, playBtn);

//                         if (isVisible) {
//                             await frame.evaluate(el => el.click(), playBtn); 
//                             buttonClicked = true;
//                             await takeAndBatchScreenshot(page, `play-btn-clicked`);
//                             break; 
//                         }
//                     }
//                 } catch (err) {}
//             }
//             if (!buttonClicked) await new Promise(r => setTimeout(r, 2000));
//             attempts++;
//         }

//         // Lock Video element
//         console.log('[*] Scanning for Video Player...');
//         let targetFrame = null;
//         for (const frame of page.frames()) {
//             try {
//                 const isRealLiveStream = await frame.evaluate(() => {
//                     const vid = document.querySelector('video');
//                     return vid && vid.clientWidth > 100 && vid.clientHeight > 100;
//                 });
//                 if (isRealLiveStream) { targetFrame = frame; break; }
//             } catch (e) { }
//         }

//         if (!targetFrame) targetFrame = page.mainFrame();

//         await targetFrame.evaluate(async (muteVideo) => {
//             const style = document.createElement('style');
//             style.innerHTML = `.jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { display: none !important; opacity: 0 !important; visibility: hidden !important; }`;
//             document.head.appendChild(style);

//             const video = document.querySelector('video');
//             if (video) { 
//                 video.muted = muteVideo; 
//                 video.volume = 1.0; 
//                 video.style.position = 'fixed'; 
//                 video.style.top = '0px'; 
//                 video.style.left = '0px';
//                 video.style.width = '100vw'; 
//                 video.style.height = '100vh';
//                 video.style.zIndex = '2147483647'; 
//                 video.style.backgroundColor = 'black'; 
//                 video.style.objectFit = 'contain';
//             }
//         }, startMuted).catch(() => {});

//     } catch (e) { }
// }

// // =========================================================================
// // 🔄 DUAL-TAB WATCHDOG 
// // =========================================================================
// async function checkPageStatus(page) {
//     try {
//         for (const frame of page.frames()) {
//             const result = await frame.evaluate(() => {
//                 const bodyText = document.body.innerText.toLowerCase();
//                 if (bodyText.includes("stream error")) return { status: 'CRITICAL_ERROR' };
//                 const v = document.querySelector('video');
//                 if (v && !v.ended) return { status: 'HEALTHY', currentTime: v.currentTime };
//                 return { status: 'DEAD' };
//             });
//             if (result.status !== 'DEAD') return result;
//         }
//     } catch (e) { return { status: 'DEAD' }; }
//     return { status: 'DEAD' };
// }

// async function startWatchdog() {
//     let lastActiveTime = -1;
//     let frozenCheckTimestamp = Date.now();
//     let watchdogTicks = 0;

//     while (true) {
//         if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

//         let activeStatus = await checkPageStatus(activePage);

//         if (activeStatus.status === 'HEALTHY') {
//             if (activeStatus.currentTime === lastActiveTime) {
//                 if (Date.now() - frozenCheckTimestamp > FROZEN_THRESHOLD_MS) activeStatus.status = 'FROZEN';
//             } else {
//                 lastActiveTime = activeStatus.currentTime;
//                 frozenCheckTimestamp = Date.now();
//             }
//         }

//         if (activeStatus.status === 'FROZEN' || activeStatus.status === 'CRITICAL_ERROR' || activeStatus.status === 'DEAD') {
//             console.log(`\n[!] ❌ WATCHDOG DETECTED ISSUE ON ACTIVE TAB: ${activeStatus.status}`);
//             await takeAndBatchScreenshot(activePage, `error-${activeStatus.status.toLowerCase()}`);
            
//             console.log(`[*] Checking Backup Tab status before switching...`);
//             let backupStatus = await checkPageStatus(backupPage);

//             if (backupStatus.status === 'HEALTHY') {
//                 console.log(`[+] Backup Tab is Healthy! Executing INSTANT HOT-SWAP ⚡`);
                
//                 await activePage.evaluate(() => { const v = document.querySelector('video'); if(v) v.muted = true; }).catch(()=>{});
//                 await backupPage.evaluate(() => { const v = document.querySelector('video'); if(v) v.muted = false; }).catch(()=>{});
                
//                 await backupPage.bringToFront();
//                 console.log(`[+] Switch successful. Stream continues smoothly!`);

//                 let brokenPage = activePage;
//                 activePage = backupPage;
//                 backupPage = brokenPage;

//                 lastActiveTime = -1;
//                 frozenCheckTimestamp = Date.now();

//                 console.log(`[*] Recovering broken tab in background to serve as new backup...`);
//                 backupPage.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
//                     .then(() => initializeVideo(backupPage, true, false)) 
//                     .catch(() => {});

//             } else {
//                 console.error(`[!] ❌ Backup Tab is ALSO DEAD/FROZEN. Hard Restarting System...`);
//                 throw new Error("Both Active and Backup tabs failed.");
//             }
//         }

//         watchdogTicks++;
//         if (watchdogTicks % 120 === 0) await takeAndBatchScreenshot(activePage, `heartbeat-tick-${watchdogTicks}`);
        
//         await new Promise(r => setTimeout(r, 5000)); 
//     }
// }

// // =========================================================================
// // 🚀 MAIN LOOP & DIRECT STREAMING
// // =========================================================================
// async function startDirectStreaming() {
//     console.log(`[*] Starting OBS Studio FIRST...`);
//     setupOBSConfig();

//     obsProcess = spawn('obs', ['--startstreaming', '--minimize-to-tray']);
    
//     obsProcess.stdout.on('data', (data) => console.log(`[OBS]: ${data.toString().trim()}`));
//     obsProcess.stderr.on('data', (data) => {
//         const msg = data.toString().trim();
//         if (msg.includes('error') || msg.includes('fail')) console.log(`[OBS Error]: ${msg}`);
//     });

//     console.log('[*] Waiting for OBS to initialize before launching browser...');
//     await new Promise(r => setTimeout(r, 8000));

//     try {
//         await obs.connect('ws://127.0.0.1:4455', 'secret');
//         console.log('[+] OBS WebSocket Connected! Enforcing WaitingScene (Black Screen)...');
//         await obs.call('SetCurrentProgramScene', { sceneName: 'WaitingScene' });
//     } catch (e) { console.log('[-] Could not connect to OBS WebSocket.'); }

//     console.log(`[*] Starting browser...`);
//     browser = await puppeteer.launch({
//         headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [
//             '--no-sandbox', '--disable-setuid-sandbox',
//             '--window-size=1280,720', '--window-position=0,0', '--kiosk', '--start-fullscreen',
//             '--autoplay-policy=no-user-gesture-required'
//         ]
//     });

//     activePage = (await browser.pages())[0]; 
//     backupPage = await browser.newPage();
    
//     // ✨ FIX 2: Inject CSS logic before any website loads
//     await applyInstantBlackout(activePage);
//     await applyInstantBlackout(backupPage);

//     await activePage.bringToFront(); 

//     console.log(`[*] STEP 1: Loading Target on Active Page: ${TARGET_URL}`);
//     await activePage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
//     await initializeVideo(activePage, false, true); 

//     console.log('\n[*] Active Video is Ready! Shifting OBS from Black Screen to LIVE Video (MainScene)...');
//     try {
//         await obs.call('SetCurrentProgramScene', { sceneName: 'MainScene' });
//     } catch (e) { console.log('[-] Failed to shift OBS scene.'); }

//     console.log(`[*] STEP 2: Silently preparing Backup Page in the background...`);
//     try {
//         await backupPage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//         await initializeVideo(backupPage, true, false); 
//     } catch (e) { console.log("[-] Background backup setup skipped."); }
    
//     await activePage.bringToFront();

//     console.log('\n[*] Everything Setup! Dual-Tab Monitoring is Active.');
//     await startWatchdog();
// }

// async function mainLoop() {
//     while (true) {
//         try {
//             await startDirectStreaming();
//         } catch (error) {
//             console.error(`\n[!] ALERT: ${error.message}`);
//             console.log('[*] 🔄 Hard Restarting everything in 3 seconds...');
//             await cleanup();
//             await new Promise(resolve => setTimeout(resolve, 3000));
//         }
//     }
// }

// // =========================================================================
// // 🧹 CLEANUP & ZOMBIE KILLER
// // =========================================================================
// async function cleanup() {
//     console.log('[*] Cleaning up resources...');
//     try { await obs.disconnect(); } catch (e) { } 
    
//     if (browser) { 
//         try { await browser.close(); } catch(e) { } 
//         browser = null; 
//     }

//     if (obsProcess) { 
//         try { obsProcess.kill('SIGKILL'); } catch(e) { } 
//         obsProcess = null; 
//     }

//     try {
//         execSync('pkill -9 obs || true', { stdio: 'ignore' });
//         execSync('pkill -9 chrome || true', { stdio: 'ignore' });
//         execSync('pkill -9 puppeteer || true', { stdio: 'ignore' });
//     } catch (e) { }
// }

// process.on('SIGINT', async () => { await cleanup(); process.exit(0); });

// // =========================================================================
// // ⏱️ AUTO-OVERLAP OR EXACT DURATION LOGIC
// // =========================================================================
// const customDurationStr = process.env.CUSTOM_DURATION || 'None';

// function parseDurationToMs(str) {
//     if (!str || str.toLowerCase() === 'none') return null;
//     let ms = 0;
//     const hMatch = str.match(/(\d+)\s*h/i);
//     const mMatch = str.match(/(\d+)\s*m/i);
//     if (hMatch) ms += parseInt(hMatch[1]) * 60 * 60 * 1000;
//     if (mMatch) ms += parseInt(mMatch[1]) * 60 * 1000;
//     return ms > 0 ? ms : null;
// }

// const exactDurationMs = parseDurationToMs(customDurationStr);

// if (exactDurationMs) {
//     console.log(`\n[*] 🕒 Custom Duration Detected: ${customDurationStr} (${exactDurationMs / 60000} mins). System will auto-shutdown after this time.`);
//     setTimeout(async () => {
//         console.log(`\n[*] 🛑 Time's up! The assigned duration (${customDurationStr}) is complete. Shutting down cleanly...`);
//         await cleanup();
//         process.exit(0);
//     }, exactDurationMs);
// } else {
//     console.log(`\n[*] 🔄 No Custom Duration specified. Defaulting to 5h 50m Auto-Overlap loop.`);
//     setTimeout(() => {
//         console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
//         try {
//             const targetUrl = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
//             const channel = process.env.OKRU_STREAM_ID || '1';
//             const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
//             const server = process.env.SERVER_SELECTION || 'None';

//             const cmd = `gh workflow run main.yml -f target_url="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}" -f custom_duration="None"`;
//             execSync(cmd, { stdio: 'inherit' });
            
//             setTimeout(async () => {
//                 console.log("\n[*] Handing over stream to next action. Shutting down cleanly...");
//                 await cleanup();
//                 process.exit(0);
//             }, 300000); 
//         } catch (err) { }
//     }, 21000000);
// }

// // 🚀 Start Execution
// mainLoop();






















// 3 abey bey website dek rhaa huta hai


// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { spawn, execSync } = require('child_process');
// const { OBSWebSocket } = require('obs-websocket-js'); 

// const obs = new OBSWebSocket(); 

// // 🚀 Multi-Stream Key Manager
// const STREAM_KEYS = {
//     '1'   : '15254238731883_15281627925099_najspfkgne', 
//     '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
//     '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
//     '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
//     '2.1' : '15254308986475_15281761618539_3xca7oij3u',
//     '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

//     '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
//     '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
//     '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

//     '4'   : '15255022345835_15283095800427_vwrupxzstm', 
//     '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
//     '4.2' : '15255045480043_15283135842923_tldl4bhmii',
//     '4.3' : '15255208599147_15283449629291_abltofuc7m', 
//     '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
//     '4.5' : '15255227670123_15283486263915_jpntt54mve',

//     '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
//     '5.1' : '15273713933931_15317494860395_avj47smmim', 
//     '5.2' : '15273722257003_15317510195819_6edjluvdqi',
//     '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
//     '5.4' : '15273750175339_15317561707115_csel26ku5a', 
//     '5.5' : '15273760071275_15317579467371_cnewcj54me',
//     '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
//     '5.7' : '15273778683499_15317616560747_4piekvs4wu',

//     's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
//     's1.2'  : '14204288179759_14846247373359_tnsknmapva',
//     's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
//     's1.4'  : '14204331957807_14846326147631_dji2acqcze',
//     's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
//     's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
//     's1.7'  : '14204370492975_14846393649711_6fduhdqite',
//     's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
//     's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
//     's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

//     's2.1'  : '14204490948143_14846603495983_kzevn36tii',
//     's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
//     's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
//     's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
//     's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
//     's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
//     's2.7'  : '14204577259055_14846756194863_3ecad2535u',
//     's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
//     's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
//     's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
// };

// // URL logic
// let rawUrl = (process.env.TARGET_URL || '').trim();
// let TARGET_URL = rawUrl !== '' ? rawUrl : 'https://dadocric.st/player.php?id=starsp3&v=m';
// if (TARGET_URL && !TARGET_URL.startsWith('http')) TARGET_URL = 'https://' + TARGET_URL;

// const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
// const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
// const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];

// let browser = null;
// let obsProcess = null;
// let activePage = null;
// let backupPage = null;

// const FROZEN_THRESHOLD_MS = 5000; 

// if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
// let pendingScreenshots = [];
// let uploadCycleCount = 0;

// async function takeAndBatchScreenshot(page, stepName) {
//     if (!page) return;
//     try {
//         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//         const filePath = `./screenshots/snap_${timestamp}_${stepName}.png`;
//         await page.screenshot({ path: filePath });
//         console.log(`[📸] Screenshot saved: ${filePath}`);
//         pendingScreenshots.push(filePath);

//         if (pendingScreenshots.length >= 3) {
//             console.log(`[🚀] 3 Screenshots collected. Triggering LIVE batch upload...`);
//             try {
//                 const tag = 'live-stream-logs';
//                 try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Logs"`, { stdio: 'ignore' }); } catch(e) {}
//                 try {
//                     const oldAssets = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim().split('\n');
//                     for (const asset of oldAssets) if (asset) execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
//                 } catch(e) {}

//                 const fileList = pendingScreenshots.join(' ');
//                 execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
//                 uploadCycleCount++;
//                 console.log(`[+] Live batch upload successful!`);
//                 pendingScreenshots = []; 
//             } catch (err) { }
//         }
//     } catch (e) { }
// }

// // =========================================================================
// // 🛠️ SETUP OBS CONFIGURATION
// // =========================================================================
// function setupOBSConfig() {
//     console.log('[*] Generating OBS Config files with WebSocket & Scenes...');
//     const obsDir = path.join(os.homedir(), '.config', 'obs-studio');
//     const profilesDir = path.join(obsDir, 'basic', 'profiles', 'Untitled');
//     const scenesDir = path.join(obsDir, 'basic', 'scenes');

//     fs.mkdirSync(profilesDir, { recursive: true });
//     fs.mkdirSync(scenesDir, { recursive: true });

//     const globalIniContent = `[General]\nLicenseAccepted=true\n[BasicWindow]\nShowAutoConfig=false\nWarned=true\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nServerPassword=secret\n`;
//     fs.writeFileSync(path.join(obsDir, 'global.ini'), globalIniContent);
//     fs.writeFileSync(path.join(profilesDir, 'basic.ini'), `[General]\nName=Untitled\n[Video]\nBaseCX=1280\nBaseCY=720\nOutputCX=1280\nOutputCY=720\nFPSCommon=30\n[Output]\nMode=Simple\n`);

//     const serviceJson = {
//         "settings": { "server": "rtmp://vsu.okcdn.ru/input/", "key": ACTIVE_STREAM_KEY },
//         "type": "rtmp_custom"
//     };
//     fs.writeFileSync(path.join(profilesDir, 'service.json'), JSON.stringify(serviceJson, null, 2));

//     const sceneJson = {
//         "current_scene": "WaitingScene", // Stream begins on Black Screen
//         "current_program_scene": "WaitingScene", 
//         "name": "Untitled",
//         "scene_order": [{"name": "WaitingScene"}, {"name": "MainScene"}],
//         "sources": [
//             { "id": "xshm_input", "name": "Screen", "settings": { "show_cursor": false } },
//             { "id": "pulse_output_capture", "name": "Audio", "settings": {} },
//             {
//                 "id": "scene", "name": "MainScene",
//                 "settings": { "items": [ {"name": "Screen", "id": 1, "visible": true}, {"name": "Audio", "id": 2, "visible": true} ] }
//             },
//             {
//                 "id": "scene", "name": "WaitingScene",
//                 "settings": { "items": [] } 
//             }
//         ]
//     };
//     fs.writeFileSync(path.join(scenesDir, 'Untitled.json'), JSON.stringify(sceneJson, null, 2));
//     console.log('[+] OBS Configurations injected successfully!');
// }

// // =========================================================================
// // 🎬 VIDEO INITIALIZATION 
// // =========================================================================
// // ✨ ADDED: `isActivePage` flag. Yeh ensure karega ke Backup tab ghalti se front par na aaye
// async function initializeVideo(page, startMuted, isActivePage) {
//     try {
//         if (SERVER_SELECTION !== 'None') {
//             let serverClicked = false; let serverAttempts = 0;
//             while (!serverClicked && serverAttempts < 10) { 
//                 serverAttempts++;
//                 try {
//                     const clickSuccess = await page.evaluate((serverName) => {
//                         const buttons = Array.from(document.querySelectorAll('button'));
//                         const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
//                         if (targetBtn) { targetBtn.click(); return true; }
//                         return false;
//                     }, SERVER_SELECTION);

//                     if (clickSuccess) {
//                         serverClicked = true; await takeAndBatchScreenshot(page, `server-clicked`);
//                         await new Promise(r => setTimeout(r, 2000)); 
//                         // ✨ Sirf main tab front par ayega, backup apni background location par rahega!
//                         if (isActivePage) await page.bringToFront(); 
//                     } else await new Promise(r => setTimeout(r, 2000));
//                 } catch (err) { await new Promise(r => setTimeout(r, 2000)); }
//             }
//         }

//         console.log('[*] Hunting for the Play Button...');
//         let buttonClicked = false; let attempts = 0;
        
//         while (!buttonClicked && attempts < 15) {
//             for (const frame of page.frames()) {
//                 try {
//                     const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"], .vjs-big-play-button');
//                     if (playBtn) {
//                         const isVisible = await frame.evaluate(el => {
//                             const style = window.getComputedStyle(el);
//                             return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
//                         }, playBtn);

//                         if (isVisible) {
//                             await frame.evaluate(el => el.click(), playBtn); 
//                             buttonClicked = true;
//                             await takeAndBatchScreenshot(page, `play-btn-clicked`);
//                             break; 
//                         }
//                     }
//                 } catch (err) {}
//             }
//             if (!buttonClicked) await new Promise(r => setTimeout(r, 2000));
//             attempts++;
//         }

//         console.log('[*] Scanning for Video Player...');
//         let targetFrame = null;
//         for (const frame of page.frames()) {
//             try {
//                 const isRealLiveStream = await frame.evaluate(() => {
//                     const vid = document.querySelector('video');
//                     return vid && vid.clientWidth > 100 && vid.clientHeight > 100;
//                 });
//                 if (isRealLiveStream) { targetFrame = frame; break; }
//             } catch (e) { }
//         }

//         if (!targetFrame) targetFrame = page.mainFrame();

//         console.log('[*] Enforcing Black Background and Full Screen UI...');
//         await page.evaluate(() => {
//             document.body.style.backgroundColor = 'black';
//             document.body.style.overflow = 'hidden';
//             document.querySelectorAll('iframe').forEach(iframe => {
//                 iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
//                 iframe.style.width = '100vw'; iframe.style.height = '100vh';
//                 iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
//             });
//         }).catch(() => {});

//         await targetFrame.evaluate(async (muteVideo) => {
//             const style = document.createElement('style');
//             style.innerHTML = `.jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { display: none !important; opacity: 0 !important; visibility: hidden !important; }`;
//             document.head.appendChild(style);

//             const video = document.querySelector('video');
//             if (video) { 
//                 video.muted = muteVideo; 
//                 video.volume = 1.0; 
//                 video.style.position = 'fixed'; 
//                 video.style.top = '0'; video.style.left = '0';
//                 video.style.width = '100vw'; video.style.height = '100vh';
//                 video.style.zIndex = '2147483647'; 
//                 video.style.backgroundColor = 'black'; 
//                 video.style.objectFit = 'contain';
//             }
//         }, startMuted).catch(() => {});

//     } catch (e) { }
// }

// // =========================================================================
// // 🔄 DUAL-TAB WATCHDOG 
// // =========================================================================
// async function checkPageStatus(page) {
//     try {
//         for (const frame of page.frames()) {
//             const result = await frame.evaluate(() => {
//                 const bodyText = document.body.innerText.toLowerCase();
//                 if (bodyText.includes("stream error")) return { status: 'CRITICAL_ERROR' };
//                 const v = document.querySelector('video');
//                 if (v && !v.ended) return { status: 'HEALTHY', currentTime: v.currentTime };
//                 return { status: 'DEAD' };
//             });
//             if (result.status !== 'DEAD') return result;
//         }
//     } catch (e) { return { status: 'DEAD' }; }
//     return { status: 'DEAD' };
// }

// async function startWatchdog() {
//     let lastActiveTime = -1;
//     let frozenCheckTimestamp = Date.now();
//     let watchdogTicks = 0;

//     while (true) {
//         if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

//         let activeStatus = await checkPageStatus(activePage);

//         if (activeStatus.status === 'HEALTHY') {
//             if (activeStatus.currentTime === lastActiveTime) {
//                 if (Date.now() - frozenCheckTimestamp > FROZEN_THRESHOLD_MS) activeStatus.status = 'FROZEN';
//             } else {
//                 lastActiveTime = activeStatus.currentTime;
//                 frozenCheckTimestamp = Date.now();
//             }
//         }

//         if (activeStatus.status === 'FROZEN' || activeStatus.status === 'CRITICAL_ERROR' || activeStatus.status === 'DEAD') {
//             console.log(`\n[!] ❌ WATCHDOG DETECTED ISSUE ON ACTIVE TAB: ${activeStatus.status}`);
//             await takeAndBatchScreenshot(activePage, `error-${activeStatus.status.toLowerCase()}`);
            
//             console.log(`[*] Checking Backup Tab status before switching...`);
//             let backupStatus = await checkPageStatus(backupPage);

//             if (backupStatus.status === 'HEALTHY') {
//                 console.log(`[+] Backup Tab is Healthy! Executing INSTANT HOT-SWAP ⚡`);
                
//                 await activePage.evaluate(() => { const v = document.querySelector('video'); if(v) v.muted = true; }).catch(()=>{});
//                 await backupPage.evaluate(() => { const v = document.querySelector('video'); if(v) v.muted = false; }).catch(()=>{});
                
//                 await backupPage.bringToFront();
//                 console.log(`[+] Switch successful. Stream continues smoothly!`);

//                 let brokenPage = activePage;
//                 activePage = backupPage;
//                 backupPage = brokenPage;

//                 lastActiveTime = -1;
//                 frozenCheckTimestamp = Date.now();

//                 console.log(`[*] Recovering broken tab in background to serve as new backup...`);
//                 backupPage.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
//                     .then(() => initializeVideo(backupPage, true, false)) // isActive = false
//                     .catch(() => {});

//             } else {
//                 console.error(`[!] ❌ Backup Tab is ALSO DEAD/FROZEN. Hard Restarting System...`);
//                 throw new Error("Both Active and Backup tabs failed.");
//             }
//         }

//         watchdogTicks++;
//         if (watchdogTicks % 120 === 0) await takeAndBatchScreenshot(activePage, `heartbeat-tick-${watchdogTicks}`);
        
//         await new Promise(r => setTimeout(r, 5000)); 
//     }
// }

// // =========================================================================
// // 🚀 MAIN LOOP & DIRECT STREAMING
// // =========================================================================
// async function startDirectStreaming() {
//     console.log(`[*] Starting OBS Studio FIRST...`);
//     setupOBSConfig();

//     obsProcess = spawn('obs', ['--startstreaming']);
//     obsProcess.stdout.on('data', (data) => console.log(`[OBS]: ${data.toString().trim()}`));
//     obsProcess.stderr.on('data', (data) => {
//         const msg = data.toString().trim();
//         if (msg.includes('error') || msg.includes('fail')) console.log(`[OBS Error]: ${msg}`);
//     });

//     console.log('[*] Waiting for OBS to initialize before launching browser...');
//     await new Promise(r => setTimeout(r, 8000));

//     try {
//         await obs.connect('ws://127.0.0.1:4455', 'secret');
//         console.log('[+] OBS WebSocket Connected! Enforcing WaitingScene (Black Screen)...');
//         await obs.call('SetCurrentProgramScene', { sceneName: 'WaitingScene' });
//     } catch (e) { console.log('[-] Could not connect to OBS WebSocket.'); }

//     console.log(`[*] Starting browser...`);
//     browser = await puppeteer.launch({
//         headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [
//             '--no-sandbox', '--disable-setuid-sandbox',
//             '--window-size=1280,720', '--kiosk', 
//             '--autoplay-policy=no-user-gesture-required'
//         ]
//     });

//     activePage = (await browser.pages())[0]; 
//     backupPage = await browser.newPage();
    
//     // Ensure Active page is strictly in front initially
//     await activePage.bringToFront(); 

//     console.log(`[*] STEP 1: Loading Target on Active Page: ${TARGET_URL}`);
//     await activePage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
//     // Initialize Main Video (isActive = true)
//     await initializeVideo(activePage, false, true); 

//     // 🔥 FAURAN STREAM LIVE KARO! Backup ka wait nahi karna
//     console.log('\n[*] Active Video is Ready! Shifting OBS from Black Screen to LIVE Video (MainScene)...');
//     try {
//         await obs.call('SetCurrentProgramScene', { sceneName: 'MainScene' });
//     } catch (e) { console.log('[-] Failed to shift OBS scene.'); }

//     // 🤫 Background mein Backup prepare karo
//     console.log(`[*] STEP 2: Silently preparing Backup Page in the background...`);
//     try {
//         await backupPage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//         // Initialize Backup Video (isActive = false, so it DOES NOT steal focus)
//         await initializeVideo(backupPage, true, false); 
//     } catch (e) { console.log("[-] Background backup setup skipped."); }
    
//     // Make absolutely sure Active is still visible
//     await activePage.bringToFront();

//     console.log('\n[*] Everything Setup! Dual-Tab Monitoring is Active.');
//     await startWatchdog();
// }

// async function mainLoop() {
//     while (true) {
//         try {
//             await startDirectStreaming();
//         } catch (error) {
//             console.error(`\n[!] ALERT: ${error.message}`);
//             console.log('[*] 🔄 Hard Restarting everything in 3 seconds...');
//             await cleanup();
//             await new Promise(resolve => setTimeout(resolve, 3000));
//         }
//     }
// }

// // =========================================================================
// // 🧹 CLEANUP & ZOMBIE KILLER
// // =========================================================================
// async function cleanup() {
//     console.log('[*] Cleaning up resources...');
//     try { await obs.disconnect(); } catch (e) { } 
    
//     if (browser) { 
//         try { await browser.close(); } catch(e) { } 
//         browser = null; 
//     }

//     if (obsProcess) { 
//         try { obsProcess.kill('SIGKILL'); } catch(e) { } 
//         obsProcess = null; 
//     }

//     try {
//         execSync('pkill -9 obs || true', { stdio: 'ignore' });
//         execSync('pkill -9 chrome || true', { stdio: 'ignore' });
//         execSync('pkill -9 puppeteer || true', { stdio: 'ignore' });
//     } catch (e) { }
// }

// process.on('SIGINT', async () => { await cleanup(); process.exit(0); });

// // =========================================================================
// // ⏱️ AUTO-OVERLAP OR EXACT DURATION LOGIC
// // =========================================================================
// const customDurationStr = process.env.CUSTOM_DURATION || 'None';

// function parseDurationToMs(str) {
//     if (!str || str.toLowerCase() === 'none') return null;
//     let ms = 0;
//     const hMatch = str.match(/(\d+)\s*h/i);
//     const mMatch = str.match(/(\d+)\s*m/i);
//     if (hMatch) ms += parseInt(hMatch[1]) * 60 * 60 * 1000;
//     if (mMatch) ms += parseInt(mMatch[1]) * 60 * 1000;
//     return ms > 0 ? ms : null;
// }

// const exactDurationMs = parseDurationToMs(customDurationStr);

// if (exactDurationMs) {
//     console.log(`\n[*] 🕒 Custom Duration Detected: ${customDurationStr} (${exactDurationMs / 60000} mins). System will auto-shutdown after this time.`);
//     setTimeout(async () => {
//         console.log(`\n[*] 🛑 Time's up! The assigned duration (${customDurationStr}) is complete. Shutting down cleanly...`);
//         await cleanup();
//         process.exit(0);
//     }, exactDurationMs);
// } else {
//     console.log(`\n[*] 🔄 No Custom Duration specified. Defaulting to 5h 50m Auto-Overlap loop.`);
//     setTimeout(() => {
//         console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
//         try {
//             const targetUrl = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
//             const channel = process.env.OKRU_STREAM_ID || '1';
//             const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
//             const server = process.env.SERVER_SELECTION || 'None';

//             const cmd = `gh workflow run main.yml -f target_url="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}" -f custom_duration="None"`;
//             execSync(cmd, { stdio: 'inherit' });
            
//             setTimeout(async () => {
//                 console.log("\n[*] Handing over stream to next action. Shutting down cleanly...");
//                 await cleanup();
//                 process.exit(0);
//             }, 300000); 
//         } catch (err) { }
//     }, 21000000);
// }

// // 🚀 Start Execution
// mainLoop();









































// 2


// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { spawn, execSync } = require('child_process');
// const { OBSWebSocket } = require('obs-websocket-js');

// const obs = new OBSWebSocket(); 

// // 🚀 Multi-Stream Key Manager
// const STREAM_KEYS = {
//     '1'   : '15254238731883_15281627925099_najspfkgne', 
//     '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
//     '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
//     '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
//     '2.1' : '15254308986475_15281761618539_3xca7oij3u',
//     '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

//     '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
//     '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
//     '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

//     '4'   : '15255022345835_15283095800427_vwrupxzstm', 
//     '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
//     '4.2' : '15255045480043_15283135842923_tldl4bhmii',
//     '4.3' : '15255208599147_15283449629291_abltofuc7m', 
//     '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
//     '4.5' : '15255227670123_15283486263915_jpntt54mve',

//     '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
//     '5.1' : '15273713933931_15317494860395_avj47smmim', 
//     '5.2' : '15273722257003_15317510195819_6edjluvdqi',
//     '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
//     '5.4' : '15273750175339_15317561707115_csel26ku5a', 
//     '5.5' : '15273760071275_15317579467371_cnewcj54me',
//     '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
//     '5.7' : '15273778683499_15317616560747_4piekvs4wu',

//     's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
//     's1.2'  : '14204288179759_14846247373359_tnsknmapva',
//     's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
//     's1.4'  : '14204331957807_14846326147631_dji2acqcze',
//     's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
//     's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
//     's1.7'  : '14204370492975_14846393649711_6fduhdqite',
//     's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
//     's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
//     's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

//     's2.1'  : '14204490948143_14846603495983_kzevn36tii',
//     's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
//     's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
//     's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
//     's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
//     's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
//     's2.7'  : '14204577259055_14846756194863_3ecad2535u',
//     's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
//     's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
//     's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
// };

// // URL logic
// let rawUrl = (process.env.TARGET_URL || '').trim();
// let TARGET_URL = rawUrl !== '' ? rawUrl : 'https://dadocric.st/player.php?id=starsp3&v=m';
// if (TARGET_URL && !TARGET_URL.startsWith('http')) TARGET_URL = 'https://' + TARGET_URL;

// const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
// const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
// const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];

// let browser = null;
// let obsProcess = null;
// let activePage = null;
// let backupPage = null;

// const FROZEN_THRESHOLD_MS = 5000; 

// if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
// let pendingScreenshots = [];
// let uploadCycleCount = 0;

// async function takeAndBatchScreenshot(page, stepName) {
//     if (!page) return;
//     try {
//         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//         const filePath = `./screenshots/snap_${timestamp}_${stepName}.png`;
//         await page.screenshot({ path: filePath });
//         console.log(`[📸] Screenshot saved: ${filePath}`);
//         pendingScreenshots.push(filePath);

//         if (pendingScreenshots.length >= 3) {
//             console.log(`[🚀] 3 Screenshots collected. Triggering LIVE batch upload...`);
//             try {
//                 const tag = 'live-stream-logs';
//                 try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Logs"`, { stdio: 'ignore' }); } catch(e) {}
//                 try {
//                     const oldAssets = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim().split('\n');
//                     for (const asset of oldAssets) if (asset) execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
//                 } catch(e) {}

//                 const fileList = pendingScreenshots.join(' ');
//                 execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
//                 uploadCycleCount++;
//                 console.log(`[+] Live batch upload successful! (Total Cycles: ${uploadCycleCount})`);
//                 pendingScreenshots = []; 
//             } catch (err) { console.error("[Error] Batch Upload:", err.message); }
//         }
//     } catch (e) { console.error("[Error] Screenshot failed:", e.message); }
// }

// // =========================================================================
// // 🛠️ SETUP OBS CONFIGURATION DYNAMICALLY (UPDATED WITH WEBSOCKET & SCENES)
// // =========================================================================
// function setupOBSConfig() {
//     console.log('[*] Generating OBS Config files with WebSocket & Scenes...');
//     const obsDir = path.join(os.homedir(), '.config', 'obs-studio');
//     const profilesDir = path.join(obsDir, 'basic', 'profiles', 'Untitled');
//     const scenesDir = path.join(obsDir, 'basic', 'scenes');

//     fs.mkdirSync(profilesDir, { recursive: true });
//     fs.mkdirSync(scenesDir, { recursive: true });

//     const globalIniContent = `[General]\nLicenseAccepted=true\n[BasicWindow]\nShowAutoConfig=false\nWarned=true\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nServerPassword=secret\n`;
//     fs.writeFileSync(path.join(obsDir, 'global.ini'), globalIniContent);
//     fs.writeFileSync(path.join(profilesDir, 'basic.ini'), `[General]\nName=Untitled\n[Video]\nBaseCX=1280\nBaseCY=720\nOutputCX=1280\nOutputCY=720\nFPSCommon=30\n[Output]\nMode=Simple\n`);

//     const serviceJson = {
//         "settings": {
//             "server": "rtmp://vsu.okcdn.ru/input/",
//             "key": ACTIVE_STREAM_KEY
//         },
//         "type": "rtmp_custom"
//     };
//     fs.writeFileSync(path.join(profilesDir, 'service.json'), JSON.stringify(serviceJson, null, 2));

//     const sceneJson = {
//         "current_scene": "WaitingScene", // ✨ MODIFIED: Stream starts on Black Screen
//         "current_program_scene": "WaitingScene", // ✨ MODIFIED
//         "name": "Untitled",
//         "scene_order": [{"name": "WaitingScene"}, {"name": "MainScene"}],
//         "sources": [
//             { "id": "xshm_input", "name": "Screen", "settings": { "show_cursor": false } },
//             { "id": "pulse_output_capture", "name": "Audio", "settings": {} },
//             {
//                 "id": "scene", "name": "MainScene",
//                 "settings": { "items": [ {"name": "Screen", "id": 1, "visible": true}, {"name": "Audio", "id": 2, "visible": true} ] }
//             },
//             {
//                 "id": "scene", "name": "WaitingScene",
//                 "settings": { "items": [] } // Black background scene
//             }
//         ]
//     };
//     fs.writeFileSync(path.join(scenesDir, 'Untitled.json'), JSON.stringify(sceneJson, null, 2));
//     console.log('[+] OBS Configurations injected successfully!');
// }

// // =========================================================================
// // 🎬 VIDEO INITIALIZATION (Play Button, Server, Smart Scan, Fullscreen)
// // =========================================================================
// async function initializeVideo(page, startMuted) {
//     try {
//         if (SERVER_SELECTION !== 'None') {
//             let serverClicked = false; let serverAttempts = 0;
//             while (!serverClicked && serverAttempts < 10) { 
//                 serverAttempts++;
//                 try {
//                     const clickSuccess = await page.evaluate((serverName) => {
//                         const buttons = Array.from(document.querySelectorAll('button'));
//                         const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
//                         if (targetBtn) { targetBtn.click(); return true; }
//                         return false;
//                     }, SERVER_SELECTION);

//                     if (clickSuccess) {
//                         serverClicked = true; await takeAndBatchScreenshot(page, `server-clicked`);
//                         await new Promise(r => setTimeout(r, 3000)); await page.bringToFront(); 
//                     } else await new Promise(r => setTimeout(r, 2000));
//                 } catch (err) { await new Promise(r => setTimeout(r, 2000)); }
//             }
//         }

//         console.log('[*] Hunting for the Play Button...');
//         let buttonClicked = false;
//         let attempts = 0;
        
//         while (!buttonClicked && attempts < 15) {
//             for (const frame of page.frames()) {
//                 try {
//                     const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"], .vjs-big-play-button');
//                     if (playBtn) {
//                         const isVisible = await frame.evaluate(el => {
//                             const style = window.getComputedStyle(el);
//                             return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
//                         }, playBtn);

//                         if (isVisible) {
//                             await frame.evaluate(el => el.click(), playBtn); 
//                             buttonClicked = true;
//                             await takeAndBatchScreenshot(page, `play-btn-clicked`);
//                             break; 
//                         }
//                     }
//                 } catch (err) {}
//             }
//             if (!buttonClicked) await new Promise(r => setTimeout(r, 2000));
//             attempts++;
//         }

//         console.log('[*] Scanning iframes for the REAL Live Stream Video...');
//         let targetFrame = null;
//         for (const frame of page.frames()) {
//             try {
//                 const isRealLiveStream = await frame.evaluate(() => {
//                     const vid = document.querySelector('video');
//                     return vid && vid.clientWidth > 100 && vid.clientHeight > 100;
//                 });
//                 if (isRealLiveStream) { targetFrame = frame; break; }
//             } catch (e) { }
//         }

//         if (!targetFrame) targetFrame = page.mainFrame();
//         await takeAndBatchScreenshot(page, 'video-located');

//         console.log('[*] Enforcing Black Background and Full Screen UI...');
//         await page.evaluate(() => {
//             document.body.style.backgroundColor = 'black';
//             document.body.style.overflow = 'hidden';
//             document.querySelectorAll('iframe').forEach(iframe => {
//                 iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
//                 iframe.style.width = '100vw'; iframe.style.height = '100vh';
//                 iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
//             });
//         }).catch(() => {});

//         await targetFrame.evaluate(async (muteVideo) => {
//             const style = document.createElement('style');
//             style.innerHTML = `
//                 .jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { 
//                     display: none !important; opacity: 0 !important; visibility: hidden !important;
//                 }
//             `;
//             document.head.appendChild(style);

//             const video = document.querySelector('video');
//             if (video) { 
//                 video.muted = muteVideo; 
//                 video.volume = 1.0; 
//                 video.style.position = 'fixed'; 
//                 video.style.top = '0'; video.style.left = '0';
//                 video.style.width = '100vw'; video.style.height = '100vh';
//                 video.style.zIndex = '2147483647'; 
//                 video.style.backgroundColor = 'black'; 
//                 video.style.objectFit = 'contain';
//             }
//         }, startMuted).catch(e => console.error("[Error] Video UI setup:", e.message));

//     } catch (e) {
//         console.error("[Error] at initializeVideo:", e.message);
//     }
// }

// // =========================================================================
// // 🔄 DUAL-TAB WATCHDOG & HOT-SWAP LOGIC
// // =========================================================================
// async function checkPageStatus(page) {
//     try {
//         for (const frame of page.frames()) {
//             const result = await frame.evaluate(() => {
//                 const bodyText = document.body.innerText.toLowerCase();
//                 if (bodyText.includes("stream error")) return { status: 'CRITICAL_ERROR' };
//                 const v = document.querySelector('video');
//                 if (v && !v.ended) return { status: 'HEALTHY', currentTime: v.currentTime };
//                 return { status: 'DEAD' };
//             });
//             if (result.status !== 'DEAD') return result;
//         }
//     } catch (e) {
//         return { status: 'DEAD' };
//     }
//     return { status: 'DEAD' };
// }

// async function startWatchdog() {
//     let lastActiveTime = -1;
//     let frozenCheckTimestamp = Date.now();
//     let watchdogTicks = 0;

//     while (true) {
//         if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

//         let activeStatus = await checkPageStatus(activePage);

//         if (activeStatus.status === 'HEALTHY') {
//             if (activeStatus.currentTime === lastActiveTime) {
//                 if (Date.now() - frozenCheckTimestamp > FROZEN_THRESHOLD_MS) {
//                     activeStatus.status = 'FROZEN';
//                 }
//             } else {
//                 lastActiveTime = activeStatus.currentTime;
//                 frozenCheckTimestamp = Date.now();
//             }
//         }

//         if (activeStatus.status === 'FROZEN' || activeStatus.status === 'CRITICAL_ERROR' || activeStatus.status === 'DEAD') {
//             console.log(`\n[!] ❌ WATCHDOG DETECTED ISSUE ON ACTIVE TAB: ${activeStatus.status}`);
//             await takeAndBatchScreenshot(activePage, `error-${activeStatus.status.toLowerCase()}`);
            
//             console.log(`[*] Checking Backup Tab status before switching...`);
//             let backupStatus = await checkPageStatus(backupPage);

//             if (backupStatus.status === 'HEALTHY') {
//                 console.log(`[+] Backup Tab is Healthy! Executing INSTANT HOT-SWAP ⚡`);
                
//                 await activePage.evaluate(() => { const v = document.querySelector('video'); if(v) v.muted = true; }).catch(e => console.error("Mute failed:", e.message));
//                 await backupPage.evaluate(() => { const v = document.querySelector('video'); if(v) v.muted = false; }).catch(e => console.error("Unmute failed:", e.message));
                
//                 await backupPage.bringToFront();
//                 console.log(`[+] Switch successful. Stream continues smoothly!`);

//                 let brokenPage = activePage;
//                 activePage = backupPage;
//                 backupPage = brokenPage;

//                 lastActiveTime = -1;
//                 frozenCheckTimestamp = Date.now();

//                 console.log(`[*] Recovering broken tab in background to serve as new backup...`);
//                 backupPage.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
//                     .then(() => initializeVideo(backupPage, true))
//                     .catch(e => console.error("[Error] Background recovery failed:", e.message));
                
//                 // ✨ Safety check: Ensure active page stays visible after background reload
//                 setTimeout(() => activePage.bringToFront().catch(()=>{}), 3000);

//             } else {
//                 console.error(`[!] ❌ Backup Tab is ALSO DEAD/FROZEN. Hard Restarting System...`);
//                 throw new Error("Both Active and Backup tabs failed.");
//             }
//         }

//         watchdogTicks++;
//         if (watchdogTicks % 120 === 0) await takeAndBatchScreenshot(activePage, `heartbeat-tick-${watchdogTicks}`);
        
//         await new Promise(r => setTimeout(r, 5000)); 
//     }
// }

// // =========================================================================
// // 🚀 MAIN LOOP & DIRECT STREAMING
// // =========================================================================
// async function startDirectStreaming() {
//     console.log(`[*] Starting OBS Studio FIRST...`);
//     setupOBSConfig();

//     console.log(`[+] Broadcasting via OBS STUDIO to OK.ru CHANNEL: ${SELECTED_CHANNEL}`);
    
//     obsProcess = spawn('obs', ['--startstreaming']);
//     obsProcess.stdout.on('data', (data) => console.log(`[OBS]: ${data.toString().trim()}`));
//     obsProcess.stderr.on('data', (data) => {
//         const msg = data.toString().trim();
//         if (msg.includes('error') || msg.includes('fail')) console.log(`[OBS Error]: ${msg}`);
//     });

//     console.log('[*] Waiting for OBS to initialize before launching browser...');
//     await new Promise(r => setTimeout(r, 8000));

//     // ✨ NEW: Connect OBS WS Early to guarantee Black Screen during setup
//     try {
//         await obs.connect('ws://127.0.0.1:4455', 'secret');
//         console.log('[+] OBS WebSocket Connected Early! Enforcing WaitingScene (Black Screen)...');
//         await obs.call('SetCurrentProgramScene', { sceneName: 'WaitingScene' });
//     } catch (e) { console.log('[-] Could not connect to OBS WebSocket early.'); }

//     console.log(`[*] Starting browser...`);
//     browser = await puppeteer.launch({
//         headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [
//             '--no-sandbox', '--disable-setuid-sandbox',
//             '--window-size=1280,720', '--kiosk', 
//             '--autoplay-policy=no-user-gesture-required'
//         ]
//     });

//     // Create Two Pages (Main & Backup)
//     activePage = (await browser.pages())[0]; 
//     backupPage = await browser.newPage();

//     console.log(`[*] Loading Target on Active Page: ${TARGET_URL}`);
//     await activePage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await takeAndBatchScreenshot(activePage, 'after-load-active');
//     await initializeVideo(activePage, false); // Muted = false

//     console.log(`[*] Loading Target on Backup Page (Muted): ${TARGET_URL}`);
//     await backupPage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await initializeVideo(backupPage, true); // Muted = true

//     // Bring the prepared Active Page to the front
//     await activePage.bringToFront();
    
//     // ✨ NEW: Everything is ready and fullscreen. Shift OBS to Live view!
//     console.log('\n[*] Browser Setup Complete! Shifting OBS from Black Screen to LIVE Video (MainScene)...');
//     try {
//         await obs.call('SetCurrentProgramScene', { sceneName: 'MainScene' });
//     } catch (e) { console.log('[-] Failed to shift OBS scene to MainScene.'); }

//     // Start the Hot-Swap Watchdog
//     await startWatchdog();
// }

// async function mainLoop() {
//     while (true) {
//         try {
//             await startDirectStreaming();
//         } catch (error) {
//             console.error(`\n[!] ALERT: ${error.message}`);
//             console.log('[*] 🔄 Hard Restarting everything in 3 seconds...');
//             await cleanup();
//             await new Promise(resolve => setTimeout(resolve, 3000));
//         }
//     }
// }

// // =========================================================================
// // 🧹 CLEANUP & ZOMBIE KILLER
// // =========================================================================
// async function cleanup() {
//     console.log('[*] Cleaning up resources...');
//     try { await obs.disconnect(); } catch (e) { } 
    
//     if (browser) { 
//         try { await browser.close(); } catch(e) { console.error("[Error] Browser Close:", e.message); } 
//         browser = null; 
//     }

//     if (obsProcess) { 
//         try { obsProcess.kill('SIGKILL'); } catch(e) { console.error("[Error] OBS Kill:", e.message); } 
//         obsProcess = null; 
//     }

//     try {
//         execSync('pkill -9 obs || true', { stdio: 'ignore' });
//         execSync('pkill -9 chrome || true', { stdio: 'ignore' });
//         execSync('pkill -9 puppeteer || true', { stdio: 'ignore' });
//     } catch (e) { /* Ignore */ }
// }

// process.on('SIGINT', async () => { await cleanup(); process.exit(0); });

// // =========================================================================
// // ⏱️ AUTO-OVERLAP OR EXACT DURATION LOGIC
// // =========================================================================
// const customDurationStr = process.env.CUSTOM_DURATION || 'None';

// function parseDurationToMs(str) {
//     if (!str || str.toLowerCase() === 'none') return null;
//     let ms = 0;
//     const hMatch = str.match(/(\d+)\s*h/i);
//     const mMatch = str.match(/(\d+)\s*m/i);
//     if (hMatch) ms += parseInt(hMatch[1]) * 60 * 60 * 1000;
//     if (mMatch) ms += parseInt(mMatch[1]) * 60 * 1000;
//     return ms > 0 ? ms : null;
// }

// const exactDurationMs = parseDurationToMs(customDurationStr);

// if (exactDurationMs) {
//     console.log(`\n[*] 🕒 Custom Duration Detected: ${customDurationStr} (${exactDurationMs / 60000} mins). System will auto-shutdown after this time.`);
    
//     setTimeout(async () => {
//         console.log(`\n[*] 🛑 Time's up! The assigned duration (${customDurationStr}) is complete. Shutting down cleanly...`);
//         await cleanup();
//         process.exit(0);
//     }, exactDurationMs);

// } else {
//     console.log(`\n[*] 🔄 No Custom Duration specified. Defaulting to 5h 50m Auto-Overlap loop.`);
    
//     setTimeout(() => {
//         console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
//         try {
//             const targetUrl = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
//             const channel = process.env.OKRU_STREAM_ID || '1';
//             const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
//             const server = process.env.SERVER_SELECTION || 'None';

//             const cmd = `gh workflow run main.yml -f target_url="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}" -f custom_duration="None"`;
            
//             console.log(`[*] Executing Command: ${cmd}`);
//             execSync(cmd, { stdio: 'inherit' });
            
//             console.log("[+] Next workflow run successfully triggered!");

//             setTimeout(async () => {
//                 console.log("\n[*] Handing over stream to next action. Shutting down cleanly...");
//                 await cleanup();
//                 process.exit(0);
//             }, 300000); 

//         } catch (err) {
//             console.error("[-] Failed to trigger next workflow using GH CLI:", err.message);
//         }
//     }, 21000000);
// }

// // 🚀 Start Execution
// mainLoop();











// 1


// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { spawn, execSync } = require('child_process');
// const { OBSWebSocket } = require('obs-websocket-js'); // 🌟 OBS WebSocket Library

// const obs = new OBSWebSocket(); // OBS instance

// // 🚀 Multi-Stream Key Manager
// const STREAM_KEYS = {
//     '1'   : '15254238731883_15281627925099_najspfkgne', 
//     '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
//     '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
//     '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
//     '2.1' : '15254308986475_15281761618539_3xca7oij3u',
//     '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

//     '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
//     '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
//     '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

//     '4'   : '15255022345835_15283095800427_vwrupxzstm', 
//     '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
//     '4.2' : '15255045480043_15283135842923_tldl4bhmii',
//     '4.3' : '15255208599147_15283449629291_abltofuc7m', 
//     '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
//     '4.5' : '15255227670123_15283486263915_jpntt54mve',

//     '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
//     '5.1' : '15273713933931_15317494860395_avj47smmim', 
//     '5.2' : '15273722257003_15317510195819_6edjluvdqi',
//     '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
//     '5.4' : '15273750175339_15317561707115_csel26ku5a', 
//     '5.5' : '15273760071275_15317579467371_cnewcj54me',
//     '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
//     '5.7' : '15273778683499_15317616560747_4piekvs4wu',

//     's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
//     's1.2'  : '14204288179759_14846247373359_tnsknmapva',
//     's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
//     's1.4'  : '14204331957807_14846326147631_dji2acqcze',
//     's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
//     's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
//     's1.7'  : '14204370492975_14846393649711_6fduhdqite',
//     's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
//     's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
//     's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

//     's2.1'  : '14204490948143_14846603495983_kzevn36tii',
//     's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
//     's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
//     's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
//     's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
//     's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
//     's2.7'  : '14204577259055_14846756194863_3ecad2535u',
//     's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
//     's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
//     's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
// };

// const TARGET_URL = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
// const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
// const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
// const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];

// let browser = null;
// let obsProcess = null;
// let activePage = null;
// let backupPage = null;

// const FROZEN_THRESHOLD_MS = 5000; 

// if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
// let pendingScreenshots = [];
// let uploadCycleCount = 0;

// async function takeAndBatchScreenshot(page, stepName) {
//     if (!page) return;
//     try {
//         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//         const filePath = `./screenshots/snap_${timestamp}_${stepName}.png`;
//         await page.screenshot({ path: filePath });
//         console.log(`[📸] Screenshot saved: ${filePath}`);
//         pendingScreenshots.push(filePath);

//         if (pendingScreenshots.length >= 3) {
//             console.log(`[🚀] 3 Screenshots collected. Triggering LIVE batch upload...`);
//             try {
//                 const tag = 'live-stream-logs';
//                 try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Logs"`, { stdio: 'ignore' }); } catch(e) {}
//                 try {
//                     const oldAssets = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim().split('\n');
//                     for (const asset of oldAssets) if (asset) execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
//                 } catch(e) {}

//                 const fileList = pendingScreenshots.join(' ');
//                 execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
//                 uploadCycleCount++;
//                 console.log(`[+] Live batch upload successful! (Total Cycles: ${uploadCycleCount})`);
//                 pendingScreenshots = []; 
//             } catch (err) { console.error("[Error] Batch Upload:", err.message); }
//         }
//     } catch (e) { console.error("[Error] Screenshot failed:", e.message); }
// }

// // =========================================================================
// // 🛠️ SETUP OBS CONFIGURATION DYNAMICALLY (UPDATED WITH WEBSOCKET & SCENES)
// // =========================================================================
// function setupOBSConfig() {
//     console.log('[*] Generating OBS Config files with WebSocket & Scenes...');
//     const obsDir = path.join(os.homedir(), '.config', 'obs-studio');
//     const profilesDir = path.join(obsDir, 'basic', 'profiles', 'Untitled');
//     const scenesDir = path.join(obsDir, 'basic', 'scenes');

//     fs.mkdirSync(profilesDir, { recursive: true });
//     fs.mkdirSync(scenesDir, { recursive: true });

//     const globalIniContent = `[General]\nLicenseAccepted=true\n[BasicWindow]\nShowAutoConfig=false\nWarned=true\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nServerPassword=secret\n`;
//     fs.writeFileSync(path.join(obsDir, 'global.ini'), globalIniContent);
//     fs.writeFileSync(path.join(profilesDir, 'basic.ini'), `[General]\nName=Untitled\n[Video]\nBaseCX=1280\nBaseCY=720\nOutputCX=1280\nOutputCY=720\nFPSCommon=30\n[Output]\nMode=Simple\n`);

//     const serviceJson = {
//         "settings": {
//             "server": "rtmp://vsu.okcdn.ru/input/",
//             "key": ACTIVE_STREAM_KEY
//         },
//         "type": "rtmp_custom"
//     };
//     fs.writeFileSync(path.join(profilesDir, 'service.json'), JSON.stringify(serviceJson, null, 2));

//     const sceneJson = {
//         "current_scene": "MainScene",
//         "current_program_scene": "MainScene",
//         "name": "Untitled",
//         "scene_order": [{"name": "MainScene"}, {"name": "WaitingScene"}],
//         "sources": [
//             { "id": "xshm_input", "name": "Screen", "settings": { "show_cursor": false } },
//             { "id": "pulse_output_capture", "name": "Audio", "settings": {} },
//             {
//                 "id": "scene", "name": "MainScene",
//                 "settings": { "items": [ {"name": "Screen", "id": 1, "visible": true}, {"name": "Audio", "id": 2, "visible": true} ] }
//             },
//             {
//                 "id": "scene", "name": "WaitingScene",
//                 "settings": { "items": [] } 
//             }
//         ]
//     };
//     fs.writeFileSync(path.join(scenesDir, 'Untitled.json'), JSON.stringify(sceneJson, null, 2));
//     console.log('[+] OBS Configurations injected successfully!');
// }

// // =========================================================================
// // 🎬 VIDEO INITIALIZATION (Play Button, Server, Smart Scan, Fullscreen)
// // =========================================================================
// async function initializeVideo(page, startMuted) {
//     try {
//         if (SERVER_SELECTION !== 'None') {
//             let serverClicked = false; let serverAttempts = 0;
//             while (!serverClicked && serverAttempts < 10) { 
//                 serverAttempts++;
//                 try {
//                     const clickSuccess = await page.evaluate((serverName) => {
//                         const buttons = Array.from(document.querySelectorAll('button'));
//                         const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
//                         if (targetBtn) { targetBtn.click(); return true; }
//                         return false;
//                     }, SERVER_SELECTION);

//                     if (clickSuccess) {
//                         serverClicked = true; await takeAndBatchScreenshot(page, `server-clicked`);
//                         await new Promise(r => setTimeout(r, 3000)); await page.bringToFront(); 
//                     } else await new Promise(r => setTimeout(r, 2000));
//                 } catch (err) { await new Promise(r => setTimeout(r, 2000)); }
//             }
//         }

//         console.log('[*] Hunting for the Play Button...');
//         let buttonClicked = false;
//         let attempts = 0;
        
//         while (!buttonClicked && attempts < 15) {
//             for (const frame of page.frames()) {
//                 try {
//                     const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"], .vjs-big-play-button');
//                     if (playBtn) {
//                         const isVisible = await frame.evaluate(el => {
//                             const style = window.getComputedStyle(el);
//                             return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
//                         }, playBtn);

//                         if (isVisible) {
//                             await frame.evaluate(el => el.click(), playBtn); 
//                             buttonClicked = true;
//                             await takeAndBatchScreenshot(page, `play-btn-clicked`);
//                             break; 
//                         }
//                     }
//                 } catch (err) {}
//             }
//             if (!buttonClicked) await new Promise(r => setTimeout(r, 2000));
//             attempts++;
//         }

//         console.log('[*] Scanning iframes for the REAL Live Stream Video...');
//         let targetFrame = null;
//         for (const frame of page.frames()) {
//             try {
//                 const isRealLiveStream = await frame.evaluate(() => {
//                     const vid = document.querySelector('video');
//                     return vid && vid.clientWidth > 100 && vid.clientHeight > 100;
//                 });
//                 if (isRealLiveStream) { targetFrame = frame; break; }
//             } catch (e) { }
//         }

//         if (!targetFrame) targetFrame = page.mainFrame();
//         await takeAndBatchScreenshot(page, 'video-located');

//         console.log('[*] Enforcing Black Background and Full Screen UI...');
//         await page.evaluate(() => {
//             document.body.style.backgroundColor = 'black';
//             document.body.style.overflow = 'hidden';
//             document.querySelectorAll('iframe').forEach(iframe => {
//                 iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
//                 iframe.style.width = '100vw'; iframe.style.height = '100vh';
//                 iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
//             });
//         }).catch(() => {});

//         await targetFrame.evaluate(async (muteVideo) => {
//             const style = document.createElement('style');
//             style.innerHTML = `
//                 .jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { 
//                     display: none !important; opacity: 0 !important; visibility: hidden !important;
//                 }
//             `;
//             document.head.appendChild(style);

//             const video = document.querySelector('video');
//             if (video) { 
//                 video.muted = muteVideo; 
//                 video.volume = 1.0; 
//                 video.style.position = 'fixed'; 
//                 video.style.top = '0'; video.style.left = '0';
//                 video.style.width = '100vw'; video.style.height = '100vh';
//                 video.style.zIndex = '2147483647'; 
//                 video.style.backgroundColor = 'black'; 
//                 video.style.objectFit = 'contain';
//             }
//         }, startMuted).catch(e => console.error("[Error] Video UI setup:", e.message));

//     } catch (e) {
//         console.error("[Error] at initializeVideo:", e.message);
//     }
// }

// // =========================================================================
// // 🔄 DUAL-TAB WATCHDOG & HOT-SWAP LOGIC
// // =========================================================================
// async function checkPageStatus(page) {
//     try {
//         for (const frame of page.frames()) {
//             const result = await frame.evaluate(() => {
//                 const bodyText = document.body.innerText.toLowerCase();
//                 if (bodyText.includes("stream error")) return { status: 'CRITICAL_ERROR' };
//                 const v = document.querySelector('video');
//                 if (v && !v.ended) return { status: 'HEALTHY', currentTime: v.currentTime };
//                 return { status: 'DEAD' };
//             });
//             if (result.status !== 'DEAD') return result;
//         }
//     } catch (e) {
//         return { status: 'DEAD' };
//     }
//     return { status: 'DEAD' };
// }

// async function startWatchdog() {
//     let lastActiveTime = -1;
//     let frozenCheckTimestamp = Date.now();
//     let watchdogTicks = 0;

//     while (true) {
//         if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

//         let activeStatus = await checkPageStatus(activePage);

//         if (activeStatus.status === 'HEALTHY') {
//             if (activeStatus.currentTime === lastActiveTime) {
//                 if (Date.now() - frozenCheckTimestamp > FROZEN_THRESHOLD_MS) {
//                     activeStatus.status = 'FROZEN';
//                 }
//             } else {
//                 lastActiveTime = activeStatus.currentTime;
//                 frozenCheckTimestamp = Date.now();
//             }
//         }

//         if (activeStatus.status === 'FROZEN' || activeStatus.status === 'CRITICAL_ERROR' || activeStatus.status === 'DEAD') {
//             console.log(`\n[!] ❌ WATCHDOG DETECTED ISSUE ON ACTIVE TAB: ${activeStatus.status}`);
//             await takeAndBatchScreenshot(activePage, `error-${activeStatus.status.toLowerCase()}`);
            
//             console.log(`[*] Checking Backup Tab status before switching...`);
//             let backupStatus = await checkPageStatus(backupPage);

//             if (backupStatus.status === 'HEALTHY') {
//                 console.log(`[+] Backup Tab is Healthy! Executing INSTANT HOT-SWAP ⚡`);
                
//                 await activePage.evaluate(() => { const v = document.querySelector('video'); if(v) v.muted = true; }).catch(e => console.error("Mute failed:", e.message));
//                 await backupPage.evaluate(() => { const v = document.querySelector('video'); if(v) v.muted = false; }).catch(e => console.error("Unmute failed:", e.message));
                
//                 await backupPage.bringToFront();
//                 console.log(`[+] Switch successful. Stream continues smoothly!`);

//                 let brokenPage = activePage;
//                 activePage = backupPage;
//                 backupPage = brokenPage;

//                 lastActiveTime = -1;
//                 frozenCheckTimestamp = Date.now();

//                 console.log(`[*] Recovering broken tab in background to serve as new backup...`);
//                 backupPage.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
//                     .then(() => initializeVideo(backupPage, true))
//                     .catch(e => console.error("[Error] Background recovery failed:", e.message));

//             } else {
//                 console.error(`[!] ❌ Backup Tab is ALSO DEAD/FROZEN. Hard Restarting System...`);
//                 throw new Error("Both Active and Backup tabs failed.");
//             }
//         }

//         watchdogTicks++;
//         if (watchdogTicks % 120 === 0) await takeAndBatchScreenshot(activePage, `heartbeat-tick-${watchdogTicks}`);
        
//         await new Promise(r => setTimeout(r, 5000)); 
//     }
// }

// // =========================================================================
// // 🚀 MAIN LOOP & DIRECT STREAMING
// // =========================================================================
// async function startDirectStreaming() {
//     console.log(`[*] Starting OBS Studio FIRST...`);
//     setupOBSConfig();

//     console.log(`[+] Broadcasting via OBS STUDIO to OK.ru CHANNEL: ${SELECTED_CHANNEL}`);
    
//     obsProcess = spawn('obs', ['--startstreaming']);
//     obsProcess.stdout.on('data', (data) => console.log(`[OBS]: ${data.toString().trim()}`));
//     obsProcess.stderr.on('data', (data) => {
//         const msg = data.toString().trim();
//         if (msg.includes('error') || msg.includes('fail')) console.log(`[OBS Error]: ${msg}`);
//     });

//     console.log('[*] Waiting for OBS to initialize before launching browser...');
//     await new Promise(r => setTimeout(r, 8000));

//     console.log(`[*] Starting browser...`);
//     browser = await puppeteer.launch({
//         headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [
//             '--no-sandbox', '--disable-setuid-sandbox',
//             '--window-size=1280,720', '--kiosk', 
//             '--autoplay-policy=no-user-gesture-required'
//         ]
//     });

//     // 🌟 Create Two Pages (Main & Backup)
//     activePage = (await browser.pages())[0]; 
//     backupPage = await browser.newPage();

//     console.log(`[*] Loading Target on Active Page...`);
//     await activePage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await takeAndBatchScreenshot(activePage, 'after-load-active');
//     await initializeVideo(activePage, false); // Muted = false

//     console.log(`[*] Loading Target on Backup Page (Muted)...`);
//     await backupPage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await initializeVideo(backupPage, true); // Muted = true

//     await activePage.bringToFront();
    
//     console.log('\n[*] OBS Engine Connected! Dual-Tab Monitoring Active...');
//     try {
//         await obs.connect('ws://127.0.0.1:4455', 'secret');
//         console.log('[+] Connected to OBS WebSocket successfully!');
//     } catch (e) { console.log('[-] Could not connect to OBS WebSocket. Scene switching might fail.'); }

//     // Start the Hot-Swap Watchdog
//     await startWatchdog();
// }

// async function mainLoop() {
//     while (true) {
//         try {
//             await startDirectStreaming();
//         } catch (error) {
//             console.error(`\n[!] ALERT: ${error.message}`);
//             console.log('[*] 🔄 Hard Restarting everything in 3 seconds...');
//             await cleanup();
//             await new Promise(resolve => setTimeout(resolve, 3000));
//         }
//     }
// }

// // =========================================================================
// // 🧹 CLEANUP & ZOMBIE KILLER
// // =========================================================================
// async function cleanup() {
//     console.log('[*] Cleaning up resources...');
//     try { await obs.disconnect(); } catch (e) { } 
    
//     if (browser) { 
//         try { await browser.close(); } catch(e) { console.error("[Error] Browser Close:", e.message); } 
//         browser = null; 
//     }

//     if (obsProcess) { 
//         try { obsProcess.kill('SIGKILL'); } catch(e) { console.error("[Error] OBS Kill:", e.message); } 
//         obsProcess = null; 
//     }

//     try {
//         execSync('pkill -9 obs || true', { stdio: 'ignore' });
//         execSync('pkill -9 chrome || true', { stdio: 'ignore' });
//         execSync('pkill -9 puppeteer || true', { stdio: 'ignore' });
//     } catch (e) { /* Ignore */ }
// }

// process.on('SIGINT', async () => { await cleanup(); process.exit(0); });

// // =========================================================================
// // ⏱️ AUTO-OVERLAP OR EXACT DURATION LOGIC
// // =========================================================================
// const customDurationStr = process.env.CUSTOM_DURATION || 'None';

// function parseDurationToMs(str) {
//     if (!str || str.toLowerCase() === 'none') return null;
//     let ms = 0;
//     const hMatch = str.match(/(\d+)\s*h/i);
//     const mMatch = str.match(/(\d+)\s*m/i);
//     if (hMatch) ms += parseInt(hMatch[1]) * 60 * 60 * 1000;
//     if (mMatch) ms += parseInt(mMatch[1]) * 60 * 1000;
//     return ms > 0 ? ms : null;
// }

// const exactDurationMs = parseDurationToMs(customDurationStr);

// if (exactDurationMs) {
//     console.log(`\n[*] 🕒 Custom Duration Detected: ${customDurationStr} (${exactDurationMs / 60000} mins). System will auto-shutdown after this time.`);
    
//     setTimeout(async () => {
//         console.log(`\n[*] 🛑 Time's up! The assigned duration (${customDurationStr}) is complete. Shutting down cleanly...`);
//         await cleanup();
//         process.exit(0);
//     }, exactDurationMs);

// } else {
//     console.log(`\n[*] 🔄 No Custom Duration specified. Defaulting to 5h 50m Auto-Overlap loop.`);
    
//     setTimeout(() => {
//         console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
//         try {
//             const targetUrl = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
//             const channel = process.env.OKRU_STREAM_ID || '1';
//             const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
//             const server = process.env.SERVER_SELECTION || 'None';

//             const cmd = `gh workflow run main.yml -f target_url="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}" -f custom_duration="None"`;
            
//             console.log(`[*] Executing Command: ${cmd}`);
//             execSync(cmd, { stdio: 'inherit' });
            
//             console.log("[+] Next workflow run successfully triggered!");

//             setTimeout(async () => {
//                 console.log("\n[*] Handing over stream to next action. Shutting down cleanly...");
//                 await cleanup();
//                 process.exit(0);
//             }, 300000); 

//         } catch (err) {
//             console.error("[-] Failed to trigger next workflow using GH CLI:", err.message);
//         }
//     }, 21000000);
// }

// // 🚀 Start Execution
// mainLoop();





















// ================================= yeh below few code tiktok k liye hai imagges banana lekin aab bas upper mei sabsee bottom wala code like just focus on stream =======================




// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { spawn, execSync } = require('child_process');
// const { OBSWebSocket } = require('obs-websocket-js'); // 🌟 OBS WebSocket Library

// const obs = new OBSWebSocket(); // OBS instance

// // 🚀 Multi-Stream Key Manager
// const STREAM_KEYS = {
//     '1'   : '15254238731883_15281627925099_najspfkgne', 
//     '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
//     '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
//     '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
//     '2.1' : '15254308986475_15281761618539_3xca7oij3u',
//     '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

//     '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
//     '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
//     '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

//     '4'   : '15255022345835_15283095800427_vwrupxzstm', 
//     '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
//     '4.2' : '15255045480043_15283135842923_tldl4bhmii',
//     '4.3' : '15255208599147_15283449629291_abltofuc7m', 
//     '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
//     '4.5' : '15255227670123_15283486263915_jpntt54mve',

//     '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
//     '5.1' : '15273713933931_15317494860395_avj47smmim', 
//     '5.2' : '15273722257003_15317510195819_6edjluvdqi',
//     '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
//     '5.4' : '15273750175339_15317561707115_csel26ku5a', 
//     '5.5' : '15273760071275_15317579467371_cnewcj54me',
//     '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
//     '5.7' : '15273778683499_15317616560747_4piekvs4wu',

//     's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
//     's1.2'  : '14204288179759_14846247373359_tnsknmapva',
//     's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
//     's1.4'  : '14204331957807_14846326147631_dji2acqcze',
//     's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
//     's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
//     's1.7'  : '14204370492975_14846393649711_6fduhdqite',
//     's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
//     's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
//     's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

//     's2.1'  : '14204490948143_14846603495983_kzevn36tii',
//     's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
//     's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
//     's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
//     's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
//     's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
//     's2.7'  : '14204577259055_14846756194863_3ecad2535u',
//     's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
//     's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
//     's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
// };

// const TARGET_URL = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
// const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
// const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
// const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];

// let browser = null;
// let obsProcess = null;

// let lastVideoTime = -1;
// let frozenCheckTimestamp = Date.now();
// const FROZEN_THRESHOLD_MS = 5000; 

// if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
// let pendingScreenshots = [];
// let uploadCycleCount = 0;

// // =========================================================================
// // 🧹 GLOBAL STARTUP CLEANUP (DELETE ALL IMAGES)
// // =========================================================================
// async function performStartupCleanup() {
//     console.log(`\n[*] Running Initial Startup Cleanup... Checking for existing images.`);
//     const jitterMs = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
//     await new Promise(r => setTimeout(r, jitterMs));

//     try {
//         const tag = 'live-stream-logs';
//         try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Logs"`, { stdio: 'ignore' }); } catch(e) {}
        
//         const allAssetsRaw = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim();
        
//         if (allAssetsRaw) {
//             const allAssets = allAssetsRaw.split('\n').filter(a => a.trim() !== '');
//             if (allAssets.length > 0) {
//                 console.log(`[*] Found ${allAssets.length} old images. Deleting EVERYTHING...`);
//                 for (const asset of allAssets) {
//                     try {
//                         execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
//                     } catch (delErr) {}
//                 }
//                 console.log(`[+] Global Startup Cleanup Complete! Slate is clean.`);
//             }
//         }
//     } catch (err) {
//         console.log(`[-] Startup cleanup skipped or minor issue: ${err.message}`);
//     }
// }

// // =========================================================================
// // 📸 SMART SCREENSHOT & UPLOAD MANAGER (FAST UPLOAD, NO DELETE LAG)
// // =========================================================================
// async function takeAndBatchScreenshot(page, stepName, forceUpload = false) {
//     try {
//         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//         const fileName = `ch-${SELECTED_CHANNEL}_${timestamp}_${stepName}.png`;
//         const filePath = `./screenshots/${fileName}`;
        
//         await page.screenshot({ path: filePath });
//         console.log(`[📸] Screenshot saved: ${filePath}`);
//         pendingScreenshots.push(filePath);

//         if (pendingScreenshots.length >= 3 || forceUpload) {
//             console.log(`[🚀] Upload criteria met. Triggering FAST batch upload...`);
            
//             const tag = 'live-stream-logs';
//             try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Logs"`, { stdio: 'ignore' }); } catch(e) {}
            
//             // Note: Remove old deletion loop from here to fix the 40-minute lag!
            
//             const fileList = pendingScreenshots.join(' ');
//             let retries = 3;
//             let uploadSuccess = false;

//             while (retries > 0 && !uploadSuccess) {
//                 try {
//                     // Clobber uploads images immediately
//                     execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
//                     uploadSuccess = true;
//                 } catch (err) {
//                     retries--;
//                     console.log(`[!] Upload failed. Retries left: ${retries}. Waiting 2s...`);
//                     if (retries > 0) await new Promise(r => setTimeout(r, 2000));
//                 }
//             }

//             if (uploadSuccess) {
//                 uploadCycleCount++;
//                 console.log(`[+] Fast batch upload successful! (Total Cycles: ${uploadCycleCount})`);
//             } else {
//                 console.log(`[-] Batch upload failed completely after retries.`);
//             }
            
//             // Delete local files after uploading so they don't pile up on the runner
//             pendingScreenshots.forEach(file => { try { fs.unlinkSync(file) } catch(e){} });
//             pendingScreenshots = []; 
//         }
//     } catch (e) {
//         console.error(`[-] Screenshot capture error: ${e.message}`);
//     }
// }

// // =========================================================================
// // 🛠️ SETUP OBS CONFIGURATION
// // =========================================================================
// function setupOBSConfig() {
//     console.log('[*] Generating OBS Config files with WebSocket & Scenes...');
//     const obsDir = path.join(os.homedir(), '.config', 'obs-studio');
//     const profilesDir = path.join(obsDir, 'basic', 'profiles', 'Untitled');
//     const scenesDir = path.join(obsDir, 'basic', 'scenes');

//     fs.mkdirSync(profilesDir, { recursive: true });
//     fs.mkdirSync(scenesDir, { recursive: true });

//     const globalIniContent = `[General]\nLicenseAccepted=true\n[BasicWindow]\nShowAutoConfig=false\nWarned=true\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nServerPassword=secret\n`;
//     fs.writeFileSync(path.join(obsDir, 'global.ini'), globalIniContent);
//     fs.writeFileSync(path.join(profilesDir, 'basic.ini'), `[General]\nName=Untitled\n[Video]\nBaseCX=1280\nBaseCY=720\nOutputCX=1280\nOutputCY=720\nFPSCommon=30\n[Output]\nMode=Simple\n`);

//     const serviceJson = {
//         "settings": { "server": "rtmp://vsu.okcdn.ru/input/", "key": ACTIVE_STREAM_KEY },
//         "type": "rtmp_custom"
//     };
//     fs.writeFileSync(path.join(profilesDir, 'service.json'), JSON.stringify(serviceJson, null, 2));

//     const sceneJson = {
//         "current_scene": "MainScene",
//         "current_program_scene": "MainScene",
//         "name": "Untitled",
//         "scene_order": [{"name": "MainScene"}, {"name": "WaitingScene"}],
//         "sources": [
//             { "id": "xshm_input", "name": "Screen", "settings": { "show_cursor": false } },
//             { "id": "pulse_output_capture", "name": "Audio", "settings": {} },
//             { "id": "scene", "name": "MainScene", "settings": { "items": [ {"name": "Screen", "id": 1, "visible": true}, {"name": "Audio", "id": 2, "visible": true} ] } },
//             { "id": "scene", "name": "WaitingScene", "settings": { "items": [] } }
//         ]
//     };
//     fs.writeFileSync(path.join(scenesDir, 'Untitled.json'), JSON.stringify(sceneJson, null, 2));
// }

// // =========================================================================
// // 🎬 VIDEO INITIALIZATION
// // =========================================================================
// async function initializeVideo(page) {
//     if (SERVER_SELECTION !== 'None') {
//         let serverClicked = false; let serverAttempts = 0;
//         while (!serverClicked && serverAttempts < 10) { 
//             serverAttempts++;
//             try {
//                 const clickSuccess = await page.evaluate((serverName) => {
//                     const buttons = Array.from(document.querySelectorAll('button'));
//                     const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
//                     if (targetBtn) { targetBtn.click(); return true; }
//                     return false;
//                 }, SERVER_SELECTION);

//                 if (clickSuccess) {
//                     serverClicked = true; 
//                     await new Promise(r => setTimeout(r, 3000)); await page.bringToFront(); 
//                 } else await new Promise(r => setTimeout(r, 2000));
//             } catch (err) { await new Promise(r => setTimeout(r, 2000)); }
//         }
//     }

//     console.log('[*] Hunting for the Play Button...');
//     let buttonClicked = false;
//     let attempts = 0;
    
//     while (!buttonClicked && attempts < 15) {
//         for (const frame of page.frames()) {
//             try {
//                 const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"], .vjs-big-play-button');
//                 if (playBtn) {
//                     const isVisible = await frame.evaluate(el => {
//                         const style = window.getComputedStyle(el);
//                         return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
//                     }, playBtn);

//                     if (isVisible) {
//                         console.log(`[+] Play button mil gaya! Click kar raha hoon...`);
//                         await frame.evaluate(el => el.click(), playBtn); 
//                         buttonClicked = true;
//                         break; 
//                     }
//                 }
//             } catch (err) {}
//         }
//         await new Promise(r => setTimeout(r, 2000));
//         attempts++;
//     }

//     console.log('[*] Scanning iframes for the REAL Live Stream Video...');
//     let targetFrame = null;
//     for (const frame of page.frames()) {
//         try {
//             const isRealLiveStream = await frame.evaluate(() => {
//                 const vid = document.querySelector('video');
//                 return vid && vid.clientWidth > 100 && vid.clientHeight > 100;
//             });
//             if (isRealLiveStream) { targetFrame = frame; break; }
//         } catch (e) { }
//     }

//     if (!targetFrame) targetFrame = page.mainFrame();

//     console.log('[*] Enforcing Black Background and Full Screen UI...');
//     await page.evaluate(() => {
//         document.body.style.backgroundColor = 'black';
//         document.body.style.overflow = 'hidden';
//         document.querySelectorAll('iframe').forEach(iframe => {
//             iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
//             iframe.style.width = '100vw'; iframe.style.height = '100vh';
//             iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
//         });
//     }).catch(() => {});

//     await targetFrame.evaluate(async () => {
//         const style = document.createElement('style');
//         style.innerHTML = `.jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { display: none !important; opacity: 0 !important; visibility: hidden !important; }`;
//         document.head.appendChild(style);

//         const video = document.querySelector('video');
//         if (video) { 
//             video.muted = false; video.volume = 1.0; 
//             video.style.position = 'fixed'; video.style.top = '0'; video.style.left = '0';
//             video.style.width = '100vw'; video.style.height = '100vh';
//             video.style.zIndex = '2147483647'; video.style.backgroundColor = 'black'; video.style.objectFit = 'contain';
//         }
//     }).catch(()=>{});
// }

// // =========================================================================
// // 🔄 SMART RECOVERY LOGIC
// // =========================================================================
// async function handleRecovery(reason, page) {
//     try {
//         console.log(`\n[🔄] STARTING RECOVERY SEQUENCE DUE TO: ${reason}`);
//         try { await obs.call('SetCurrentProgramScene', { sceneName: 'WaitingScene' }); } catch(e) {}

//         console.log(`[*] Reloading Video Page in background...`);
//         await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
//         await new Promise(r => setTimeout(r, 5000)); 

//         console.log(`[*] Re-initializing Video Player and Fullscreen...`);
//         await initializeVideo(page);

//         lastVideoTime = -1;
//         frozenCheckTimestamp = Date.now();

//         try { await obs.call('SetCurrentProgramScene', { sceneName: 'MainScene' }); } catch(e) {}
//         console.log(`[+] Recovery Complete. Stream is Live again smoothly!`);
//     } catch (err) {
//         console.log(`[!] Recovery Failed: ${err.message}. Force Restarting...`);
//         throw err; 
//     }
// }

// // =========================================================================
// // 🚀 MAIN LOOP & DIRECT STREAMING
// // =========================================================================
// async function mainLoop() {
//     while (true) {
//         try {
//             await startDirectStreaming();
//         } catch (error) {
//             console.error(`\n[!] ALERT: ${error.message}`);
//             await cleanup();
//             await new Promise(resolve => setTimeout(resolve, 3000));
//         }
//     }
// }

// async function startDirectStreaming() {
//     await performStartupCleanup();

//     console.log(`[*] Starting OBS Studio FIRST...`);
//     setupOBSConfig();
    
//     obsProcess = spawn('obs', ['--startstreaming']);
//     obsProcess.stdout.on('data', (data) => console.log(`[OBS]: ${data.toString().trim()}`));
//     obsProcess.stderr.on('data', (data) => {
//         const msg = data.toString().trim();
//         if (msg.includes('error') || msg.includes('fail')) console.log(`[OBS Error]: ${msg}`);
//     });

//     await new Promise(r => setTimeout(r, 8000));

//     console.log(`[*] Starting browser...`);
//     browser = await puppeteer.launch({
//         headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,720', '--kiosk', '--autoplay-policy=no-user-gesture-required']
//     });

//     const page = await browser.newPage();
//     const pages = await browser.pages();
//     for (const p of pages) { if (p !== page) await p.close(); }

//     browser.on('targetcreated', async (target) => {
//         if (target.type() === 'page') {
//             try {
//                 const newPage = await target.page();
//                 if (newPage && newPage !== page) { await page.bringToFront(); await newPage.close(); }
//             } catch (e) {}
//         }
//     });

//     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await initializeVideo(page);

//     try {
//         await obs.connect('ws://127.0.0.1:4455', 'secret');
//         console.log('[+] Connected to OBS WebSocket successfully!');
//     } catch (e) {}

//     let watchdogTicks = 0;
//     while (true) {
//         if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

//         let overallStatus = 'DEAD'; let currentVideoTime = -1; let criticalErrorFound = false;

//         for (const frame of page.frames()) {
//             try {
//                 const result = await frame.evaluate(() => {
//                     const bodyText = document.body.innerText.toLowerCase();
//                     if (bodyText.includes("stream error")) return { status: 'CRITICAL_ERROR' };
//                     const v = document.querySelector('video');
//                     if (v && !v.ended) return { status: 'HEALTHY', currentTime: v.currentTime };
//                     return { status: 'DEAD' };
//                 });
//                 if (result.status === 'CRITICAL_ERROR') criticalErrorFound = true;
//                 if (result.status === 'HEALTHY') { overallStatus = 'HEALTHY'; currentVideoTime = result.currentTime; }
//             } catch (e) {}
//         }

//         if (overallStatus === 'HEALTHY' && currentVideoTime !== -1) {
//             const now = Date.now();
//             if (currentVideoTime === lastVideoTime) {
//                 if (now - frozenCheckTimestamp > FROZEN_THRESHOLD_MS) overallStatus = 'FROZEN';
//             } else { lastVideoTime = currentVideoTime; frozenCheckTimestamp = now; }
//         }

//         // Recovery Logic
//         if (criticalErrorFound) await handleRecovery('CRITICAL_ERROR', page);
//         else if (overallStatus === 'DEAD') await handleRecovery('DEAD', page);
//         else if (overallStatus === 'FROZEN') await handleRecovery('FROZEN', page);

//         watchdogTicks++;
        
//         // 🌟 NAYA LOGIC 1: HAR 1 MINUTE BAAD UPLOAD KAREGA (12 ticks * 5s = 60 seconds)
//         if (watchdogTicks % 12 === 0) {
//             if (overallStatus === 'HEALTHY' && !criticalErrorFound) {
//                 console.log(`\n[*] Taking 3 sequential live-thumbnail screenshots for 1-minute interval...`);
//                 for (let i = 1; i <= 3; i++) {
//                     const shouldForceUpload = (i === 3);
//                     await takeAndBatchScreenshot(page, `live-thumbnail-seq${i}`, shouldForceUpload);
//                     if (i < 3) await new Promise(r => setTimeout(r, 1000));
//                 }
//             } else {
//                 console.log(`[*] Skipping live-thumbnail capture due to unhealthy stream.`);
//             }
//         }
        
//         // 🌟 NAYA LOGIC 2: HAR 30 MINUTES BAAD 50% OLD IMAGES DELETE KAREGA (360 ticks * 5s = 1800s)
//         if (watchdogTicks > 0 && watchdogTicks % 360 === 0) {
//             console.log(`\n🧹 [30-MIN CLEANUP] Deleting 50% of old images to free up GitHub space...`);
//             try {
//                 const tag = 'live-stream-logs';
//                 const oldAssetsRaw = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim();
//                 if (oldAssetsRaw) {
//                     const allAssets = oldAssetsRaw.split('\n').filter(a => a.startsWith(`ch-${SELECTED_CHANNEL}_`));
//                     if (allAssets.length > 0) {
//                         allAssets.sort(); // Purani dates oopar aa jayengi
//                         const deleteCount = Math.floor(allAssets.length / 2); // Half delete karni hain
                        
//                         console.log(`[*] Found ${allAssets.length} total images for this channel. Deleting oldest ${deleteCount}...`);
//                         for (let i = 0; i < deleteCount; i++) {
//                             const assetToDelete = allAssets[i];
//                             try {
//                                 execSync(`gh release delete-asset ${tag} "${assetToDelete}" -y`, { stdio: 'ignore' });
//                             } catch (e) {}
//                         }
//                         console.log(`[+] 30-Min Cleanup complete! System is light again.`);
//                     }
//                 }
//             } catch (err) {
//                 console.log(`[-] 30-Min cleanup issue: ${err.message}`);
//             }
//         }
        
//         await new Promise(r => setTimeout(r, 5000)); 
//     }
// }

// async function cleanup() {
//     try { await obs.disconnect(); } catch (e) {} 
//     if (obsProcess) { try { obsProcess.kill('SIGKILL'); } catch(e){} obsProcess = null; }
//     if (browser) { try { await browser.close(); } catch(e){} browser = null; }
// }

// process.on('SIGINT', async () => { await cleanup(); process.exit(0); });

// // =========================================================================
// // ⏱️ AUTO-OVERLAP OR EXACT DURATION LOGIC
// // =========================================================================
// const customDurationStr = process.env.CUSTOM_DURATION || 'None';

// function parseDurationToMs(str) {
//     if (!str || str.toLowerCase() === 'none') return null;
//     let ms = 0;
//     const hMatch = str.match(/(\d+)\s*h/i);
//     const mMatch = str.match(/(\d+)\s*m/i);
//     if (hMatch) ms += parseInt(hMatch[1]) * 60 * 60 * 1000;
//     if (mMatch) ms += parseInt(mMatch[1]) * 60 * 1000;
//     return ms > 0 ? ms : null;
// }

// const exactDurationMs = parseDurationToMs(customDurationStr);

// if (exactDurationMs) {
//     console.log(`\n[*] 🕒 Custom Duration Detected: ${customDurationStr}. System will auto-shutdown after this time.`);
//     setTimeout(async () => {
//         console.log(`\n[*] 🛑 Time's up! Shutting down cleanly...`);
//         await cleanup();
//         process.exit(0);
//     }, exactDurationMs);
// } else {
//     console.log(`\n[*] 🔄 No Custom Duration specified. Defaulting to 5h 50m Auto-Overlap loop.`);
//     setTimeout(() => {
//         console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
//         try {
//             const { execSync } = require('child_process');
//             const targetUrl = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
//             const channel = process.env.OKRU_STREAM_ID || '1';
//             const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
//             const server = process.env.SERVER_SELECTION || 'None';

//             const cmd = `gh workflow run main.yml -f target_url="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}" -f custom_duration="None"`;
//             execSync(cmd, { stdio: 'inherit' });
//             console.log("[+] Next workflow run successfully triggered!");

//             setTimeout(async () => {
//                 await cleanup();
//                 process.exit(0);
//             }, 300000); 
//         } catch (err) {}
//     }, 21000000);
// }

// mainLoop();

















// 1


// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { spawn, execSync } = require('child_process');
// const { OBSWebSocket } = require('obs-websocket-js'); // 🌟 OBS WebSocket Library

// const obs = new OBSWebSocket(); // OBS instance

// // 🚀 Multi-Stream Key Manager
// const STREAM_KEYS = {
//     '1'   : '15254238731883_15281627925099_najspfkgne', 
//     '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
//     '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
//     '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
//     '2.1' : '15254308986475_15281761618539_3xca7oij3u',
//     '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

//     '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
//     '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
//     '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

//     '4'   : '15255022345835_15283095800427_vwrupxzstm', 
//     '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
//     '4.2' : '15255045480043_15283135842923_tldl4bhmii',
//     '4.3' : '15255208599147_15283449629291_abltofuc7m', 
//     '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
//     '4.5' : '15255227670123_15283486263915_jpntt54mve',

//     '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
//     '5.1' : '15273713933931_15317494860395_avj47smmim', 
//     '5.2' : '15273722257003_15317510195819_6edjluvdqi',
//     '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
//     '5.4' : '15273750175339_15317561707115_csel26ku5a', 
//     '5.5' : '15273760071275_15317579467371_cnewcj54me',
//     '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
//     '5.7' : '15273778683499_15317616560747_4piekvs4wu',

//     's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
//     's1.2'  : '14204288179759_14846247373359_tnsknmapva',
//     's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
//     's1.4'  : '14204331957807_14846326147631_dji2acqcze',
//     's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
//     's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
//     's1.7'  : '14204370492975_14846393649711_6fduhdqite',
//     's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
//     's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
//     's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

//     's2.1'  : '14204490948143_14846603495983_kzevn36tii',
//     's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
//     's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
//     's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
//     's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
//     's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
//     's2.7'  : '14204577259055_14846756194863_3ecad2535u',
//     's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
//     's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
//     's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
// };

// const TARGET_URL = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
// const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
// const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
// const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];

// let browser = null;
// let obsProcess = null;

// let lastVideoTime = -1;
// let frozenCheckTimestamp = Date.now();
// const FROZEN_THRESHOLD_MS = 5000; 

// if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
// let pendingScreenshots = [];
// let uploadCycleCount = 0;

// // =========================================================================
// // 🧹 GLOBAL STARTUP CLEANUP (DELETE ALL IMAGES)
// // =========================================================================
// async function performStartupCleanup() {
//     console.log(`\n[*] Running Initial Startup Cleanup... Checking for existing images.`);
    
//     // Random wait (2 to 5 seconds) so if 2 actions start exactly together, they don't crash
//     const jitterMs = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
//     await new Promise(r => setTimeout(r, jitterMs));

//     try {
//         const tag = 'live-stream-logs';
//         try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Logs"`, { stdio: 'ignore' }); } catch(e) {}
        
//         const allAssetsRaw = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim();
        
//         if (allAssetsRaw) {
//             const allAssets = allAssetsRaw.split('\n').filter(a => a.trim() !== '');
//             if (allAssets.length > 0) {
//                 console.log(`[*] Found ${allAssets.length} old images. Deleting EVERYTHING...`);
//                 for (const asset of allAssets) {
//                     try {
//                         execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
//                     } catch (delErr) {
//                         // Crash protection: Agar koi aur action isay already delete kar chuka ho, toh ignore karo
//                     }
//                 }
//                 console.log(`[+] Global Startup Cleanup Complete! Slate is clean.`);
//             } else {
//                 console.log(`[*] Release is already empty. Nothing to delete.`);
//             }
//         } else {
//             console.log(`[*] Release is already empty. Nothing to delete.`);
//         }
//     } catch (err) {
//         console.log(`[-] Startup cleanup skipped or minor issue: ${err.message}`);
//     }
// }

// // =========================================================================
// // 📸 SMART SCREENSHOT & UPLOAD MANAGER (WITH QUEUE, CLEANUP & RETRY)
// // =========================================================================
// async function takeAndBatchScreenshot(page, stepName, forceUpload = false) {
//     try {
//         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//         // 🌟 Smart Naming: ch-ID_Time_Step.png
//         const fileName = `ch-${SELECTED_CHANNEL}_${timestamp}_${stepName}.png`;
//         const filePath = `./screenshots/${fileName}`;
        
//         await page.screenshot({ path: filePath });
//         console.log(`[📸] Screenshot saved: ${filePath}`);
//         pendingScreenshots.push(filePath);

//         // Upload triggers if we hit 3 images OR if we explicitly force it (forceUpload = true)
//         if (pendingScreenshots.length >= 3 || forceUpload) {
//             console.log(`[🚀] Upload criteria met. Triggering LIVE batch upload...`);
            
//             // 🌟 1. The "Jitter" Phase (Random wait to avoid API clashes)
//             const jitterMs = Math.floor(Math.random() * (10000 - 2000 + 1)) + 2000; // Wait between 2-10 seconds
//             console.log(`[*] Waiting for ${jitterMs}ms to avoid GitHub API clash...`);
//             await new Promise(r => setTimeout(r, jitterMs));

//             try {
//                 const tag = 'live-stream-logs';
//                 try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Logs"`, { stdio: 'ignore' }); } catch(e) {}
                
//                 // 🌟 2. Smart Cleanup: Delete ONLY this specific channel's old screenshots OF THE SAME TYPE
//                 try {
//                     const oldAssetsRaw = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim();
//                     if (oldAssetsRaw) {
//                         const oldAssets = oldAssetsRaw.split('\n');
                        
//                         // Determine if current upload is an error or a thumbnail
//                         const isErrorUpload = stepName.includes('error') || stepName.includes('located') || stepName.includes('clicked');
                        
//                         const myOldAssets = oldAssets.filter(asset => {
//                             if (!asset.startsWith(`ch-${SELECTED_CHANNEL}_`)) return false;
                            
//                             // If uploading an error/status, ONLY delete old errors/status
//                             if (isErrorUpload) {
//                                 return !asset.includes('live-thumbnail'); 
//                             } 
//                             // If uploading thumbnails, ONLY delete old thumbnails
//                             else {
//                                 return asset.includes('live-thumbnail');
//                             }
//                         });

//                         for (const asset of myOldAssets) {
//                             if (asset) execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
//                         }
//                     }
//                 } catch(e) {}

//                 // 🌟 3. Retry Logic for Upload (Max 3 Tries)
//                 const fileList = pendingScreenshots.join(' ');
//                 let retries = 3;
//                 let uploadSuccess = false;

//                 while (retries > 0 && !uploadSuccess) {
//                     try {
//                         execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
//                         uploadSuccess = true;
//                     } catch (err) {
//                         retries--;
//                         console.log(`[!] Upload failed. Retries left: ${retries}. Waiting 5s...`);
//                         if (retries > 0) await new Promise(r => setTimeout(r, 5000));
//                     }
//                 }

//                 if (uploadSuccess) {
//                     uploadCycleCount++;
//                     console.log(`[+] Live batch upload successful! (Total Cycles: ${uploadCycleCount})`);
//                 } else {
//                     console.log(`[-] Batch upload failed completely after retries.`);
//                 }
//             } catch (err) { 
//                 console.log(`[-] Error in upload sequence: ${err.message}`);
//             } finally {
//                 // Always empty the array to prevent memory leaks
//                 pendingScreenshots = []; 
//             }
//         }
//     } catch (e) {
//         console.error(`[-] Screenshot capture error: ${e.message}`);
//     }
// }

// // =========================================================================
// // 🛠️ SETUP OBS CONFIGURATION DYNAMICALLY (UPDATED WITH WEBSOCKET & SCENES)
// // =========================================================================
// function setupOBSConfig() {
//     console.log('[*] Generating OBS Config files with WebSocket & Scenes...');
//     const obsDir = path.join(os.homedir(), '.config', 'obs-studio');
//     const profilesDir = path.join(obsDir, 'basic', 'profiles', 'Untitled');
//     const scenesDir = path.join(obsDir, 'basic', 'scenes');

//     fs.mkdirSync(profilesDir, { recursive: true });
//     fs.mkdirSync(scenesDir, { recursive: true });

//     // 🌟 Added WebSocket Config
//     const globalIniContent = `[General]\nLicenseAccepted=true\n[BasicWindow]\nShowAutoConfig=false\nWarned=true\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nServerPassword=secret\n`;
//     fs.writeFileSync(path.join(obsDir, 'global.ini'), globalIniContent);
//     fs.writeFileSync(path.join(profilesDir, 'basic.ini'), `[General]\nName=Untitled\n[Video]\nBaseCX=1280\nBaseCY=720\nOutputCX=1280\nOutputCY=720\nFPSCommon=30\n[Output]\nMode=Simple\n`);

//     const serviceJson = {
//         "settings": {
//             "server": "rtmp://vsu.okcdn.ru/input/",
//             "key": ACTIVE_STREAM_KEY
//         },
//         "type": "rtmp_custom"
//     };
//     fs.writeFileSync(path.join(profilesDir, 'service.json'), JSON.stringify(serviceJson, null, 2));

//     // 🌟 Added 'WaitingScene' (Black Screen) to switch to during errors
//     const sceneJson = {
//         "current_scene": "MainScene",
//         "current_program_scene": "MainScene",
//         "name": "Untitled",
//         "scene_order": [{"name": "MainScene"}, {"name": "WaitingScene"}],
//         "sources": [
//             { "id": "xshm_input", "name": "Screen", "settings": { "show_cursor": false } },
//             { "id": "pulse_output_capture", "name": "Audio", "settings": {} },
//             {
//                 "id": "scene", "name": "MainScene",
//                 "settings": { "items": [ {"name": "Screen", "id": 1, "visible": true}, {"name": "Audio", "id": 2, "visible": true} ] }
//             },
//             {
//                 "id": "scene", "name": "WaitingScene",
//                 "settings": { "items": [] } // Black background scene
//             }
//         ]
//     };
//     fs.writeFileSync(path.join(scenesDir, 'Untitled.json'), JSON.stringify(sceneJson, null, 2));
//     console.log('[+] OBS Configurations injected successfully!');
// }

// // =========================================================================
// // 🎬 VIDEO INITIALIZATION (Play Button, Server, Smart Scan, Fullscreen)
// // =========================================================================
// async function initializeVideo(page) {
//     if (SERVER_SELECTION !== 'None') {
//         let serverClicked = false; let serverAttempts = 0;
//         while (!serverClicked && serverAttempts < 10) { 
//             serverAttempts++;
//             try {
//                 const clickSuccess = await page.evaluate((serverName) => {
//                     const buttons = Array.from(document.querySelectorAll('button'));
//                     const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
//                     if (targetBtn) { targetBtn.click(); return true; }
//                     return false;
//                 }, SERVER_SELECTION);

//                 if (clickSuccess) {
//                     serverClicked = true; await takeAndBatchScreenshot(page, `server-clicked`, true); // Force upload initial steps
//                     await new Promise(r => setTimeout(r, 3000)); await page.bringToFront(); 
//                 } else await new Promise(r => setTimeout(r, 2000));
//             } catch (err) { await new Promise(r => setTimeout(r, 2000)); }
//         }
//     }

//     console.log('[*] Hunting for the Play Button...');
//     let buttonClicked = false;
//     let attempts = 0;
    
//     while (!buttonClicked && attempts < 15) {
//         console.log(`[*] Searching for Play button... (Attempt ${attempts + 1}/15)`);
//         for (const frame of page.frames()) {
//             try {
//                 const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"], .vjs-big-play-button');
//                 if (playBtn) {
//                     const isVisible = await frame.evaluate(el => {
//                         const style = window.getComputedStyle(el);
//                         return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
//                     }, playBtn);

//                     if (isVisible) {
//                         console.log(`[+] Play button mil gaya! Click kar raha hoon...`);
//                         await frame.evaluate(el => el.click(), playBtn); 
//                         buttonClicked = true;
//                         await takeAndBatchScreenshot(page, `play-btn-clicked`, true); // Force upload
//                         break; 
//                     }
//                 }
//             } catch (err) {}
//         }
        
//         if (!buttonClicked) {
//             console.log(`[-] Button abhi nahi mila, thora wait kar raha hoon...`);
//             await new Promise(r => setTimeout(r, 2000));
//         } else {
//             await new Promise(r => setTimeout(r, 2000));
//         }
//         attempts++;
//     }

//     if (!buttonClicked) {
//         console.log('[!] Warning: Play button 15 attempts ke baad bhi nahi mila. Aagay barh raha hoon.');
//     }

//     console.log('[*] Scanning iframes for the REAL Live Stream Video...');
//     let targetFrame = null;
//     for (const frame of page.frames()) {
//         try {
//             const isRealLiveStream = await frame.evaluate(() => {
//                 const vid = document.querySelector('video');
//                 return vid && vid.clientWidth > 100 && vid.clientHeight > 100;
//             });
//             if (isRealLiveStream) { 
//                 targetFrame = frame; 
//                 console.log(`[+] Smart Scanner locked onto video frame!`);
//                 break; 
//             }
//         } catch (e) { }
//     }

//     if (!targetFrame) targetFrame = page.mainFrame();
//     await takeAndBatchScreenshot(page, 'video-located', true); // Force upload

//     console.log('[*] Enforcing Black Background and Full Screen UI...');
//     await page.evaluate(() => {
//         document.body.style.backgroundColor = 'black';
//         document.body.style.overflow = 'hidden';
//         document.querySelectorAll('iframe').forEach(iframe => {
//             iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
//             iframe.style.width = '100vw'; iframe.style.height = '100vh';
//             iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
//         });
//     }).catch(() => {});

//     await targetFrame.evaluate(async () => {
//         const style = document.createElement('style');
//         style.innerHTML = `
//             .jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { 
//                 display: none !important; 
//                 opacity: 0 !important;
//                 visibility: hidden !important;
//             }
//         `;
//         document.head.appendChild(style);

//         const video = document.querySelector('video');
//         if (video) { 
//             video.muted = false; 
//             video.volume = 1.0; 
//             video.style.position = 'fixed'; 
//             video.style.top = '0'; 
//             video.style.left = '0';
//             video.style.width = '100vw'; 
//             video.style.height = '100vh';
//             video.style.zIndex = '2147483647'; 
//             video.style.backgroundColor = 'black'; 
//             video.style.objectFit = 'contain';
//         }
//     }).catch(()=>{});
// }

// // =========================================================================
// // 🔄 SMART RECOVERY LOGIC (Background Refresh without killing OBS stream)
// // =========================================================================
// async function handleRecovery(reason, page) {
//     try {
//         console.log(`\n[🔄] STARTING RECOVERY SEQUENCE DUE TO: ${reason}`);
        
//         console.log(`[*] Shifting OBS to WaitingScene (Black Screen)...`);
//         try { await obs.call('SetCurrentProgramScene', { sceneName: 'WaitingScene' }); } catch(e) {}

//         console.log(`[*] Reloading Video Page in background...`);
//         await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
//         await new Promise(r => setTimeout(r, 5000)); 

//         console.log(`[*] Re-initializing Video Player and Fullscreen...`);
//         await initializeVideo(page);

//         lastVideoTime = -1;
//         frozenCheckTimestamp = Date.now();

//         console.log(`[+] Video fixed! Shifting OBS back to MainScene (Live)...`);
//         try { await obs.call('SetCurrentProgramScene', { sceneName: 'MainScene' }); } catch(e) {}

//         console.log(`[+] Recovery Complete. Stream is Live again smoothly!`);
//     } catch (err) {
//         console.log(`[!] Recovery Failed: ${err.message}. Force Restarting whole system...`);
//         throw err; 
//     }
// }

// // =========================================================================
// // 🚀 MAIN LOOP & DIRECT STREAMING
// // =========================================================================
// async function mainLoop() {
//     while (true) {
//         try {
//             await startDirectStreaming();
//         } catch (error) {
//             console.error(`\n[!] ALERT: ${error.message}`);
//             console.log('[*] 🔄 Hard Restarting everything in 3 seconds...');
//             await cleanup();
//             await new Promise(resolve => setTimeout(resolve, 3000));
//         }
//     }
// }

// async function startDirectStreaming() {
//     // 🌟 RUN THE GLOBAL STARTUP CLEANUP FIRST
//     await performStartupCleanup();

//     console.log(`[*] Starting OBS Studio FIRST...`);
//     setupOBSConfig();

//     console.log(`[+] Broadcasting via OBS STUDIO to OK.ru CHANNEL: ${SELECTED_CHANNEL}`);
    
//     obsProcess = spawn('obs', ['--startstreaming']);
    
//     obsProcess.stdout.on('data', (data) => console.log(`[OBS]: ${data.toString().trim()}`));
//     obsProcess.stderr.on('data', (data) => {
//         const msg = data.toString().trim();
//         if (msg.includes('error') || msg.includes('fail')) console.log(`[OBS Error]: ${msg}`);
//     });

//     console.log('[*] Waiting for OBS to initialize before launching browser...');
//     await new Promise(r => setTimeout(r, 8000));

//     console.log(`[*] Starting browser...`);
//     browser = await puppeteer.launch({
//         headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [
//             '--no-sandbox', '--disable-setuid-sandbox',
//             '--window-size=1280,720', '--kiosk', 
//             '--autoplay-policy=no-user-gesture-required'
//         ]
//     });

//     const page = await browser.newPage();
//     const pages = await browser.pages();
//     for (const p of pages) { if (p !== page) await p.close(); }

//     browser.on('targetcreated', async (target) => {
//         if (target.type() === 'page') {
//             try {
//                 const newPage = await target.page();
//                 if (newPage && newPage !== page) {
//                     await page.bringToFront(); await newPage.close();
//                 }
//             } catch (e) {}
//         }
//     });

//     console.log(`[*] Navigating to: ${TARGET_URL}`);
//     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await takeAndBatchScreenshot(page, 'after-load', true); // Force upload

//     await initializeVideo(page);

//     console.log('\n[*] OBS Engine Connected! 24/7 Monitoring Active...');

//     try {
//         await obs.connect('ws://127.0.0.1:4455', 'secret');
//         console.log('[+] Connected to OBS WebSocket successfully!');
//     } catch (e) {
//         console.log('[-] Could not connect to OBS WebSocket. Scene switching might fail.');
//     }

//     let watchdogTicks = 0;
//     while (true) {
//         if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

//         let overallStatus = 'DEAD'; let currentVideoTime = -1; let criticalErrorFound = false;

//         for (const frame of page.frames()) {
//             try {
//                 const result = await frame.evaluate(() => {
//                     const bodyText = document.body.innerText.toLowerCase();
//                     if (bodyText.includes("stream error")) return { status: 'CRITICAL_ERROR' };
//                     const v = document.querySelector('video');
//                     if (v && !v.ended) return { status: 'HEALTHY', currentTime: v.currentTime };
//                     return { status: 'DEAD' };
//                 });
//                 if (result.status === 'CRITICAL_ERROR') criticalErrorFound = true;
//                 if (result.status === 'HEALTHY') { overallStatus = 'HEALTHY'; currentVideoTime = result.currentTime; }
//             } catch (e) {}
//         }

//         if (overallStatus === 'HEALTHY' && currentVideoTime !== -1) {
//             const now = Date.now();
//             if (currentVideoTime === lastVideoTime) {
//                 if (now - frozenCheckTimestamp > FROZEN_THRESHOLD_MS) overallStatus = 'FROZEN';
//             } else { lastVideoTime = currentVideoTime; frozenCheckTimestamp = now; }
//         }

//         // Error detection logic with FORCE UPLOAD (true)
//         if (criticalErrorFound) {
//             console.log(`\n[!] ❌ WATCHDOG DETECTED: CRITICAL_ERROR (Screen par 'stream error' text mila)`);
//             await takeAndBatchScreenshot(page, 'error-stream-text', true); 
//             await handleRecovery('CRITICAL_ERROR', page);
//         } 
//         else if (overallStatus === 'DEAD') {
//             console.log(`\n[!] ❌ WATCHDOG DETECTED: DEAD (Video player gayab hai ya video end ho gayi)`);
//             await takeAndBatchScreenshot(page, 'error-video-dead', true);
//             await handleRecovery('DEAD', page);
//         } 
//         else if (overallStatus === 'FROZEN') {
//             console.log(`\n[!] ❌ WATCHDOG DETECTED: FROZEN (Video pichle 15 seconds se atki hui hai)`);
//             await takeAndBatchScreenshot(page, 'error-video-frozen', true);
//             await handleRecovery('FROZEN', page);
//         }

//         watchdogTicks++;
        
//         // 🌟 NEW 5-MINUTE SEQUENCE LOGIC (60 ticks * 5s = 300s = 5 mins)
//         if (watchdogTicks % 60 === 0) {
//             if (overallStatus === 'HEALTHY' && !criticalErrorFound) {
//                 console.log(`[*] Taking 3 sequential live-thumbnail screenshots with 1s gap...`);
//                 for (let i = 1; i <= 3; i++) {
//                     // Teesri picture par forceUpload = true taake fauran push ho jaye
//                     const shouldForceUpload = (i === 3);
//                     await takeAndBatchScreenshot(page, `live-thumbnail-seq${i}`, shouldForceUpload);
                    
//                     if (i < 3) {
//                         await new Promise(r => setTimeout(r, 1000)); // 1 second gap
//                     }
//                 }
//             } else {
//                 console.log(`[*] Skipping live-thumbnail capture due to unhealthy stream.`);
//             }
//         }
        
//         await new Promise(r => setTimeout(r, 5000)); 
//     }
// }

// async function cleanup() {
//     try { await obs.disconnect(); } catch (e) {} 
//     if (obsProcess) { try { obsProcess.kill('SIGKILL'); } catch(e){} obsProcess = null; }
//     if (browser) { try { await browser.close(); } catch(e){} browser = null; }
// }

// process.on('SIGINT', async () => { await cleanup(); process.exit(0); });

// // =========================================================================
// // ⏱️ NEW: AUTO-OVERLAP OR EXACT DURATION LOGIC (ADDED HERE)
// // =========================================================================
// const customDurationStr = process.env.CUSTOM_DURATION || 'None';

// function parseDurationToMs(str) {
//     if (!str || str.toLowerCase() === 'none') return null;
//     let ms = 0;
//     const hMatch = str.match(/(\d+)\s*h/i);
//     const mMatch = str.match(/(\d+)\s*m/i);
//     if (hMatch) ms += parseInt(hMatch[1]) * 60 * 60 * 1000;
//     if (mMatch) ms += parseInt(mMatch[1]) * 60 * 1000;
//     return ms > 0 ? ms : null;
// }

// const exactDurationMs = parseDurationToMs(customDurationStr);

// if (exactDurationMs) {
//     console.log(`\n[*] 🕒 Custom Duration Detected: ${customDurationStr} (${exactDurationMs / 60000} mins). System will auto-shutdown after this time.`);
    
//     setTimeout(async () => {
//         console.log(`\n[*] 🛑 Time's up! The assigned duration (${customDurationStr}) is complete. Shutting down cleanly...`);
//         await cleanup();
//         process.exit(0);
//     }, exactDurationMs);

// } else {
//     console.log(`\n[*] 🔄 No Custom Duration specified. Defaulting to 5h 50m Auto-Overlap loop.`);
    
//     setTimeout(() => {
//         console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
//         try {
//             const { execSync } = require('child_process');
            
//             const targetUrl = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
//             const channel = process.env.OKRU_STREAM_ID || '1';
//             const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
//             const server = process.env.SERVER_SELECTION || 'None';

//             const cmd = `gh workflow run main.yml -f target_url="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}" -f custom_duration="None"`;
            
//             console.log(`[*] Executing Command: ${cmd}`);
//             execSync(cmd, { stdio: 'inherit' });
            
//             console.log("[+] Next workflow run successfully triggered!");

//             setTimeout(async () => {
//                 console.log("\n[*] Handing over stream to next action. Shutting down cleanly...");
//                 await cleanup();
//                 process.exit(0);
//             }, 300000); 

//         } catch (err) {
//             console.error("[-] Failed to trigger next workflow using GH CLI:", err.message);
//         }
//     }, 21000000);
// }

// mainLoop();




































// ==================== Alhamdullah full fone, bas upper yeh tiktok k liye screenshot wala system ko or teek karty hai ===========================



// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const { spawn, execSync } = require('child_process');
// const { OBSWebSocket } = require('obs-websocket-js'); // 🌟 OBS WebSocket Library

// const obs = new OBSWebSocket(); // OBS instance

// // 🚀 Multi-Stream Key Manager
// const STREAM_KEYS = {
//     '1'   : '15254238731883_15281627925099_najspfkgne', 
//     '1.1' : '15254260751979_15281671637611_2plrcfqzze', 
//     '1.2' : '15254285524587_15281717840491_7e6qdknzsu',
    
//     '2'   : '15254299352683_15281743071851_7dvz3h5d7q',
//     '2.1' : '15254308986475_15281761618539_3xca7oij3u',
//     '2.2' : '15254328122987_15281795566187_zjqa6bqzoq', 

//     '3'   : '15254341885547_15281821059691_hhlpb5vicy', 
//     '3.1' : '15254357089899_15281848322667_sxeexgvzl4', 
//     '3.2' : '15254367510123_15281868180075_pc4jrytfgm',

//     '4'   : '15255022345835_15283095800427_vwrupxzstm', 
//     '4.1' : '15255038074475_15283122080363_ai5qqp2we4', 
//     '4.2' : '15255045480043_15283135842923_tldl4bhmii',
//     '4.3' : '15255208599147_15283449629291_abltofuc7m', 
//     '4.4' : '15255217708651_15283466603115_bojrrqtlmu', 
//     '4.5' : '15255227670123_15283486263915_jpntt54mve',

//     '5'   : '15273689226859_15317451606635_d7zzy3c7qi', 
//     '5.1' : '15273713933931_15317494860395_avj47smmim', 
//     '5.2' : '15273722257003_15317510195819_6edjluvdqi',
//     '5.3' : '15273739624043_15317541653099_ii4bxpvabe',
//     '5.4' : '15273750175339_15317561707115_csel26ku5a', 
//     '5.5' : '15273760071275_15317579467371_cnewcj54me',
//     '5.6' : '15273767935595_15317595851371_3q43tk7tvm', 
//     '5.7' : '15273778683499_15317616560747_4piekvs4wu',

//     's1.1'  : '14204232736303_14846150314543_37jq4ryehq',
//     's1.2'  : '14204288179759_14846247373359_tnsknmapva',
//     's1.3'  : '14204319768111_14846302489135_sr4ht4ccwq',
//     's1.4'  : '14204331957807_14846326147631_dji2acqcze',
//     's1.5'  : '14204346572335_14846351641135_7gvns4o5ue',
//     's1.6'  : '14204361252399_14846376479279_cjajhf4d3y',
//     's1.7'  : '14204370492975_14846393649711_6fduhdqite',
//     's1.8'  : '14204395527727_14846438017583_s2jlti7lsm',
//     's1.9'  : '14204411387439_14846464887343_f5lxgcqj5y',
//     's1.10' : '14204424691247_14846487562799_xmbvntt6wa',

//     's2.1'  : '14204490948143_14846603495983_kzevn36tii',
//     's2.2'  : '14204506742319_14846634494511_ta2rxyg2oy',
//     's2.3'  : '14204523322927_14846661233199_foqb3q7zb4',
//     's2.4'  : '14204540034607_14846689085999_gjejdie4uy',
//     's2.5'  : '14204555304495_14846715497007_zdanghuxzu',
//     's2.6'  : '14204565200431_14846734371375_ap3bqpabpu',
//     's2.7'  : '14204577259055_14846756194863_3ecad2535u',
//     's2.8'  : '14204592528943_14846785227311_4hjl46y62e',
//     's2.9'  : '14204602621487_14846802594351_ilnp6lxekq',
//     's2.10' : '14206184136239_14849618610735_ihnbx7hkoi'
// };

// const TARGET_URL = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
// const SELECTED_CHANNEL = process.env.OKRU_STREAM_ID || '1';
// const SERVER_SELECTION = process.env.SERVER_SELECTION || 'None'; 
// const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];

// let browser = null;
// let obsProcess = null;

// let lastVideoTime = -1;
// let frozenCheckTimestamp = Date.now();
// const FROZEN_THRESHOLD_MS = 5000; 

// if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');
// let pendingScreenshots = [];
// let uploadCycleCount = 0;

// async function takeAndBatchScreenshot(page, stepName) {
//     try {
//         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//         const filePath = `./screenshots/snap_${timestamp}_${stepName}.png`;
//         await page.screenshot({ path: filePath });
//         console.log(`[📸] Screenshot saved: ${filePath}`);
//         pendingScreenshots.push(filePath);

//         if (pendingScreenshots.length >= 3) {
//             console.log(`[🚀] 3 Screenshots collected. Triggering LIVE batch upload...`);
//             try {
//                 const tag = 'live-stream-logs';
//                 try { execSync(`gh release view ${tag} || gh release create ${tag} -t "Live Logs"`, { stdio: 'ignore' }); } catch(e) {}
//                 try {
//                     const oldAssets = execSync(`gh release view ${tag} --json assets -q ".assets[].name"`, { encoding: 'utf-8' }).trim().split('\n');
//                     for (const asset of oldAssets) if (asset) execSync(`gh release delete-asset ${tag} "${asset}" -y`, { stdio: 'ignore' });
//                 } catch(e) {}

//                 const fileList = pendingScreenshots.join(' ');
//                 execSync(`gh release upload ${tag} ${fileList} --clobber`, { stdio: 'ignore' });
//                 uploadCycleCount++;
//                 console.log(`[+] Live batch upload successful! (Total Cycles: ${uploadCycleCount})`);
//                 pendingScreenshots = []; 
//             } catch (err) { }
//         }
//     } catch (e) {}
// }

// // =========================================================================
// // 🛠️ SETUP OBS CONFIGURATION DYNAMICALLY (UPDATED WITH WEBSOCKET & SCENES)
// // =========================================================================
// function setupOBSConfig() {
//     console.log('[*] Generating OBS Config files with WebSocket & Scenes...');
//     const obsDir = path.join(os.homedir(), '.config', 'obs-studio');
//     const profilesDir = path.join(obsDir, 'basic', 'profiles', 'Untitled');
//     const scenesDir = path.join(obsDir, 'basic', 'scenes');

//     fs.mkdirSync(profilesDir, { recursive: true });
//     fs.mkdirSync(scenesDir, { recursive: true });

//     // 🌟 Added WebSocket Config
//     const globalIniContent = `[General]\nLicenseAccepted=true\n[BasicWindow]\nShowAutoConfig=false\nWarned=true\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nServerPassword=secret\n`;
//     fs.writeFileSync(path.join(obsDir, 'global.ini'), globalIniContent);
//     fs.writeFileSync(path.join(profilesDir, 'basic.ini'), `[General]\nName=Untitled\n[Video]\nBaseCX=1280\nBaseCY=720\nOutputCX=1280\nOutputCY=720\nFPSCommon=30\n[Output]\nMode=Simple\n`);

//     const serviceJson = {
//         "settings": {
//             "server": "rtmp://vsu.okcdn.ru/input/",
//             "key": ACTIVE_STREAM_KEY
//         },
//         "type": "rtmp_custom"
//     };
//     fs.writeFileSync(path.join(profilesDir, 'service.json'), JSON.stringify(serviceJson, null, 2));

//     // 🌟 Added 'WaitingScene' (Black Screen) to switch to during errors
//     const sceneJson = {
//         "current_scene": "MainScene",
//         "current_program_scene": "MainScene",
//         "name": "Untitled",
//         "scene_order": [{"name": "MainScene"}, {"name": "WaitingScene"}],
//         "sources": [
//             { "id": "xshm_input", "name": "Screen", "settings": { "show_cursor": false } },
//             { "id": "pulse_output_capture", "name": "Audio", "settings": {} },
//             {
//                 "id": "scene", "name": "MainScene",
//                 "settings": { "items": [ {"name": "Screen", "id": 1, "visible": true}, {"name": "Audio", "id": 2, "visible": true} ] }
//             },
//             {
//                 "id": "scene", "name": "WaitingScene",
//                 "settings": { "items": [] } // Black background scene
//             }
//         ]
//     };
//     fs.writeFileSync(path.join(scenesDir, 'Untitled.json'), JSON.stringify(sceneJson, null, 2));
//     console.log('[+] OBS Configurations injected successfully!');
// }

// // =========================================================================
// // 🎬 VIDEO INITIALIZATION (Play Button, Server, Smart Scan, Fullscreen)
// // =========================================================================
// async function initializeVideo(page) {
//     if (SERVER_SELECTION !== 'None') {
//         let serverClicked = false; let serverAttempts = 0;
//         while (!serverClicked && serverAttempts < 10) { 
//             serverAttempts++;
//             try {
//                 const clickSuccess = await page.evaluate((serverName) => {
//                     const buttons = Array.from(document.querySelectorAll('button'));
//                     const targetBtn = buttons.find(b => b.innerText && b.innerText.trim().includes(serverName));
//                     if (targetBtn) { targetBtn.click(); return true; }
//                     return false;
//                 }, SERVER_SELECTION);

//                 if (clickSuccess) {
//                     serverClicked = true; await takeAndBatchScreenshot(page, `server-clicked`);
//                     await new Promise(r => setTimeout(r, 3000)); await page.bringToFront(); 
//                 } else await new Promise(r => setTimeout(r, 2000));
//             } catch (err) { await new Promise(r => setTimeout(r, 2000)); }
//         }
//     }

//     console.log('[*] Hunting for the Play Button...');
//     let buttonClicked = false;
//     let attempts = 0;
    
//     while (!buttonClicked && attempts < 15) {
//         console.log(`[*] Searching for Play button... (Attempt ${attempts + 1}/15)`);
//         for (const frame of page.frames()) {
//             try {
//                 const playBtn = await frame.$('.jw-icon-display[aria-label="Play"], button[data-plyr="play"], .vjs-big-play-button');
//                 if (playBtn) {
//                     const isVisible = await frame.evaluate(el => {
//                         const style = window.getComputedStyle(el);
//                         return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
//                     }, playBtn);

//                     if (isVisible) {
//                         console.log(`[+] Play button mil gaya! Click kar raha hoon...`);
//                         await frame.evaluate(el => el.click(), playBtn); 
//                         buttonClicked = true;
//                         await takeAndBatchScreenshot(page, `play-btn-clicked`);
//                         break; 
//                     }
//                 }
//             } catch (err) {}
//         }
        
//         if (!buttonClicked) {
//             console.log(`[-] Button abhi nahi mila, thora wait kar raha hoon...`);
//             await new Promise(r => setTimeout(r, 2000));
//         } else {
//             await new Promise(r => setTimeout(r, 2000));
//         }
//         attempts++;
//     }

//     if (!buttonClicked) {
//         console.log('[!] Warning: Play button 15 attempts ke baad bhi nahi mila. Aagay barh raha hoon.');
//     }

//     console.log('[*] Scanning iframes for the REAL Live Stream Video...');
//     let targetFrame = null;
//     for (const frame of page.frames()) {
//         try {
//             const isRealLiveStream = await frame.evaluate(() => {
//                 const vid = document.querySelector('video');
//                 return vid && vid.clientWidth > 100 && vid.clientHeight > 100;
//             });
//             if (isRealLiveStream) { 
//                 targetFrame = frame; 
//                 console.log(`[+] Smart Scanner locked onto video frame!`);
//                 break; 
//             }
//         } catch (e) { }
//     }

//     if (!targetFrame) targetFrame = page.mainFrame();
//     await takeAndBatchScreenshot(page, 'video-located');

//     console.log('[*] Enforcing Black Background and Full Screen UI...');
//     await page.evaluate(() => {
//         document.body.style.backgroundColor = 'black';
//         document.body.style.overflow = 'hidden';
//         document.querySelectorAll('iframe').forEach(iframe => {
//             iframe.style.position = 'fixed'; iframe.style.top = '0'; iframe.style.left = '0';
//             iframe.style.width = '100vw'; iframe.style.height = '100vh';
//             iframe.style.zIndex = '999999'; iframe.style.backgroundColor = 'black'; iframe.style.border = 'none';
//         });
//     }).catch(() => {});

//     await targetFrame.evaluate(async () => {
//         const style = document.createElement('style');
//         style.innerHTML = `
//             .jw-controls, .jw-ui, .plyr__controls, .vjs-control-bar, [data-player] .controls { 
//                 display: none !important; 
//                 opacity: 0 !important;
//                 visibility: hidden !important;
//             }
//         `;
//         document.head.appendChild(style);

//         const video = document.querySelector('video');
//         if (video) { 
//             video.muted = false; 
//             video.volume = 1.0; 
//             video.style.position = 'fixed'; 
//             video.style.top = '0'; 
//             video.style.left = '0';
//             video.style.width = '100vw'; 
//             video.style.height = '100vh';
//             video.style.zIndex = '2147483647'; 
//             video.style.backgroundColor = 'black'; 
//             video.style.objectFit = 'contain';
//         }
//     }).catch(()=>{});
// }

// // =========================================================================
// // 🔄 SMART RECOVERY LOGIC (Background Refresh without killing OBS stream)
// // =========================================================================
// async function handleRecovery(reason, page) {
//     try {
//         console.log(`\n[🔄] STARTING RECOVERY SEQUENCE DUE TO: ${reason}`);
        
//         console.log(`[*] Shifting OBS to WaitingScene (Black Screen)...`);
//         try { await obs.call('SetCurrentProgramScene', { sceneName: 'WaitingScene' }); } catch(e) {}

//         console.log(`[*] Reloading Video Page in background...`);
//         await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
//         await new Promise(r => setTimeout(r, 5000)); 

//         console.log(`[*] Re-initializing Video Player and Fullscreen...`);
//         await initializeVideo(page);

//         lastVideoTime = -1;
//         frozenCheckTimestamp = Date.now();

//         console.log(`[+] Video fixed! Shifting OBS back to MainScene (Live)...`);
//         try { await obs.call('SetCurrentProgramScene', { sceneName: 'MainScene' }); } catch(e) {}

//         console.log(`[+] Recovery Complete. Stream is Live again smoothly!`);
//     } catch (err) {
//         console.log(`[!] Recovery Failed: ${err.message}. Force Restarting whole system...`);
//         throw err; 
//     }
// }

// // =========================================================================
// // 🚀 MAIN LOOP & DIRECT STREAMING
// // =========================================================================
// async function mainLoop() {
//     while (true) {
//         try {
//             await startDirectStreaming();
//         } catch (error) {
//             console.error(`\n[!] ALERT: ${error.message}`);
//             console.log('[*] 🔄 Hard Restarting everything in 3 seconds...');
//             await cleanup();
//             await new Promise(resolve => setTimeout(resolve, 3000));
//         }
//     }
// }

// async function startDirectStreaming() {
//     console.log(`[*] Starting OBS Studio FIRST...`);
//     setupOBSConfig();

//     console.log(`[+] Broadcasting via OBS STUDIO to OK.ru CHANNEL: ${SELECTED_CHANNEL}`);
    
//     obsProcess = spawn('obs', ['--startstreaming']);
    
//     obsProcess.stdout.on('data', (data) => console.log(`[OBS]: ${data.toString().trim()}`));
//     obsProcess.stderr.on('data', (data) => {
//         const msg = data.toString().trim();
//         if (msg.includes('error') || msg.includes('fail')) console.log(`[OBS Error]: ${msg}`);
//     });

//     console.log('[*] Waiting for OBS to initialize before launching browser...');
//     await new Promise(r => setTimeout(r, 8000));

//     console.log(`[*] Starting browser...`);
//     browser = await puppeteer.launch({
//         headless: false, 
//         defaultViewport: { width: 1280, height: 720 },
//         ignoreDefaultArgs: ['--enable-automation'], 
//         args: [
//             '--no-sandbox', '--disable-setuid-sandbox',
//             '--window-size=1280,720', '--kiosk', 
//             '--autoplay-policy=no-user-gesture-required'
//         ]
//     });

//     const page = await browser.newPage();
//     const pages = await browser.pages();
//     for (const p of pages) { if (p !== page) await p.close(); }

//     browser.on('targetcreated', async (target) => {
//         if (target.type() === 'page') {
//             try {
//                 const newPage = await target.page();
//                 if (newPage && newPage !== page) {
//                     await page.bringToFront(); await newPage.close();
//                 }
//             } catch (e) {}
//         }
//     });

//     console.log(`[*] Navigating to: ${TARGET_URL}`);
//     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     await takeAndBatchScreenshot(page, 'after-load');

//     await initializeVideo(page);

//     console.log('\n[*] OBS Engine Connected! 24/7 Monitoring Active...');

//     try {
//         await obs.connect('ws://127.0.0.1:4455', 'secret');
//         console.log('[+] Connected to OBS WebSocket successfully!');
//     } catch (e) {
//         console.log('[-] Could not connect to OBS WebSocket. Scene switching might fail.');
//     }

//     let watchdogTicks = 0;
//     while (true) {
//         if (!browser || !browser.isConnected()) throw new Error("Browser closed.");

//         let overallStatus = 'DEAD'; let currentVideoTime = -1; let criticalErrorFound = false;

//         for (const frame of page.frames()) {
//             try {
//                 const result = await frame.evaluate(() => {
//                     const bodyText = document.body.innerText.toLowerCase();
//                     if (bodyText.includes("stream error")) return { status: 'CRITICAL_ERROR' };
//                     const v = document.querySelector('video');
//                     if (v && !v.ended) return { status: 'HEALTHY', currentTime: v.currentTime };
//                     return { status: 'DEAD' };
//                 });
//                 if (result.status === 'CRITICAL_ERROR') criticalErrorFound = true;
//                 if (result.status === 'HEALTHY') { overallStatus = 'HEALTHY'; currentVideoTime = result.currentTime; }
//             } catch (e) {}
//         }

//         if (overallStatus === 'HEALTHY' && currentVideoTime !== -1) {
//             const now = Date.now();
//             if (currentVideoTime === lastVideoTime) {
//                 if (now - frozenCheckTimestamp > FROZEN_THRESHOLD_MS) overallStatus = 'FROZEN';
//             } else { lastVideoTime = currentVideoTime; frozenCheckTimestamp = now; }
//         }

//         if (criticalErrorFound) {
//             console.log(`\n[!] ❌ WATCHDOG DETECTED: CRITICAL_ERROR (Screen par 'stream error' text mila)`);
//             await takeAndBatchScreenshot(page, 'error-stream-text');
//             await handleRecovery('CRITICAL_ERROR', page);
//         } 
//         else if (overallStatus === 'DEAD') {
//             console.log(`\n[!] ❌ WATCHDOG DETECTED: DEAD (Video player gayab hai ya video end ho gayi)`);
//             await takeAndBatchScreenshot(page, 'error-video-dead');
//             await handleRecovery('DEAD', page);
//         } 
//         else if (overallStatus === 'FROZEN') {
//             console.log(`\n[!] ❌ WATCHDOG DETECTED: FROZEN (Video pichle 15 seconds se atki hui hai)`);
//             await takeAndBatchScreenshot(page, 'error-video-frozen');
//             await handleRecovery('FROZEN', page);
//         }

//         watchdogTicks++;
//         if (watchdogTicks % 120 === 0) await takeAndBatchScreenshot(page, `heartbeat-tick-${watchdogTicks}`);
//         await new Promise(r => setTimeout(r, 5000)); 
//     }
// }

// async function cleanup() {
//     try { await obs.disconnect(); } catch (e) {} 
//     if (obsProcess) { try { obsProcess.kill('SIGKILL'); } catch(e){} obsProcess = null; }
//     if (browser) { try { await browser.close(); } catch(e){} browser = null; }
// }

// process.on('SIGINT', async () => { await cleanup(); process.exit(0); });

// // =========================================================================
// // ⏱️ NEW: AUTO-OVERLAP OR EXACT DURATION LOGIC (ADDED HERE)
// // =========================================================================
// const customDurationStr = process.env.CUSTOM_DURATION || 'None';

// function parseDurationToMs(str) {
//     if (!str || str.toLowerCase() === 'none') return null;
//     let ms = 0;
//     const hMatch = str.match(/(\d+)\s*h/i);
//     const mMatch = str.match(/(\d+)\s*m/i);
//     if (hMatch) ms += parseInt(hMatch[1]) * 60 * 60 * 1000;
//     if (mMatch) ms += parseInt(mMatch[1]) * 60 * 1000;
//     return ms > 0 ? ms : null;
// }

// const exactDurationMs = parseDurationToMs(customDurationStr);

// if (exactDurationMs) {
//     console.log(`\n[*] 🕒 Custom Duration Detected: ${customDurationStr} (${exactDurationMs / 60000} mins). System will auto-shutdown after this time.`);
    
//     setTimeout(async () => {
//         console.log(`\n[*] 🛑 Time's up! The assigned duration (${customDurationStr}) is complete. Shutting down cleanly...`);
//         await cleanup();
//         process.exit(0);
//     }, exactDurationMs);

// } else {
//     console.log(`\n[*] 🔄 No Custom Duration specified. Defaulting to 5h 50m Auto-Overlap loop.`);
    
//     setTimeout(() => {
//         console.log("\n[*] 5h 50m completed! Triggering next action for seamless overlap...");
//         try {
//             const { execSync } = require('child_process');
            
//             const targetUrl = process.env.TARGET_URL || 'https://dadocric.st/player.php?id=starsp3&v=m';
//             const channel = process.env.OKRU_STREAM_ID || '1';
//             const quality = process.env.STREAM_QUALITY || '110KBps (Balanced 480p)';
//             const server = process.env.SERVER_SELECTION || 'None';

//             // custom_duration="None" add kar diya gaya hai naye overlap trigger mein
//             const cmd = `gh workflow run main.yml -f target_url="${targetUrl}" -f okru_stream_channel="${channel}" -f stream_quality="${quality}" -f server_selection="${server}" -f custom_duration="None"`;
            
//             console.log(`[*] Executing Command: ${cmd}`);
//             execSync(cmd, { stdio: 'inherit' });
            
//             console.log("[+] Next workflow run successfully triggered!");

//             setTimeout(async () => {
//                 console.log("\n[*] Handing over stream to next action. Shutting down cleanly...");
//                 await cleanup();
//                 process.exit(0);
//             }, 300000); 

//         } catch (err) {
//             console.error("[-] Failed to trigger next workflow using GH CLI:", err.message);
//         }
//     }, 21000000);
// }

// mainLoop();
