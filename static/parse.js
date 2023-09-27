chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.message === "parse-dom") {
    const d = new DOMParser().parseFromString(message.data, 'text/html');

    // after parsing text html into a DOM element, use query selectors to extract the unsub link
    const anchors = d.querySelectorAll("a");
    let unsubLink;
    for (const anchor of anchors) {
      // console.log(anchor.outerHTML, anchor.innerText);
      if (anchor.innerText && /.*unsubscribe.*/i.test(anchor.innerText)) {
        console.log(anchor.innerText);
        unsubLink = anchor.href;
        break;
      }
    }

    sendResponse({
      message: "parse-dom",
      unsubLink
    });
  } else {
    sendResponse();
  }
});
