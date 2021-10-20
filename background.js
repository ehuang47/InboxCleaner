console.log("Background script is running");

// when extension is installed, updated, or chrome is updated
chrome.runtime.onInstalled.addListener((details) => {
  // gets previous extension version, reason "oninstalled" activated, and maybe ID
  console.log("Triggered onInstalled due to: " + details.reason);
});

// when active tab in the window changes
/*
chrome.tabs.onActivated.addListener((activeInfo) => {
  // gets tab and window ID
  let msg = { txt: "hello" };
  chrome.tabs.sendMessage(activeInfo.tabId, msg, (response) => {
    console.log("Printing response: \n", response);
  }); // only tabs.sendMessage can go to content scripts
});
*/

chrome.runtime.onConnect.addListener((port) => {
  console.log("connected to port: \n", port);
  if (port.name === "content") {
    port.postMessage({ text: "hello" });
    port.onMessage.addListener((msg, resPort) => {
      console.log("received msg: \n", msg);
    });
  }
});


/*
* surface level event listener
chrome.runtime.onStartup.addListener(function() {
  // run startup function
})

* storage API get/set 
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