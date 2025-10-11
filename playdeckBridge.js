// playdeckBridge.js (UPDATED)
// - Adds on-screen debug console
// - Makes ad callbacks robust (multiple callback names / promise handling)
// - Preserves existing stubs and telegram username getter

(function () {
    'use strict';

    // --- Configuration ----
    const AD_BLOCK_ID = '15960'; // your AdsGram block id
    const ADSGRAM_INIT_OPTS = { blockId: AD_BLOCK_ID, debug: true, debugConsole: true };

    // --- On-screen debug panel (useful when testing inside Telegram where console is hidden) ---
    (function createDebugPanel() {
        if (window.__playdeck_debug_panel_created) return;
        window.__playdeck_debug_panel_created = true;

        const panel = document.createElement('div');
        panel.id = 'playdeck-debug-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            width: 320px;
            max-height: 45vh;
            overflow-y: auto;
            background: rgba(0,0,0,0.85);
            color: #fff;
            font-family: monospace;
            font-size: 12px;
            padding: 8px;
            border-radius: 8px;
            z-index: 99999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            line-height: 1.2;
        `;
        panel.innerHTML = '<strong style="color:yellow">PLAYDECK DEBUG</strong><div id="playdeck-debug-contents" style="margin-top:6px;"></div>';
        document.body.appendChild(panel);

        // small clear button
        const btn = document.createElement('button');
        btn.textContent = 'Clear';
        btn.style.cssText = 'position: absolute; right: 8px; top: 6px; background:#222;color:#fff;border:none;padding:2px 6px;border-radius:4px;cursor:pointer';
        btn.onclick = () => {
            const c = document.getElementById('playdeck-debug-contents');
            if (c) c.innerHTML = '';
        };
        panel.appendChild(btn);

        // expose appendDebug
        window.appendDebug = function (msg) {
            try {
                const c = document.getElementById('playdeck-debug-contents');
                if (!c) return;
                const el = document.createElement('div');
                el.textContent = (new Date()).toISOString().substr(11, 12) + ' » ' + msg;
                c.appendChild(el);
                c.scrollTop = c.scrollHeight;
            } catch (e) {
                try { console.log('appendDebug error', e); } catch (_) { }
            }
        };
        window.appendDebug('Debug panel ready');
    })();

    // small helpers
    function safeLog(...args) { try { console.log(...args); window.appendDebug && window.appendDebug(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')); } catch (e) { } }
    function safeWarn(...args) { try { console.warn(...args); window.appendDebug && window.appendDebug('[WARN] ' + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')); } catch (e) { } }
    function safeError(...args) { try { console.error(...args); window.appendDebug && window.appendDebug('[ERR] ' + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')); } catch (e) { } }

    // --- Bridge object that stores unity instance ---
    const bridge = {
        unityInstance: null,
        init(unity) {
            this.unityInstance = unity;
            safeLog('PlayDeckBridge: unityInstance set');
        }
    };

    // backward compatibility
    window.playDeckBridge = window.playDeckBridge || bridge;

    // --- SANE STUBS to avoid null DllImport crashes ---
    window.PlayDeck_SetLoading = function (progress) {
        safeLog('PlayDeck_SetLoading (stub):', progress);
    };

    window.PlayDeck_GameEnd = function () {
        safeLog('PlayDeck_GameEnd (stub)');
        try { window.parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*'); } catch (e) { }
    };

    window.PlayDeck_Analytics = function (eventName, payload) {
        safeLog('PlayDeck_Analytics (stub):', eventName, payload);
    };

    window.PlayDeck_AreAdsAvailable = function () {
        safeLog('PlayDeck_AreAdsAvailable (stub) -> 0');
        return 0;
    };

    window.PlayDeck_PreloadAds = function () {
        safeLog('PlayDeck_PreloadAds (stub)');
    };

    window.PlayDeck_ShowRewardedAd = function () {
        safeLog('PlayDeck_ShowRewardedAd (stub) — sending failure to Unity');
        try { (bridge.unityInstance || window.unityInstance)?.SendMessage('AdsManager', 'OnAdCompleted', "false"); } catch (e) { }
    };

    // --- AdsGram detection / state ---
    let adsState = {
        methodType: null, // 'controller' | 'callback' | 'generic'
        controller: null,
        methodName: null,
        ready: false,
        globalObjName: null
    };

    function detectAdsGram() {
        const G = window;
        const candidateNames = ['AdsGram', 'Adsgram', 'AdsGramSDK', 'AdsgramSDK', 'sad', 'Ads'];
        for (const name of candidateNames) {
            if (G[name]) {
                safeLog('Detected AdsGram global as', name);
                adsState.globalObjName = name;
                return G[name];
            }
        }
        if (G.sad && (G.sad.AdsGram || G.sad.Adsgram)) {
            const o = G.sad.AdsGram || G.sad.Adsgram;
            safeLog('Detected AdsGram under sad namespace');
            adsState.globalObjName = 'sad.AdsGram';
            return o;
        }
        return null;
    }

    function initAdsGramControllerIfPossible(globalObj) {
        if (globalObj && typeof globalObj.init === 'function') {
            try {
                const controller = globalObj.init(ADSGRAM_INIT_OPTS);
                if (controller && typeof controller.show === 'function') {
                    adsState.methodType = 'controller';
                    adsState.controller = controller;
                    adsState.ready = true;
                    safeLog('AdsGram controller initialized (init -> controller.show)');
                    return true;
                }
            } catch (e) {
                safeWarn('AdsGram.init threw', e);
            }
        }
        return false;
    }

    function findCallbackStyleMethod(globalObj) {
        const methodCandidates = ['showRewarded', 'showRewardedAd', 'showAd', 'showInterstitial', 'displayAd', 'show'];
        for (const m of methodCandidates) {
            if (globalObj && typeof globalObj[m] === 'function') {
                adsState.methodType = 'callback';
                adsState.methodName = m;
                adsState.ready = true;
                safeLog('Found AdsGram callback-style method:', m);
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
                    safeLog('Using generic AdsGram method:', p);
                    return true;
                }
            }
        } catch (e) {
            safeWarn('generic search error', e);
        }
        return false;
    }

    function initializeAdsGramIfPossible() {
        const globalAds = detectAdsGram();
        if (!globalAds) {
            safeLog('No AdsGram global found yet');
            return false;
        }
        // prefer controller.init style
        if (initAdsGramControllerIfPossible(globalAds)) return true;
        if (findCallbackStyleMethod(globalAds)) return true;
        if (tryGenericSearch(globalAds)) return true;
        return false;
    }

    // run detection attempts
    setTimeout(() => initializeAdsGramIfPossible(), 300);
    setTimeout(() => initializeAdsGramIfPossible(), 1000);
    setTimeout(() => initializeAdsGramIfPossible(), 3000);

    // expose state for debugging
    window.playDeckBridge = window.playDeckBridge || {};
    window.playDeckBridge._adsState = adsState;

    // --- Enhanced ad-callback wiring ---
    function sendAdResultToUnity(success) {
        const str = success ? "true" : "false";
        try {
            const u = bridge.unityInstance || window.unityInstance;
            if (u && typeof u.SendMessage === 'function') {
                safeLog('Sending OnAdCompleted ->', str);
                u.SendMessage('AdsManager', 'OnAdCompleted', str);
            } else {
                safeWarn('Unity instance not ready when sending ad result:', str);
            }
        } catch (e) {
            safeError('Failed to SendMessage to Unity AdsManager.OnAdCompleted:', e);
        }
    }

    // Wrap multiple possible success callback names into a single handler
    function makeAdCallbacks() {
        return {
            onReward: function (payload) {
                safeLog('Ad callback: onReward', payload);
                sendAdResultToUnity(true);
            },
            onRewarded: function (payload) {
                safeLog('Ad callback: onRewarded', payload);
                sendAdResultToUnity(true);
            },
            onComplete: function (payload) {
                safeLog('Ad callback: onComplete', payload);
                // Some SDKs call complete even for skip. Heuristic: treat complete as success.
                sendAdResultToUnity(true);
            },
            onFinish: function (payload) {
                safeLog('Ad callback: onFinish', payload);
                sendAdResultToUnity(true);
            },
            onSuccess: function (payload) {
                safeLog('Ad callback: onSuccess', payload);
                sendAdResultToUnity(true);
            },
            onClose: function () {
                safeLog('Ad callback: onClose (no reward)');
                // Usually onClose means closed without reward; treat as false
                sendAdResultToUnity(false);
            },
            onCancel: function () {
                safeLog('Ad callback: onCancel (no reward)');
                sendAdResultToUnity(false);
            },
            onError: function (err) {
                safeWarn('Ad callback: onError', err);
                sendAdResultToUnity(false);
            }
        };
    }

    // Expose real functions (replace stubs)
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

        window.PlayDeck_ShowRewardedAd = function () {
            safeLog('PlayDeck_ShowRewardedAd invoked, adsState=', JSON.parse(JSON.stringify(adsState, Object.getOwnPropertyNames(adsState))));
            const callbacks = makeAdCallbacks();
            const globalAds = detectAdsGram();

            // 1) controller style: try controller.show(options) first, then controller.show()
            if (adsState.methodType === 'controller' && adsState.controller) {
                try {
                    // prefer passing callbacks if controller.show accepts args
                    if (typeof adsState.controller.show === 'function') {
                        safeLog('Calling controller.show with callbacks...');
                        try {
                            const maybe = adsState.controller.show(callbacks);
                            if (maybe && typeof maybe.then === 'function') {
                                maybe.then((res) => {
                                    safeLog('controller.show promise resolved', res);
                                    // sometimes the resolved value indicates reward state, check heuristics
                                    if (res && (res.rewarded === true || res.success === true || res.status === 'rewarded')) {
                                        sendAdResultToUnity(true);
                                    } else {
                                        // treat resolve as success by default
                                        sendAdResultToUnity(true);
                                    }
                                }).catch((err) => {
                                    safeWarn('controller.show promise rejected', err);
                                    sendAdResultToUnity(false);
                                });
                                return maybe;
                            } else {
                                // no promise returned — assume the callbacks will fire; if they don't, assume success
                                safeLog('controller.show returned non-promise; assuming callbacks or success');
                                return;
                            }
                        } catch (err) {
                            safeWarn('controller.show(callbacks) failed, trying controller.show()', err);
                            // fallback to calling without args
                            try {
                                const maybe2 = adsState.controller.show();
                                if (maybe2 && typeof maybe2.then === 'function') {
                                    maybe2.then(() => sendAdResultToUnity(true)).catch((err2) => { safeWarn('controller.show() rejected', err2); sendAdResultToUnity(false); });
                                    return maybe2;
                                } else {
                                    sendAdResultToUnity(true);
                                    return;
                                }
                            } catch (err3) {
                                safeWarn('controller.show() fallback failed', err3);
                                sendAdResultToUnity(false);
                                return;
                            }
                        }
                    }
                } catch (e) {
                    safeWarn('controller show invocation error', e);
                    sendAdResultToUnity(false);
                    return;
                }
            }

            // 2) callback-style: method(blockId, callbacks)
            if ((adsState.methodType === 'callback' || adsState.methodType === 'generic') && adsState.methodName) {
                try {
                    const methodName = adsState.methodName;
                    const method = globalAds && globalAds[methodName];
                    if (typeof method === 'function') {
                        safeLog('Calling Ads method:', methodName, 'with callbacks');
                        // call with blockId and callbacks object
                        const ret = method.call(globalAds, AD_BLOCK_ID, callbacks);
                        // if returns Promise -> attach handlers
                        if (ret && typeof ret.then === 'function') {
                            ret.then((r) => {
                                safeLog('Ads method promise resolved', r);
                                // treat resolution as success
                                sendAdResultToUnity(true);
                            }).catch((er) => {
                                safeWarn('Ads method promise rejected', er);
                                sendAdResultToUnity(false);
                            });
                            return ret;
                        }
                        // else callbacks will handle results
                        return ret;
                    } else {
                        safeWarn('Ads method not a function anymore:', adsState.methodName);
                    }
                } catch (e) {
                    safeWarn('Exception calling Ads method', e);
                    sendAdResultToUnity(false);
                    return;
                }
            }

            // 3) Not ready fallback
            safeWarn('PlayDeck_ShowRewardedAd: Ads not ready; notifying Unity with false');
            sendAdResultToUnity(false);
            return;
        };

        safeLog('playdeckBridge: Real ad functions exposed');
    }

    // Keep attempting to init and then expose real functions
    let initAttempts = 0;
    const maxInitAttempts = 12;
    const initTimer = setInterval(() => {
        initAttempts++;
        if (!adsState.ready) initializeAdsGramIfPossible();
        if (adsState.ready) {
            clearInterval(initTimer);
            exposeRealAdFunctions();
        } else if (initAttempts >= maxInitAttempts) {
            clearInterval(initTimer);
            // still expose functions to avoid null calls (they will report not available)
            exposeRealAdFunctions();
            safeWarn('playdeckBridge: AdsGram not detected after attempts; real functions exposed but will return not available.');
        }
    }, 700);

    // --- Telegram username retrieval used by LoginManager ---
    window.getTelegramUsername = function (unityObjectName, callbackMethod) {
        safeLog('getTelegramUsername called');
        function sendIfReady() {
            try {
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                    const user = window.Telegram.WebApp.initDataUnsafe.user;
                    const username = user.username ? user.username : (user.first_name || ("Player_" + user.id));
                    const u = bridge.unityInstance || window.unityInstance;
                    if (u && typeof u.SendMessage === 'function') {
                        safeLog('Sending username to Unity:', username, '->', unityObjectName, callbackMethod);
                        u.SendMessage(unityObjectName, callbackMethod, username);
                        return true;
                    } else {
                        safeWarn('Unity instance not ready for username send');
                        // fallback: set window.lastTelegramUsername for manual pick up
                        window.lastTelegramUsername = username;
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
        const max = 10;
        const t = setInterval(() => {
            tries++;
            if (sendIfReady()) {
                clearInterval(t);
            } else if (tries >= max) {
                clearInterval(t);
                safeWarn('getTelegramUsername: giving up after retries');
            }
        }, 700);
    };

    // expose bridge helpers
    window.playDeckBridge = Object.assign(window.playDeckBridge || {}, {
        init: function (unityInstance) { bridge.init(unityInstance); },
        _internalState: () => ({ adsState: adsState })
    });

    safeLog('playdeckBridge loaded (enhanced ad callbacks + debug UI).');

})();

