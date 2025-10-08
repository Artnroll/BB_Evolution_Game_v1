// PlayDeck Bridge for Unity WebGL with REAL AdsGram - REWARDED ADS ONLY
(function () {
    'use strict';

    console.log("Initializing PlayDeck Bridge with REAL AdsGram Rewarded Ads...");

    const bridge = {
        unityInstance: null,
        currentRewardResolve: null,
        currentRewardReject: null,
        isAdsGramReady: false,
        rewardedAdUnitId: '15876', // REPLACE WITH YOUR ACTUAL ID

        init: function (unity) {
            console.log("Bridge initialized with Unity instance");
            this.unityInstance = unity;
            this.initializeAdsGram();
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
        },

        // Initialize AdsGram SDK
        initializeAdsGram: function () {
            console.log("Initializing AdsGram SDK...");

            // Check if AdsGram is available
            if (!window.AdsGram) {
                console.error("AdsGram SDK not found");
                return;
            }

            // Initialize AdsGram (no app ID needed according to docs)
            window.AdsGram.init()
                .then(() => {
                    console.log("AdsGram initialized successfully");
                    this.isAdsGramReady = true;

                    // Preload rewarded ads for better performance
                    this.preloadRewardedAds();
                })
                .catch((error) => {
                    console.error("AdsGram initialization failed:", error);
                    this.isAdsGramReady = false;
                });
        },

        // Preload rewarded ads
        preloadRewardedAds: function () {
            if (this.isAdsGramReady && window.AdsGram.preload) {
                console.log("Preloading rewarded ads...");
                window.AdsGram.preload([this.rewardedAdUnitId])
                    .then(() => {
                        console.log("Rewarded ads preloaded successfully");
                    })
                    .catch((error) => {
                        console.warn("Rewarded ads preload failed:", error);
                    });
            }
        },

        // REAL AdsGram Rewarded Ad - CORRECT IMPLEMENTATION
        ShowRewardedAd: function () {
            console.log("ShowRewardedAd called");

            return new Promise((resolve, reject) => {
                // Check if AdsGram is ready
                if (!this.isAdsGramReady || !window.AdsGram) {
                    console.error("AdsGram not ready or not available");
                    this.notifyUnityAdCompleted(false);
                    reject(false);
                    return;
                }

                // Store callbacks
                this.currentRewardResolve = resolve;
                this.currentRewardReject = reject;

                console.log("Showing rewarded ad with unit ID:", this.rewardedAdUnitId);

                // Show the rewarded ad - CORRECT METHOD BASED ON DOCS
                window.AdsGram.showRewarded(this.rewardedAdUnitId, {
                    onReward: (reward) => {
                        console.log(" Rewarded ad completed successfully, reward:", reward);
                        this.clearRewardCallbacks();
                        this.notifyUnityAdCompleted(true);
                        resolve(true);
                    },
                    onClose: () => {
                        console.log("Rewarded ad closed without reward");
                        this.clearRewardCallbacks();
                        this.notifyUnityAdCompleted(false);
                        reject(false);
                    },
                    onError: (error) => {
                        console.error("Rewarded ad error:", error);
                        this.clearRewardCallbacks();
                        this.notifyUnityAdCompleted(false);
                        reject(false);
                    }
                }).catch((error) => {
                    console.error("Failed to show rewarded ad:", error);
                    this.clearRewardCallbacks();
                    this.notifyUnityAdCompleted(false);
                    reject(false);
                });
            });
        },

        // Clear reward callbacks to prevent memory leaks
        clearRewardCallbacks: function () {
            this.currentRewardResolve = null;
            this.currentRewardReject = null;
        },

        // Notify Unity about ad completion
        notifyUnityAdCompleted: function (success) {
            if (this.unityInstance && this.unityInstance.SendMessage) {
                const message = success ? "true" : "false";
                console.log("Notifying Unity - OnAdCompleted:", message);
                this.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', message);
            } else {
                console.warn("Unity instance not available for sending message");
            }
        },

        // Check if ads are available
        AreAdsAvailable: function () {
            const available = this.isAdsGramReady && !!window.AdsGram;
            console.log("AreAdsAvailable:", available);
            return available;
        },

        // Preload ads (public method for Unity)
        PreloadAds: function () {
            if (this.isAdsGramReady) {
                this.preloadRewardedAds();
            } else {
                console.warn("AdsGram not ready for preloading");
            }
        }
    };

    // Expose to global scope
    window.playDeckBridge = bridge;

    // Also expose directly for Unity's DllImport
    window.PlayDeck_SetLoading = bridge.SetLoading;
    window.PlayDeck_GameEnd = bridge.GameEnd;
    window.PlayDeck_Analytics = bridge.Analytics;
    window.PlayDeck_ShowRewardedAd = bridge.ShowRewardedAd;
    window.PlayDeck_AreAdsAvailable = bridge.AreAdsAvailable;
    window.PlayDeck_PreloadAds = bridge.PreloadAds;

    console.log("PlayDeck Bridge ready - Waiting for AdsGram SDK and Unity...");

    // Initialize when AdsGram SDK loads
    if (window.AdsGram) {
        console.log("AdsGram SDK already loaded, initializing...");
        bridge.initializeAdsGram();
    } else {
        // Wait for AdsGram SDK to load
        window.addEventListener('load', function () {
            if (window.AdsGram) {
                console.log("AdsGram SDK loaded on window load, initializing...");
                bridge.initializeAdsGram();
            }
        });
    }

})();

