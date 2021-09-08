console.log("Highlight paragraphs immediately upon opening a webpage");

/*
chrome.runtime.sendMessage({greeting: "hello"}, function(response) {
  console.log(response.farewell);
});

InboxSDK.loadScript('https://cdn.jsdelivr.net/npm/vue@2.5.17/dist/vue.js')
InboxSDK.loadScript('https://cdnjs.cloudflare.com/ajax/libs/axios/0.18.0/axios.min.js')

*/



InboxSDK.load(2, 'sdk_gmanager_284293dc99').then(function(sdk){
  // the SDK has been loaded, now do something with it!
  sdk.Compose.registerComposeViewHandler(function (composeView) {
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
    });
  });
});



chrome.runtime.onMessage.addListener(gotMessage);

function gotMessage(msg, sender, response) {
  console.log(msg.txt);
  if (msg.txt === "hello!") {
    let pg = document.getElementsByTagName('p');
    for (element of pg) {
      element.style['background-color'] = '#9FE2BF';
    }
  }
}