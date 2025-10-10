// PlayDeck Bridge - MAXIMUM DEBUGGING VERSION
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
        console.log("AreAdsAvailable:", available);
        return available;
    };

    window.PlayDeck_PreloadAds = function () {
        console.log("PreloadAds called");
    };

    window.PlayDeck_ShowRewardedAd = function () {
        console.log("ShowRewardedAd called");

        return new Promise((resolve, reject) => {
            const isTelegram = !!(window.Telegram && window.Telegram.WebApp);

            if (!isTelegram) {
                console.log("SIMULATOR: Showing fake rewarded ad");
                setTimeout(() => {
                    console.log("SIMULATOR: Ad completed successfully");

                    // Notify Unity directly
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                    }

                    resolve(true);
                }, 2000);
                return;
            }

            // Real AdsGram implementation
            if (!window.AdsGram) {
                console.error("AdsGram not available");
                if (window.unityInstance && window.unityInstance.SendMessage) {
                    window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                }
                reject(false);
                return;
            }

            console.log("Showing real rewarded ad");

            window.AdsGram.showRewarded('15876', {
                onReward: (reward) => {
                    console.log("Rewarded ad completed successfully");
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                    }
                    resolve(true);
                },
                onClose: () => {
                    console.log("Rewarded ad closed without reward");
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                    }
                    reject(false);
                },
                onError: (error) => {
                    console.error("Rewarded ad error:", error);
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                    }
                    reject(false);
                }
            });
        });
    };

    // TELEGRAM USERNAME GRAB - WITH RETRY LOGIC
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
        }, 1000); // Retry every second
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

    debugLog("✅ PlayDeck Bridge ready with MAX DEBUG");

})();
