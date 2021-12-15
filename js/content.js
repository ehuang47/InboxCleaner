// perhaps this will generate port array if multiple listeners
var port = chrome.runtime.connect({ name: "content" });

port.onMessage.addListener((msg, resPort) => {
	// when the subscribers are updated, i need to refresh the page so they appear in the section
	if (msg.message === "updated_subscribers") window.location.reload(true);
});

/* ONE-TIME MESSAGING
when message is sent by extension process(runtime.sendMessage) or popup script(tabs.sendMessage)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	// gets the message and sender, as well as a function to respond with
	console.log(msg);

	if (msg.colour) document.body.style.backgroundColor = msg.colour;
	if (msg.message === "open_browser") {
		var firstHref = $("a[href^='http']").eq(0).attr("href");
		console.log(firstHref);
		port.postMessage({ message: "open_new_tab", url: firstHref });
		// return true; only when u need to send response asynchronously (after an async function)
  }
});
*/
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

async function loadInboxSDK() {
	var res = await getFromLocal(["all_subs", "last_synced"]);
	InboxSDK.load(2, "sdk_gmanager_284293dc99").then(function (sdk) {
		// grab a list of emails? from the current inbox, display most recent 50 of unique emails, list email and sender and thread name
		sdk.Router.handleListRoute(sdk.Router.NativeListRouteIDs.INBOX, (ListRouteView) => {
			// TODO: set contentElement to a nicely styled html notice/instructions on how to use the subscription
			var last_synced = "";
			var all_subs = [];

			if (Object.keys(res).length != 0) {
				let subs = res.all_subs;
				for (key in subs) {
					// key = email, subs = { [name, unsub link, isSubscribed bool], ... }
					console.log(key, subs[key]);
					all_subs.push({
						title: subs[key][0],
						body: key,
						shortDetailText: "Click this row to unsubscribe from " + key,
						isRead: true,
						labels: subs[key][2]
							? [{ title: "Subscribed", foregroundColor: "white", backgroundColor: "gold" }]
							: [{ title: "Unsubscribed", foregroundColor: "white", backgroundColor: "pink" }],
						onClick: () => {
							subs[key][2] = false;
							chrome.storage.local.set({ all_subs: subs });
							port.postMessage({ message: "open_new_tab", url: subs[key][1] });
						},
					});
				}

				// TODO: convert last synced epoch to "Last synced: __"
				last_synced = "Last synced: " + new Date(res.last_synced).toString();
			}

			ListRouteView.addCollapsibleSection({
				title: "Subscriptions",
				subtitle:
					// "To unsubscribe from an email address, click on the respective row. It will navigate you to a new tab where you can fill out the request to unsubscribe. If you've recently unsubscribed from an email address and would like to delete all of their emails from your inbox, first copy and paste their email address into the search bar and hit enter. Check the box to select all emails, then select the option to 'Select all conversations that match this search'. Now that you've selected all of their emails, click the trashbin 'Delete' icon to delete them." +
					last_synced,
				titleLinkText: "Sync Now",
				onTitleLinkClick: () => {
					port.postMessage({ message: "sync" });
				},
				tableRows: all_subs,
				footerLinkText: "Reset",
				onFooterLinkClick: () => {
					port.postMessage({ message: "reset" });
				},
			});
		});

		sdk.Lists.registerThreadRowViewHandler((ThreadRowView) => {
			// TODO: check the contacts (emailAddress and name) to see if they appear in the chrome.storage subscriber list and that label isnt set. if so, then add the "Subscribed" label
			var contact = ThreadRowView.getContacts()[0];
			// console.log(contact.emailAddress, contact.name);
			let subscribed = false;
			if (subscribed)
				ThreadRowView.addLabel({
					title: "Subscribed",
					foregroundColor: "white",
					backgroundColor: "gold",
				});

			/* currently, this opens the thread in a new tab
		ThreadRowView.addButton({
			title: "Unsubscribe",
			iconUrl: "../images/gman.png",
      onClick: (event) => {
        // check chrome storage for all the emails
				event.threadRowView.getThreadIDIfStableAsync().then((id) => {
					// grab the current inbox url and re-direct to the thread id to open in new tab
					let thread_url = $("a[href^='http']").eq(0).attr("href").slice(0, -5) + "#inbox/" + id;
					port.postMessage({ message: "open_new_tab", url: thread_url });
				});
			},
		});
    */
		});
	});
}

loadInboxSDK();
