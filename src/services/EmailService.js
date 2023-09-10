import * as c from "../constants";

// https://exceptionshub.com/gmail-api-parse-message-content-base64-decoding-with-javascript.html
// https://stackoverflow.com/questions/24811008/gmail-api-decoding-messages-in-javascript
// recursion to traverse the messageparts and acquire the decoded text/html
function parseMessagePart(part) {
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

// after parsing text html into a DOM element, use query selectors to extract the unsub link
function getUnsubLink(html) {
  var node_list = html.querySelectorAll("a");
  for (let i = 0; i < node_list.length; i++) {
    let node = node_list[i];
    // console.log(node.outerHTML, "\n", node.outerText);
    if (node.outerText != undefined && node.outerText.match(/unsubscribe/i)) {
      // console.log(node.outerText);
      return node.href;
    }
    // sometimes, the href acts as onClick to activate native function
    // console.log(node_list[i]);
  }
  // never found the unsub link
  return null;
}

// some email headers contain an unsub link
function getHeaderUnsubLink(headers) {
  for (var i in headers) {
    let header = headers[i];
    if (header.name === "List-Unsubscribe") {
      console.log(header.value);
      // some headers are strange in that its a pair <unsub link, mail link> or it lacks the url so its just <mail-link>
      let http_or_mail = header.value.split(",")[0].slice(1, -1);
      return http_or_mail.match(/^https?:\/\/[^t][^r][^k]/) ? http_or_mail : null;
    }
  }
  return null;
}

// look in email headers to find the sender name and email
function getSender(headers) {
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

// grab every thread, extract its messages' contents, and store in the subscription dictionary
async function extractThreadData(storage, threads) {
  const promises = threads.map((thread) => {
    return chrome.storage.local.get(c.ACCESS_TOKEN)
      .then(res => {
        const token = res[c.ACCESS_TOKEN];
        const queryParams = new URLSearchParams({
          [c.ACCESS_TOKEN]: token,
        });
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}`;
        return fetch(url + queryParams);
      })
      .then(data => data.json())
      .then(res => {
        console.log("Received thread" + thread.id + ":\n", res);
        let msg = res.result.messages[0];
        // message mimeType is either multiparty or text/html; we want to use decode the UTF8-encoded html
        if (msg.internalDate < storage.last_synced) {
          // an old email thread that we've already scanned, so set redundant_emails to true
          storage.redundant_emails = true;
          return;
        }
        var payload = msg.payload;
        var href = getHeaderUnsubLink(payload.headers);
        if (href == null) {
          // when header doesn't display "unsubscribe" link, parse the html in the message that usually has it at the bottom
          var parsed_html = new DOMParser().parseFromString(
            parseMessagePart(payload),
            "text/html"
          );
          href = getUnsubLink(parsed_html);
        }

        if (href != null) {
          // only grab sender information when an unsub link is found
          var sender = getSender(payload.headers);
          // console.log(sender);
          // console.log("Unsubscribe at:", href);
          // console.log(parsed_html);
          let email = sender.email;
          // console.log(email, storage.all_subs[email]);
          if (storage.all_subs[email] == null) {
            // only record sender info if there is no existing entry
            storage.all_subs[email] = [sender.name, href, true];
          }
        }
      })
      .catch((e) => {
        console.log("Error: " + e);
      });
  });
  // returns promise that resolves only when all of the other callbacks of thread.get complete
  return Promise.all(promises);
}

// grab all gmail threads that haven't been scanned, single out the unique subscribed emails that aren't already stored, and update chrome.storage
export async function getThreads() {
  try {
    const storage = await chrome.storage.local
      .get([c.ALL_SUBS, c.LAST_SYNCED, c.REDUNDANT_EMAILS, c.START]);

    storage.all_subs = storage.all_subs ?? {},
      storage.last_synced = storage.last_synced ?? null,
      storage.redundant_emails = storage.redundant_emails ?? false,
      storage.start = storage.start ?? null;

    let maxThreads = 1500,
      thread_count = 0,
      pg_token = "",
      promises = [];
    const { [c.ACCESS_TOKEN]: token } = await chrome.storage.local.get(c.ACCESS_TOKEN);
    while (pg_token != null && thread_count < maxThreads && !storage.redundant_emails) {
      const queryParams = new URLSearchParams({
        [c.ACCESS_TOKEN]: token,
        pageToken: pg_token,
        maxResults: 500,
      });
      for (const p of queryParams) {
        console.log(p);
      }

      // var threadDetails = await gapi.client.gmail.users.threads.list({
      //   userId: "me",
      //   pageToken: pg_token,
      //   maxResults: 500,
      // }).catch(e => { console.warn("email service getting threads error", e); });
      const data = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads` + queryParams);
      const threadDetails = await data.json();
      console.log(threadDetails);
      var res = threadDetails.result;
      thread_count += res.threads.length;
      pg_token = res.nextPageToken;
      promises.push(extractThreadData(storage, res.threads));
    }
    // ! await to make sure we store the next page token in the thread list.
    // ! Promise.all to wait for extractThreadData promises to resolve after all thread.get callbacks complete, then store the subscriber list

    await Promise.all(promises);
    console.log(all_subs);
    chrome.storage.local.set({
      [c.ALL_SUBS]: storage.all_subs,
      last_synced: new Date().getTime()
    });
    let elapsed = new Date().getTime() - storage.start;
    var mins = elapsed / 60000;
    console.log(mins.toFixed(3) + " min, " + (elapsed / 1000 - mins * 60).toFixed(3) + " sec");
  } catch (e) {
    console.warn("error getThreads", e);
  }
}
