// PlayDeck Bridge for Unity WebGL with AdsGram - FIXED VERSION
(function () {
    'use strict';

    console.log("🔧 Initializing PlayDeck Bridge...");

    const bridge = {
        unityInstance: null,
        currentRewardResolve: null,
        currentRewardReject: null,
        isAdsGramReady: false,
        isTelegram: false,
        sdkLoaded: false,
        rewardedAdUnitId: '15876', // Your actual ad unit ID

        init: function (unity) {
            console.log("🔧 Bridge initialized with Unity instance");
            this.unityInstance = unity;
            this.isTelegram = this.isTelegramEnvironment();
            console.log("🔧 Is Telegram environment:", this.isTelegram);

            // Check if AdsGram SDK is available
            this.checkAdsGramSDK();
        },

        isTelegramEnvironment: function () {
            const isTG = !!(window.Telegram && window.Telegram.WebApp);
            if (isTG) {
                console.log("🔧 Telegram WebApp detected - Version:", window.Telegram.WebApp.version);
                console.log("🔧 Telegram Platform:", window.Telegram.WebApp.platform);
            }
            return isTG;
        },

        checkAdsGramSDK: function () {
            console.log("🔧 Checking AdsGram SDK...");

            if (window.AdsGram) {
                console.log("✅ AdsGram SDK found in window object");
                console.log("🔧 Available AdsGram methods:", Object.keys(window.AdsGram));
                this.sdkLoaded = true;

                if (this.isTelegram) {
                    this.initializeAdsGram();
                }
                return;
            }

            // SDK not found
            console.warn("⚠️ AdsGram SDK not found in window object");

            if (this.isTelegram) {
                console.error("❌ AdsGram SDK not available in Telegram - this is unexpected!");
            } else {
                console.log("🔧 Not in Telegram - using simulator mode");
                this.sdkLoaded = true; // Enable simulator
                this.isAdsGramReady = true;
            }
        },

        initializeAdsGram: function () {
            if (!this.sdkLoaded) {
                console.error("❌ Cannot initialize - SDK not loaded");
                return;
            }

            console.log("🔧 Initializing AdsGram...");

            try {
                if (typeof window.AdsGram.init !== 'function') {
                    console.error("❌ AdsGram.init is not a function");
                    return;
                }

                window.AdsGram.init()
                    .then(() => {
                        console.log("✅ AdsGram initialized successfully");
                        this.isAdsGramReady = true;
                        this.preloadRewardedAds();
                    })
                    .catch((error) => {
                        console.error("❌ AdsGram initialization failed:", error);
                        this.isAdsGramReady = false;
                    });
            } catch (error) {
                console.error("❌ Exception during AdsGram initialization:", error);
                this.isAdsGramReady = false;
            }
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

            const self = this;

            return new Promise((resolve, reject) => {
                // If not in Telegram or SDK not loaded, use simulator
                if (!self.isTelegram || !self.sdkLoaded) {
                    console.log("🔄 SIMULATOR: Showing fake rewarded ad");
                    setTimeout(() => {
                        const simulateSuccess = true; // Change to false to test failure
                        if (simulateSuccess) {
                            console.log("🔄 SIMULATOR: Ad completed successfully");
                            self.notifyUnityAdCompleted(true);
                            resolve(true);
                        } else {
                            console.log("🔄 SIMULATOR: Ad failed");
                            self.notifyUnityAdCompleted(false);
                            reject(false);
                        }
                    }, 2000);
                    return;
                }

                // Real AdsGram implementation for Telegram
                if (!self.isAdsGramReady) {
                    console.error("❌ AdsGram not ready - SDK loaded but not initialized");
                    self.notifyUnityAdCompleted(false);
                    reject(false);
                    return;
                }

                console.log("🔧 Showing REAL rewarded ad with unit ID:", self.rewardedAdUnitId);

                self.currentRewardResolve = resolve;
                self.currentRewardReject = reject;

                try {
                    if (typeof window.AdsGram.showRewarded !== 'function') {
                        console.error("❌ AdsGram.showRewarded is not a function");
                        self.notifyUnityAdCompleted(false);
                        reject(false);
                        return;
                    }

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
                    }).catch((error) => {
                        console.error("🔥 AdsGram.showRewarded promise rejected:", error);
                        self.clearRewardCallbacks();
                        self.notifyUnityAdCompleted(false);
                        reject(false);
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
            } else {
                console.warn("⚠️ Cannot notify Unity - instance not available");
            }
        },

        AreAdsAvailable: function () {
            // In Telegram: only available if SDK is loaded AND initialized
            // Outside Telegram: always available (simulator)
            const available = this.isTelegram ? (this.sdkLoaded && this.isAdsGramReady) : true;
            console.log("🔧 AreAdsAvailable:", available,
                "(Telegram:", this.isTelegram,
                "SDK Loaded:", this.sdkLoaded,
                "Initialized:", this.isAdsGramReady, ")");
            return available;
        },

        PreloadAds: function () {
            console.log("🔧 PreloadAds called");
            if (this.isTelegram && this.sdkLoaded && this.isAdsGramReady) {
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

    // Check if AdsGram loaded after a delay (in case it loads slowly)
    setTimeout(() => {
        if (!bridge.sdkLoaded && window.AdsGram) {
            console.log("✅ AdsGram SDK loaded after delay");
            bridge.sdkLoaded = true;
            if (bridge.isTelegram) {
                bridge.initializeAdsGram();
            }
        }
    }, 2000);

})();
