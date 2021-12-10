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
	if (part.mimeType === "text/html") {
		let a = B64.decode(part.body.data);
		console.log(a);
		// return B64.decode(part.body.data);
	}
	if (part.parts != null) {
		for (i in part.parts) {
			var result = parseMessagePart(part.parts[i]);
			if (result != "") return result; // found text/html, so return decoded version
		}
	}
	return ""; // never found text/html
}

// batch together requests that grab a thread and extract its messages' contents
function extractThreadData(threads) {
	var batch = new gapi.client.newBatch();
	for (i in threads) {
		console.log(threads[i]);
		batch.add(
			gapi.client.gmail.users.threads
				.get({
					userId: "me",
					id: threads[i].id,
				})
				.then((res) => {
					console.log("Received thread" + threads[i].id + ":\n", res);
					let payload = res.result.messages[0].payload;
					var encoded_html = payload.body.data; // undefined if payload is multipart
					// message mimeType is either multiparty or text/html; we want to use B64 to decode the UTF8-encoded html
					console.log(parseMessagePart(payload));
					/*
					if (payload.mimeType.substring(0, 5) === "multi") {
						// mimeType is multipart => body is empty, so dive into nested payloads
						// payload parts tend to put text/html at index 1
						console.log(payload.mimeType, "\n", payload.body, "\n", payload.parts);
						var pl = payload,
							foundHTML = false;
						// TODO: usually parts[1] has the text/html type, but if not it'll be undefined so check that, then recurse through parts>mimeType until text/html appears to decode it
						console.log(pl);
						while (pl.mimeType.substring(0, 5) === "multi") {
							if (pl.parts[0].mimeType.substring(0, 5) === "multi") {
								pl = pl.parts[0];
								console.log("Part is multi:" + pl.mimeType);
								continue;
							}
							for (j in pl.parts.length) {
								console.log(j, pl.parts[j].mimeType);
								if (pl.parts[j].mimeType === "text/html") {
									pl = pl.parts[j];
									foundHTML = true;
									break;
								}
							}
							if (foundHTML) break;
						}
						encoded_html = pl.body.data;
					}
          console.log(B64.decode(encoded_html));
          */
				})
		);
	}
	return batch;
}

function getThreadHTML(threadDetails) {
	var body = threadDetails.result.messages[0].payload.parts[1].body.data;
	return B64.decode(body);
}

// listen for content script port connection
var gapi_loaded = false;
chrome.runtime.onConnect.addListener((port) => {
	console.log("connected to port: \n", port);
	if (port.name === "content") {
		// when content script loads, bg script sends hello, creates a listener for messages from the port and when it disconnects. it logs any response from the content script
		port.onMessage.addListener((msg, resPort) => {
			if (msg.message === "open_new_tab") {
				chrome.tabs.create({ url: msg.url });
			}

			/* content script loads, triggers the list route handler, which creates the section and sync button
      if user clicks sync now, it alerts the user, saying it will scan the entire inbox and take a while
      when user clicks yes, content script sends a message to background script asking for the data
      a listener in bg script will make gapi calls to prepare the data and then store it in chrome.storage
      when finished, it sends a response to content script to check the storage
      content script receives message and will refresh the page
      */
			if (gapi_loaded) {
				if (msg.message === "sync") {
					console.log("syncing now");
					// port.postMessage({ message: "updated_subscribers" });
					gapi.client.gmail.users.threads
						.list({
							userId: "me",
							maxResults: 5,
						})
						.then((threadDetails) => {
							console.log(threadDetails.result);
							// extractThreadData returns a batch that when executed, results in ? list of objects that contain the relevant thread details: sender name, email address, unsubscribe link
							extractThreadData(threadDetails.result.threads).execute(
								(responseMap, rawBatchResponse) => {
									// TODO: generate list of subscribers (rowdescriptor objects) up until last sync timestamp using gapi & the current sync timestamp to store in chrome.storage
									// TODO: set rowdescriptor title to name, body to emailaddress, shortdetail text for unsubscribe link, and onclick to a function that'll check storage, grabs the unsub link if exists or else do nothing, opens a new tab for user to fill out, update labels to one that says "unsubbed timestamp", nullify the unsub link, and refresh that tab
									// TODO: iterate through the batch responses and populate a dictionary based on unique subscribed email, then repeat for every 500-thread list
									console.log(responseMap);
								}
							);

							/*
							for (i in thread_list) {
								// must use threads.get to get a thread object
								let thread_id = thread_list[i].id;
								console.log(thread_list[i]);
								gapi.client.gmail.users.threads
									.get({
										userId: "me",
										id: thread_id,
									})
									.then((res) => {
										console.log("Received thread" + thread_id + ":\n", res);
										// emails tend to be of mimetype multipart, meaning messages will have empty bodies, so we have to traverse the payload message parts
										// dates are epoch, each payload part usually has a plaintext and plainhtml of the message, and we want to decode from utf8 to html to find the unsub link
										// we can usually find the unsub link in the first email message
										let msg_1 = res.result.messages[0];
										let date = msg_1.internalDate,
											payload = msg_1.payload;
										console.log(payload.mimeType, payload.body, payload.parts);
										console.log(B64.decode(msg_1.payload.parts[1].body.data));
										// TODO: usually parts[1] has the text/html type, but if not it'll be undefined so check that, then recurse through parts>mimeType until text/html appears to decode it
									});
							}*/
						});
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
// make sure to have user click a button (maybe on popup?) in order to activate interactive signin and access token, so that u can brief them why they need to sign in
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
		eval(request.responseText);
	};

	request.open("GET", "https://apis.google.com/js/client.js");
	request.send();
});

function archiveThread(id) {
	var request = gapi.client.request({
		path: "/gmail/v1/users/me/threads/" + id + "/modify",
		method: "POST",
		body: {
			removeLabelIds: ["INBOX"],
		},
	});

	request.execute();
}

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
