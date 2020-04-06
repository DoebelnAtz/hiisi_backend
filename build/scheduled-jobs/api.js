"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const axios = require('axios');
const client_id = '0d8990a930df301677a66c9c0c4e3b29c953d5663eb3a5debcdbbe26905593f6';
const client_secret = 'a0f002175c1555d7defeae9c9b3da6d769583a2ca2751844fa0b854ba9877cd5';
const client_id1 = '520cf2ed25a517e352458db17ec06a2f0791b65cf99fc851ef0dea579908f158';
const client_secret1 = 'af3ab8010919e3f92a5e5cdc6da74752853ed37fd64758797f8eba86947ac923';
let token = '';
const getToken = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('old token: ' + token);
    let data = {
        client_id,
        client_secret,
        grant_type: 'client_credentials',
    };
    let resp = yield axios({
        method: 'post',
        url: 'https://api.intra.42.fr/oauth/token',
        data: data,
    });
    token = resp.data.access_token;
    console.log('New Token: ' + token);
    return token;
});
const intraApi = (endpoint) => __awaiter(void 0, void 0, void 0, function* () {
    let headers = {
        Authorization: 'Bearer ' + token,
    };
    console.log('Making request to https://api.intra.42.fr/v2' + endpoint);
    let resp;
    try {
        resp = yield axios({
            method: 'get',
            url: 'https://api.intra.42.fr/v2' + endpoint,
            headers: headers,
        });
    }
    catch (e) {
        if (e.response.status === 401) {
            token = yield getToken();
            throw new Error('Failed to get token');
        }
    }
    return resp.data;
});
module.exports = {
    intraApi: (endpoint) => intraApi(endpoint),
};
//# sourceMappingURL=api.js.map