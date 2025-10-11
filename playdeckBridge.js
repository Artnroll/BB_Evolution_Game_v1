// playdeckBridge.js
(function () {
    'use strict';

    // --- Configuration ----
    const AD_BLOCK_ID = '15960'; // set your AdsGram block id here
    const ADSGRAM_INIT_OPTS = { blockId: AD_BLOCK_ID, debug: true, debugConsole: true };

    // Small helper for safe console
    function safeLog(...args) { try { console.log(...args); } catch (e) { } }
    function safeWarn(...args) { try { console.warn(...args); } catch (e) { } }
    function safeError(...args) { try { console.error(...args); } catch (e) { } }

    // --- Public bridge object (keeps unity instance reference) ---
    const bridge = {
        unityInstance: null,
        init(unity) {
            this.unityInstance = unity;
            safeLog('PlayDeckBridge: unityInstance set');
        }
    };

    // Expose playdeckBridge for backward compatibility (some code expects window.playDeckBridge)
    window.playDeckBridge = bridge;

    // --- SAFE STUBS (immediately available so Unity's DllImport never calls null) ---
    // These stubs are intentionally synchronous and non-throwing. They will be replaced when SDK is ready.
    window.PlayDeck_SetLoading = function (progress) {
        safeLog('PlayDeck_SetLoading called (stub):', progress);
    };

    window.PlayDeck_GameEnd = function () {
        safeLog('PlayDeck_GameEnd called (stub)');
        // Try to post message to parent (PlayDeck)
        try { window.parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*'); }
        catch (e) { }
    };

    window.PlayDeck_Analytics = function (eventName, payload) {
        safeLog('PlayDeck_Analytics called (stub):', eventName, payload);
    };

    // AreAdsAvailable must return numeric 1 or 0 (C# expects int)
    window.PlayDeck_AreAdsAvailable = function () {
        safeLog('PlayDeck_AreAdsAvailable called (stub) -> returning 0');
        return 0;
    };

    window.PlayDeck_PreloadAds = function () {
        safeLog('PlayDeck_PreloadAds called (stub)');
    };

    // Show rewarded ad stub (won't throw, will send false callback to unity)
    window.PlayDeck_ShowRewardedAd = function () {
        safeLog('PlayDeck_ShowRewardedAd called (stub) - no ads available');
        // Ensure we don't throw when Unity calls this; send OnAdCompleted(false)
        try {
            if (bridge.unityInstance && bridge.unityInstance.SendMessage) {
                bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
            }
        } catch (e) { }
        // return undefined (Unity ignores return) — but when real impl replaces this it may return a Promise
    };

    // ----- AdsGram integration -----
    // We'll try to support: Adsgram.init(...).show() (promise style),
    // and AdsGram.showRewarded(blockId, {onReward,onClose,onError}) style.
    let adsState = {
        methodType: null, // 'controller' or 'callback' or 'generic'
        controller: null,
        methodName: null,
        ready: false
    };

    function detectAdsGram() {
        // Normalize possible global names
        const G = window;
        const candidateNames = ['AdsGram', 'Adsgram', 'AdsGramSDK', 'AdsgramSDK', 'sad', 'Ads'];
        for (const name of candidateNames) {
            if (G[name]) {
                safeLog('playdeckBridge: detected AdsGram global as', name);
                return G[name];
            }
        }
        // Try window.sad or other nested properties
        if (G.sad && (G.sad.AdsGram || G.sad.Adsgram)) {
            safeLog('playdeckBridge: detected AdsGram under sad namespace');
            return G.sad.AdsGram || G.sad.Adsgram;
        }
        return null;
    }

    function initAdsGramControllerIfPossible(globalObj) {
        // Some SDKs provide adsController = Adsgram.init({blockId:...,debug:...}); and then adsController.show() returns a Promise
        if (globalObj && typeof globalObj.init === 'function') {
            try {
                const controller = globalObj.init(ADSGRAM_INIT_OPTS);
                if (controller && typeof controller.show === 'function') {
                    adsState.methodType = 'controller';
                    adsState.controller = controller;
                    adsState.ready = true;
                    safeLog('playdeckBridge: AdsGram controller initialized (init->controller.show)');
                    return true;
                }
            } catch (e) {
                safeWarn('playdeckBridge: AdsGram.init threw', e);
            }
        }
        return false;
    }

    function findCallbackStyleMethod(globalObj) {
        // Many SDKs expose showRewarded(blockId, callbacks) or showRewardedAd(...)
        const methodCandidates = [
            'showRewarded', 'showRewardedAd', 'showAd', 'show', 'showInterstitial', 'displayAd'
        ];
        for (const m of methodCandidates) {
            if (globalObj && typeof globalObj[m] === 'function') {
                adsState.methodType = 'callback';
                adsState.methodName = m;
                adsState.ready = true;
                safeLog('playdeckBridge: Found AdsGram callback-style method:', m);
                return true;
            }
        }
        return false;
    }

    function tryGenericSearch(globalObj) {
        // As a last resort, search for any function property containing 'show' in its name
        if (!globalObj) return false;
        const props = Object.getOwnPropertyNames(globalObj);
        for (const p of props) {
            try {
                if (/show/i.test(p) && typeof globalObj[p] === 'function') {
                    adsState.methodType = 'generic';
                    adsState.methodName = p;
                    adsState.ready = true;
                    safeLog('playdeckBridge: Using generic AdsGram method:', p);
                    return true;
                }
            } catch (e) { }
        }
        return false;
    }

    function initializeAdsGramIfPossible() {
        const globalAds = detectAdsGram();
        if (!globalAds) {
            safeLog('playdeckBridge: No AdsGram global found yet');
            return false;
        }

        // prefer controller.init style
        if (initAdsGramControllerIfPossible(globalAds)) return true;

        // fallback to callback style methods
        if (findCallbackStyleMethod(globalAds)) return true;

        // fallback generic search
        if (tryGenericSearch(globalAds)) return true;

        return false;
    }

    // attempt initialization immediately and also after a few delays (SDK might load async)
    setTimeout(() => { initializeAdsGramIfPossible(); }, 300);
    setTimeout(() => { initializeAdsGramIfPossible(); }, 1000);
    setTimeout(() => { initializeAdsGramIfPossible(); }, 3000);

    // Expose richer utilities if desired
    window.playDeckBridge._adsState = adsState;

    // --- Implement the real functions to replace stubs when ready ---
    function exposeRealAdFunctions() {
        // PlayDeck_AreAdsAvailable -> return 1 or 0
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

        // Preload / init call
        window.PlayDeck_PreloadAds = function () {
            safeLog('PlayDeck_PreloadAds called');
            // Try to initialize again if not ready
            if (!adsState.ready) {
                initializeAdsGramIfPossible();
            }
        };

        // Show rewarded ad: attempt to return a Promise if underlying API supports it.
        window.PlayDeck_ShowRewardedAd = function () {
            safeLog('PlayDeck_ShowRewardedAd invoked, adsState:', JSON.parse(JSON.stringify(adsState, Object.getOwnPropertyNames(adsState))));
            // If controller style
            if (adsState.methodType === 'controller' && adsState.controller && typeof adsState.controller.show === 'function') {
                try {
                    const p = adsState.controller.show(); // typically returns a Promise
                    if (p && typeof p.then === 'function') {
                        p.then((result) => {
                            safeLog('Ads controller.show resolved', result);
                            if (bridge.unityInstance && bridge.unityInstance.SendMessage) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                        }).catch((err) => {
                            safeWarn('Ads controller.show rejected', err);
                            if (bridge.unityInstance && bridge.unityInstance.SendMessage) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                        });
                        return p;
                    } else {
                        // no promise — assume success
                        safeLog('Ads controller.show returned non-promise, assuming success');
                        if (bridge.unityInstance && bridge.unityInstance.SendMessage) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                        return;
                    }
                } catch (e) {
                    safeWarn('Exception calling controller.show', e);
                    if (bridge.unityInstance && bridge.unityInstance.SendMessage) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                    return;
                }
            }

            // If callback-style: AdsGram.showRewarded(blockId, {onReward,onClose,onError})
            if ((adsState.methodType === 'callback' || adsState.methodType === 'generic') && adsState.methodName) {
                const globalAds = detectAdsGram();
                const method = globalAds && globalAds[adsState.methodName];
                if (typeof method === 'function') {
                    try {
                        // many callback implementations expect (blockId, callbacks)
                        const maybeResult = method.call(globalAds, AD_BLOCK_ID, {
                            onReward: function (reward) {
                                safeLog('Ads callback onReward', reward);
                                try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true"); } catch (e) { }
                            },
                            onClose: function () {
                                safeLog('Ads callback onClose');
                                try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                            },
                            onError: function (err) {
                                safeWarn('Ads callback onError', err);
                                try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                            }
                        });

                        // if the method returns a Promise, attach handlers
                        if (maybeResult && typeof maybeResult.then === 'function') {
                            maybeResult.then(() => {
                                safeLog('Ads method-promise resolved');
                                try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true"); } catch (e) { }
                            }).catch((err) => {
                                safeWarn('Ads method-promise rejected', err);
                                try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                            });
                            return maybeResult;
                        }

                        // otherwise we assume AD is handled by callbacks above
                        return maybeResult;
                    } catch (e) {
                        safeWarn('Exception calling AdsGram callback-style method', e);
                        try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                        return;
                    }
                } else {
                    safeWarn('Ads method not a function:', adsState.methodName);
                    try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                    return;
                }
            }

            // Not ready fallback: send failure
            safeWarn('PlayDeck_ShowRewardedAd: Ads not ready');
            try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
            return;
        };

        safeLog('playdeckBridge: Real ad functions exposed.');
    }

    // Keep attempting to initialize AdsGram for a while and then expose real implementations once detected
    let initAttempts = 0;
    const maxInitAttempts = 10;
    const initTimer = setInterval(() => {
        initAttempts++;
        if (!adsState.ready) {
            initializeAdsGramIfPossible();
        }
        if (adsState.ready) {
            clearInterval(initTimer);
            exposeRealAdFunctions();
        } else if (initAttempts >= maxInitAttempts) {
            clearInterval(initTimer);
            // expose functions even if not ready so Unity calls won't crash (they will return 'not available')
            exposeRealAdFunctions();
            safeWarn('playdeckBridge: AdsGram not detected after attempts; stubs remain but real functions exposed (will return not available).');
        }
    }, 700);

    // --- Telegram username function (unchanged behavior)
    // keep it here so LoginManager's ExternalCall / getTelegramUsername can find it
    window.getTelegramUsername = function (unityObjectName, callbackMethod) {
        safeLog('getTelegramUsername called');
        function sendIfReady() {
            try {
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                    const user = window.Telegram.WebApp.initDataUnsafe.user;
                    const username = user.username ? user.username : (user.first_name || ("Player_" + user.id));
                    if (bridge.unityInstance && bridge.unityInstance.SendMessage) {
                        bridge.unityInstance.SendMessage(unityObjectName, callbackMethod, username);
                    } else {
                        // fallback: use global unityInstance (if script used window.unityInstance)
                        try { if (window.unityInstance && window.unityInstance.SendMessage) window.unityInstance.SendMessage(unityObjectName, callbackMethod, username); } catch (e) { }
                    }
                    safeLog('getTelegramUsername: sent username ->', username);
                    return true;
                }
            } catch (e) {
                safeWarn('getTelegramUsername error', e);
            }
            return false;
        }

        // immediate attempt
        if (sendIfReady()) return;

        // fallback retries: SDK may not be ready yet
        let tries = 0;
        const max = 8;
        const t = setInterval(() => {
            tries++;
            if (sendIfReady() || tries >= max) {
                clearInterval(t);
                if (tries >= max) safeWarn('getTelegramUsername: giving up after retries');
            }
        }, 700);
    };

    // Expose the bridge object for optional external use
    window.playDeckBridge = Object.assign(window.playDeckBridge || {}, {
        init: function (unityInstance) { bridge.init(unityInstance); },
        _internalState: () => ({ adsState: adsState })
    });

    safeLog('playdeckBridge loaded (ads shim + telegram username).');

})();
