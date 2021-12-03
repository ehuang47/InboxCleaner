console.log("Background script is running");

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
					// TODO: generate list of subscribers (rowdescriptor objects) up until last sync timestamp using gapi & the current sync timestamp to store in chrome.storage
					// TODO: set rowdescriptor title to name + emailaddress, body to timestamp + email subject, shortdetail text for unsubscribe link, and onclick to a function that'll check storage, grabs the unsub link if exists or else do nothing, opens a new tab for user to fill out, update labels to one that says "unsubbed timestamp", nullify the unsub link, and refresh that tab
					port.postMessage({ message: "updated_subscribers" });
				}
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

	/* https://stackoverflow.com/questions/18681803/loading-google-api-javascript-client-library-into-chrome-extension
  gapi-client script defines a window["gapi_onload"] as the callback function for after it finishes loading, so it must be defined before making the script request
  not sure why gapi.auth is called to authorizer a new token, when chrome.identity should've done so already. i believe we can go straight to gapi client load
  */
	window.gapi_onload = () => {
		gapi.client.load("gmail", "v1", () => {
			gapi_loaded = true;
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

/* here are some utility functions for making common gmail requests */
function getThreads(query, labels) {
	return gapi.client.gmail.users.threads.list({
		userId: "me",
		q: query, //optional query
		labelIds: labels, //optional labels
	}); //returns a promise
}

//takes in an array of threads from the getThreads response
function getThreadDetails(threads) {
	var batch = new gapi.client.newBatch();

	for (var ii = 0; ii < threads.length; ii++) {
		batch.add(
			gapi.client.gmail.users.threads.get({
				userId: "me",
				id: threads[ii].id,
			})
		);
	}

	return batch;
}

function getThreadHTML(threadDetails) {
	var body = threadDetails.result.messages[0].payload.parts[1].body.data;
	return B64.decode(body);
}

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
