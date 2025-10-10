// PlayDeck Bridge - DYNAMIC ADSGRAM VERSION
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
    debugPanel.innerHTML = '<h3 style="margin:0;color:yellow;">DEBUG PANEL</h3><div id="debug-content"></div>';
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

    // AdsGram state
    let adsGramReady = false;
    let adsGramMethod = null;

    // Function to find AdsGram method
    function findAdsGramMethod() {
        debugLog("=== FINDING ADSGRAM METHOD ===");

        if (!window.AdsGram) {
            debugLog("❌ AdsGram not available");
            return null;
        }

        // List of possible method names
        const possibleMethods = [
            'showRewarded',
            'showRewardedAd',
            'showAd',
            'showInterstitial',
            'loadRewarded',
            'displayAd'
        ];

        for (const method of possibleMethods) {
            if (typeof window.AdsGram[method] === 'function') {
                debugLog(`✅ Found AdsGram method: ${method}`);
                return method;
            }
        }

        debugLog("❌ No known AdsGram methods found");
        debugLog("Available methods:", Object.getOwnPropertyNames(window.AdsGram));
        return null;
    }

    // Function to initialize AdsGram
    function initializeAdsGram() {
        debugLog("=== INITIALIZING ADSGRAM ===");

        const isTelegram = !!(window.Telegram && window.Telegram.WebApp);
        debugLog(`In Telegram: ${isTelegram}`);

        if (!isTelegram) {
            debugLog("Not in Telegram - simulator mode");
            adsGramReady = true;
            return;
        }

        debugLog(`AdsGram exists: ${!!window.AdsGram}`);

        if (window.AdsGram) {
            adsGramMethod = findAdsGramMethod();
            adsGramReady = !!adsGramMethod;

            if (adsGramReady) {
                debugLog(`✅ AdsGram ready with method: ${adsGramMethod}`);
            } else {
                debugLog("❌ AdsGram not ready - no suitable method found");
            }
        } else {
            debugLog("❌ AdsGram not loaded");
        }
    }

    // Initialize AdsGram when bridge loads
    setTimeout(initializeAdsGram, 1000);
    setTimeout(initializeAdsGram, 3000);

    // Simple global functions
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
        let available = false;

        if (isTelegram) {
            if (!adsGramReady) {
                initializeAdsGram();
            }
            available = adsGramReady;
            debugLog(`Ads Available - Telegram: ${isTelegram}, AdsGram: ${adsGramReady}, Final: ${available}`);
        } else {
            available = true;
            debugLog(`Ads Available - Simulator: ${available}`);
        }

        return available;
    };

    window.PlayDeck_PreloadAds = function () {
        debugLog("PreloadAds called");
        initializeAdsGram();
    };

    window.PlayDeck_ShowRewardedAd = function () {
        debugLog("=== ShowRewardedAd CALLED ===");

        return new Promise((resolve, reject) => {
            const isTelegram = !!(window.Telegram && window.Telegram.WebApp);
            debugLog(`Environment - Telegram: ${isTelegram}, AdsGram Ready: ${adsGramReady}, Method: ${adsGramMethod}`);

            if (!isTelegram) {
                debugLog("SIMULATOR: Fake ad (2s)");
                setTimeout(() => {
                    debugLog("SIMULATOR: Ad completed");
                    if (window.unityInstance) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                    }
                    resolve(true);
                }, 2000);
                return;
            }

            if (!adsGramReady || !adsGramMethod) {
                debugLog("❌ AdsGram not ready or no method available");
                if (window.unityInstance) {
                    window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                }
                reject(false);
                return;
            }

            debugLog(`✅ Showing AdsGram ad using method: ${adsGramMethod}`);
            const adBlockId = '15876'; // YOUR AD BLOCK ID

            try {
                // Dynamically call whatever method we found
                window.AdsGram[adsGramMethod](adBlockId, {
                    onReward: (reward) => {
                        debugLog("✅ Ad rewarded");
                        if (window.unityInstance) {
                            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                        }
                        resolve(true);
                    },
                    onClose: () => {
                        debugLog("❌ Ad closed without reward");
                        if (window.unityInstance) {
                            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                        }
                        reject(false);
                    },
                    onError: (error) => {
                        debugLog(`❌ Ad error: ${error}`);
                        if (window.unityInstance) {
                            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                        }
                        reject(false);
                    }
                });
            } catch (error) {
                debugLog(`❌ AdsGram exception: ${error}`);
                if (window.unityInstance) {
                    window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                }
                reject(false);
            }
        });
    };

    // TELEGRAM USERNAME FUNCTION (unchanged)
    window.getTelegramUsername = function (objectName, methodName) {
        debugLog("=== getTelegramUsername CALLED ===");

        function sendUsername() {
            if (window.Telegram && window.Telegram.WebApp) {
                const user = window.Telegram.WebApp.initDataUnsafe.user;
                if (user) {
                    let username = user.username ? '@' + user.username : user.first_name;

                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        debugLog("🚀 Sending username: " + username);
                        window.unityInstance.SendMessage(objectName, methodName, username);
                        return true;
                    }
                }
            }
            return false;
        }

        if (sendUsername()) return;

        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = setInterval(() => {
            retryCount++;
            debugLog(`🔄 Retry ${retryCount}/${maxRetries}`);

            if (sendUsername()) {
                clearInterval(retryInterval);
            } else if (retryCount >= maxRetries) {
                clearInterval(retryInterval);
                debugLog("❌ Max retries reached");
            }
        }, 1000);
    };

    debugLog("✅ PlayDeck Bridge ready with Dynamic AdsGram");

})();
