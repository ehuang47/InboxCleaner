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
let loadingMessage;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    loadingMessage?.destroy();
    let msg;
    switch (request.message) {
      case c.UPDATED_SUBSCRIBERS: {
        await chrome.storage.local.set({ [c.IS_SYNCING]: false });
        msg = sdk.ButterBar.showMessage({
          text: "Subscriptions successfully updated.",
          time: 5000
        });
        await renderUI(sdkViews.customRoute, sdkViews.currentSubs);
        break;
      }
      case c.UPDATE_PROGRESS: {
        msg = sdk.ButterBar.showMessage({
          text: request.data,
          time: 60000
        }); // no need to set a timer, it'll be updated soon
        break;
      }
      case c.TRASH_SENDER_THREADS: {
        await chrome.storage.local.set({ [c.IS_TRASHING]: false });
        msg = sdk.ButterBar.showMessage({
          text: "Threads moved to Trash.",
          time: 5000
        });
        setTimeout(() => { msg.destroy(); }, 3000);
        break;
      }
      case c.ERROR: {
        await chrome.storage.local.set({ [c.IS_TRASHING]: false, [c.IS_SYNCING]: false });
        msg = sdk.ButterBar.showError({
          text: "There was a problem. Please try again later.",
          time: 5000
        });
        setTimeout(() => { msg.destroy(); }, 3000);
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
    const storage = await chrome.storage.local.get([c.ALL_SUBS, c.LAST_SYNCED]);
    const storageSubs = storage[c.ALL_SUBS];

    await updateCurrentSubCount();
    await loadSubscriptionRoute();



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
        onClick: async () => {
          const isProcessing = await checkProcessing({
            key: c.IS_SYNCING,
            warningMessage: "You are currently syncing threads in your mailbox."
          });
          if (isProcessing) return;

          await chrome.storage.local.set({ [c.IS_SYNCING]: true });
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
        storageSubs,
        render: () => { renderUI(customRouteView, currentSubsView); },
        onTrashThreads: async (sender) => {
          const isProcessing = await checkProcessing({
            key: c.IS_TRASHING,
            warningMessage: "You are currently moving threads to the trash."
          });
          if (isProcessing) return;

          await chrome.storage.local.set({ [c.IS_TRASHING]: true });
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

async function checkProcessing({ key, warningMessage }) {
  const { [key]: isBusy } = await chrome.storage.local.get([key]);
  if (isBusy) {
    const div = document.createElement("div");
    div.innerText = warningMessage;
    sdk.Widgets.showModalView({
      el: div,
      title: "Please wait",
      showCloseButton: true
    });
  }
  return isBusy;
}
