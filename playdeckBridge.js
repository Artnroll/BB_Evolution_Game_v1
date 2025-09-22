(function () {
    const parent = window.parent;

    const bridge = {
        unityInstance: null,
        init(unity) {
            this.unityInstance = unity;
            console.log('PlayDeckBridge initialized');
        },
        setLoadingProgress(value) {
            try {
                parent.postMessage({ playdeck: { method: 'loading', value } }, '*');
            } catch (e) { console.warn(e); }
        },
        gameEnd() {
            parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*');
        },
        analyticsEvent(eventName, payload) {
            parent.postMessage({ playdeck: { method: 'analytics', event: eventName, data: payload } }, '*');
        },
        requestPayment(payload) {
            parent.postMessage({ playdeck: { method: 'requestPayment', value: payload } }, '*');
        }
    };

    window.playDeckBridge = bridge;

    // Safe SetLoading for Unity .jslib
    window.playDeckBridge.SetLoading = function (progress) {
        try { bridge.setLoadingProgress(progress); } catch (e) { console.warn(e); }
    };

    // Telegram Play message listener
    window.addEventListener('message', (ev) => {
        const d = ev.data?.playdeck;
        if (!d || !bridge.unityInstance) return;
        if (d.method === 'play') bridge.unityInstance.SendMessage('LoadingScreenUI', 'OnPlayButton');
    });
})();


