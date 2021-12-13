// InboxSDK.loadScript('https://cdn.jsdelivr.net/npm/vue@2.5.17/dist/vue.js')
// InboxSDK.loadScript('https://cdnjs.cloudflare.com/ajax/libs/axios/0.18.0/axios.min.js')
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

InboxSDK.load(2, "sdk_gmanager_284293dc99").then(function (sdk) {
	/* conversations to see inside messages
toolbars (hover over individual email row to press unsub button)
router for modifying the inbox page route
lists for modifying/reading the lists ?
*/

	// grab a list of emails? from the current inbox, display most recent 50 of unique emails, list email and sender and thread name
	sdk.Router.handleListRoute(sdk.Router.NativeListRouteIDs.INBOX, (ListRouteView) => {
		// TODO: check chrome.storage for sync timestamp and subscriber list. depending on presence or lack thereof, set the value for a last_synced string and sub_list array
		// TODO: if a row descriptor's label is set, compare it to current timestamp. if older than 1 week, update the storage and then set the rows
		// TODO: set contentElement to a nicely styled html notice/instructions on how to use the subscription
		var last_synced = ""; // set to "Last synced: timestamp"
		var subs_list = []; // set to the array in storage
		var collap_section = ListRouteView.addCollapsibleSection({
			title: "Subscriptions",
			subtitle:
				// "To unsubscribe from an email address, click on the respective row. It will navigate you to a new tab where you can fill out the request to unsubscribe. If you've recently unsubscribed from an email address and would like to delete all of their emails from your inbox, first copy and paste their email address into the search bar and hit enter. Check the box to select all emails, then select the option to 'Select all conversations that match this search'. Now that you've selected all of their emails, click the trashbin 'Delete' icon to delete them." +
				last_synced,
			titleLinkText: "Sync Now",
			onTitleLinkClick: () => {
				port.postMessage({ message: "sync" });
			},
			tableRows: subs_list,
		});
	});

	// adds button to unsubscribe to individual emails or to multiple selected
	sdk.Toolbars.registerThreadButton({
		title: "Unsubscribe",
		iconUrl: "../images/gman.png",
		positions: ["THREAD", "LIST"],
		onClick: (event) => {
			console.log(event);
			console.log(event.selectedThreadRowViews);
		},
		// hideFor: return true when there was no unsubscribe link in this email
		// when unsubbing, delete or send the email to trash
	});

	sdk.Lists.registerThreadRowViewHandler((ThreadRowView) => {
		// TODO: check the contacts (emailAddress and name) to see if they appear in the chrome.storage subscriber list and that label isnt set. if so, then add the "Subscribed" label
		var contact = ThreadRowView.getContacts()[0];
		console.log(contact.emailAddress, contact.name);
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

	// getSelectedThreadRowView - for every view in this array, check for unsub link and then activate it ?
});

// when user clicks on page alert
// document.addEventListener("click", () => alert("Click occurred!"));

/* make it load what is stored
chrome.storage.local.get("colour", (response) => {
	if (response.colour) document.body.style.backgroundColor = response.colour;
});
*/
