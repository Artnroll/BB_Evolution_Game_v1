// PlayDeck Bridge - COMPREHENSIVE ENVIRONMENT DEBUG
(function () {
    'use strict';

    console.log("🔧 Initializing PlayDeck Bridge...");

    // Create visible debug panel
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
            <div style="color: yellow; font-weight: bold;">ENVIRONMENT DEBUG</div>
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
            statusEl.parentElement.scrollTop = statusEl.parentElement.scrollHeight;
        }
        console.log(message);
    }

    // Create debug panel immediately
    createDebugPanel();
    updateDebugStatus("Bridge loading...");

    // Comprehensive environment analysis
    function analyzeEnvironment() {
        updateDebugStatus("🔍 Analyzing environment...");

        // Check for Telegram WebApp
        const hasTelegram = !!window.Telegram;
        const hasWebApp = !!(window.Telegram && window.Telegram.WebApp);

        updateDebugStatus(`📱 window.Telegram: ${hasTelegram}`);
        updateDebugStatus(`🌐 window.Telegram.WebApp: ${hasWebApp}`);

        if (hasTelegram && hasWebApp) {
            updateDebugStatus(`✅ Platform: ${window.Telegram.WebApp.platform}`);
            updateDebugStatus(`✅ Version: ${window.Telegram.WebApp.version}`);
            updateDebugStatus(`✅ Theme: ${window.Telegram.WebApp.themeParams}`);
        }

        // Check URL parameters (Telegram Mini Apps add these)
        const urlParams = new URLSearchParams(window.location.search);
        const tgParams = [];
        urlParams.forEach((value, key) => {
            if (key.includes('tg') || key.includes('Telegram')) {
                tgParams.push(`${key}=${value}`);
            }
        });
        updateDebugStatus(`🔗 Telegram URL params: ${tgParams.length > 0 ? tgParams.join(', ') : 'None'}`);

        // Check user agent
        const userAgent = navigator.userAgent;
        updateDebugStatus(`🤖 User Agent: ${userAgent.substring(0, 50)}...`);
        updateDebugStatus(`📱 Is Mobile: ${/Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)}`);

        // Check for AdsGram
        updateDebugStatus(`📦 AdsGram: ${!!window.AdsGram}`);

        return {
            hasTelegram,
            hasWebApp,
            isMiniApp: hasWebApp,
            tgParams: tgParams.length
        };
    }

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
        const env = analyzeEnvironment();
        const adsGramAvailable = !!window.AdsGram;
        const available = env.isMiniApp ? adsGramAvailable : true;

        updateDebugStatus(`Ads Available: ${available}`);
        return available;
    };

    window.PlayDeck_PreloadAds = function () {
        updateDebugStatus("PreloadAds called");
    };

    window.PlayDeck_ShowRewardedAd = function () {
        updateDebugStatus("🎬 ShowRewardedAd called");

        return new Promise((resolve, reject) => {
            const env = analyzeEnvironment();
            const adsGramAvailable = !!window.AdsGram;

            // Show detailed environment info
            updateDebugStatus(`=== AD REQUEST ENVIRONMENT ===`);
            updateDebugStatus(`Telegram object: ${env.hasTelegram}`);
            updateDebugStatus(`WebApp object: ${env.hasWebApp}`);
            updateDebugStatus(`Telegram params: ${env.tgParams}`);
            updateDebugStatus(`AdsGram: ${adsGramAvailable}`);

            if (!env.isMiniApp) {
                updateDebugStatus("❌ CRITICAL: Not in Telegram Mini App");
                updateDebugStatus("💡 Even though opened from bot menu!");
                updateDebugStatus("🤔 Possible bot configuration issue");
                showBotConfigurationHelp(resolve, reject);
                return;
            }

            if (!adsGramAvailable) {
                updateDebugStatus("❌ In Mini App but AdsGram not loaded");
                showVisualAdSimulation(resolve, reject, "AdsGram SDK issue");
                return;
            }

            updateDebugStatus("🎯 Attempting REAL AdsGram ad...");

            try {
                window.AdsGram.showRewarded('15957', {
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

    function showBotConfigurationHelp(resolve, reject) {
        updateDebugStatus("📱 Showing bot configuration help");

        const helpOverlay = document.createElement('div');
        helpOverlay.style.cssText = `
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

        helpOverlay.innerHTML = `
            <h2>Bot Configuration Issue</h2>
            <p style="color: yellow;">Your bot is not launching as a Mini App</p>
            
            <div style="text-align: left; margin: 20px; background: #333; padding: 20px; border-radius: 10px;">
                <p><strong>To fix this:</strong></p>
                <p>1. Open @BotFather in Telegram</p>
                <p>2. Send: /mybots</p>
                <p>3. Select your bot</p>
                <p>4. Choose "Bot Settings"</p>
                <p>5. Choose "Menu Button"</p>
                <p>6. Set URL to: <code style="background: #555; padding: 2px 5px;">https://artnroll.github.io/BB_Evolution_Game_v1/</code></p>
                <p>7. Save and restart Telegram app</p>
            </div>
            
            <p>For now, we'll simulate an ad for testing</p>
            <div style="margin: 20px; padding: 20px; background: #333; border-radius: 10px;">
                <p>🎥 Ad simulation</p>
                <p id="countdown">⏰ 3 seconds remaining...</p>
            </div>
            <button id="skip-ad" style="margin-top: 20px; padding: 10px 20px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer;">Skip Ad</button>
        `;

        document.body.appendChild(helpOverlay);

        let timeLeft = 3;
        const countdownElement = document.getElementById('countdown');
        const countdownInterval = setInterval(() => {
            timeLeft--;
            countdownElement.textContent = `⏰ ${timeLeft} second${timeLeft !== 1 ? 's' : ''} remaining...`;

            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                document.body.removeChild(helpOverlay);
                updateDebugStatus("✅ Simulation completed - reward granted");
                notifyUnityAdCompleted(true);
                resolve(true);
            }
        }, 1000);

        document.getElementById('skip-ad').onclick = () => {
            clearInterval(countdownInterval);
            document.body.removeChild(helpOverlay);
            updateDebugStatus("❌ Simulation skipped - no reward");
            notifyUnityAdCompleted(false);
            reject(false);
        };
    }

    function showVisualAdSimulation(resolve, reject, reason) {
        updateDebugStatus(`📱 Showing simulation: ${reason}`);

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
            <p style="color: yellow;">${reason}</p>
            <div style="margin: 20px; padding: 20px; background: #333; border-radius: 10px;">
                <p>🎥 Video ad would play here</p>
                <p id="countdown">⏰ 3 seconds remaining...</p>
            </div>
            <button id="skip-ad" style="margin-top: 20px; padding: 10px 20px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer;">Skip Ad</button>
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

    // Initial environment analysis
    setTimeout(() => {
        updateDebugStatus("=== INITIAL ENVIRONMENT ANALYSIS ===");
        analyzeEnvironment();
    }, 1000);

})();
