import * as InboxSDK from '@inboxsdk/core';
import * as c from "./constants.js";
import * as contentUtils from "./utils/content-utils.js";

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
let unregisterHandler, collapsibleSectionView;

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
  console.log(sdk.NavMenu);
  // sdk.NavMenu.INBOX.addNavItem({
  //   name: "Subscriptions",
  // });
  const subsNavItemView = sdk.NavMenu.addNavItem({
    name: "Subscriptions",
  });
  const currentSubsView = subsNavItemView.addNavItem({
    name: "Current",
    routeID: customRouteIds.SUBSCRIPTIONS,
  });
}

function clearUI() {
  collapsibleSectionView.remove();
  unregisterHandler();
}

async function renderUI() {
  try {
    const storage = await chrome.storage.local.get([c.ALL_SUBS, c.LAST_SYNCED]);
    const storage_subs = storage[c.ALL_SUBS];

    // grab a list of emails? from the current inbox, display most recent 50 of unique emails, list email and sender and thread name
    sdk.Router.handleCustomRoute(customRouteIds.SUBSCRIPTIONS, (customRouteView) => {
      const parent = customRouteView.getElement();
      console.log(parent);

      let last_synced = "";
      const all_subs = [];

      if (contentUtils.formatAllSubs(storage_subs, all_subs)) {
        last_synced = "Last synced: " + new Date(storage[c.LAST_SYNCED]).toString();
      }

      parent.innerHTML = `
      <h3>Subscriptions</h3> ${last_synced}
      <button id="sync-now">Sync Now</button>
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Subscribed?</th>
            <th>Email Address</th>
            <th>Click To Unsubscribe</th>
          </tr>
        </thead>
        <tbody>
          ${all_subs.map(sub =>
        `<tr>
              <td>${sub.title}</td>
              <td>${storage_subs[sub.body][2]}</td>
              <td>${sub.body}</td>
              <td><a href=${storage_subs[sub.body][1]}>Unsubscribe</a></td>
            </tr>`
      ).join("")
        }
        </tbody>
      </table>
      `;
      console.log(parent.querySelector("button#sync-now"));
    });

    unregisterHandler = sdk.Router.handleListRoute(sdk.Router.NativeListRouteIDs.INBOX, (ListRouteView) => {
      let last_synced = "";
      const all_subs = [];

      if (contentUtils.formatAllSubs(storage_subs, all_subs)) {
        last_synced = "Last synced: " + new Date(storage[c.LAST_SYNCED]).toString();
      }

      collapsibleSectionView = ListRouteView.addCollapsibleSection({
        title: "Subscriptions",
        subtitle:
          last_synced ?? "You are currently subscribed to " + all_subs.length + " emails. " + last_synced,
        titleLinkText: "Sync Now",
        onTitleLinkClick: () => {
          chrome.runtime.sendMessage({ message: c.SYNC });
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

