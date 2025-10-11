/// playdeckBridge.js (replace existing)
(function () {
    'use strict';

    // Ensure appendDebug exists (HTML sets it too)
    function safeAppendDebug(msg) {
        try {
            if (window.appendDebug) {
                window.appendDebug(msg);
            } else {
                // fallback: console
                console.log("[appendDebug fallback] " + msg);
            }
        } catch (e) {
            console.log("[safeAppendDebug error] " + e);
        }
    }

    // Hook console methods to surface logs to on-screen console
    (function hookConsole() {
        if (window.__consoleHooked) return;
        window.__consoleHooked = true;

        const origLog = console.log.bind(console);
        const origWarn = console.warn.bind(console);
        const origError = console.error.bind(console);
        const origInfo = console.info.bind(console);

        console.log = function () {
            try {
                const args = Array.from(arguments).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
                safeAppendDebug("[LOG] " + args);
            } catch (e) { }
            origLog.apply(null, arguments);
        };

        console.warn = function () {
            try {
                const args = Array.from(arguments).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
                safeAppendDebug("[WARN] " + args);
            } catch (e) { }
            origWarn.apply(null, arguments);
        };

        console.error = function () {
            try {
                const args = Array.from(arguments).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
                safeAppendDebug("[ERROR] " + args);
            } catch (e) { }
            origError.apply(null, arguments);
        };

        console.info = function () {
            try {
                const args = Array.from(arguments).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
                safeAppendDebug("[INFO] " + args);
            } catch (e) { }
            origInfo.apply(null, arguments);
        };
    })();

    const parent = window.parent;

    const bridge = {
        unityInstance: null,

        init(unity) {
            this.unityInstance = unity;
            safeAppendDebug('PlayDeckBridge initialized');
        },

        setLoadingProgress(value) {
            safeAppendDebug('PlayDeckBridge setLoadingProgress: ' + value);
            try {
                parent.postMessage({ playdeck: { method: 'loading', value } }, '*');
            } catch (e) {
                safeAppendDebug('PlayDeckBridge.setLoadingProgress failed: ' + e);
            }
        },

        gameEnd() {
            safeAppendDebug('PlayDeckBridge gameEnd called');
            try {
                parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*');
            } catch (e) {
                safeAppendDebug('PlayDeckBridge.gameEnd failed: ' + e);
            }
        },

        analyticsEvent(eventName, payload) {
            safeAppendDebug(`PlayDeckBridge analyticsEvent called: ${eventName} ${payload}`);
            try {
                parent.postMessage({ playdeck: { method: 'analytics', event: eventName, data: payload } }, '*');
            } catch (e) {
                safeAppendDebug('PlayDeckBridge.analyticsEvent failed: ' + e);
            }
        },

        requestPayment(payload) {
            safeAppendDebug('PlayDeckBridge requestPayment: ' + JSON.stringify(payload));
            try {
                parent.postMessage({ playdeck: { method: 'requestPayment', value: payload } }, '*');
            } catch (e) {
                safeAppendDebug('PlayDeckBridge.requestPayment failed: ' + e);
            }
        }
    };

    // Expose
    window.playDeckBridge = bridge;

    // Safe SetLoading used by jslib
    window.playDeckBridge.SetLoading = function (progress) {
        safeAppendDebug('playDeckBridge.SetLoading: ' + progress);
        try { bridge.setLoadingProgress(progress); } catch (e) { safeAppendDebug('SetLoading error: ' + e); }
    };

    // Telegram Play listener
    window.addEventListener('message', (ev) => {
        const d = ev.data?.playdeck;
        if (!d || !bridge.unityInstance) return;
        if (d.method === 'play') {
            safeAppendDebug('PlayDeckBridge received play message from Telegram');
            bridge.unityInstance.SendMessage('LoadingScreenUI', 'OnPlayButton');
        }
    });

    window.playDeckBridge.GameEnd = function () {
        safeAppendDebug('playDeckBridge.GameEnd called');
        bridge.gameEnd();
    };

    // ===== Ads helpers (don't change names used by your C# / jslib) =====
    // We'll keep the methods minimal: they log heavily to help debugging in Telegram WebView

    window.playDeckBridge.preloadAds = function () {
        safeAppendDebug("playDeckBridge.preloadAds called");
        // If AdsGram has an init method you use, call it here (optional)
        if (window.Adsgram && typeof window.Adsgram.init === 'function') {
            try {
                safeAppendDebug("Calling Adsgram.init(...)");
                window.Adsgram.init({ debug: true });
            } catch (e) {
                safeAppendDebug("Adsgram.init error: " + e);
            }
        } else if (window.AdsGram && typeof window.AdsGram.init === 'function') {
            try {
                safeAppendDebug("Calling AdsGram.init(...)");
                window.AdsGram.init({ debug: true });
            } catch (e) {
                safeAppendDebug("AdsGram.init error: " + e);
            }
        } else {
            safeAppendDebug("No AdsGram/A dsgram init function found");
        }
    };

    window.playDeckBridge.areAdsAvailable = function () {
        // detect Telegram environment
        const isTG = !!(window.Telegram && window.Telegram.WebApp);
        let ok = false;
        if (!isTG) {
            safeAppendDebug("areAdsAvailable: not in Telegram -> simulate true");
            return true;
        }
        // if in Telegram, check AdsGram global(s)
        if (window.AdsGram) {
            // heuristics: check for known methods
            const methods = Object.getOwnPropertyNames(window.AdsGram);
            safeAppendDebug("AdsGram present, methods: " + methods.join(", "));
            ok = methods.some(m => typeof window.AdsGram[m] === 'function');
        } else if (window.Adsgram) {
            const methods = Object.getOwnPropertyNames(window.Adsgram);
            safeAppendDebug("Adsgram present, methods: " + methods.join(", "));
            ok = methods.some(m => typeof window.Adsgram[m] === 'function');
        } else {
            safeAppendDebug("AdsGram not present in Telegram environment");
            ok = false;
        }
        safeAppendDebug("areAdsAvailable => " + ok);
        return ok;
    };

    window.playDeckBridge.showRewardedAd = function () {
        safeAppendDebug("playDeckBridge.showRewardedAd called");
        // Keep behavior friendly: if AdsGram has a promise-based call, use it, otherwise try common methods.
        try {
            if (window.AdsGram && typeof window.AdsGram.showRewarded === 'function') {
                safeAppendDebug("Calling AdsGram.showRewarded");
                // return the Promise if the SDK returns one
                return window.AdsGram.showRewarded('15960', {
                    onReward: (r) => {
                        safeAppendDebug("AdsGram.onReward: " + JSON.stringify(r));
                        if (window.unityInstance && window.unityInstance.SendMessage) {
                            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                        }
                    },
                    onClose: () => {
                        safeAppendDebug("AdsGram.onClose");
                        if (window.unityInstance && window.unityInstance.SendMessage) {
                            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                        }
                    },
                    onError: (e) => {
                        safeAppendDebug("AdsGram.onError: " + e);
                        if (window.unityInstance && window.unityInstance.SendMessage) {
                            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                        }
                    }
                });
            } else if (window.Adsgram && typeof window.Adsgram.init === 'function') {
                // older style sad.min.js usage - try .init().show() pattern
                try {
                    safeAppendDebug("Using window.Adsgram.init()/show()");
                    const controller = window.Adsgram.init({ blockId: '15876', debug: true });
                    if (controller && typeof controller.show === 'function') {
                        return controller.show().then((result) => {
                            safeAppendDebug("Adsgram.controller.show resolved: " + JSON.stringify(result));
                            if (window.unityInstance && window.unityInstance.SendMessage) {
                                window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                            }
                        }).catch((err) => {
                            safeAppendDebug("Adsgram.controller.show rejected: " + err);
                            if (window.unityInstance && window.unityInstance.SendMessage) {
                                window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                            }
                        });
                    } else {
                        safeAppendDebug("adsController.show not available");
                        if (window.unityInstance && window.unityInstance.SendMessage) {
                            window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                        }
                        return;
                    }
                } catch (e) {
                    safeAppendDebug("Adsgram show exception: " + e);
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                    }
                }
            } else {
                safeAppendDebug("No recognized AdsGram API found - simulating ad in non-Telegram env");
                // In non Telegram or fallback, simulate success after 1.5s
                setTimeout(() => {
                    safeAppendDebug("Simulated ad complete -> true");
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                    }
                }, 1500);
                return;
            }
        } catch (e) {
            safeAppendDebug("showRewardedAd top-level exception: " + e);
            if (window.unityInstance && window.unityInstance.SendMessage) {
                window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
            }
        }
    };

    // expose small helpers for direct calls (keeps analytics/loading/gameEnd names used in your jslib)
    window.PlayDeck_SetLoading = function (p) { safeAppendDebug("[PlayDeck_SetLoading] " + p); };
    window.PlayDeck_GameEnd = function () { safeAppendDebug("[PlayDeck_GameEnd] called"); };
    window.PlayDeck_Analytics = function (name, payload) { safeAppendDebug("[PlayDeck_Analytics] " + name + " payload:" + payload); };

    // Convenience global used by jslib: append messages
    window.appendDebug = safeAppendDebug;

    // Debug ready message
    safeAppendDebug("playdeckBridge.js loaded and console hooked");
})();

