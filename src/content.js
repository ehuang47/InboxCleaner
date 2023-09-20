import * as InboxSDK from '@inboxsdk/core';
import * as c from "./constants.js";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(sender.tab ?
    "from a content script:" + sender.tab.url :
    "from the extension");
  if (request.message === c.UPDATED_SUBSCRIBERS) {
    window.location.reload(true);
  }
  sendResponse();
});

(async function () {
  try {
    const storage = await chrome.storage.local.get([c.ALL_SUBS, c.LAST_SYNCED]);
    const sdk = await InboxSDK.load(2, "sdk_gmanager_284293dc99");
    const storage_subs = storage[c.ALL_SUBS];

    // grab a list of emails? from the current inbox, display most recent 50 of unique emails, list email and sender and thread name
    sdk.Router.handleListRoute(sdk.Router.NativeListRouteIDs.INBOX, (ListRouteView) => {
      let last_synced = "";
      const all_subs = [];
      if (storage_subs && Object.keys(storage_subs).length > 0) {
        const subs = storage_subs;
        for (const key in subs) {
          // key = email, subs = { [name, unsub link, isSubscribed bool], ... }
          // console.log(key, subs[key]);
          all_subs.push({
            title: subs[key][0],
            body: key,
            shortDetailText: "Unsubscribe",
            isRead: true,
            labels: subs[key][2]
              ? [{ title: "Subscribed", foregroundColor: "white", backgroundColor: "gold" }]
              : [{ title: "Unsubscribed", foregroundColor: "white", backgroundColor: "pink" }],
          });
        }

        all_subs.sort((a, b) => a.body.toLowerCase().localeCompare(b.body.toLowerCase()));
        last_synced = "Last synced: " + new Date(storage[c.LAST_SYNCED]).toString();
      }

      ListRouteView.addCollapsibleSection({
        title: "Subscriptions",
        subtitle:
          last_synced ?? "You are currently subscribed to " + all_subs.length + " emails. " + last_synced,
        titleLinkText: "Sync Now",
        onTitleLinkClick: () => {
          chrome.runtime.sendMessage({ message: c.SYNC });
        },
        tableRows: all_subs,
        contentElement: instructionHTML(),
      });

      // scan the document for the html injected by inboxsdk and add onclick functionality
      let node_list = document.querySelectorAll(".inboxsdk__resultsSection_tableRow.zA.yO");
      for (let i = 0; i < node_list.length; i++) {
        var spans = node_list[i].querySelectorAll("span");
        // console.log(spans[0], spans[1], spans[2]); // should be sender, email, unsubscribe link
        let key = spans[1].innerText;
        spans[2].addEventListener("click", (e) => {
          storage_subs[key][2] = false;
          chrome.storage.local.set({ [c.ALL_SUBS]: storage_subs });
          chrome.runtime.sendMessage({ message: c.OPEN_NEW_TAB, url: storage_subs[key][1] });
        });
      }

      let test = document.querySelector(".inboxsdk__resultsSection .zE");
      test.children[0].addEventListener("click", (e) => {
        chrome.runtime.sendMessage({ message: c.RESET });
      });

      console.log("all_subs", all_subs);
      console.log("storage_subs", storage_subs);
    });

    // for each thread row that we see, attach a label to indicate if this is a subscribed email
    sdk.Lists.registerThreadRowViewHandler((ThreadRowView) => {
      var contact = ThreadRowView.getContacts()[0];
      if (storage_subs && storage_subs.hasOwnProperty(contact.emailAddress)) {
        const [name, unsubUrl, isSubscribed] = storage_subs[contact.emailAddress];
        ThreadRowView.addLabel({
          title: isSubscribed ? "Subscribed" : "Unsubscribed",
          foregroundColor: "white",
          backgroundColor: isSubscribed ? "gold" : "pink",
        });
      }
    });
  } catch (e) {
    console.warn("content.js error", e);
  }
})();


function instructionHTML() {
  var parent = document.createElement("div");
  var notice = document.createElement("p");
  notice.innerHTML =
    "If you've recently unsubscribed from an email address and would like to delete all of their emails from your inbox, follow the steps below.";
  parent.appendChild(notice);

  var instructions = document.createElement("ol");
  parent.appendChild(instructions);
  var steps = [
    "Copy and paste their email address into the search bar and hit enter.",
    "Check the box to select all emails, then select the option to 'Select all conversations that match this search'.",
    "With all emails selected, click the trash bin 'Delete' icon. ",
  ];
  for (var i = 0; i < 3; i++) {
    let step = document.createElement("li");
    step.setAttribute("id", "li" + i);
    step.innerHTML = steps[i];
    instructions.appendChild(step);
  }
  return parent;
}
