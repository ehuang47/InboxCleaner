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
let loadingMessage;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message) {
    case c.UPDATED_SUBSCRIBERS: {
      loadingMessage?.destroy();
      renderUI(sdkViews.customRoute, sdkViews.currentSubs);
      const msg = sdk.ButterBar.showMessage({
        text: "Subscriptions updated successfully!"
      });
      setTimeout(() => {
        msg.destroy();
      }, 2000);
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
    chrome.storage.local.get([c.ALL_SUBS]).then(storage => {
      if (!storage.hasOwnProperty(c.ALL_SUBS)) { // possibly first time
        sdk.Widgets.showModalView({
          el: ui.Instructions(),
          title: "Tips",
          constrainTitleWidth: true
        });
      }
    });
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
      parent.classList.add(["ic-container"]);
      console.log(parent);

      let last_synced = "";
      const all_subs = [];

      if (contentUtils.formatAllSubs(storage_subs, all_subs)) {
        last_synced = "Last synced: " + new Date(storage[c.LAST_SYNCED]).toLocaleString();
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
          loadingMessage = sdk.ButterBar.showLoading({
            text: "Syncing all emails..."
          });
        }
      }));
      parent.appendChild(ui.MyButton({
        id: "reset-btn",
        innerText: "Reset",
        onClick: () => {
          chrome.runtime.sendMessage({ message: c.RESET });
          loadingMessage = sdk.ButterBar.showLoading({
            text: "Resetting stored subscriptions..."
          });
        }
      }));
      parent.appendChild(ui.Instructions());
      if (!storage_subs) return;
      parent.appendChild(ui.SubscriptionTable({ all_subs, storage_subs }));
    }
  } catch (e) {
    console.warn("content.js error", e);
  }
}

