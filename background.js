// when extension is installed, updated, or chrome is updated
chrome.runtime.onInstalled.addListener((details) => {
	// gets previous extension version, reason "oninstalled" activated, and maybe ID
	console.log("Triggered onInstalled due to: " + details.reason);

	// set stored color for changing background
	chrome.storage.sync.set({ color: "#3aa757" }, function () {
		console.log("The color is green.");
	});

	// setting rules for page actions & taking action when accessing a page that meets all criteria
	chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
		chrome.declarativeContent.onPageChanged.addRules([
			{
				conditions: [
					new chrome.declarativeContent.PageStateMatcher({
						pageUrl: { hostContains: ".google.com", schemes: ["https"] },
					}),
				],
				actions: [new chrome.declarativeContent.ShowPageAction()],
			},
		]);
	});
});

// recursion to traverse the messageparts and acquire the decoded text/html
function parseMessagePart(part) {
	// console.log(part.mimeType, "\n", part.body, "\n", part.parts);
	if (part == null || part.mimeType === "text/plain") return "";
	// https://exceptionshub.com/gmail-api-parse-message-content-base64-decoding-with-javascript.html
	// https://stackoverflow.com/questions/24811008/gmail-api-decoding-messages-in-javascript
	if (part.mimeType === "text/html")
		return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));

	if (part.parts != null) {
		for (i in part.parts) {
			var result = parseMessagePart(part.parts[i]);
			if (result != "") return result; // found text/html, so return decoded version
		}
	}
	return ""; // never found text/html
}

function getUnsubLink(html) {
	var node_list = html.querySelectorAll("a");
	for (var i in node_list) {
		let node = node_list[i];
		// console.log(node.outerHTML, "\n", node.outerText);
		if (node.outerText != undefined && node.outerText.match(/unsubscribe/i)) {
			return node.href;
		}
		// sometimes, the href acts as onClick to activate native function
		// console.log(node_list[i]);
	}
	// never found the unsub link
	return null;
}

function getSender(headers) {
	for (var i in headers) {
		let header = headers[i];
		if (header.name === "From") {
			let data = header.value.split(" <");
			return { name: data[0], email: data[1].slice(0, -1) };
		}
	}
}

// grab every thread, extract its messages' contents, and store in the subscription dictionary
function extractThreadData(threads) {
	let promises = [];
	for (i in threads) {
		console.log(threads[i]);
		promises.push(
			gapi.client.gmail.users.threads
				.get({
					userId: "me",
					id: threads[i].id,
				})
				.then((res) => {
					console.log("Received thread" + threads[i].id + ":\n", res);
					let msg = res.result.messages[0];
					// message mimeType is either multiparty or text/html; we want to use decode the UTF8-encoded html
					// TODO: check current thread epoch against last sync epoch to determine cutoff, which results in extracting the most recent list of subscribers (rowdescriptor objects) since last sync timestamp
					if (msg.internalDate < last_synced) {
						// an old email thread that we've already scanned, so set redundant_emails to true
						redundant_emails = true;
						return;
					}
					var payload = msg.payload;
					var parsed_html = new DOMParser().parseFromString(parseMessagePart(payload), "text/html");
					var href = getUnsubLink(parsed_html);
					if (href != null) {
						// only grab sender information when an unsub link is found
						var sender = getSender(payload.headers);
						// console.log(sender);
						// console.log("Unsubscribe at:", href);
						// console.log(parsed_html);
						let email = sender.email;
						// console.log(email, all_subs[email]);
						if (all_subs[email] == null) {
							// only record sender info if there is no existing entry
							all_subs[email] = [sender.name, href];
						}
					}
				})
		);
	}
	// returns promise that resolves only when all of the other callbacks of thread.get complete
	return new Promise((resolve, reject) => {
		resolve(Promise.all(promises));
	});
}

/* content script loads, triggers the list route handler, which creates the section and sync button
if user clicks sync now, it alerts the user, saying it will scan the entire inbox and take a while
when user clicks yes, content script sends a message to background script asking for the data
a listener in bg script will make gapi calls to prepare the data and then store it in chrome.storage
when finished, it sends a response to content script to check the storage
content script receives message and will refresh the page
*/
async function getThreads() {
	// TODO: calculate how many list() calls i must make based on n = total inbox count - emails checked, may need promise.all on array[n] for guaranteeing that all callbacks updated sub list
	let maxThreads = 50,
		thread_count = 0,
		pg_token = "",
		promises = [];
	while (pg_token != null && thread_count < maxThreads && !redundant_emails) {
		var threadDetails = await gapi.client.gmail.users.threads.list({
			userId: "me",
			pageToken: pg_token,
			maxResults: 5,
		});
		var res = threadDetails.result;
		thread_count += res.threads.length;
		pg_token = res.nextPageToken;
		promises.push(extractThreadData(res.threads));
	}
	// ! await to make sure we store the next page token in the thread list. Promise.all to wait for extractThreadData promises to resolve after all thread.get callbacks complete, then store the subscriber list
	Promise.all(promises).then((res) => {
		console.log(all_subs);
		chrome.storage.local.set({ all_subs: all_subs, last_synced: new Date().getTime() });
	});
}

// listen for content script port connection
var gapi_loaded = false,
	all_subs = {},
	last_synced = null,
	redundant_emails = false;
chrome.runtime.onConnect.addListener((port) => {
	console.log("connected to port: \n", port);
	if (port.name === "content") {
		// when content script loads, bg script sends hello, creates a listener for messages from the port and when it disconnects. it logs any response from the content script
		port.onMessage.addListener((msg, resPort) => {
			if (msg.message === "open_new_tab") {
				chrome.tabs.create({ url: msg.url });
			}

			if (gapi_loaded) {
				if (msg.message === "sync") {
					// port.postMessage({ message: "updated_subscribers" });
					chrome.storage.local.get(["all_subs", "last_synced"], (res) => {
						// console.log(res);
						if (Object.keys(res).length != 0) {
							all_subs = res.all_subs;
							last_synced = res.last_synced;
						}
						console.log("Sync in progress. Last synced at: ", last_synced);
						getThreads(); // updates the subscriber list into storage
					});
				}
				if (msg.message === "reset") {
					chrome.storage.local.clear();
					redundant_emails = false;
				}
				// TODO: footer button onclick that deletes all the null-unsub link rows and refreshes tab
				// if (msg.message === "clear_unsubscribed") { }
			}
		});
		// gets rid of listeners when disconnected?
		port.onDisconnect.addListener(() => {
			port = null; // same as port.onDisconnect.removeListener()
		});
	}

	if (port.name === "popup") {
		port.postMessage({ text: "hello" });
		port.onMessage.addListener((msg, resPort) => {
			console.log("popup responded: \n", msg);
		});
		// gets rid of listeners when disconnected?
		port.onDisconnect.addListener(() => {
			port = null; // same as port.onDisconnect.removeListener()
		});
	}
});

//* Gmail API OAuth2 @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// TODO: have user click a button (maybe on popup?) in order to activate interactive signin and access token, so that u can brief them why they need to sign in
// https://gist.github.com/omarstreak/7908035c91927abfef59 --> reference code
chrome.identity.getAuthToken({ interactive: true }, (token) => {
	// retrieves an OAuth2 access token for making http request to API functions, then load Google's javascript client libraries... does identity auto-remove invalid cached tokens?
	// if not using chrome extension, no access to chrome.identity, so use the client.init that'll auto-load auth2

	/* https://stackoverflow.com/questions/18681803/loading-google-api-javascript-client-library-into-chrome-extension
  gapi-client script defines a window["gapi_onload"] as the callback function for after it finishes loading, so it must be defined before making the script request
  not sure why gapi.auth is called to authorizer a new token, when chrome.identity should've done so already. i believe we can go straight to gapi client load
  */
	window.gapi_onload = () => {
		// load with discovery rest url
		gapi.client.load("https://gmail.googleapis.com/$discovery/rest?version=v1").then(() => {
			gapi_loaded = true;
			gapi.client.setToken({ access_token: token });
		});
	};

	// make http request to load the API client script
	var request = new XMLHttpRequest();
	request.onreadystatechange = function () {
		if (request.readyState !== 4 || request.status !== 200) return;
		eval(request.responseText); //! UNSAFE
	};

	request.open("GET", "https://apis.google.com/js/client.js");
	request.send();
});

/* listen for when the browser button is clicked
! chrome.browserAction or pageAction
chrome.action.onClicked.addListener((tab) => {
	// Send a message to the active tab
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		var activeTab = tabs[0];
		// upon response with active tab URL, create a duplicate tab
		chrome.tabs.sendMessage(activeTab.id, { message: "clicked_browser_action" }, (response) => {
			if (response.message === "open_new_tab") {
				chrome.tabs.create({ url: response.url });
			}
		});
	});
});
*/

/* storage API get/set 
chrome.storage.local.set({ variable: variableInformation });
chrome.storage.local.get(['variable'], function(result) {
  let awesomeVariable = result.variable;
  // Do something with awesomeVariable
});

* alarms API for timer delay
chrome.alarms.create({delayInMinutes: 3.0})
chrome.alarms.onAlarm.addListener(function() {
  alert("Hello, world!")
});

* use callback to async call functions defined here
document.getElementById('target').addEventListener('click', function() {
  chrome.runtime.getBackgroundPage(function(backgroundPage){
    backgroundPage.backgroundFunction()
  })
});
*/
