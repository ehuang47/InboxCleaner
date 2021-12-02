// InboxSDK.loadScript('https://cdn.jsdelivr.net/npm/vue@2.5.17/dist/vue.js')
// InboxSDK.loadScript('https://cdnjs.cloudflare.com/ajax/libs/axios/0.18.0/axios.min.js')
// perhaps this will generate port array if multiple listeners
var port = chrome.runtime.connect({ name: "content" });

port.onMessage.addListener((msg, resPort) => {
	console.log(msg);
	if (msg.text === "hello") resPort.postMessage({ text: "hello, i am content" });
});

// ONE-TIME MESSAGING
// when message is sent by extension process(runtime.sendMessage) or content script(tabs.sendMessage)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	// gets the message and sender, as well as a function to respond with
	console.log(msg);

	if (msg.colour) document.body.style.backgroundColor = msg.colour;
	if (msg.text === "open_browser") {
		var firstHref = $("a[href^='http']").eq(0).attr("href");
		console.log(firstHref);
		port.postMessage({ message: "open_new_tab", url: firstHref });
		// return true; only when u need to send response asynchronously (after an async function)
	}
});

InboxSDK.load(2, "sdk_gmanager_284293dc99").then(function (sdk) {
	// sdk.Router.handleCustomRoute(CUSTOM, (CustomRouteView) => {
	//   routeID = CustomRouteView.getRouteID();
	// });

	/*
conversations to see inside messages
toolbars (hover over individual email row to press unsub button)
router for modifying the inbox page route
lists for modifying/reading the lists ?
*/

	// grab a list of emails? from the current inbox, display most recent 50 of unique emails, list email and sender and thread name
	sdk.Router.handleListRoute(sdk.Router.NativeListRouteIDs.INBOX, (ListRouteView) => {
		var collap_section = ListRouteView.addCollapsibleSection({
			title: "Subscriptions",
			subtitle: "Expand to view the list of emails that you're currently subscribed to.",
			tableRows: [],
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
		// for each visible thread, look at sender email and thread title, take most recent/unique email and append to list to show in subscriptions tab, ONLY if "unsubscribe" link is within the message
		ThreadRowView.addLabel({
			title: "Subscribed",
			foregroundColor: "white",
			backgroundColor: "gold",
		});
		ThreadRowView.addButton({
			title: "Unsubscribe",
			iconUrl: "../images/gman.png",
			onClick: (event) => {
				event.threadRowView.getThreadIDIfStableAsync().then((id) => {
					// grab the current inbox url and re-direct to the thread id to open in new tab
					let thread_url = $("a[href^='http']").eq(0).attr("href").slice(0, -5) + "#inbox/" + id;
					port.postMessage({ message: "open_new_tab", url: thread_url });
				});
			},
		});
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
