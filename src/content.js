import * as InboxSDK from '@inboxsdk/core';
import * as c from "./constants.js";
import * as contentUtils from "./utils/content-utils.js";
import ui from "./ui";
import logger from './services/LoggerService.js';

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
      logger.shared.log({
        data: request.message,
        message: "unknown handler",
        type: "info"
      });
  }
  sendResponse();
});

sdk.Router.handleAllRoutes(function (routeView) {
  logger.shared.log({
    data: routeView.getParams(),
    message: `id: ${routeView.getRouteID()}, type: ${routeView.getRouteType()}, params:`,
    type: "info"
  });
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
  sdk.Router.handleCustomRoute(customRouteIds.SUBSCRIPTIONS, (customRouteView) => {
    sdkViews.customRoute = customRouteView;
    renderUI(customRouteView, currentSubsView);
  });
}

function removeHandlers() {
  unregisterHandlers.forEach(fn => fn());
  unregisterHandlers.length = 0;
}

async function renderUI(customRouteView, currentSubsView) {
  try {
    const storage = await chrome.storage.local.get([c.ALL_SUBS, c.LAST_SYNCED]);
    const storage_subs = storage[c.ALL_SUBS];

    await updateCurrentSubCount();
    await loadSubscriptionRoute();

    removeHandlers();
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
      logger.shared.log({
        data: parent,
        message: `custom route view parent element`,
        type: "info"
      });

      let last_synced = "";
      const all_subs = [];

      if (contentUtils.formatAllSubs(storage_subs, all_subs)) {
        last_synced = "Last synced: " + new Date(storage[c.LAST_SYNCED]).toLocaleString();
      }

      parent.innerHTML = `
      <div class="ic-flex-row">
        <h3>Subscriptions</h3>
        <span>${last_synced}</span>
      </div>
      `;

      const btnContainer = document.createElement("div");
      btnContainer.classList.add(["ic-flex-row"]);
      btnContainer.appendChild(ui.MyButton({
        id: "sync-now-btn",
        innerText: "Sync Now",
        onClick: () => {
          chrome.runtime.sendMessage({ message: c.SYNC });
          loadingMessage = sdk.ButterBar.showLoading({
            text: "Syncing all emails..."
          });
        }
      }));
      btnContainer.appendChild(ui.MyButton({
        id: "reset-btn",
        innerText: "Reset",
        onClick: () => {
          chrome.runtime.sendMessage({ message: c.RESET });
          loadingMessage = sdk.ButterBar.showLoading({
            text: "Resetting stored subscriptions..."
          });
        }
      }));

      parent.children[0].appendChild(btnContainer);
      parent.appendChild(ui.Instructions());
      if (!storage_subs) return;
      parent.appendChild(ui.SubscriptionTable({ all_subs, storage_subs, render: () => { renderUI(customRouteView, currentSubsView); } }));
    }
  } catch (e) {
    console.warn("content.js error", e);
  }
}

