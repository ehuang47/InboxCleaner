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

	console.log(parent);
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

				last_synced = "Last synced: " + new Date(res.last_synced).toString();
			}

			ListRouteView.addCollapsibleSection({
				title: "Subscriptions",
				subtitle: last_synced,
				titleLinkText: "Sync Now",
				onTitleLinkClick: () => {
					port.postMessage({ message: "sync" });
				},
				tableRows: all_subs,
				contentElement: instructionHTML(),
				footerLinkText: "Reset",
				onFooterLinkClick: () => {
					port.postMessage({ message: "reset" });
				},
			});
		});

		sdk.Lists.registerThreadRowViewHandler((ThreadRowView) => {
			var contact = ThreadRowView.getContacts()[0];
			if (res.all_subs[contact.emailAddress] != null)
				ThreadRowView.addLabel({
					title: "Subscribed",
					foregroundColor: "white",
					backgroundColor: "gold",
				});
		});
	});
}

loadInboxSDK();
