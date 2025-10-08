// PlayDeck Bridge - MINIMAL WORKING VERSION
(function () {
    'use strict';

    console.log("Initializing PlayDeck Bridge...");

    // Simple global functions that won't lose scope
    window.PlayDeck_SetLoading = function (progress) {
        console.log("SetLoading:", progress);
    };

    window.PlayDeck_GameEnd = function () {
        console.log("GameEnd called");
    };

    window.PlayDeck_Analytics = function (eventName, payload) {
        console.log("Analytics:", eventName, payload);
    };

    window.PlayDeck_AreAdsAvailable = function () {
        const isTelegram = !!(window.Telegram && window.Telegram.WebApp);
        const available = isTelegram ? !!window.AdsGram : true;
        console.log("AreAdsAvailable:", available);
        return available;
    };

    window.PlayDeck_PreloadAds = function () {
        console.log("PreloadAds called");
    };

    window.PlayDeck_ShowRewardedAd = function () {
        console.log("ShowRewardedAd called");

        return new Promise((resolve, reject) => {
            const isTelegram = !!(window.Telegram && window.Telegram.WebApp);

            if (!isTelegram) {
                console.log("SIMULATOR: Showing fake rewarded ad");
                setTimeout(() => {
                    console.log("SIMULATOR: Ad completed successfully");

                    // Notify Unity directly
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                    }

                    resolve(true);
                }, 2000);
                return;
            }

            // Real AdsGram implementation
            if (!window.AdsGram) {
                console.error("AdsGram not available");
                if (window.unityInstance && window.unityInstance.SendMessage) {
                    window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                }
                reject(false);
                return;
            }

            console.log("Showing real rewarded ad");

            window.AdsGram.showRewarded('15876', {
                onReward: (reward) => {
                    console.log("Rewarded ad completed successfully");
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "true");
                    }
                    resolve(true);
                },
                onClose: () => {
                    console.log("Rewarded ad closed without reward");
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                    }
                    reject(false);
                },
                onError: (error) => {
                    console.error("Rewarded ad error:", error);
                    if (window.unityInstance && window.unityInstance.SendMessage) {
                        window.unityInstance.SendMessage('AdsManager', 'OnAdCompleted', "false");
                    }
                    reject(false);
                }
            });
        });
    };

    console.log("PlayDeck Bridge ready");

})();
