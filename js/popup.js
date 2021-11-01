// perhaps this will generate port array if multiple listeners
var port = chrome.runtime.connect({ name: "popup" });

port.onMessage.addListener((msg, resPort) => {
	if (msg.text === "hello") resPort.postMessage({ text: "hello, i am popup" });
});

document.querySelector("#colour-submit-btn").addEventListener("click", () => {
	// read the colour that the user has selected
	const colour = document.querySelector("#colour-input").value;

	// store what the user selected
	chrome.storage.local.set({ colour });
	// get all the google tabs and send a message to their tabs
	chrome.tabs.query({ url: "https://*.google.com/*" }, (tabs) => {
		tabs.forEach((tab) => chrome.tabs.sendMessage(tab.id, { colour }));
	});
});

document.querySelector("#open-browser-btn").addEventListener("click", () => {
	// tell the current tab to make a request to background script for duplicating itself
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		console.log(tabs);
		chrome.tabs.sendMessage(tabs[0].id, { text: "open_browser" });
	});
});
