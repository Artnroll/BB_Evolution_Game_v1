(function () {
    // Parent window reference
    const parent = window.parent;

    // PlayDeck bridge object
    const bridge = {
        unityInstance: null,

        // Called once Unity instance is ready
        init(unity) {
            this.unityInstance = unity;
            console.log('PlayDeckBridge initialized');
        },

        // Loading progress 0�100
        setLoadingProgress(value) {
            parent.postMessage({ playdeck: { method: 'loading', value } }, '*');
        },

        // Game ended
        gameEnd() {
            parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*');
        },

        // Analytics event
        analyticsEvent(eventName, payload) {
            parent.postMessage({ playdeck: { method: 'analytics', event: eventName, data: payload } }, '*');
        },

        // Request payment
        requestPayment(payload) {
            parent.postMessage({ playdeck: { method: 'requestPayment', value: payload } }, '*');
        }
    };

    // Expose bridge globally for message forwarding
    window.playDeckBridge = bridge;

    // Listen to PlayDeck wrapper messages (Play button etc.)
    window.addEventListener('message', (ev) => {
        const d = ev.data && ev.data.playdeck;
        if (!d) return;
        if (d.method === 'play' && bridge.unityInstance) {
            bridge.unityInstance.SendMessage('LoadingScreenUI', 'OnPlayButton');
        }
    });

})();


