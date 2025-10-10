// PlayDeck Bridge - IMPROVED TELEGRAM DETECTION
(function () {
    'use strict';

    console.log("Initializing PlayDeck Bridge...");

    // Store the Unity instance
    let unityInstance = null;

    // Main bridge object
    window.playDeckBridge = {
        init: function (instance) {
            unityInstance = instance;
            console.log("PlayDeck Bridge initialized with Unity instance");

            // Auto-initialize Telegram username detection
            this.initializeTelegramUsername();
        },

        initializeTelegramUsername: function () {
            console.log("Initializing Telegram username detection...");

            // Check immediately if we're in Telegram
            if (this.isTelegramWebApp()) {
                console.log("✓ Running in Telegram WebApp");
                this.getTelegramUsername();
            } else {
                console.log("✗ Not in Telegram WebApp");
                // Signal to Unity that Telegram is not available
                this.signalTelegramNotAvailable();
            }
        },

        isTelegramWebApp: function () {
            return !!(window.Telegram && window.Telegram.WebApp);
        },

        getTelegramUsername: function () {
            console.log("Getting Telegram username...");

            try {
                const webApp = window.Telegram.WebApp;

                // Initialize WebApp
                webApp.ready();
                webApp.expand();

                // Get user data
                const user = webApp.initDataUnsafe?.user;
                console.log("Telegram user data:", user);

                if (user) {
                    let username = null;

                    if (user.username) {
                        username = "@" + user.username;
                        console.log("✓ Found Telegram username:", username);
                    } else if (user.first_name) {
                        username = user.first_name;
                        console.log("✓ Using Telegram first name:", username);
                    } else if (user.id) {
                        username = "User_" + user.id;
                        console.log("✓ Using Telegram user ID:", username);
                    }

                    if (username && unityInstance) {
                        console.log("Sending Telegram username to Unity:", username);
                        unityInstance.SendMessage('LoginManager', 'OnTelegramUsernameReceived', username);
                        return;
                    }
                }

                // If we're in Telegram but no user data
                console.log("In Telegram but no user data available");
                this.sendTelegramFallback();

            } catch (error) {
                console.error("Error getting Telegram username:", error);
                this.sendTelegramFallback();
            }
        },

        sendTelegramFallback: function () {
            const fallbackUsername = "TelegramUser_" + Math.random().toString(36).substr(2, 6);
            console.log("Using Telegram fallback username:", fallbackUsername);

            if (unityInstance) {
                setTimeout(() => {
                    unityInstance.SendMessage('LoginManager', 'OnTelegramUsernameReceived', fallbackUsername);
                }, 500);
            }
        },

        signalTelegramNotAvailable: function () {
            if (unityInstance) {
                setTimeout(() => {
                    unityInstance.SendMessage('LoginManager', 'OnTelegramNotAvailable', '');
                }, 1000);
            }
        },

        // Other PlayDeck functions
        SetLoading: function (progress) {
            console.log("SetLoading:", progress + "%");
        },

        GameEnd: function () {
            console.log("GameEnd called");
        },

        Analytics: function (eventName, payload) {
            console.log("Analytics:", eventName, payload);
        },

        AreAdsAvailable: function () {
            const isTelegram = this.isTelegramWebApp();
            const available = isTelegram ? !!window.AdsGram : true;
            console.log("AreAdsAvailable:", available);
            return available;
        },

        PreloadAds: function () {
            console.log("PreloadAds called");
        },

        ShowRewardedAd: function () {
            console.log("ShowRewardedAd called");
            return this.showRewardedAd();
        },

        showRewardedAd: function () {
            return new Promise((resolve, reject) => {
                const isTelegram = this.isTelegramWebApp();

                if (!isTelegram) {
                    console.log("SIMULATOR: Showing fake rewarded ad");
                    setTimeout(() => {
                        console.log("SIMULATOR: Ad completed successfully");
                        if (unityInstance) {
                            unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                        }
                        resolve(true);
                    }, 2000);
                    return;
                }

                if (!window.AdsGram) {
                    console.error("AdsGram not available");
                    if (unityInstance) {
                        unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                    }
                    reject(false);
                    return;
                }

                console.log("Showing real rewarded ad");
                window.AdsGram.showRewarded('15876', {
                    onReward: (reward) => {
                        console.log("Rewarded ad completed successfully");
                        if (unityInstance) {
                            unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                        }
                        resolve(true);
                    },
                    onClose: () => {
                        console.log("Rewarded ad closed without reward");
                        if (unityInstance) {
                            unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                        }
                        reject(false);
                    },
                    onError: (error) => {
                        console.error("Rewarded ad error:", error);
                        if (unityInstance) {
                            unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                        }
                        reject(false);
                    }
                });
            });
        }
    };

    console.log("PlayDeck Bridge ready");

})();
