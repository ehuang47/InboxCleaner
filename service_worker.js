import { getThreads } from "./scripts/EmailService";
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

var gapi_loaded = false;

const shared = {
  all_subs: {},
  last_synced: null,
  redundant_emails: false,
  start: null
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("service_worker chrome.runtime.onMessage.sender", sender);
  // todo: if it makes a difference, check sender = content.js, then wrap both if statements
  if (message.message === "open_new_tab") { //! guarantee the message "open_new_tab" only comes from content.js
    chrome.tabs.create({ url: message.url });
  }

  if (gapi_loaded) {
    if (message.message === "sync") {
      shared.start = new Date().getTime();
      shared.redundant_emails = false; // reset bool for every sync request
      // see if we've synced before, and use the existing subscriber list & sync time
      chrome.storage.local.get(["all_subs", "last_synced"], (res) => {
        // console.log(res);
        if (Object.keys(res).length != 0) {
          shared.all_subs = res.all_subs;
          shared.last_synced = res.last_synced;
        }
        console.log("Sync in progress. Last synced at: ", shared.last_synced);
        getThreads(shared).then(() => {
          port.postMessage({ message: "updated_subscribers" });
        }); // updates the subscriber list into storage
      });
    }

    // mostly for testing, if you need to clear out subscriber list
    if (message.message === "reset") {
      chrome.storage.local.clear();
      shared.all_subs = {};
      shared.last_synced = null;
      port.postMessage({ message: "updated_subscribers" });
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
    gapi.client.load("https://gmail.googleapis.com/$discovery/rest?version=v1").then(() => {
      gapi_loaded = true;
      gapi.client.setToken({ access_token: token });
    });
  };

  // make http request to load the API client script
  var request = new XMLHttpRequest();
  request.onreadystatechange = function () {
    if (request.readyState !== 4 || request.status !== 200) return;
    eval(request.responseText); //! UNSAFE
  };

  request.open("GET", "https://apis.google.com/js/client.js");
  request.send();
});

