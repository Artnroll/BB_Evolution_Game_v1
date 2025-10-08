// PlayDeck Bridge for Unity WebGL
(function () {
    'use strict';

    console.log("Initializing PlayDeck Bridge...");

    const bridge = {
        unityInstance: null,

        init: function (unity) {
            console.log("Bridge initialized with Unity instance");
            this.unityInstance = unity;
        },

        SetLoading: function (progress) {
            console.log("SetLoading:", progress);
            try {
                if (window.parent && window.parent.postMessage) {
                    window.parent.postMessage({
                        playdeck: {
                            method: 'loading',
                            value: progress
                        }
                    }, '*');
                }
            } catch (e) {
                console.warn("SetLoading failed:", e);
            }
        },

        GameEnd: function () {
            console.log("GameEnd called");
            try {
                if (window.parent && window.parent.postMessage) {
                    window.parent.postMessage({
                        playdeck: {
                            method: 'gameEnd'
                        }
                    }, '*');
                }
            } catch (e) {
                console.warn("GameEnd failed:", e);
            }
        },

        Analytics: function (eventName, payload) {
            console.log("Analytics:", eventName, payload);
            try {
                if (window.parent && window.parent.postMessage) {
                    window.parent.postMessage({
                        playdeck: {
                            method: 'analytics',
                            event: eventName,
                            data: payload
                        }
                    }, '*');
                }
            } catch (e) {
                console.warn("Analytics failed:", e);
            }
        }
    };

    // Expose to global scope
    window.playDeckBridge = bridge;

    // Also expose directly for Unity's DllImport
    window.PlayDeck_SetLoading = bridge.SetLoading;
    window.PlayDeck_GameEnd = bridge.GameEnd;
    window.PlayDeck_Analytics = bridge.Analytics;

    console.log("PlayDeck Bridge ready");

})();

