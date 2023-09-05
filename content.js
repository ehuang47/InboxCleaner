chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(sender.tab ?
    "from a content script:" + sender.tab.url :
    "from the extension");

  if (request.message === "updated_subscribers") window.location.reload(true);
  sendResponse();
});

async function getFromLocal(key) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(key, (value) => {
        resolve(value);
      });
    } catch (ex) {
      reject(ex);
    }
  });
}

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

async function loadInboxSDK() {
  var res = await getFromLocal(["all_subs", "last_synced"]);
  InboxSDK.load(2, "sdk_gmanager_284293dc99").then(function (sdk) {
    // grab a list of emails? from the current inbox, display most recent 50 of unique emails, list email and sender and thread name
    sdk.Router.handleListRoute(sdk.Router.NativeListRouteIDs.INBOX, (ListRouteView) => {
      var last_synced = "";
      var all_subs = [];

      if (Object.keys(res).length != 0) {
        let subs = res.all_subs;
        for (key in subs) {
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

        all_subs.sort((a, b) => {
          let fa = a.body.toLowerCase(),
            fb = b.body.toLowerCase();

          if (fa < fb) {
            return -1;
          }
          if (fa > fb) {
            return 1;
          }
          return 0;
        });
        last_synced = "Last synced: " + new Date(res.last_synced).toString();
      }

      ListRouteView.addCollapsibleSection({
        title: "Subscriptions",
        subtitle:
          last_synced === ""
            ? last_synced
            : "You are currently subscribed to " + all_subs.length + " emails. " + last_synced,
        titleLinkText: "Sync Now",
        onTitleLinkClick: () => {
          // port.postMessage({ message: "sync" });
          chrome.runtime.sendMessage({ message: "sync" });
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
          let subs = res.all_subs;
          subs[key][2] = false;
          chrome.storage.local.set({ all_subs: subs });
          // port.postMessage({ message: "open_new_tab", url: subs[key][1] });
          chrome.runtime.sendMessage({ message: "open_new_tab", url: subs[key][1] });
        });
      }

      let test = document.querySelector(".inboxsdk__resultsSection .zE");
      test.children[0].addEventListener("click", (e) => {
        console.log("clicked subscription heading, resetting");
        port.postMessage({ message: "reset" });
        chrome.runtime.sendMessage({ message: "reset" });
      });
    });

    // for each thread row that we see, attach a label to indicate if this is a subscribed email
    sdk.Lists.registerThreadRowViewHandler((ThreadRowView) => {
      var contact = ThreadRowView.getContacts()[0];
      if (res.all_subs != null && res.all_subs[contact.emailAddress] != null)
        res.all_subs[contact.emailAddress][2]
          ? ThreadRowView.addLabel({
            title: "Subscribed",
            foregroundColor: "white",
            backgroundColor: "gold",
          })
          : ThreadRowView.addLabel({
            title: "Unsubscribed",
            foregroundColor: "white",
            backgroundColor: "pink",
          });
    });
  });
}

loadInboxSDK();
