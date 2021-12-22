// when extension is installed, updated, or chrome is updated
chrome.runtime.onInstalled.addListener((details) => {
	// gets previous extension version, reason "oninstalled" activated, and maybe ID
	console.log("Triggered onInstalled due to: " + details.reason);

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

// after parsing text html into a DOM element, use query selectors to extract the unsub link
function getUnsubLink(html) {
	var node_list = html.querySelectorAll("a");
	for (let i = 0; i < node_list.length; i++) {
		let node = node_list[i];
		// console.log(node.outerHTML, "\n", node.outerText);
		if (node.outerText != undefined && node.outerText.match(/unsubscribe/i)) {
			// console.log(node.outerText);
			return node.href;
		}
		// sometimes, the href acts as onClick to activate native function
		// console.log(node_list[i]);
	}
	// never found the unsub link
	return null;
}

// some email headers contain an unsub link
function getHeaderUnsubLink(headers) {
	for (var i in headers) {
		let header = headers[i];
		if (header.name === "List-Unsubscribe") {
			console.log(header.value);
			// some headers are strange in that its a pair <unsub link, mail link> or it lacks the url so its just <mail-link>
			let http_or_mail = header.value.split(",")[0].slice(1, -1);
			return http_or_mail.match(/^https?:\/\/[^t][^r][^k]/) ? http_or_mail : null;
		}
	}
	return null;
}

// look in email headers to find the sender name and email
function getSender(headers) {
	for (var i in headers) {
		let header = headers[i];
		if (header.name === "From") {
			let data = header.value.split(" <");
			// console.log(header, data);
			// some headers solely have an email value, so splitting returns array of size 1
			return data[1] != null
				? { name: data[0], email: data[1].slice(0, -1) }
				: { name: "", email: data[0] };
		}
	}
}

// grab every thread, extract its messages' contents, and store in the subscription dictionary
function extractThreadData(threads) {
	let promises = [];
	for (i in threads) {
		// console.log(threads[i]);
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
					if (msg.internalDate < last_synced) {
						// an old email thread that we've already scanned, so set redundant_emails to true
						redundant_emails = true;
						return;
					}
					var payload = msg.payload;
					var href = getHeaderUnsubLink(payload.headers);
					if (href == null) {
						// when header doesn't display "unsubscribe" link, parse the html in the message that usually has it at the bottom
						var parsed_html = new DOMParser().parseFromString(
							parseMessagePart(payload),
							"text/html"
						);
						href = getUnsubLink(parsed_html);
					}

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
							all_subs[email] = [sender.name, href, true];
						}
					}
				})
				.catch((e) => {
					console.log("Error: " + e);
				})
		);
	}
	// returns promise that resolves only when all of the other callbacks of thread.get complete
	return new Promise((resolve, reject) => {
		resolve(Promise.all(promises));
	});
}

// grab all gmail threads that haven't been scanned, single out the unique subscribed emails that aren't already stored, and update chrome.storage
async function getThreads() {
	let maxThreads = 1500,
		thread_count = 0,
		pg_token = "",
		promises = [];
	while (pg_token != null && thread_count < maxThreads && !redundant_emails) {
		var threadDetails = await gapi.client.gmail.users.threads.list({
			userId: "me",
			pageToken: pg_token,
			maxResults: 500,
		});
		var res = threadDetails.result;
		thread_count += res.threads.length;
		pg_token = res.nextPageToken;
		promises.push(extractThreadData(res.threads));
	}
	// ! await to make sure we store the next page token in the thread list.
	// ! Promise.all to wait for extractThreadData promises to resolve after all thread.get callbacks complete, then store the subscriber list
	return new Promise((resolve, reject) => {
		resolve(
			Promise.all(promises).then((res) => {
				console.log(all_subs);
				chrome.storage.local.set({ all_subs: all_subs, last_synced: new Date().getTime() });
				let elapsed = new Date().getTime() - start;
				var mins = elapsed / 60000;
				console.log(mins.toFixed(3) + " min, " + (elapsed / 1000 - mins * 60).toFixed(3) + " sec");
			})
		);
	});
}

// listen for content script port connection
var gapi_loaded = false,
	all_subs = {},
	last_synced = null,
	redundant_emails = false,
	start = null;

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
					start = new Date().getTime();
					redundant_emails = false; // reset bool for every sync request
					// see if we've synced before, and use the existing subscriber list & sync time
					chrome.storage.local.get(["all_subs", "last_synced"], (res) => {
						// console.log(res);
						if (Object.keys(res).length != 0) {
							all_subs = res.all_subs;
							last_synced = res.last_synced;
						}
						console.log("Sync in progress. Last synced at: ", last_synced);
						getThreads().then(() => {
							port.postMessage({ message: "updated_subscribers" });
						}); // updates the subscriber list into storage
					});
				}

				// mostly for testing, if you need to clear out subscriber list
				if (msg.message === "reset") {
					chrome.storage.local.clear();
					all_subs = {};
					last_synced = null;
					port.postMessage({ message: "updated_subscribers" });
				}
				// TODO: footer button onclick that deletes all the null-unsub link rows and refreshes tab
			}
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
	/* retrieves an OAuth2 access token for making http request to API functions, then load Google's javascript client libraries
  ? does identity auto - remove invalid cached tokens ?
  if not using chrome extension, no access to chrome.identity, so use the client.init that'll auto-load auth2
  https://stackoverflow.com/questions/18681803/loading-google-api-javascript-client-library-into-chrome-extension
  gapi-client script defines a window["gapi_onload"] as the callback function for after it finishes loading, so it must be defined before making the script request
  */
	window.gapi_onload = () => {
		// load with discovery rest url and set the chrome identity oauth token to make authorized requests
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

// https://gist.github.com/sumitpore/47439fcd86696a71bf083ede8bbd5466
