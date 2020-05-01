"use strict";
module.exports = {
    secret: process.env.TOKEN_PASS || 'access-token-password',
    refreshSecret: process.env.REFRESH_PASS || 'dev-refresh-pass',
};
//# sourceMappingURL=config.js.map