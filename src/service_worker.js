import "@inboxsdk/core/background.js";
import EmailService from "./services/EmailService";
import * as c from "./constants";

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

// for dom-parsing
chrome.offscreen.createDocument({
  url: chrome.runtime.getURL("dom-parser.html"),
  reasons: [chrome.offscreen.Reason.DOM_PARSER],
  justification: "needing to parse the html of an email message bodies"
});

// handle communication between content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(message, sender);
  (async () => {
    try {
      const storage = await chrome.storage.local
        .get([c.LAST_SYNCED, c.REDUNDANT_EMAILS, c.START]);

      let last_synced = storage.last_synced ?? null,
        redundant_emails = storage.redundant_emails ?? false,
        start = storage.start ?? null;

      switch (message.message) {
        case c.SYNC: {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          start = new Date().getTime();
          redundant_emails = false; // reset bool for every sync request
          await chrome.storage.local.set({ start, redundant_emails });

          // see if we've synced before, and use the existing subscriber list & sync time
          // if (Object.keys(all_subs).length != 0)
          console.log("Sync in progress. Last synced at: ", last_synced);
          await EmailService.shared.syncAllThreads();
          chrome.tabs.sendMessage(tab.id, { message: c.UPDATED_SUBSCRIBERS });
          break;
        }
        case c.RESET: {
          // mostly for testing, if you need to clear out subscriber list
          await chrome.storage.local.clear();
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          chrome.tabs.sendMessage(tab.id, { message: c.UPDATED_SUBSCRIBERS });
          break;
        }
        case c.TRASH_SENDER_THREADS: {
          await EmailService.shared.trashAllSenderThreads(message.data); //todo: include sender id in message
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          chrome.tabs.sendMessage(tab.id, { message: c.UPDATED_SUBSCRIBERS });
          break;
        }
        default:
          console.log("message not handled", message.message);
      }
    } catch (e) {
      console.warn("error runtime.onMessage.listener", e);
    }
  })();
  return true;
});
