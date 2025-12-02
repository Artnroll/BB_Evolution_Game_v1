// playdeckBridge.js
(function () {
    'use strict';

    // --- Configuration ----
    const UNITY_SEND_RETRY_MS = 250;
    const UNITY_SEND_MAX_RETRIES = 30;

    // Small safe console wrappers
    function safeLog(...args) { try { console.log(...args); } catch (e) { } }
    function safeWarn(...args) { try { console.warn(...args); } catch (e) { } }
    function safeError(...args) { try { console.error(...args); } catch (e) { } }

    // Local helper to reliably send messages to Unity
    function sendToUnity(objectName, methodName, message) {
        let tries = 0;
        const trySend = () => {
            tries++;
            try {
                const instance = (window.playDeckBridge && window.playDeckBridge.unityInstance) ? window.playDeckBridge.unityInstance : window.unityInstance;
                if (instance && typeof instance.SendMessage === 'function') {
                    instance.SendMessage(objectName, methodName, message);
                    safeLog(`sendToUnity: Sent -> ${objectName}.${methodName}("${message}")`);
                    return true;
                }
            } catch (e) {
                safeWarn('sendToUnity: send exception', e);
            }
            if (tries * UNITY_SEND_RETRY_MS >= UNITY_SEND_MAX_RETRIES * UNITY_SEND_RETRY_MS) {
                safeWarn(`sendToUnity: giving up after ${tries} tries for ${objectName}.${methodName}`);
                return false;
            }
            setTimeout(trySend, UNITY_SEND_RETRY_MS);
        };
        trySend();
    }

    // Bridge object
    const bridge = {
        unityInstance: null,
        init(unity) {
            this.unityInstance = unity;
            safeLog('PlayDeckBridge: unityInstance set');
        }
    };

    // Expose bridge
    window.playDeckBridge = bridge;

    // --- IMMEDIATE SAFE STUBS ---
    window.PlayDeck_SetLoading = function (progress) { safeLog('PlayDeck_SetLoading (stub):', progress); };
    window.PlayDeck_GameEnd = function () {
        safeLog('PlayDeck_GameEnd (stub)');
        try { window.parent.postMessage({ playdeck: { method: 'gameEnd' } }, '*'); } catch (e) { }
    };

    window.PlayDeck_Analytics = function (eventName, payload) {
        safeLog('PlayDeck_Analytics called:', eventName, payload);

        // Send to Telegram Analytics if available
        if (window.telegramAnalytics && typeof window.telegramAnalytics.track === 'function') {
            try {
                // Parse payload if it's a JSON string
                let eventData = {};
                if (payload && payload !== '{}') {
                    try {
                        eventData = JSON.parse(payload);
                    } catch (e) {
                        // If not JSON, just use it as a string property
                        eventData = { data: payload };
                    }
                }

                // Send event to Telegram Analytics
                window.telegramAnalytics.track(eventName, eventData);
                safeLog('✅ Event sent to Telegram Analytics:', eventName, eventData);

            } catch (error) {
                safeError('❌ Failed to send analytics event:', error);
            }
        } else {
            safeWarn('⚠️ Telegram Analytics not available yet');
        }
    };

    // ===== TELEGRAM STARS INTEGRATION =====
    const starsIntegration = {
        BACKEND_URL: 'https://telegram-server-payment.onrender.com',

        // check if telegram stars are available
        isAvailable() {
            return !!(window.Telegram && window.Telegram.WebApp);
        },

        // Get telegram user ID
        getUserId() {
            const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
            return user ? user.id : null;
        },

        // main purchase function
        async purchaseItem(itemId, starsCost, itemName, itemDescription) {
            safeLog('Telegram Stars: purchaseItem called for', itemId, 'cost:', starsCost);

            if (!this.isAvailable()) {
                const error = 'Telegram WebApp not available';
                safeWarn('Telegram Stars:', error);
                return { success: false, error: error };
            }

            const userId = this.getUserId();
            if (!userId) {
                return { success: false, error: 'User not identified'}
            }

            try {
                safeLog('Creating invoice via backend');

                // get invoice from backend
                const invoiceLink = await this.createInvoiceViaBackend(userId, itemId, starsCost, itemName, itemDescription);

                safeLog('Invoice link received, opening popup...');

                // open payment popup inside the game
                const paymentResult = await this.openPaymentPopup(invoiceLink);
                return paymentResult;

            } catch (error) {
                safeError('Telegram Stars: Purchase error', error)
                return {success: false, error: error.message};
            }
        },

        // create invoice and get the link
        async createInvoiceViaBackend(userId, itemId, starsCost, itemName, itemDescription) {
            try {
                safeLog('Calling backend to create invoice...');

                const response = await fetch(`${this.BACKEND_URL}/create-invoice-link`, {                 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        item_id: itemId,
                        amount: starsCost,
                        title: itemName,
                        description: itemDescription
                    })
                });

                if (!response.ok) {
                    throw new Error(`Backend error: ${response.status}`);
                }

                const result = await response.json();
                safeLog('Backend response:', result);
                safeLog('Checking result.success:', result.success);
                safeLog('Checking result.invoice_link:', result.invoice_link);

                if (result.success === true && result.invoice_link) {
                    safeLog('Returning invoice link:', result.invoice_link);
                    return result.invoice_link;
                } else {
                    safeError(' Invoice link check failed');
                    safeError('result.success =', result.success);
                    safeError('result.invoice_link =', result.invoice_link);
                    throw new Error(result.error || 'Failed to create invoice');
                }
                
            } catch (error) {
                safeError('Backend call failed:', error);
                return null;
            }
        },

        openPaymentPopup(invoiceLink) {
            return new Promise((resolve) => {
                safeLog('Opening Telegram payment popup with link:', invoiceLink);

                // open the invoice using telegram webapp API
                window.Telegram.WebApp.openInvoice(invoiceLink, (status) => {
                    safeLog('Payment popup closed with status:', status);

                    if (status === 'paid') {
                        safeLog('Payment succesful!');
                        resolve({
                            success: true,
                            message: 'Payment completed succesfully!',
                            status: 'paid'
                        });
                    } else if (status === 'cancelled') {
                        safeLog('Payment cancelled by user');
                        resolve({
                            success: false,
                            error: 'Payment was cancelled',
                            status: 'cancelled'
                        });
                    } else if (status === 'failed') {
                        safeLog('Payment failed');
                        resolve({
                            success: false,
                            error: 'Payment failed',
                            status: 'failed'
                        });
                    } else {
                        safeLog('Payment pending or unkown status:', status);
                        resolve({
                            success: false,
                            error: 'Payment status unknown:' + status,
                            status: status
                        });
                    }
                });
            });
        }
    }

    // ===== SINGLE FUNCTION EXPOSURE =====

    window.PlayDeck_BuyItemWithStars = function (itemId, starsCost, itemName, itemDescription) {
        safeLog('PlayDeck_BuyItemWithStars called with:', itemId, starsCost, itemName);

        // Handle the purchase and send result to Unity
        starsIntegration.purchaseItem(itemId, starsCost, itemName, itemDescription)
            .then(result => {
                // Send result back to Unity
                const resultJson = JSON.stringify(result);
                safeLog('Sending purchase result to Unity:', resultJson);
                sendToUnity('TelegramStarsManager', 'OnPurchaseResult', resultJson);
            })
            .catch(error => {
                // Send error to Unity
                const errorResult = JSON.stringify({
                    success: false,
                    error: error.message,
                    item: itemId
                });
                safeError('Purchase failed:', error);
                sendToUnity('TelegramStarsManager', 'OnPurchaseResult', errorResult);
            });
    };

    // ADSGRAM Integration 
    const adControllers = {};

    function getAdController(blockId) {
        if (!window.Adsgram) {
            safeError('Adsgram SDK not loaded');
            return null;
        }

        if (!adControllers[blockId]) {
            safeLog('Initializing Adsgram for new block');
            adControllers[blockId] = window.Adsgram.init({
                blockId: blockId,
                debug: false,
                debugConsole: false
            });
        }

        return adControllers[blockId];
    }

    window.PlayDeck_AreAdsAvailable = function () {
        const available = (window.Adsgram) ? 1 : 0;
        safeLog('PlayDeck_AreAdsAvailable ->', available);
        return available;
    };

    window.PlayDeck_PreloadAds = function () {
        if (window.Adsgram) {
            // Preloads your "Energy" block by default so it's ready faster
        }
    };

    // This receives the ID strictly from your C# call
    window.PlayDeck_ShowRewardedAdForBlock = function (blockId) {
        safeLog(`PlayDeck_ShowRewardedAdForBlock called for: ${blockId}`);

        const controller = getAdController(blockId);

        if (!controller) {
            safeError('AdController could not be created. Adsgram SDK missing?');
            // Notify Unity immediately that it failed
            // Note: We use "false" as a string because Unity SendMessage expects a string
            return 0;
        }

        // Show the ad
        controller.show().then((result) => {
            // Success: User watched the ad
            safeLog('Ad finished successfully:', result);
            sendToUnity('AdsManager', 'OnAdCompleted', "true");
        }).catch((result) => {
            // Failure: User skipped, error, or ad not ready
            safeLog('Ad failed or skipped:', result);
            sendToUnity('AdsManager', 'OnAdCompleted', "false");
        });

        // Return 1 to Unity to say "We successfully started the ad process"
        return 1;
    };
    
    window.playDeckBridge = Object.assign(window.playDeckBridge || {}, {
        init: function (unityInstance) { bridge.init(unityInstance); },
        stars: starsIntegration,
        _internalState: () => ({
            adsState: adsState,
            starsAvailable: starsIntegration.isAvailable(),
            telegramAvailable: !!(window.Telegram && window.Telegram.WebApp)
        })
    });

    safeLog('playdeckBridge loaded with SIMPLIFIED Telegram Stars (No Backend)');

})();


