import * as c from "../constants";
export default class AuthService {
  _shared; // make private

  static get shared() { // lazy init
    if (!this._shared) this._shared = new AuthService();
    return this._shared;
  }

  constructor() { } // make private

  getAuthRedirectUrl() {
    const clientId = "142584390652-vomcgmkmgsh6v92j9i8c4eg74pil19sd.apps.googleusercontent.com",
      redirectUri = "https://mail.google.com/mail/u/0/#inbox",
      scope = "https://www.googleapis.com/auth/gmail.readonly",
      state = "my_state";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=token&state=${state}`;
    return authUrl;
  }

  // expects window.location.hash
  retrieveAccessToken(urlHash) {
    const accessToken = urlHash.substring(1).split('&')[0].split('=')[1];
    console.log("retrieveAccessToken =", accessToken);
    return accessToken;
  }

  async storeAccessToken(token) {
    await chrome.storage.local.set({ [c.AUTH_TOKEN]: token });
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
