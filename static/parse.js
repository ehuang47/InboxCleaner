chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.message === "parse-dom") {
    const d = new DOMParser().parseFromString(message.data, 'text/html');

    // after parsing text html into a DOM element, use query selectors to extract the unsub link
    const node_list = d.querySelectorAll("a");
    for (let i = 0; i < node_list.length; i++) {
      const node = node_list[i];
      // console.log(node.outerHTML, "\n", node.outerText);
      if (node.outerText != undefined && node.outerText.match(/unsubscribe/i)) {
        // console.log(node.outerText);
        sendResponse({
          message: "parse-dom",
          unsubLink: node.href
        });
      }
      // sometimes, the href acts as onClick to activate native function
      // console.log(node_list[i]);
    }
    // never found the unsub link
    sendResponse({
      message: "parse-dom",
      unsubLink: null
    });
  }
});
