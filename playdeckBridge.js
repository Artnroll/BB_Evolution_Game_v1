// PlayDeck Bridge for Unity WebGL with CORRECT AdsGram SDK
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

            return new Promise((resolve, reject) => {
                // Browser simulator for testing
                if (!this.isTelegram) {
                    console.log("🔄 SIMULATOR: Showing fake rewarded ad");
                    setTimeout(() => {
                        const simulateSuccess = true; // Change to false to test failure
                        if (simulateSuccess) {
                            console.log("🔄 SIMULATOR: Ad completed successfully");
                            this.notifyUnityAdCompleted(true);
                            resolve(true);
                        } else {
                            console.log("🔄 SIMULATOR: Ad failed");
                            this.notifyUnityAdCompleted(false);
                            reject(false);
                        }
                    }, 2000);
                    return;
                }

                // Real AdsGram implementation
                if (!this.isAdsGramReady) {
                    console.error("❌ AdsGram not ready");
                    this.notifyUnityAdCompleted(false);
                    reject(false);
                    return;
                }

                console.log("🔧 Showing real rewarded ad with unit ID:", this.rewardedAdUnitId);

                this.currentRewardResolve = resolve;
                this.currentRewardReject = reject;

                try {
                    // CORRECT method call based on AdsGram docs
                    window.AdsGram.showRewarded(this.rewardedAdUnitId, {
                        onReward: (reward) => {
                            console.log("✅ Rewarded ad completed successfully, reward:", reward);
                            this.clearRewardCallbacks();
                            this.notifyUnityAdCompleted(true);
                            resolve(true);
                        },
                        onClose: () => {
                            console.log("❌ Rewarded ad closed without reward");
                            this.clearRewardCallbacks();
                            this.notifyUnityAdCompleted(false);
                            reject(false);
                        },
                        onError: (error) => {
                            console.error("🔥 Rewarded ad error:", error);
                            this.clearRewardCallbacks();
                            this.notifyUnityAdCompleted(false);
                            reject(false);
                        }
                    });
                } catch (error) {
                    console.error("🔥 Exception in showRewarded:", error);
                    this.clearRewardCallbacks();
                    this.notifyUnityAdCompleted(false);
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
