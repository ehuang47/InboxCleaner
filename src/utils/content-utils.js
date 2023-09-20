export function formatAllSubs(storage_subs, all_subs) {
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
    return true;
  }
  return false;
}

export function registerRowHandlers(storage_subs) {
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
}

export function labelThreadRowViews(storage_subs) {
  // for each thread row that we see, attach a label to indicate if this is a subscribed email
  return (ThreadRowView) => {
    var contact = ThreadRowView.getContacts()[0];
    if (storage_subs && storage_subs.hasOwnProperty(contact.emailAddress)) {
      const [name, unsubUrl, isSubscribed] = storage_subs[contact.emailAddress];
      ThreadRowView.addLabel({
        title: isSubscribed ? "Subscribed" : "Unsubscribed",
        foregroundColor: "white",
        backgroundColor: isSubscribed ? "gold" : "pink",
      });
    }
  };
}

export function instructionHTML() {
  const parent = document.createElement("div");
  parent.innerHTML = `<p>If you've recently unsubscribed from an email address and would like to delete all of their emails from your inbox, follow the steps below.</p>
  <ol>
  <li id="li-0">Copy and paste their email address into the search bar and hit enter.</li>
  <li id="li-1">Check the box to select all emails, then select the option to 'Select all conversations that match this search'.</li>
  <li id="li-2">With all emails selected, click the trash bin 'Delete' icon.</li>
  </ol>
  `;
  return parent;
}
