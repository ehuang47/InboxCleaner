import * as InboxSDK from '@inboxsdk/core';
import * as c from "./constants.js";
import * as contentUtils from "./utils/content-utils.js";
import ui from "./ui";

const sdkViews = {
  customRoute: null,
  currentSubs: null
};
const sdk = await InboxSDK.load(2, "sdk_gmanager_284293dc99");
const customRouteIds = {
  SUBSCRIPTIONS: "subscriptions"
};
const unregisterHandlers = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message) {
    case c.UPDATED_SUBSCRIBERS: {
      renderUI(sdkViews.customRoute, sdkViews.currentSubs);
      break;
    }
    default:
      console.log("unknown handler", request.message);
  }
  sendResponse();
});

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

function initUI() {
  const subsNavItemView = sdk.NavMenu.addNavItem({
    name: "Subscriptions",
  });
  const currentSubsView = subsNavItemView.addNavItem({
    name: "Current",
    routeID: customRouteIds.SUBSCRIPTIONS,
    iconUrl: chrome.runtime.getURL('./subscribe.png'),
  });
  sdkViews.currentSubs = currentSubsView;


  // grab a list of emails? from the current inbox, display most recent 50 of unique emails, list email and sender and thread name
  unregisterHandlers[unregisterHandlers.length] = sdk.Router.handleCustomRoute(customRouteIds.SUBSCRIPTIONS, (customRouteView) => {
    sdkViews.customRoute = customRouteView;
    renderUI(customRouteView, currentSubsView);
  });
}

async function renderUI(customRouteView, currentSubsView) {
  try {
    const storage = await chrome.storage.local.get([c.ALL_SUBS, c.LAST_SYNCED]);
    const storage_subs = storage[c.ALL_SUBS];

    await updateCurrentSubCount();
    await loadSubscriptionRoute();

    unregisterHandlers[unregisterHandlers.length] = sdk.Lists.registerThreadRowViewHandler(contentUtils.labelThreadRowViews(storage_subs));

    async function updateCurrentSubCount() {
      const currentSubs = await currentSubsView.getElement();
      const tabInfo = currentSubs.querySelector("span.bsU"); // similar to inbox span
      tabInfo.innerText = null;
      if (storage.hasOwnProperty(c.ALL_SUBS)) {
        tabInfo.innerText = Object.keys(storage[c.ALL_SUBS]).length;
        tabInfo.style.display = "inline";
      }
    }

    async function loadSubscriptionRoute() {
      const parent = customRouteView.getElement();
      console.log(parent);

      let last_synced = "";
      const all_subs = [];

      if (contentUtils.formatAllSubs(storage_subs, all_subs)) {
        last_synced = "Last synced: " + new Date(storage[c.LAST_SYNCED]).toString();
      }

      parent.innerHTML = `
      <h3>Subscriptions</h3>
      <span>${last_synced}</span>
      `;
      parent.appendChild(ui.MyButton({
        id: "sync-now-btn",
        innerText: "Sync Now",
        onClick: () => {
          chrome.runtime.sendMessage({ message: c.SYNC });
        }
      }));
      parent.appendChild(ui.MyButton({
        id: "reset-btn",
        innerText: "Reset",
        onClick: () => {
          chrome.runtime.sendMessage({ message: c.RESET });
        }
      }));
      parent.appendChild(ui.Instructions());
      parent.appendChild(ui.SubscriptionTable({ all_subs, storage_subs }));
    }


  } catch (e) {
    console.warn("content.js error", e);
  }
}

