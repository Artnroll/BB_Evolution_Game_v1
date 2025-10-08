(function () {
    const parent = window.parent;
    let unityInstance = null;

    const bridge = {
        // Initialize bridge with Unity instance
        init(unity) {
            unityInstance = unity;
            console.log('PlayDeckBridge initialized with Unity instance');
        },

        // Loading progress (0�100)
        SetLoading: function (progress) {
            console.log('PlayDeckBridge.SetLoading called:', progress);
            try {
                parent.postMessage({ playdeck: { method: 'loading', value: progress } }, '*');
            } catch (e) {
                console.warn('PlayDeckBridge.SetLoading failed:', e);
            }
        },

        // Game ended
        GameEnd: function () {
            console.log('PlayDeckBridge.GameEnd called');
            try {
                parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*');
            } catch (e) {
                console.warn('PlayDeckBridge.GameEnd failed:', e);
            }
        },

        // Analytics event
        Analytics: function (eventName, payload) {
            console.log('PlayDeckBridge.Analytics called:', eventName, payload);
            try {
                parent.postMessage({
                    playdeck: {
                        method: 'analytics',
                        event: eventName,
                        data: payload
                    }
                }, '*');
            } catch (e) {
                console.warn('PlayDeckBridge.Analytics failed:', e);
            }
        }
    };

    // Expose globally
    window.playDeckBridge = bridge;

    // Telegram Play message listener
    window.addEventListener('message', (ev) => {
        const data = ev.data?.playdeck;
        if (!data || !unityInstance) return;

        if (data.method === 'play') {
            console.log('PlayDeckBridge received play message from Telegram');
            if (unityInstance.SendMessage) {
                unityInstance.SendMessage('LoadingScreenUI', 'OnPlayButton');
            }
        }
    });

    console.log('PlayDeckBridge loaded successfully');
})();


