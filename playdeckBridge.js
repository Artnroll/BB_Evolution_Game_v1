// playdeckBridge.js
(function () {
    'use strict';

    // --- Configuration ----
    const DEFAULT_AD_BLOCK_ID = '15960'; // default energy block id
    const ADSGRAM_INIT_OPTS = { blockId: DEFAULT_AD_BLOCK_ID, debug: false, debugConsole: true };
    const UNITY_SEND_RETRY_MS = 250;
    const UNITY_SEND_MAX_RETRIES = 30;

    // Small safe console wrappers
    function safeLog(...args) { try { console.log(...args); } catch (e) { } }
    function safeWarn(...args) { try { console.warn(...args); } catch (e) { } }
    function safeError(...args) { try { console.error(...args); } catch (e) { } }

    // Local helper to reliably send messages to Unity (retries until unityInstance available)
    function sendToUnity(objectName, methodName, message) {
        let tries = 0;
        const trySend = () => {
            tries++;
            try {
                const instance = (window.playDeckBridge && window.playDeckBridge.unityInstance) ? window.playDeckBridge.unityInstance : window.unityInstance;
                if (instance && typeof instance.SendMessage === 'function') {
                    instance.SendMessage(objectName, methodName, message);
                    safeLog(`sendToUnity: Sent -> ${objectName}.${methodName}("${message}")`);
                    return true;
                }
            } catch (e) {
                safeWarn('sendToUnity: send exception', e);
            }
            if (tries * UNITY_SEND_RETRY_MS >= UNITY_SEND_MAX_RETRIES * UNITY_SEND_RETRY_MS) {
                safeWarn(`sendToUnity: giving up after ${tries} tries for ${objectName}.${methodName}`);
                return false;
            }
            setTimeout(trySend, UNITY_SEND_RETRY_MS);
        };
        trySend();
    }

    // Bridge object to hold unity instance (and expose for others)
    const bridge = {
        unityInstance: null,
        init(unity) {
            this.unityInstance = unity;
            safeLog('PlayDeckBridge: unityInstance set');
        }
    };

    // Expose short alias - some other scripts use window.playDeckBridge
    window.playDeckBridge = bridge;

    // --- IMMEDIATE SAFE STUBS (prevent null calls) ---
    window.PlayDeck_SetLoading = function (progress) { safeLog('PlayDeck_SetLoading (stub):', progress); };
    window.PlayDeck_GameEnd = function () {
        safeLog('PlayDeck_GameEnd (stub)');
        try { window.parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*'); } catch (e) { }
    };
    window.PlayDeck_Analytics = function (eventName, payload) { safeLog('PlayDeck_Analytics (stub):', eventName, payload); };
    window.PlayDeck_AreAdsAvailable = function () { safeLog('PlayDeck_AreAdsAvailable (stub) -> 0'); return 0; };
    window.PlayDeck_PreloadAds = function () { safeLog('PlayDeck_PreloadAds (stub)'); };

    // NEW: stub for block-based ad call so DllImport always finds a function
    window.PlayDeck_ShowRewardedAdForBlock = function (blockId) {
        safeLog('PlayDeck_ShowRewardedAdForBlock (stub) called with blockId:', blockId);
        // Notify Unity that ad attempt failed (so Unity resets internal state)
        try { sendToUnity('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
    };

    // NEW: task stub (so PlayDeck_ShowTaskForBlock exists immediately)
    window.PlayDeck_ShowTaskForBlock = function (blockId) {
        safeLog('PlayDeck_ShowTaskForBlock (stub) called with', blockId);
        try { sendToUnity('AdsManager', 'OnTaskCompleted', "false"); } catch (e) { }
        return 0;
    };

    // Legacy default stub
    window.PlayDeck_ShowRewardedAd = function () {
        safeLog('PlayDeck_ShowRewardedAd (stub) called - delegating to block function');
        try { window.PlayDeck_ShowRewardedAdForBlock(DEFAULT_AD_BLOCK_ID); } catch (e) { safeWarn(e); }
    };

    // ----- AdsGram detection & init -----
    let adsState = {
        methodType: null, // 'controller' | 'callback' | 'generic'
        controller: null,
        methodName: null,
        ready: false,
        globalName: null
    };

    function detectAdsGram() {
        const G = window;
        const candidateNames = ['AdsGram', 'Adsgram', 'AdsGramSDK', 'AdsgramSDK', 'sad', 'Ads', 'adsgram'];
        for (const name of candidateNames) {
            if (G[name]) {
                safeLog('playdeckBridge: detected AdsGram global as', name);
                adsState.globalName = name;
                return G[name];
            }
        }
        if (G.sad && (G.sad.AdsGram || G.sad.Adsgram)) {
            safeLog('playdeckBridge: detected AdsGram under sad namespace');
            adsState.globalName = 'sad.AdsGram';
            return G.sad.AdsGram || G.sad.Adsgram;
        }
        return null;
    }

    function initAdsGramControllerIfPossible(globalObj, initOpts) {
        if (globalObj && typeof globalObj.init === 'function') {
            try {
                const controller = globalObj.init(initOpts || ADSGRAM_INIT_OPTS);
                if (controller && typeof controller.show === 'function') {
                    adsState.methodType = 'controller';
                    adsState.controller = controller;
                    adsState.ready = true;
                    safeLog('playdeckBridge: controller initialized');
                    return true;
                }
            } catch (e) {
                safeWarn('playdeckBridge: AdsGram.init threw', e);
            }
        }
        return false;
    }

    function findCallbackStyleMethod(globalObj) {
        const methodCandidates = ['showRewarded', 'showRewardedAd', 'showAd', 'show', 'showInterstitial', 'displayAd'];
        for (const m of methodCandidates) {
            if (globalObj && typeof globalObj[m] === 'function') {
                adsState.methodType = 'callback';
                adsState.methodName = m;
                adsState.ready = true;
                safeLog('playdeckBridge: Found callback-style method:', m);
                return true;
            }
        }
        return false;
    }

    function tryGenericSearch(globalObj) {
        if (!globalObj) return false;
        try {
            const props = Object.getOwnPropertyNames(globalObj);
            for (const p of props) {
                if (/show/i.test(p) && typeof globalObj[p] === 'function') {
                    adsState.methodType = 'generic';
                    adsState.methodName = p;
                    adsState.ready = true;
                    safeLog('playdeckBridge: Using generic AdsGram method:', p);
                    return true;
                }
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function initializeAdsGramIfPossible() {
        const globalAds = detectAdsGram();
        if (!globalAds) {
            safeLog('playdeckBridge: No AdsGram global found yet');
            return false;
        }
        if (initAdsGramControllerIfPossible(globalAds)) return true;
        if (findCallbackStyleMethod(globalAds)) return true;
        if (tryGenericSearch(globalAds)) return true;
        return false;
    }

    // Try initial detections (SDK often loads async)
    setTimeout(() => { initializeAdsGramIfPossible(); }, 300);
    setTimeout(() => { initializeAdsGramIfPossible(); }, 1000);
    setTimeout(() => { initializeAdsGramIfPossible(); }, 3000);

    window.playDeckBridge._adsState = adsState;

    // Now expose "real" functions (override stubs) once we detect or eventually even if we didn't
    function exposeRealAdFunctions() {
        // AreAdsAvailable
        window.PlayDeck_AreAdsAvailable = function () {
            try {
                const available = (adsState && adsState.ready) ? 1 : 0;
                safeLog('PlayDeck_AreAdsAvailable ->', available);
                return Number(available);
            } catch (e) {
                safeWarn('PlayDeck_AreAdsAvailable error', e);
                return 0;
            }
        };

        // Preload
        window.PlayDeck_PreloadAds = function () {
            safeLog('PlayDeck_PreloadAds called');
            if (!adsState.ready) initializeAdsGramIfPossible();
        };

        // Legacy default -> delegates to block call
        window.PlayDeck_ShowRewardedAd = function () {
            safeLog('PlayDeck_ShowRewardedAd (delegate) ->', DEFAULT_AD_BLOCK_ID);
            try { return window.PlayDeck_ShowRewardedAdForBlock(DEFAULT_AD_BLOCK_ID); } catch (e) { safeWarn(e); }
        };

        // MAIN: show rewarded ad for specific block
        window.PlayDeck_ShowRewardedAdForBlock = function (blockId) {
            const adBlock = blockId || DEFAULT_AD_BLOCK_ID;
            safeLog('PlayDeck_ShowRewardedAdForBlock called with', adBlock, 'adsState:', adsState);

            // send ad-request debug to Unity
            try { sendToUnity('AdsManager', 'OnAdRequestStarted', adBlock); } catch (e) { }

            const globalAds = detectAdsGram();

            // controller style
            if (adsState.methodType === 'controller' && adsState.controller && typeof adsState.controller.show === 'function') {
                try {
                    let r;
                    try {
                        r = adsState.controller.show({ blockId: adBlock });
                    } catch (e) {
                        safeLog('controller.show({blockId}) threw, calling without args', e);
                        r = adsState.controller.show();
                    }

                    if (r && typeof r.then === 'function') {
                        r.then((result) => {
                            safeLog('controller.show resolved', result);
                            try { sendToUnity('AdsManager', 'OnAdCompleted', "true"); } catch (e) { }
                        }).catch((err) => {
                            safeWarn('controller.show rejected', err);
                            try { sendToUnity('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                        });
                        return r;
                    } else {
                        safeLog('controller.show returned non-promise -> assume success');
                        try { sendToUnity('AdsManager', 'OnAdCompleted', "true"); } catch (e) { }
                        return;
                    }
                } catch (e) {
                    safeWarn('Exception calling controller.show', e);
                    try { sendToUnity('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                    return;
                }
            }

            // callback-style
            if ((adsState.methodType === 'callback' || adsState.methodType === 'generic') && adsState.methodName && globalAds) {
                const method = globalAds[adsState.methodName];
                if (typeof method === 'function') {
                    try {
                        const maybeResult = method.call(globalAds, adBlock, {
                            onReward: function (reward) {
                                safeLog('Ads callback:onReward', reward);
                                try { sendToUnity('AdsManager', 'OnAdCompleted', "true"); } catch (e) { }
                            },
                            onClose: function () {
                                safeLog('Ads callback:onClose');
                                try { sendToUnity('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                            },
                            onError: function (err) {
                                safeWarn('Ads callback:onError', err);
                                try { sendToUnity('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                            }
                        });

                        if (maybeResult && typeof maybeResult.then === 'function') {
                            maybeResult.then(() => {
                                safeLog('Ads method-promise resolved (maybeResult)');
                                try { sendToUnity('AdsManager', 'OnAdCompleted', "true"); } catch (e) { }
                            }).catch((err) => {
                                safeWarn('Ads method-promise rejected (maybeResult)', err);
                                try { sendToUnity('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                            });
                        }

                        return maybeResult;
                    } catch (e) {
                        safeWarn('Exception calling AdsGram method', e);
                        try { sendToUnity('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                        return;
                    }
                } else {
                    safeWarn('Ads method not a function:', adsState.methodName);
                    try { sendToUnity('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                    return;
                }
            }

            // Not ready fallback
            safeWarn('PlayDeck_ShowRewardedAdForBlock: Ads not ready (fallback)');
            try { sendToUnity('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
            return;
        };

        // MAIN: show TASK block for specific block id (calls AdsGram's UI for tasks).
        // This is separate so callbacks map to OnTaskCompleted on Unity side.
        window.PlayDeck_ShowTaskForBlock = function (blockId) {
            const adBlock = blockId || DEFAULT_AD_BLOCK_ID;
            safeLog('PlayDeck_ShowTaskForBlock called with', adBlock, 'adsState:', adsState);

            // send debug to Unity
            try { sendToUnity('AdsManager', 'OnAdRequestStarted', adBlock); } catch (e) { }

            const globalAds = detectAdsGram();

            // controller style: many controllers treat tasks same as show() but we'll call with blockId
            if (adsState.methodType === 'controller' && adsState.controller && typeof adsState.controller.show === 'function') {
                try {
                    let r;
                    try {
                        r = adsState.controller.show({ blockId: adBlock });
                    } catch (e) {
                        safeLog('controller.show({blockId}) threw (task), calling without args', e);
                        r = adsState.controller.show();
                    }

                    if (r && typeof r.then === 'function') {
                        r.then((result) => {
                            safeLog('controller.show (task) resolved', result);
                            try { sendToUnity('AdsManager', 'OnTaskCompleted', "true"); } catch (e) { }
                        }).catch((err) => {
                            safeWarn('controller.show (task) rejected', err);
                            try { sendToUnity('AdsManager', 'OnTaskCompleted', "false"); } catch (e) { }
                        });
                        return r;
                    } else {
                        safeLog('controller.show (task) non-promise -> assume success');
                        try { sendToUnity('AdsManager', 'OnTaskCompleted', "true"); } catch (e) { }
                        return;
                    }
                } catch (e) {
                    safeWarn('Exception calling controller.show for task', e);
                    try { sendToUnity('AdsManager', 'OnTaskCompleted', "false"); } catch (e) { }
                    return;
                }
            }

            // callback-style
            if ((adsState.methodType === 'callback' || adsState.methodType === 'generic') && adsState.methodName && globalAds) {
                const method = globalAds[adsState.methodName];
                if (typeof method === 'function') {
                    try {
                        const maybeResult = method.call(globalAds, adBlock, {
                            // For tasks we map the SDK callbacks to OnTaskCompleted
                            onReward: function (reward) {
                                safeLog('Ads TASK callback:onReward', reward);
                                try { sendToUnity('AdsManager', 'OnTaskCompleted', "true"); } catch (e) { }
                            },
                            onClose: function () {
                                safeLog('Ads TASK callback:onClose');
                                try { sendToUnity('AdsManager', 'OnTaskCompleted', "false"); } catch (e) { }
                            },
                            onError: function (err) {
                                safeWarn('Ads TASK callback:onError', err);
                                try { sendToUnity('AdsManager', 'OnTaskCompleted', "false"); } catch (e) { }
                            }
                        });

                        if (maybeResult && typeof maybeResult.then === 'function') {
                            maybeResult.then(() => {
                                safeLog('Ads TASK method-promise resolved (maybeResult)');
                                try { sendToUnity('AdsManager', 'OnTaskCompleted', "true"); } catch (e) { }
                            }).catch((err) => {
                                safeWarn('Ads TASK method-promise rejected (maybeResult)', err);
                                try { sendToUnity('AdsManager', 'OnTaskCompleted', "false"); } catch (e) { }
                            });
                        }

                        return maybeResult;
                    } catch (e) {
                        safeWarn('Exception calling AdsGram method for task', e);
                        try { sendToUnity('AdsManager', 'OnTaskCompleted', "false"); } catch (e) { }
                        return;
                    }
                } else {
                    safeWarn('Ads method not a function (task):', adsState.methodName);
                    try { sendToUnity('AdsManager', 'OnTaskCompleted', "false"); } catch (e) { }
                    return;
                }
            }

            // Not ready fallback
            safeWarn('PlayDeck_ShowTaskForBlock: Ads not ready (fallback)');
            try { sendToUnity('AdsManager', 'OnTaskCompleted', "false"); } catch (e) { }
            return;
        };

        safeLog('playdeckBridge: Real ad & task functions exposed.');
    }

    // Attempt initialization repeatedly, then exposeRealAdFunctions (so stubs are replaced)
    let initAttempts = 0;
    const maxInitAttempts = 10;
    const initTimer = setInterval(() => {
        initAttempts++;
        if (!adsState.ready) initializeAdsGramIfPossible();
        if (adsState.ready) {
            clearInterval(initTimer);
            exposeRealAdFunctions();
        } else if (initAttempts >= maxInitAttempts) {
            clearInterval(initTimer);
            // expose but will return not available / false
            exposeRealAdFunctions();
            safeWarn('playdeckBridge: AdsGram not detected after attempts; exposing fallback functions.');
        }
    }, 700);

    // Telegram username helper (unchanged)
    window.getTelegramUserFull = function (unityObjectName, callbackMethod) {
        function trySend() {
            try {
                let userData = null;

                // Method 1: Standard Telegram WebApp format
                if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                    const u = window.Telegram.WebApp.initDataUnsafe.user;
                    userData = {
                        id: u.id || 0,
                        username: u.username || "",
                        first_name: u.first_name || "",
                        last_name: u.last_name || "",
                        is_premium: u.is_premium || false
                    };
                }
                // Method 2: Alternative Telegram data location
                else if (window.Telegram?.WebApp?.initData) {
                    // Try to parse initData string
                    const initData = window.Telegram.WebApp.initData;
                    console.log("Raw initData:", initData);
                    // You might need to parse URL-encoded data here
                }
                // Method 3: Check for Telegram Android/iOS app injection
                else if (window.TelegramGameProxy) {
                    console.log("TelegramGameProxy found:", window.TelegramGameProxy);
                    // Some Telegram versions inject data differently
                }
                // Method 4: Check for any Telegram-related globals
                else {
                    console.log("Available Telegram-related globals:");
                    for (let key in window) {
                        if (key.toLowerCase().includes('telegram') ||
                            key.toLowerCase().includes('tg') ||
                            key.toLowerCase().includes('webapp')) {
                            console.log(`- ${key}:`, window[key]);
                        }
                    }
                }

                if (userData) {
                    console.log("Sending Telegram user data:", userData);
                    SendMessage(unityObjectName, callbackMethod, JSON.stringify(userData));
                    return true;
                } else {
                    console.log("No Telegram user data found in current attempt");
                    return false;
                }
            } catch (e) {
                console.warn('getTelegramUserFull error in trySend:', e);
                return false;
            }
        }

        // Try immediately
        if (trySend()) {
            console.log("Telegram data sent successfully on first try");
            return;
        }

        // If not found, retry several times with delays
        let tries = 0;
        const maxTries = 12; // Increased from 8
        console.log(`Starting Telegram data retry loop (${maxTries} attempts)`);

        const interval = setInterval(() => {
            tries++;
            console.log(`Telegram data retry attempt ${tries}/${maxTries}`);

            if (trySend()) {
                console.log("Telegram data found on attempt", tries);
                clearInterval(interval);
            } else if (tries >= maxTries) {
                console.log("Giving up on Telegram data after", maxTries, "attempts");

                // Send empty data as fallback so Unity knows we tried
                const fallbackData = {
                    id: 0,
                    username: "unknown",
                    first_name: "Unknown",
                    last_name: "User",
                    is_premium: false
                };

                try {
                    SendMessage(unityObjectName, callbackMethod, JSON.stringify(fallbackData));
                    console.log("Sent fallback user data");
                } catch (e) {
                    console.error("Failed to send fallback data:", e);
                }

                clearInterval(interval);
            }
        }, 500); // Reduced delay to 500ms
    };

    // expose the bridge convenience API
    window.playDeckBridge = Object.assign(window.playDeckBridge || {}, {
        init: function (unityInstance) { bridge.init(unityInstance); },
        _internalState: () => ({ adsState: adsState, detectedGlobal: adsState.globalName })
    });

    safeLog('playdeckBridge loaded (safe stubs + ads shim + telegram username).');

})();


