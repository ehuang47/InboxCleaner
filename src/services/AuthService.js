import * as c from "../constants";
export default class AuthService {
  _shared; // make private

  static get shared() { // lazy init
    if (!this._shared) this._shared = new AuthService();
    return this._shared;
  }

  constructor() { } // make private

  getAuthRedirectUrl() {
    const clientId = "142584390652-13klfjbscibla44rm9gnefu01u180hi6.apps.googleusercontent.com",
      redirectUri = "https://mail.google.com",
      scope = "https://www.googleapis.com/auth/gmail.readonly",
      state = "my_state";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&state=${state}`;
    return authUrl;
  }

  /* expects window.location.hash, with format:
  '#state=my_state
  &access_token=ya29.a0AfB_byB6kiQcBbhDuErGzyzb3Dt-OCDkC6psS91RidG0_27pDmDTazy0J4cc2_M6T-wkVrSeR5XlHUUQOxi27SXYui-Wvtyj_l4ayTxMl8zynzTN9wqyNjaFEw5V1Z2Up2X-jw8eydHIdaO95Ib-HklRLi3wy3q0PgaCgYKAXkSARESFQGOcNnCbV4CsauOPb0igw-XO1AewA0169
  &token_type=Bearer
  &expires_in=3599
  &scope=https://www.googleapis.com/auth/gmail.readonly'
  */

  retrieveAccessToken(urlHash) {
    console.log(urlHash);
    const hash = urlHash.slice(1);
    const map = hash.split('&').reduce((map, param) => {
      const [k, v] = param.split("=");
      map[k] = v;
      return map;
    }, {});
    console.log("url map", map);
    return map;
  }

  async storeAccessToken(urlMap) {
    await chrome.storage.local.set({ ...urlMap });
  }

  async listMessages() {
    try {
      const apiUrl = 'https://www.googleapis.com/gmail/v1/users/me/messages';
      const res = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      console.log('Messages:', data);
    }
    catch (e) {
      console.error('Error fetching messages:', error);
    }
  }
}
