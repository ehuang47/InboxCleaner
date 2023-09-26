import * as InboxSDK from '@inboxsdk/core';
import * as c from "./constants.js";
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
  (async () => {
    loadingMessage?.destroy();
    let msg;
    switch (request.message) {
      case c.UPDATED_SUBSCRIBERS: {
        msg = sdk.ButterBar.showMessage({
          text: "Subscriptions successfully updated."
        });
        await renderUI(sdkViews.customRoute, sdkViews.currentSubs);
        break;
      }
      case c.TRASH_SENDER_THREADS: {
        msg = sdk.ButterBar.showMessage({
          text: "Threads moved to Trash."
        });
        break;
      }
      case c.ERROR: {
        msg = sdk.ButterBar.showError({
          text: "There was a problem. Please try again later."
        });
        break;
      }
      default:
        logger.shared.log({
          data: request.message,
          message: "unknown handler",
          type: "info"
        });
    }
    setTimeout(() => {
      msg.destroy();
    }, 2000);
    sendResponse();
  })();
  return true;
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

async function renderUI(customRouteView, currentSubsView) {
  try {
    const storage = await chrome.storage.local.get([c.ALL_SUBS, c.LAST_SYNCED, c.SENDER_THREADS]);
    const senderThreads = storage[c.SENDER_THREADS];
    const storageSubs = storage[c.ALL_SUBS];

    await updateCurrentSubCount();
    await loadSubscriptionRoute();

    unregisterHandlers.forEach(fn => fn());
    unregisterHandlers.length = 0;
    unregisterHandlers[unregisterHandlers.length] = sdk.Lists.registerThreadRowViewHandler((ThreadRowView) => {
      // add subscription label to qualifying threads
      var contact = ThreadRowView.getContacts()[0];
      if (storageSubs && storageSubs.hasOwnProperty(contact.emailAddress)) {
        ThreadRowView.addLabel({
          title: "Subscription",
          foregroundColor: "white",
          backgroundColor: "green"
        });
      }
    });

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

      if (storageSubs && Object.keys(storageSubs).length > 0) {
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
        classes: ["ic-btn"],
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
        classes: ["ic-btn"],
        onClick: () => {
          chrome.runtime.sendMessage({ message: c.RESET });
          loadingMessage = sdk.ButterBar.showLoading({
            text: "Resetting stored subscriptions..."
          });
        }
      }));

      parent.children[0].appendChild(btnContainer);
      parent.appendChild(ui.Instructions());
      if (!storageSubs) return;
      parent.appendChild(ui.SubscriptionTable({
        senderThreads,
        storageSubs,
        render: () => { renderUI(customRouteView, currentSubsView); },
        onTrashThreads: (sender) => {
          chrome.runtime.sendMessage({ message: c.TRASH_SENDER_THREADS, data: sender });
          loadingMessage = sdk.ButterBar.showLoading({
            text: "Moving threads to Trash..."
          });
        }
      }));
    }
  } catch (e) {
    console.warn("content.js error", e);
  }
}

