module.exports = {
	secret: process.env.TOKEN_PASS || 'access-token-password', // the password that is used to create tokens
	refreshSecret: process.env.REFRESH_PASS || 'dev-refresh-pass',
};
