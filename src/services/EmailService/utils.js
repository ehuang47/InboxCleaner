import * as c from "../../constants";
// https://exceptionshub.com/gmail-api-parse-message-content-base64-decoding-with-javascript.html
// https://stackoverflow.com/questions/24811008/gmail-api-decoding-messages-in-javascript
// recursion to traverse the messageparts and acquire the decoded text/html
export function parseMessagePart(part) {
  // console.log(part.mimeType, "\n", part.body, "\n", part.parts);
  if (part == null || part.mimeType === "text/plain") return "";
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

// some email headers contain an unsub link
export function getHeaderUnsubLink(headers) {
  for (var i in headers) {
    let header = headers[i];
    if (header.name === "List-Unsubscribe") {
      // console.log(header.value);
      // some headers are strange in that its a pair <unsub link, mail link> or it lacks the url so its just <mail-link>
      let http_or_mail = header.value.split(",")[0].slice(1, -1);
      return http_or_mail.match(/^https?:\/\/[^t][^r][^k]/) ? http_or_mail : null;
    }
  }
  return null;
}

// look in email headers to find the sender name and email
export function getSender(headers) {
  // console.log("getSender", headers);
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

export async function getStoredThreads() {
  const storage = await chrome.storage.local.get([c.ALL_SUBS, c.LAST_SYNCED, c.START]);

  storage.all_subs = storage.all_subs ?? {};
  storage.last_synced = storage.last_synced ?? null;
  storage.start = storage.start ?? null;
  return storage;
}

export async function updateStoredThreads(storage) {
  console.log(storage.all_subs);
  chrome.storage.local.set({
    ...storage,
    [c.LAST_SYNCED]: new Date().getTime()
  });
  let elapsed = new Date().getTime() - storage.start;
  var mins = elapsed / 60000;
  console.log(mins.toFixed(3) + " min, " + (elapsed / 1000 - mins * 60).toFixed(3) + " sec");
}

export async function getUnsubLink(threadDataPayload) {
  // message mimeType is either multiparty or text/html
  let href = getHeaderUnsubLink(threadDataPayload.headers);
  if (!href) { // check thread's email body
    const { unsubLink } = await chrome.runtime.sendMessage({
      message: "parse-dom",
      data: threadDataPayload
    });
    href = unsubLink;
  }
  return href;
}
