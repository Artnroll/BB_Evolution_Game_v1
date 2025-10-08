// PlayDeck Bridge for Unity WebGL with CORRECT AdsGram SDK - FIXED SCOPE
(function () {
    'use strict';

    console.log("🔧 Initializing PlayDeck Bridge with AdsGram...");

    const bridge = {
        unityInstance: null,
        currentRewardResolve: null,
        currentRewardReject: null,
        isAdsGramReady: false,
        isTelegram: false,
        rewardedAdUnitId: '15876', // Your actual ad unit ID

        init: function (unity) {
            console.log("🔧 Bridge initialized with Unity instance");
            this.unityInstance = unity;
            this.isTelegram = this.isTelegramEnvironment();
            console.log("🔧 Is Telegram environment:", this.isTelegram);

            // Initialize AdsGram if in Telegram
            if (this.isTelegram) {
                this.initializeAdsGram();
            } else {
                console.log("🔧 Not in Telegram - using simulator mode");
                this.isAdsGramReady = true;
            }
        },

        isTelegramEnvironment: function () {
            return !!(window.Telegram && window.Telegram.WebApp);
        },

        initializeAdsGram: function () {
            console.log("🔧 Initializing AdsGram SDK...");

            if (!window.AdsGram) {
                console.error("❌ AdsGram SDK not found!");
                console.log("🔧 Available global objects:", Object.keys(window));
                return;
            }

            console.log("✅ AdsGram SDK found, methods:", Object.keys(window.AdsGram));

            // CORRECT initialization based on docs
            window.AdsGram.init()
                .then(() => {
                    console.log("✅ AdsGram initialized successfully");
                    this.isAdsGramReady = true;

                    // Preload rewarded ads
                    this.preloadRewardedAds();
                })
                .catch((error) => {
                    console.error("❌ AdsGram initialization failed:", error);
                    this.isAdsGramReady = false;
                });
        },

        preloadRewardedAds: function () {
            if (this.isAdsGramReady && window.AdsGram.preload) {
                console.log("🔧 Preloading rewarded ads...");
                window.AdsGram.preload([this.rewardedAdUnitId])
                    .then(() => {
                        console.log("✅ Rewarded ads preloaded successfully");
                    })
                    .catch((error) => {
                        console.warn("⚠️ Rewarded ads preload failed:", error);
                    });
            }
        },

        ShowRewardedAd: function () {
            console.log("🔧 ShowRewardedAd called");

            // FIX: Store 'this' in a variable to preserve context
            const self = this;

            return new Promise((resolve, reject) => {
                // Browser simulator for testing
                if (!self.isTelegram) {
                    console.log("🔄 SIMULATOR: Showing fake rewarded ad");
                    setTimeout(() => {
                        const simulateSuccess = true; // Change to false to test failure
                        if (simulateSuccess) {
                            console.log("🔄 SIMULATOR: Ad completed successfully");
                            self.notifyUnityAdCompleted(true); // Use self instead of this
                            resolve(true);
                        } else {
                            console.log("🔄 SIMULATOR: Ad failed");
                            self.notifyUnityAdCompleted(false); // Use self instead of this
                            reject(false);
                        }
                    }, 2000);
                    return;
                }

                // Real AdsGram implementation
                if (!self.isAdsGramReady) {
                    console.error("❌ AdsGram not ready");
                    self.notifyUnityAdCompleted(false); // Use self instead of this
                    reject(false);
                    return;
                }

                console.log("🔧 Showing real rewarded ad with unit ID:", self.rewardedAdUnitId);

                self.currentRewardResolve = resolve;
                self.currentRewardReject = reject;

                try {
                    // CORRECT method call based on AdsGram docs
                    window.AdsGram.showRewarded(self.rewardedAdUnitId, {
                        onReward: (reward) => {
                            console.log("✅ Rewarded ad completed successfully, reward:", reward);
                            self.clearRewardCallbacks();
                            self.notifyUnityAdCompleted(true);
                            resolve(true);
                        },
                        onClose: () => {
                            console.log("❌ Rewarded ad closed without reward");
                            self.clearRewardCallbacks();
                            self.notifyUnityAdCompleted(false);
                            reject(false);
                        },
                        onError: (error) => {
                            console.error("🔥 Rewarded ad error:", error);
                            self.clearRewardCallbacks();
                            self.notifyUnityAdCompleted(false);
                            reject(false);
                        }
                    });
                } catch (error) {
                    console.error("🔥 Exception in showRewarded:", error);
                    self.clearRewardCallbacks();
                    self.notifyUnityAdCompleted(false);
                    reject(false);
                }
            });
        },

        clearRewardCallbacks: function () {
            this.currentRewardResolve = null;
            this.currentRewardReject = null;
        },

        notifyUnityAdCompleted: function (success) {
            console.log("🔧 Notifying Unity, success:", success);
            if (this.unityInstance && this.unityInstance.SendMessage) {
                const message = success ? "true" : "false";
                this.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', message);
            }
        },

        AreAdsAvailable: function () {
            const available = this.isTelegram ? this.isAdsGramReady : true;
            console.log("🔧 AreAdsAvailable:", available);
            return available;
        },

        PreloadAds: function () {
            if (this.isTelegram && this.isAdsGramReady) {
                this.preloadRewardedAds();
            }
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
    window.PlayDeck_SetLoading = bridge.SetLoading;
    window.PlayDeck_GameEnd = bridge.GameEnd;
    window.PlayDeck_Analytics = bridge.Analytics;
    window.PlayDeck_ShowRewardedAd = bridge.ShowRewardedAd;
    window.PlayDeck_AreAdsAvailable = bridge.AreAdsAvailable;
    window.PlayDeck_PreloadAds = bridge.PreloadAds;

    console.log("🔧 PlayDeck Bridge ready");

})();
