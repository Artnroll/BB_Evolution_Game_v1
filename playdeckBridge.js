// playdeckBridge.js - debug-heavy version (only ad/debug additions)
(function () {
    'use strict';

    const AD_BLOCK_ID = '15960'; // your block id, keep as string
    const ADSGRAM_INIT_OPTS = { blockId: AD_BLOCK_ID, debug: true, debugConsole: true };

    function now() { return (new Date()).toISOString(); }
    function log(...a) { try { console.log("[playdeckBridge]", now(), ...a); } catch (e) { } }
    function warn(...a) { try { console.warn("[playdeckBridge]", now(), ...a); } catch (e) { } }
    function error(...a) { try { console.error("[playdeckBridge]", now(), ...a); } catch (e) { } }

    // Minimal bridge object
    const bridge = { unityInstance: null, adsObjectName: null };

    // Expose init (called by your html after Unity instance is created)
    bridge.init = function (unityInstance) {
        bridge.unityInstance = unityInstance;
        log("init: unityInstance set");
    };

    window.playdeckBridge = window.playdeckBridge || bridge;

    // Safe default stubs to avoid DllImport -> missing JS crash
    window.PlayDeck_SetLoading = window.PlayDeck_SetLoading || function (progress) { log("PlayDeck_SetLoading:", progress); };
    window.PlayDeck_GameEnd = window.PlayDeck_GameEnd || function () { log("PlayDeck_GameEnd called"); };
    window.PlayDeck_Analytics = window.PlayDeck_Analytics || function (eventName, payload) { log("PlayDeck_Analytics:", eventName, payload); };
    window.PlayDeck_PreloadAds = window.PlayDeck_PreloadAds || function () { log("PlayDeck_PreloadAds called"); };
    window.PlayDeck_AreAdsAvailable = window.PlayDeck_AreAdsAvailable || function () { log("PlayDeck_AreAdsAvailable called -> 0"); return 0; };

    // Register Ads GameObject name from Unity (optional but helpful)
    window.PlayDeck_RegisterAdsObject = function (name) {
        try {
            bridge.adsObjectName = name;
            log("PlayDeck_RegisterAdsObject: registered ads object name =", name);
        } catch (e) {
            warn("PlayDeck_RegisterAdsObject error:", e);
        }
    };

    // Helper: send ad result to Unity, tries registered name then fallback
    function sendAdResultToUnity(success, meta) {
        const resultStr = (success ? "true" : "false");
        const payload = (typeof meta === "string") ? meta : (meta ? JSON.stringify(meta) : resultStr);
        const candidates = [];
        if (bridge.adsObjectName) candidates.push(bridge.adsObjectName);
        candidates.push('AdsManager'); // fallback
        candidates.push('AdManager');  // extra fallback in case your object uses different naming
        log("sendAdResultToUnity: will try targets:", candidates, "payload:", payload);

        let sent = false;
        for (const target of candidates) {
            try {
                const instance = bridge.unityInstance || window.unityInstance;
                if (instance && instance.SendMessage) {
                    log(`sendAdResultToUnity: Sending to ${target}.OnAdCompleted -> ${payload}`);
                    instance.SendMessage(target, 'OnAdCompleted', payload);
                    sent = true;
                    // Do NOT break — send to multiple targets can help debugging.
                } else {
                    warn(`sendAdResultToUnity: no unityInstance.SendMessage available for target ${target}`);
                }
            } catch (e) {
                warn("sendAdResultToUnity: SendMessage error for target", target, e);
            }
        }
        if (!sent) warn("sendAdResultToUnity: no message sent, unity instance missing?");
        return sent;
    }

    // Detect AdsGram global object heuristically
    function detectAdsGramGlobal() {
        const names = ['AdsGram', 'Adsgram', 'adsgram', 'sad', 'Sad'];
        for (const n of names) {
            if (window[n]) {
                log("detectAdsGramGlobal: found", n);
                return window[n];
            }
        }
        // also support nested: window.sad?.AdsGram etc
        if (window.sad && (window.sad.AdsGram || window.sad.Adsgram)) {
            log("detectAdsGramGlobal: found window.sad.AdsGram");
            return window.sad.AdsGram || window.sad.Adsgram;
        }
        return null;
    }

    // Expose real PlayDeck_ShowRewardedAd that logs a lot and sends the result
    window.PlayDeck_ShowRewardedAd = function () {
        log("PlayDeck_ShowRewardedAd called");
        const adsGlobal = detectAdsGramGlobal();

        // If no AdsGram, simulate no ad available and return
        if (!adsGlobal) {
            warn("PlayDeck_ShowRewardedAd: AdsGram SDK not found");
            sendAdResultToUnity(false, { reason: 'adsdk_not_found' });
            return;
        }

        // Some SDKs have an init pattern returning controller
        try {
            if (typeof adsGlobal.init === 'function') {
                try {
                    const controller = adsGlobal.init(ADSGRAM_INIT_OPTS);
                    log("PlayDeck_ShowRewardedAd: init returned controller:", !!controller);
                    if (controller && typeof controller.show === 'function') {
                        const maybePromise = controller.show();
                        if (maybePromise && typeof maybePromise.then === 'function') {
                            log("PlayDeck_ShowRewardedAd: controller.show returned promise — attaching handlers");
                            maybePromise.then((res) => {
                                log("controller.show resolved:", res);
                                sendAdResultToUnity(true, res);
                            }).catch((err) => {
                                warn("controller.show rejected:", err);
                                sendAdResultToUnity(false, err);
                            });
                            return maybePromise;
                        } else {
                            log("controller.show did not return promise, assuming success");
                            sendAdResultToUnity(true, controller);
                            return;
                        }
                    }
                } catch (e) {
                    warn("PlayDeck_ShowRewardedAd: controller.init/show threw", e);
                    // continue to try other method candidates below
                }
            }

            // Try common method names on global
            const methodCandidates = ['showRewarded', 'showRewardedAd', 'showAd', 'show', 'showInterstitial', 'displayAd'];
            for (const m of methodCandidates) {
                if (typeof adsGlobal[m] === 'function') {
                    log(`PlayDeck_ShowRewardedAd: Using adsGlobal.${m}()`);
                    try {
                        const maybePromise = adsGlobal[m](AD_BLOCK_ID, {
                            onReward: function (reward) {
                                log(`${m} onReward:`, reward);
                                sendAdResultToUnity(true, reward);
                            },
                            onClose: function () {
                                log(`${m} onClose (no reward)`);
                                sendAdResultToUnity(false, { reason: 'closed' });
                            },
                            onError: function (err) {
                                warn(`${m} onError:`, err);
                                sendAdResultToUnity(false, err);
                            }
                        });
                        if (maybePromise && typeof maybePromise.then === 'function') {
                            log(`${m} returned a Promise; attaching then/catch`);
                            maybePromise.then((r) => { log(`${m} promise resolved`, r); sendAdResultToUnity(true, r); })
                                .catch((err) => { warn(`${m} promise rejected`, err); sendAdResultToUnity(false, err); });
                        }
                        return maybePromise;
                    } catch (e) {
                        warn(`${m} threw:`, e);
                        sendAdResultToUnity(false, { reason: 'exception', message: String(e) });
                        return;
                    }
                }
            }

            // No known API found
            warn("PlayDeck_ShowRewardedAd: AdsGram present but no known show method");
            // Log all keys to help debug
            try { log("AdsGlobal keys:", Object.keys(adsGlobal)); } catch (e) { }
            sendAdResultToUnity(false, { reason: 'no_show_method' });
        } catch (e) {
            error("PlayDeck_ShowRewardedAd: unexpected error", e);
            sendAdResultToUnity(false, { reason: 'unexpected', message: String(e) });
        }
    };

    // Expose debug function to query ad internals (helpful)
    window.PlayDeck_DebugAdState = function () {
        try {
            const adsGlobal = detectAdsGramGlobal();
            const state = {
                adsGlobalPresent: !!adsGlobal,
                adsGlobalKeys: adsGlobal ? Object.keys(adsGlobal) : null,
                registeredAdsObjectName: bridge.adsObjectName,
                unityInstanceAvailable: !!(bridge.unityInstance || window.unityInstance)
            };
            log("PlayDeck_DebugAdState:", state);
            return JSON.stringify(state);
        } catch (e) {
            error("PlayDeck_DebugAdState error", e);
            return "{}";
        }
    };

    // Expose playdeckBridge.init to allow your HTML to call it explicitly (optional)
    window.playdeckBridge.init = function (unityInstance) { bridge.init(unityInstance); };

    log("playdeckBridge loaded (debug ad shim)");
})();

