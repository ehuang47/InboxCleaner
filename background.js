console.log("Background script is running");

chrome.runtime.onInstalled.addListener(buttonClicked);

function buttonClicked(tab) {
  console.log("a button was clicked");
  console.log(tab);

  let msg = {txt: "hello!"}
  chrome.tabs.sendMessage(tab.id, msg);
}

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