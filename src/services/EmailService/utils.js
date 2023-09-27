import * as c from "../../constants";
import logger from "../LoggerService";
// https://exceptionshub.com/gmail-api-parse-message-content-base64-decoding-with-javascript.html
// https://stackoverflow.com/questions/24811008/gmail-api-decoding-messages-in-javascript
// recursion to traverse the messageparts and acquire the decoded text/html
export function parseMessagePart(payload) {
  // logger.shared.log({
  //   message: payload.mimeType + "\n" + payload.body + "\n"+ payload.parts,
  //   type: "info"
  // });
  if (payload == null || payload.mimeType === "text/plain") return "";
  if (payload.mimeType === "text/html")
    return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));

  if (payload.parts != null) {
    for (const part of payload.parts) {
      var result = parseMessagePart(part);
      if (result != "") return result; // found text/html, so return decoded version
    }
  }
  return ""; // never found text/html
}

// some email headers contain an unsub link
export function getHeaderUnsubLink(headers) {
  // logger.shared.log({
  //   data: headers,
  //   message: "getHeaderUnsubLink",
  //   type: "info"
  // });
  for (const header of headers) {
    const { name, value } = header;
    if (/list-unsubscribe/i.test(name)) {
      /* edge cases for the value

      sometimes its just the unsub link, like:
      <https://click.e.usa.experian.com...>

      sometimes, it is just the mail link, so when you click the header unsubscribe, it makes a popup. the link looks like:
      <mailto:unsubscribe@questline.com...>

      or it can be a pair: <unsub-link, mailto-link>
      */
      let http_or_mail = value.split(",")[0].slice(1, -1);

      if (/^https?:\/\//.test(http_or_mail)) return http_or_mail;
    }
  }
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

export async function getStoredThreads(email) {
  const storage = await chrome.storage.local.get([email]);
  if (storage.hasOwnProperty(email)) {
    return storage[email];
  }

  return {
    [c.ALL_SUBS]: {},
    [c.LAST_SYNCED]: null,
    [c.IS_SYNCING]: false,
    [c.IS_TRASHING]: false,
  };
}

export async function getUnsubLink(threadDataPayload) {
  // message mimeType is either multiparty or text/html
  let href = getHeaderUnsubLink(threadDataPayload.headers);
  if (!href) { // check thread's email body
    const res = await chrome.runtime.sendMessage({
      message: "parse-dom",
      data: parseMessagePart(threadDataPayload)
    });
    // logger.shared.log({
    //   data: { threadDataPayload, res },
    //   message: "parsed dom for unsub link",
    //   type: res.unsubLink ? "success" : "error"
    // });
    href = res.unsubLink;
  }
  return href;
}
