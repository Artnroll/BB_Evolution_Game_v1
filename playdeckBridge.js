// PlayDeck Bridge - ENHANCED ADSGRAM VERSION
(function () {
    'use strict';

    console.log("🔧 Initializing PlayDeck Bridge...");

    // Create debug panel
    const debugPanel = document.createElement('div');
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        max-width: 400px;
        max-height: 500px;
        overflow-y: auto;
        z-index: 9999;
        border: 2px solid red;
    `;
    debugPanel.innerHTML = '<h3 style="margin:0;color:yellow;">TELEGRAM DEBUG</h3><div id="debug-content"></div>';
    document.body.appendChild(debugPanel);

    function debugLog(message) {
        console.log("🔍 " + message);
        const content = document.getElementById('debug-content');
        if (content) {
            content.innerHTML += `<div style="margin:2px 0;">${message}</div>`;
            content.scrollTop = content.scrollHeight;
        }
    }

    debugLog("Bridge loading...");

    // Simple global functions that won't lose scope
    window.PlayDeck_SetLoading = function (progress) {
        console.log("SetLoading:", progress);
    };

    window.PlayDeck_GameEnd = function () {
        console.log("GameEnd called");
    };

    window.PlayDeck_Analytics = function (eventName, payload) {
        console.log("Analytics:", eventName, payload);
    };

    window.PlayDeck_AreAdsAvailable = function () {
        const isTelegram = !!(window.Telegram && window.Telegram.WebApp);
        const available = isTelegram ? !!window.AdsGram : true;
        debugLog(`Ads Available Check - Telegram: ${isTelegram}, AdsGram: ${!!window.AdsGram}, Available: ${available}`);
        return available;
    };

    window.PlayDeck_PreloadAds = function () {
        debugLog("PreloadAds called");
        // AdsGram doesn't need preloading, but we can check availability
        if (window.Telegram && window.Telegram.WebApp && window.AdsGram) {
            debugLog("✅ AdsGram is available in Telegram");
        } else if (!window.Telegram) {
            debugLog("ℹ️ Not in Telegram - using simulator ads");
        } else {
            debugLog("❌ AdsGram not available");
        }
    };

    window.PlayDeck_ShowRewardedAd = function () {
        debugLog("=== ShowRewardedAd CALLED ===");

        return new Promise((resolve, reject) => {
            const isTelegram = !!(window.Telegram && window.Telegram.WebApp);
            debugLog(`Environment - In Telegram: ${isTelegram}`);

            if (!isTelegram) {
                debugLog("SIMULATOR: Showing fake rewarded ad (2s delay)");
                setTimeout(() => {
                    debugLog("SIMULATOR: Ad completed successfully");

                    // Notify Unity directly
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                        debugLog("✅ Sent success to Unity AdsManager");
                    } else {
                        debugLog("❌ Unity instance not available to send result");
                    }

                    resolve(true);
                }, 2000);
                return;
            }

            // Real AdsGram implementation
            debugLog("Checking AdsGram availability...");
            if (!window.AdsGram) {
                debugLog("❌ AdsGram not available");
                if (window.unityInstance && window.unityInstance.SendMessage) {
                    window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                    debugLog("Sent failure to Unity AdsManager");
                }
                reject(false);
                return;
            }

            debugLog("✅ AdsGram available, showing rewarded ad...");

            const adBlockId = '15960'; // ← CHANGE THIS TO YOUR AD BLOCK ID
            debugLog(`Using Ad Block ID: ${adBlockId}`);

            try {
                window.AdsGram.showRewarded(adBlockId, {
                    onReward: (reward) => {
                        debugLog("✅ Rewarded ad completed successfully - user earned reward");
                        if (window.unityInstance && window.unityInstance.SendMessage) {
                            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                            debugLog("Sent success to Unity AdsManager");
                        }
                        resolve(true);
                    },
                    onClose: () => {
                        debugLog("❌ Rewarded ad closed without reward");
                        if (window.unityInstance && window.unityInstance.SendMessage) {
                            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                            debugLog("Sent failure to Unity AdsManager");
                        }
                        reject(false);
                    },
                    onError: (error) => {
                        debugLog(`❌ Rewarded ad error: ${error}`);
                        if (window.unityInstance && window.unityInstance.SendMessage) {
                            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                            debugLog("Sent failure to Unity AdsManager");
                        }
                        reject(false);
                    }
                });
                debugLog("✅ AdsGram.showRewarded called successfully");
            } catch (error) {
                debugLog(`❌ Exception in AdsGram.showRewarded: ${error}`);
                if (window.unityInstance && window.unityInstance.SendMessage) {
                    window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                }
                reject(false);
            }
        });
    };

    // TELEGRAM USERNAME GRAB - WITH RETRY LOGIC (UNCHANGED)
    window.getTelegramUsername = function (objectName, methodName) {
        debugLog("=== getTelegramUsername CALLED ===");

        function sendUsername() {
            if (window.Telegram && window.Telegram.WebApp) {
                const user = window.Telegram.WebApp.initDataUnsafe.user;
                if (user) {
                    let username = user.username ? '@' + user.username : user.first_name;

                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        debugLog("🚀 SENDING TO UNITY: " + username);
                        window.unityInstance.SendMessage(objectName, methodName, username);
                        debugLog("✅ SUCCESS: Username sent to Unity!");
                        return true;
                    } else {
                        debugLog("⏳ Unity not ready yet, will retry...");
                        return false;
                    }
                }
            }
            return false;
        }

        // Try immediately
        if (sendUsername()) {
            return;
        }

        // If not successful, set up retries
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = setInterval(() => {
            retryCount++;
            debugLog(`🔄 Retry ${retryCount}/${maxRetries}...`);

            if (sendUsername()) {
                clearInterval(retryInterval);
                debugLog("✅ Retry successful!");
            } else if (retryCount >= maxRetries) {
                clearInterval(retryInterval);
                debugLog("❌ Max retries reached, giving up");
            }
        }, 1000);
    };

    // Auto-detect and send Telegram username when possible
    function autoDetectTelegram() {
        debugLog("=== AUTO DETECT TELEGRAM ===");

        if (window.Telegram && window.Telegram.WebApp) {
            debugLog("🔄 Auto-detected Telegram, sending username...");
            setTimeout(() => {
                if (window.getTelegramUsername) {
                    window.getTelegramUsername('LoginManager', 'OnUsernameReceived');
                }
            }, 1000);
        } else {
            debugLog("⏹️ Telegram not available for auto-detection");
        }
    }

    // Initialize auto-detection
    setTimeout(autoDetectTelegram, 500);
    setTimeout(autoDetectTelegram, 2000);
    setTimeout(autoDetectTelegram, 5000);

    debugLog("✅ PlayDeck Bridge ready with Enhanced AdsGram");

})();
