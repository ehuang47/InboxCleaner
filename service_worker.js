import { getThreads } from "./scripts/EmailService";
import * as c from "./scripts/constants";
// if es6 import fails, use dynamic import? https://stackoverflow.com/questions/48104433/how-to-import-es6-modules-in-content-script-for-chrome-extension
// https://developer.chrome.com/docs/extensions/migrating/to-service-workers/#register-listeners says it should work, just make sure type:module is specified

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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  const storage = await chrome.storage.local.get([c.GAPI_LOADED, c.LAST_SYNCED,
  c.REDUNDANT_EMAILS, c.START]);

  let gapi_loaded = storage.gapi_loaded ?? false,
    last_synced = storage.last_synced ?? null,
    redundant_emails = storage.redundant_emails ?? false,
    start = storage.start ?? null;


  console.log("service_worker chrome.runtime.onMessage.sender", sender);
  // todo: if it makes a difference, check sender = content.js, then wrap both if statements
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
});

//* Gmail API OAuth2 
// TODO: have user click a button (maybe on popup?) in order to activate interactive signin and access token, so that u can brief them why they need to sign in
// https://gist.github.com/omarstreak/7908035c91927abfef59 --> reference code
// https://gist.github.com/sumitpore/47439fcd86696a71bf083ede8bbd5466
// https://stackoverflow.com/questions/18681803/loading-google-api-javascript-client-library-into-chrome-extension
chrome.identity.getAuthToken({ interactive: true }, (token) => {
  window.gapi_onload = () => {
    // runs after api client is remote-loaded
    // load APIs with discovery, set chrome identity oauth token
    gapi.client.load(c.DISCOVERY_URL).then(() => {
      chrome.storage.local.set({ [c.GAPI_LOADED]: true });
      gapi.client.setToken({ access_token: token });
    });
  };

  // make http request to load the API client script
  //todo improve extension security, can no longer load remote code

  var request = new XMLHttpRequest();
  request.onreadystatechange = function () {
    if (request.readyState !== 4 || request.status !== 200) return;
    eval(request.responseText); //! UNSAFE
  };

  request.open("GET", c.GAPI_CLIENT_URL);
  request.send();
});

