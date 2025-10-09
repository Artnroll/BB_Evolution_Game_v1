// PlayDeck Bridge - MOBILE DEBUG VERSION
(function () {
    'use strict';

    console.log("🔧 Initializing PlayDeck Bridge...");

    // Create visible debug panel for mobile
    function createDebugPanel() {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'mobile-debug-panel';
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            z-index: 10000;
            max-width: 300px;
            max-height: 200px;
            overflow: auto;
            border: 2px solid red;
        `;
        debugPanel.innerHTML = `
            <div style="color: yellow; font-weight: bold;">DEBUG PANEL</div>
            <div id="debug-status">Initializing...</div>
            <button onclick="document.getElementById('mobile-debug-panel').style.display='none'" 
                    style="margin-top: 5px; padding: 2px 5px; font-size: 10px;">
                Hide
            </button>
        `;
        document.body.appendChild(debugPanel);
        return debugPanel;
    }

    function updateDebugStatus(message) {
        const statusEl = document.getElementById('debug-status');
        if (statusEl) {
            statusEl.innerHTML += `<div>${new Date().toLocaleTimeString()}: ${message}</div>`;
            // Auto-scroll to bottom
            statusEl.parentElement.scrollTop = statusEl.parentElement.scrollHeight;
        }
        console.log(message);
    }

    // Create debug panel immediately
    createDebugPanel();
    updateDebugStatus("Bridge loading...");

    // Global functions
    window.PlayDeck_SetLoading = function (progress) {
        updateDebugStatus(`Loading: ${progress}%`);
    };

    window.PlayDeck_GameEnd = function () {
        updateDebugStatus("GameEnd called");
    };

    window.PlayDeck_Analytics = function (eventName, payload) {
        updateDebugStatus(`Analytics: ${eventName}`);
    };

    window.PlayDeck_AreAdsAvailable = function () {
        const isTelegram = !!(window.Telegram && window.Telegram.WebApp);
        const adsGramAvailable = !!window.AdsGram;
        const available = isTelegram ? adsGramAvailable : true;

        updateDebugStatus(`Ads Available: ${available} (Telegram: ${isTelegram}, AdsGram: ${adsGramAvailable})`);
        return available;
    };

    window.PlayDeck_PreloadAds = function () {
        updateDebugStatus("PreloadAds called");
    };

    window.PlayDeck_ShowRewardedAd = function () {
        updateDebugStatus("🎬 ShowRewardedAd called");

        return new Promise((resolve, reject) => {
            const isTelegram = !!(window.Telegram && window.Telegram.WebApp);
            const adsGramAvailable = !!window.AdsGram;

            updateDebugStatus(`Environment: Telegram=${isTelegram}, AdsGram=${adsGramAvailable}`);

            if (!isTelegram) {
                updateDebugStatus("🖥️ Browser: Using simulator");
                setTimeout(() => {
                    updateDebugStatus("✅ Simulator: Reward granted");
                    notifyUnityAdCompleted(true);
                    resolve(true);
                }, 2000);
                return;
            }

            if (!adsGramAvailable) {
                updateDebugStatus("❌ Telegram: AdsGram SDK not loaded!");
                updateDebugStatus("🤔 Possible: Domain not whitelisted or SDK blocked");

                // Show visual ad simulation
                showVisualAdSimulation(resolve, reject);
                return;
            }

            updateDebugStatus("🎯 Attempting REAL AdsGram ad...");

            try {
                window.AdsGram.showRewarded('15876', {
                    onReward: (reward) => {
                        updateDebugStatus("✅ REAL AD: Completed with reward");
                        notifyUnityAdCompleted(true);
                        resolve(true);
                    },
                    onClose: () => {
                        updateDebugStatus("❌ REAL AD: Closed without reward");
                        notifyUnityAdCompleted(false);
                        reject(false);
                    },
                    onError: (error) => {
                        updateDebugStatus(`🔥 REAL AD: Error - ${error}`);
                        notifyUnityAdCompleted(false);
                        reject(false);
                    }
                });
            } catch (error) {
                updateDebugStatus(`🔥 Exception: ${error}`);
                notifyUnityAdCompleted(false);
                reject(false);
            }
        });
    };

    function showVisualAdSimulation(resolve, reject) {
        updateDebugStatus("📱 Showing visual ad simulation");

        const adOverlay = document.createElement('div');
        adOverlay.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: #000;
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
        `;

        adOverlay.innerHTML = `
            <h2>Advertisement Simulation</h2>
            <p style="color: yellow;">AdsGram SDK Issue Detected</p>
            <p>Real ad would show here if SDK was working</p>
            <div style="margin: 20px; padding: 20px; background: #333; border-radius: 10px;">
                <p>🎥 Video ad simulation</p>
                <p id="countdown">⏰ 3 seconds remaining...</p>
            </div>
            <button id="skip-ad" style="margin-top: 20px; padding: 10px 20px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer;">Skip Ad</button>
            <p style="margin-top: 20px; font-size: 12px; color: #888;">Testing reward system</p>
        `;

        document.body.appendChild(adOverlay);

        let timeLeft = 3;
        const countdownElement = document.getElementById('countdown');
        const countdownInterval = setInterval(() => {
            timeLeft--;
            countdownElement.textContent = `⏰ ${timeLeft} second${timeLeft !== 1 ? 's' : ''} remaining...`;

            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                document.body.removeChild(adOverlay);
                updateDebugStatus("✅ Simulation completed - reward granted");
                notifyUnityAdCompleted(true);
                resolve(true);
            }
        }, 1000);

        document.getElementById('skip-ad').onclick = () => {
            clearInterval(countdownInterval);
            document.body.removeChild(adOverlay);
            updateDebugStatus("❌ Simulation skipped - no reward");
            notifyUnityAdCompleted(false);
            reject(false);
        };
    }

    function notifyUnityAdCompleted(success) {
        updateDebugStatus(`🔧 Notifying Unity: ${success}`);
        if (window.unityInstance && window.unityInstance.SendMessage) {
            const message = success ? "true" : "false";
            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', message);
        }
    }

    updateDebugStatus("🔧 Bridge ready");

    // Check AdsGram after delay
    setTimeout(() => {
        updateDebugStatus(`📦 AdsGram check: ${!!window.AdsGram}`);
        if (window.AdsGram) {
            updateDebugStatus("✅ AdsGram SDK loaded");
        } else {
            updateDebugStatus("❌ AdsGram SDK NOT loaded - contact support");
        }
    }, 3000);

})();
