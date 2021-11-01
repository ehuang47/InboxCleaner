// InboxSDK.loadScript('https://cdn.jsdelivr.net/npm/vue@2.5.17/dist/vue.js')
// InboxSDK.loadScript('https://cdnjs.cloudflare.com/ajax/libs/axios/0.18.0/axios.min.js')

/*
InboxSDK.load(2, 'sdk_gmanager_284293dc99').then(function(sdk){
  // the SDK has been loaded, now do something with it!
  sdk.Compose.registerComposeViewHandler(function (composeView) {
    console.log("compose view handler is set up.");
    // subscribe to events emitted by views so we can destroy them when the view is closed
    composeView.on('recipientsChanged', function(event) {
      console.log('Recipients have changed to: ' + event);
    });

    composeView.on('destroy', function(event) {
      console.log('compose view going away, time to clean up');
    });
    // a compose view has come into existence, do something with it!
    composeView.addButton({
      title: "My Nifty Button!",
      iconUrl: chrome.extension.getURL('images/icon.png'),
      onClick: function(event) {
        event.composeView.insertTextIntoBodyAtCursor('Hello World!');
        sdk.Widgets.showModalView({
          title: 'Vue Pipl Search',
          'el': `<div id="vue-pipl-search"></div>`,
        });
      },
    });google
  });
});
*/

// when user clicks on page alert
// document.addEventListener("click", () => alert("Click occurred!"));

// make it load what is stored
chrome.storage.local.get("colour", (response) => {
	if (response.colour) document.body.style.backgroundColor = response.colour;
});

// perhaps this will generate port array if multiple listeners
var port = chrome.runtime.connect({ name: "content" });

port.onMessage.addListener((msg, resPort) => {
	console.log(msg);
	if (msg.text === "hello") resPort.postMessage({ text: "hello, i am content" });
	if (msg.message === "clicked_browser_action") {
		var firstHref = $("a[href^='http']").eq(0).attr("href");
		console.log(firstHref);
		resPort.postMessage({ message: "open_new_tab", url: firstHref });
		// return true; only when u need to send response asynchronously (after an async function)
	}
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
	}
});

// port.disconnect();
