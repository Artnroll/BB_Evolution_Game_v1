// playdeckBridge.js
(function () {
    'use strict';

    // --- Configuration ----
    const DEFAULT_AD_BLOCK_ID = '15960'; // your default energy ad block id (existing)
    const ADSGRAM_INIT_OPTS = { blockId: DEFAULT_AD_BLOCK_ID, debug: true, debugConsole: true };

    function safeLog(...args) { try { console.log(...args); } catch (e) { } }
    function safeWarn(...args) { try { console.warn(...args); } catch (e) { } }
    function safeError(...args) { try { console.error(...args); } catch (e) { } }

    // Bridge object to hold unity instance
    const bridge = {
        unityInstance: null,
        init(unity) {
            this.unityInstance = unity;
            safeLog('PlayDeckBridge: unityInstance set');
        }
    };

    window.playDeckBridge = bridge;

    // -- Stubs to avoid null calls from Unity --
    window.PlayDeck_SetLoading = function (progress) { safeLog('PlayDeck_SetLoading called (stub):', progress); };
    window.PlayDeck_GameEnd = function () {
        safeLog('PlayDeck_GameEnd called (stub)');
        try { window.parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*'); } catch (e) { }
    };
    window.PlayDeck_Analytics = function (eventName, payload) { safeLog('PlayDeck_Analytics (stub):', eventName, payload); };
    window.PlayDeck_AreAdsAvailable = function () { safeLog('PlayDeck_AreAdsAvailable called (stub) -> returning 0'); return 0; };
    window.PlayDeck_PreloadAds = function () { safeLog('PlayDeck_PreloadAds called (stub)'); };
    window.PlayDeck_ShowRewardedAd = function () {
        safeLog('PlayDeck_ShowRewardedAd called (stub) - no ads available');
        try { if (bridge.unityInstance && bridge.unityInstance.SendMessage) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
    };

    // ----- AdsGram detection & init (same logic you had) -----
    let adsState = {
        methodType: null, // 'controller' | 'callback' | 'generic'
        controller: null,
        methodName: null,
        ready: false
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
                // Many SDKs accept options; we override blockId if caller passed one later.
                const controller = globalObj.init(initOpts || ADSGRAM_INIT_OPTS);
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
        const methodCandidates = ['showRewarded', 'showRewardedAd', 'showAd', 'show', 'showInterstitial', 'displayAd'];
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

    setTimeout(() => { initializeAdsGramIfPossible(); }, 300);
    setTimeout(() => { initializeAdsGramIfPossible(); }, 1000);
    setTimeout(() => { initializeAdsGramIfPossible(); }, 3000);

    window.playDeckBridge._adsState = adsState;

    // Expose real ad functions once adsState is ready (or after attempts)
    function exposeRealAdFunctions() {
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

        window.PlayDeck_PreloadAds = function () {
            safeLog('PlayDeck_PreloadAds called');
            if (!adsState.ready) initializeAdsGramIfPossible();
        };

        // Legacy: keep default call (uses DEFAULT_AD_BLOCK_ID)
        window.PlayDeck_ShowRewardedAd = function () {
            safeLog('PlayDeck_ShowRewardedAd (default) invoked - delegating to block id', DEFAULT_AD_BLOCK_ID);
            // Delegate to the new function
            if (typeof window.PlayDeck_ShowRewardedAdForBlock === 'function') {
                try { return window.PlayDeck_ShowRewardedAdForBlock(DEFAULT_AD_BLOCK_ID); } catch (e) { safeWarn('PlayDeck_ShowRewardedAd fallback failed', e); }
            }
            // fallback failure:
            try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
        };

        // MAIN NEW FUNCTION: show an ad for a specific blockId (string)
        window.PlayDeck_ShowRewardedAdForBlock = function (blockId) {
            const adBlock = blockId || DEFAULT_AD_BLOCK_ID;
            safeLog('PlayDeck_ShowRewardedAdForBlock called with blockId:', adBlock, 'adsState:', JSON.parse(JSON.stringify(adsState, Object.getOwnPropertyNames(adsState))));
            const globalAds = detectAdsGram();

            // controller style: prefer controller.show() — some controllers accept block id param in init, but many use controller.show()
            if (adsState.methodType === 'controller' && adsState.controller && typeof adsState.controller.show === 'function') {
                try {
                    // Some controllers accept parameter object or block id. We'll attempt various options safely:
                    // 1) try controller.show({ blockId: ... })
                    // 2) fall back to controller.show()
                    let r;
                    try {
                        r = adsState.controller.show({ blockId: adBlock });
                    } catch (e) {
                        safeLog('controller.show({blockId}) threw, try controller.show() without args', e);
                        r = adsState.controller.show();
                    }

                    if (r && typeof r.then === 'function') {
                        r.then((result) => {
                            safeLog('controller.show resolved', result);
                            try { if (bridge.unityInstance && bridge.unityInstance.SendMessage) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true"); } catch (e) { }
                        }).catch((err) => {
                            safeWarn('controller.show rejected', err);
                            try { if (bridge.unityInstance && bridge.unityInstance.SendMessage) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                        });
                        return r;
                    } else {
                        safeLog('controller.show returned non-promise, assume success');
                        try { if (bridge.unityInstance && bridge.unityInstance.SendMessage) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true"); } catch (e) { }
                        return;
                    }
                } catch (e) {
                    safeWarn('Exception calling controller.show', e);
                    try { if (bridge.unityInstance && bridge.unityInstance.SendMessage) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                    return;
                }
            }

            // callback/generic style: call globalAds[methodName](blockId, callbacks)
            if ((adsState.methodType === 'callback' || adsState.methodType === 'generic') && adsState.methodName && globalAds) {
                const method = globalAds[adsState.methodName];
                if (typeof method === 'function') {
                    try {
                        const maybeResult = method.call(globalAds, adBlock, {
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

                        if (maybeResult && typeof maybeResult.then === 'function') {
                            maybeResult.then(() => {
                                safeLog('Ads method-promise resolved (maybeResult)');
                                try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true"); } catch (e) { }
                            }).catch((err) => {
                                safeWarn('Ads method-promise rejected', err);
                                try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
                            });
                        }

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

            // Not ready fallback:
            safeWarn('PlayDeck_ShowRewardedAdForBlock: Ads not ready');
            try { if (bridge.unityInstance) bridge.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
            return;
        };

        safeLog('playdeckBridge: Real ad functions exposed.');
    }

    // Try init for a few attempts then expose real functions (or fallback)
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
            // still expose so Unity won't crash (but will return not available)
            exposeRealAdFunctions();
            safeWarn('playdeckBridge: AdsGram not detected after attempts; real functions exposed but will report not available.');
        }
    }, 700);

    // Telegram username helper (unchanged)
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
        if (sendIfReady()) return;
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

    // expose the bridge convenience API
    window.playDeckBridge = Object.assign(window.playDeckBridge || {}, {
        init: function (unityInstance) { bridge.init(unityInstance); },
        _internalState: () => ({ adsState: adsState })
    });

    safeLog('playdeckBridge loaded (ads shim + telegram username).');
})();

