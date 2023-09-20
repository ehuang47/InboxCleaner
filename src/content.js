import * as InboxSDK from '@inboxsdk/core';
import * as c from "./constants.js";
import * as contentUtils from "./utils/content-utils.js";
import ui from "./ui";
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message) {
    case c.UPDATED_SUBSCRIBERS: {
      clearUI();
      renderUI();
      break;
    }
    default:
      console.log("unknown handler", request.message);
  }
  sendResponse();
});

// SDK things

const sdk = await InboxSDK.load(2, "sdk_gmanager_284293dc99");
const customRouteIds = {
  SUBSCRIPTIONS: "subscriptions"
};
const unregisterHandlers = [];

function log() {
  console.log.apply(
    console,
    ['custom-view'].concat(Array.prototype.slice.call(arguments)),
  );
}

sdk.Router.handleAllRoutes(function (routeView) {
  log(
    'id',
    routeView.getRouteID(),
    'type',
    routeView.getRouteType(),
    'params',
    routeView.getParams(),
  );
});

initUI();
renderUI();

function initUI() {
  const subsNavItemView = sdk.NavMenu.addNavItem({
    name: "Subscriptions",
  });
  const currentSubsView = subsNavItemView.addNavItem({
    name: "Current",
    routeID: customRouteIds.SUBSCRIPTIONS,
    iconUrl: chrome.runtime.getURL('./subscribe.png'),
  });
}

function clearUI() {
  // collapsibleSectionView.remove();
  unregisterHandlers.forEach(fn => fn());
  unregisterHandlers.length = 0;
}

async function renderUI() {
  try {
    const storage = await chrome.storage.local.get([c.ALL_SUBS, c.LAST_SYNCED]);
    const storage_subs = storage[c.ALL_SUBS];

    // grab a list of emails? from the current inbox, display most recent 50 of unique emails, list email and sender and thread name
    unregisterHandlers[unregisterHandlers.length] = sdk.Router.handleCustomRoute(customRouteIds.SUBSCRIPTIONS, (customRouteView) => {
      const parent = customRouteView.getElement();
      console.log(parent);

      let last_synced = "";
      const all_subs = [];

      if (contentUtils.formatAllSubs(storage_subs, all_subs)) {
        last_synced = "Last synced: " + new Date(storage[c.LAST_SYNCED]).toString();
      }

      parent.class;
      parent.innerHTML = `
      <h3>Subscriptions</h3>
      <div>
        <div>${last_synced}</div>
        <div>You are currently subscribed to ${all_subs.length} emails.</div>
      </div>
      <button id="sync-now-btn">Sync Now</button>
      <button id="reset-btn">Reset</button>
      `;
      parent.appendChild(ui.Instructions());
      parent.appendChild(ui.SubscriptionTable(all_subs, storage_subs));

      const syncNowBtn = parent.querySelector("button#sync-now-btn");
      syncNowBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ message: c.SYNC });
      });
      const resetBtn = parent.querySelector("button#reset-btn");
      resetBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ message: c.RESET });
      });

    });



    unregisterHandlers[unregisterHandlers.length] = sdk.Lists.registerThreadRowViewHandler(contentUtils.labelThreadRowViews(storage_subs));

  } catch (e) {
    console.warn("content.js error", e);
  }
}

