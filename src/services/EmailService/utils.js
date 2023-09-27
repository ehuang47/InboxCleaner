import * as c from "../../constants";
import logger from "../LoggerService";
// https://exceptionshub.com/gmail-api-parse-message-content-base64-decoding-with-javascript.html
// https://stackoverflow.com/questions/24811008/gmail-api-decoding-messages-in-javascript
// recursion to traverse the messageparts and acquire the decoded text/html
export function parseMessagePart(part) {
  // logger.shared.log({
  //   message: part.mimeType + "\n" + part.body + "\n"+ part.parts,
  //   type: "info"
  // });
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
      // logger.shared.log({
      //   message: `header.value ${header.value}`,
      //   type: "info"
      // });
      // some headers are strange in that its a pair <unsub link, mail link> or it lacks the url so its just <mail-link>
      let http_or_mail = header.value.split(",")[0].slice(1, -1);
      return http_or_mail.match(/^https?:\/\/[^t][^r][^k]/) ? http_or_mail : null;
    }
  }
  return null;
}

// look in email headers to find the sender name and email
export function getSender(headers) {
  // logger.shared.log({
  //   data: headers,
  //   message: "getSender",
  //   type: "info"
  // });
  for (const header of headers) {
    const { name, value } = header;
    if (/from/i.test(name)) {
      const data = value.split(" <");
      // some headers solely have an email value, so splitting returns array of size 1
      // logger.shared.log({
      //   data: {name, value, data},
      //   message: "getSender from",
      //   type: "info"
      // });
      if (data.length === 1) {
        return { name: "", email: data[0].slice(1, -1) };
      } else {
        return { name: data[0], email: data[1].slice(0, -1) };
      }
    }
  }
  logger.shared.log({
    data: headers,
    message: "getSender failed",
    type: "error"
  });
  throw new Error("Issue finding thread sender");
}

export async function getStoredThreads() {
  const storage = await chrome.storage.local.get([c.ALL_SUBS, c.LAST_SYNCED, c.START]);

  storage[c.ALL_SUBS] = storage.all_subs ?? {};
  storage[c.LAST_SYNCED] = storage.last_synced ?? null;
  storage[c.START] = storage.start ?? null;
  return storage;
}

export async function updateStoredThreads(storage) {
  logger.shared.log({
    data: storage.all_subs,
    message: "updating storage with new subscriber list",
  });
  chrome.storage.local.set({
    ...storage,
    [c.LAST_SYNCED]: new Date().getTime()
  });
  let elapsed = new Date().getTime() - storage.start;
  var mins = elapsed / 60000;
  logger.shared.log({
    message: mins.toFixed(3) + " min, " + (elapsed / 1000 - mins * 60).toFixed(3) + " sec",
  });
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
