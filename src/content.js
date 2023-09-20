import * as InboxSDK from '@inboxsdk/core';
import * as c from "./constants.js";
import * as contentUtils from "./utils/content-utils.js";

const sdk = await InboxSDK.load(2, "sdk_gmanager_284293dc99");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message) {
    case c.UPDATED_SUBSCRIBERS: {
      clearUI().then(renderUI);
    }
    case c.RESET: {
      clearUI();
    }
    default:
      console.log("unknown handler", request.message);
  }
  sendResponse();
});

async function clearUI() {

}

async function renderUI() {
  try {
    const storage = await chrome.storage.local.get([c.ALL_SUBS, c.LAST_SYNCED]);
    const storage_subs = storage[c.ALL_SUBS];

    // grab a list of emails? from the current inbox, display most recent 50 of unique emails, list email and sender and thread name
    const unregisterHandler = sdk.Router.handleListRoute(sdk.Router.NativeListRouteIDs.INBOX, (ListRouteView) => {
      let last_synced = "";
      const all_subs = [];

      if (contentUtils.formatAllSubs(storage_subs, all_subs)) {
        last_synced = "Last synced: " + new Date(storage[c.LAST_SYNCED]).toString();
      }

      ListRouteView.addCollapsibleSection({
        title: "Subscriptions",
        subtitle:
          last_synced ?? "You are currently subscribed to " + all_subs.length + " emails. " + last_synced,
        titleLinkText: "Sync Now",
        onTitleLinkClick: () => {
          chrome.runtime.sendMessage({ message: c.SYNC });
          unregisterHandler();
        },
        tableRows: all_subs,
        contentElement: contentUtils.instructionHTML(),
      });

      // scan the document for the html injected by inboxsdk and add onclick functionality
      contentUtils.registerRowHandlers(storage_subs);

      // debugging: just for clearing storage and resetting UI
      let test = document.querySelector(".inboxsdk__resultsSection .zE");
      test.children[0].addEventListener("click", (e) => {
        chrome.runtime.sendMessage({ message: c.RESET });
      });
    });

    sdk.Lists.registerThreadRowViewHandler(contentUtils.labelThreadRowViews(storage_subs));
  } catch (e) {
    console.warn("content.js error", e);
  }
}

renderUI();

