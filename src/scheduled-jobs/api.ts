const axios = require('axios');

const client_id = process.env.CLIENT_A_ID;
const client_secret = process.env.CLIENT_A_SECRET;

const client_id1 = process.env.CLIENT_B_ID;
const client_secret1 = process.env.CLIENT_B_SECRET;

let token = '';

const getToken = async () => {
	console.log('old token: ' + token);
	let data = {
		client_id,
		client_secret,
		grant_type: 'client_credentials',
	};
	let resp = await axios({
		method: 'post',
		url: 'https://api.intra.42.fr/oauth/token',
		data: data,
	});
	token = resp.data.access_token;
	console.log('New Token: ' + token);
	return token;
};

const intraApi = async (endpoint: string) => {
	let headers = {
		Authorization: 'Bearer ' + token,
	};
	console.log('Making request to https://api.intra.42.fr/v2' + endpoint);
	let resp;
	try {
		resp = await axios({
			method: 'get',
			url: 'https://api.intra.42.fr/v2' + endpoint,
			headers: headers,
		});
	} catch (e) {
		if (e.response.status === 401) {
			token = await getToken();
			throw new Error('Failed to get token');
		}
	}
	return resp.data;
};

module.exports = {
	intraApi: (endpoint: string) => intraApi(endpoint),
};
