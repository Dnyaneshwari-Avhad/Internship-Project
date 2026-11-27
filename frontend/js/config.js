/* ============================================
   Streamline Tech – Centralized Frontend API Config
   Automatically switches between local dev and
   deployed Vercel backend.
   ============================================ */

(function (global) {
    var PRODUCTION_BACKEND_URL = 'https://internship-project-backend-black.vercel.app';
    var LOCAL_BACKEND_URL = 'http://localhost:3000';

    function getBackendOrigin() {
        if (global.__ENV__ && global.__ENV__.BACKEND_URL) {
            return String(global.__ENV__.BACKEND_URL).replace(/\/+$/, '');
        }
        var host = global.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1' || global.location.protocol === 'file:') {
            return global.location.port === '3000'
                ? global.location.origin
                : LOCAL_BACKEND_URL;
        }
        return PRODUCTION_BACKEND_URL;
    }

    global.APP_CONFIG = {
        PRODUCTION_BACKEND_URL: PRODUCTION_BACKEND_URL,
        LOCAL_BACKEND_URL: LOCAL_BACKEND_URL,
        getBackendOrigin: getBackendOrigin
    };
})(window);
