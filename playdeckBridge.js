// PlayDeck Bridge - SIMPLE TELEGRAM DETECTION
(function () {
    'use strict';

    console.log("Initializing PlayDeck Bridge...");

    let unityInstance = null;

    window.playDeckBridge = {
        init: function (instance) {
            unityInstance = instance;
            console.log("PlayDeck Bridge initialized");
            this.detectTelegram();
        },

        detectTelegram: function () {
            console.log("Detecting Telegram...");

            if (this.isTelegramWebApp()) {
                console.log("✓ Telegram WebApp detected!");
                this.getTelegramUsername();
            } else {
                console.log("✗ Not in Telegram WebApp");
            }
        },

        isTelegramWebApp: function () {
            const hasTelegram = !!(window.Telegram && window.Telegram.WebApp);
            console.log("Telegram available:", hasTelegram);
            return hasTelegram;
        },

        getTelegramUsername: function () {
            console.log("Getting Telegram username...");

            try {
                const webApp = window.Telegram.WebApp;
                webApp.ready();
                webApp.expand();

                const user = webApp.initDataUnsafe?.user;
                console.log("Telegram user data:", user);

                if (user) {
                    let username = null;

                    if (user.username) {
                        username = "@" + user.username;
                    } else if (user.first_name) {
                        username = user.first_name;
                    } else if (user.id) {
                        username = "User_" + user.id;
                    }

                    if (username && unityInstance) {
                        console.log("Sending Telegram username to Unity:", username);
                        unityInstance.SendMessage('LoginManager', 'OnTelegramUsernameReceived', username);
                        return;
                    }
                }

                // Fallback
                console.log("No Telegram user data, using fallback");
                if (unityInstance) {
                    unityInstance.SendMessage('LoginManager', 'OnTelegramUsernameReceived', 'TelegramUser');
                }

            } catch (error) {
                console.error("Error getting Telegram username:", error);
                if (unityInstance) {
                    unityInstance.SendMessage('LoginManager', 'OnTelegramUsernameReceived', 'TelegramError');
                }
            }
        }
    };

    console.log("PlayDeck Bridge ready");

})();
