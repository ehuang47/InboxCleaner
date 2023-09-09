import "@inboxsdk/core/background.js";
import { getThreads } from "./services/EmailService";
import * as c from "./constants";
import AuthService from "./services/AuthService";

// when extension is installed, updated, or chrome is updated
chrome.runtime.onInstalled.addListener((details) => {
  // gets previous extension version, reason "oninstalled" activated, and maybe ID
  console.log("Triggered onInstalled due to: " + details.reason);

  // setting rules for page actions & taking action when accessing a page that meets all criteria
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostContains: ".google.com", schemes: ["https"] },
          }),
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()],
      },
    ]);
  });
});

// handle communication between content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(message, sender);
  (async () => {
    try {
      const storage = await chrome.storage.local
        .get([c.GAPI_LOADED, c.LAST_SYNCED, c.REDUNDANT_EMAILS, c.START]);

      let gapi_loaded = storage.gapi_loaded ?? false,
        last_synced = storage.last_synced ?? null,
        redundant_emails = storage.redundant_emails ?? false,
        start = storage.start ?? null;

      await handleAuthUser(message, sendResponse);

      if (message.message === c.OPEN_NEW_TAB) {
        chrome.tabs.create({ url: message.url });
      }

      if (gapi_loaded) {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

        if (message.message === c.SYNC) {
          start = new Date().getTime();
          redundant_emails = false; // reset bool for every sync request
          chrome.storage.local.set({ start, redundant_emails });

          // see if we've synced before, and use the existing subscriber list & sync time
          // if (Object.keys(all_subs).length != 0)
          console.log("Sync in progress. Last synced at: ", last_synced);
          await getThreads();
          chrome.tabs.sendMessage(tab.id, { message: c.UPDATED_SUBSCRIBERS });
        }

        // mostly for testing, if you need to clear out subscriber list
        if (message.message === c.RESET) {
          chrome.storage.local.clear();
          chrome.tabs.sendMessage(tab.id, { message: c.UPDATED_SUBSCRIBERS });
        }
        // TODO: footer button onclick that deletes all the null-unsub link rows and refreshes tab
      }
    } catch (e) {
      console.warn("error runtime.onMessage.listener", e);
    }
  })();
  return true;
});

//* Gmail API OAuth2
// TODO: have user click a button (maybe on popup?) in order to activate interactive signin and access token, so that u can brief them why they need to sign in

async function handleAuthUser(message, sendResponse) {
  if (message.message === c.CONTENT_INIT) {
    // const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    // chrome.tabs.sendMessage(tab.id, { message: c.AUTH_USER, url: redirectUrl });
    const redirectUrl = AuthService.shared.getAuthRedirectUrl();
    console.log("service worker received content init", redirectUrl);
    sendResponse({ message: c.AUTH_USER, url: redirectUrl });
  } else if (message.message === c.AUTH_USER) {
    const urlMap = AuthService.shared.retrieveAccessToken(message.hash);
    await AuthService.shared.storeAccessToken(urlMap);
  }
}

// chrome.identity.getAuthToken({ interactive: true }, (token) => {
  // global.gapi_onload = () => {
  //   // runs after api client is remote-loaded
  //   // load APIs with discovery, set chrome identity oauth token
  //   gapi.client.load(c.DISCOVERY_URL).then(() => {
  //     chrome.storage.local.set({ [c.GAPI_LOADED]: true });
  //     gapi.client.setToken({ access_token: token });
  //   });
  // };
  // console.log("finished registering window.gapi_onload");
// });
