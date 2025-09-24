(function () {
    const parent = window.parent;

    const bridge = {
        unityInstance: null,

        // Initialize bridge with Unity instance
        init(unity) {
            this.unityInstance = unity;
            console.log('PlayDeckBridge initialized');
        },

        // Loading progress (0�100)
        setLoadingProgress(value) {
            console.log('PlayDeckBridge setLoadingProgress called:', value);
            try {
                parent.postMessage({ playdeck: { method: 'loading', value } }, '*');
            } catch (e) {
                console.warn('PlayDeckBridge setLoadingProgress failed:', e);
            }
        },

        // Game ended
        gameEnd() {
            console.log('PlayDeckBridge gameEnd called');
            try {
                parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*');
            } catch (e) {
                console.warn('PlayDeckBridge gameEnd failed:', e);
            }
        },

        // Analytics event
        analyticsEvent(eventName, payload) {
            console.log('PlayDeckBridge analyticsEvent called:', eventName, payload);
            try {
                parent.postMessage({ playdeck: { method: 'analytics', event: eventName, data: payload } }, '*');
            } catch (e) {
                console.warn('PlayDeckBridge analyticsEvent failed:', e);
            }
        },

        // Request payment
        requestPayment(payload) {
            console.log('PlayDeckBridge requestPayment called:', payload);
            try {
                parent.postMessage({ playdeck: { method: 'requestPayment', value: payload } }, '*');
            } catch (e) {
                console.warn('PlayDeckBridge requestPayment failed:', e);
            }
        }
    };

    // Expose globally
    window.playDeckBridge = bridge;

    // Safe SetLoading for Unity .jslib
    window.playDeckBridge.SetLoading = function (progress) {
        console.log('PlayDeckBridge.SetLoading called:', progress);
        try {
            bridge.setLoadingProgress(progress);
        } catch (e) {
            console.warn('PlayDeckBridge.SetLoading failed:', e);
        }
    };

    // Telegram Play message listener
    window.addEventListener('message', (ev) => {
        const d = ev.data?.playdeck;
        if (!d || !bridge.unityInstance) return;
        if (d.method === 'play') {
            console.log('PlayDeckBridge received play message from Telegram');
            bridge.unityInstance.SendMessage('LoadingScreenUI', 'OnPlayButton');
        }
    });
})();



