import "@inboxsdk/core/background.js";
import EmailService from "./services/EmailService";
import * as c from "./constants";
import logger from "./services/LoggerService";

// for dom-parsing
chrome.offscreen.createDocument({
  url: chrome.runtime.getURL("dom-parser.html"),
  reasons: [chrome.offscreen.Reason.DOM_PARSER],
  justification: "needing to parse the html of an email message bodies"
});

// handle communication between content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.shared.log({
    data: { message, sender },
    message: "received message",
    type: "info"
  });
  (async () => {
    let tab;
    try {
      const queriedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      tab = queriedTabs[0];
      switch (message.message) {
        case c.SYNC: {
          const { last_synced } = await chrome.storage.local.get([c.LAST_SYNCED]);
          logger.shared.log({
            message: "Sync in progress. Last synced at: " + last_synced,
            type: "info"
          });

          const start = new Date().getTime();

          await EmailService.shared.syncAllThreads((threadCount) => {
            chrome.tabs.sendMessage(tab.id, { message: c.UPDATE_PROGRESS, data: `Synced ${threadCount} threads...` });
          });
          chrome.tabs.sendMessage(tab.id, { message: c.UPDATED_SUBSCRIBERS });

          let elapsed = new Date().getTime() - start;
          var mins = elapsed / 60000;
          logger.shared.log({
            message: mins.toFixed(3) + " min, " + (elapsed / 1000 - mins * 60).toFixed(3) + " sec to sync all threads",
          });
          break;
        }
        case c.RESET: {
          // mostly for testing, if you need to clear out subscriber list
          await chrome.storage.local.clear();
          chrome.tabs.sendMessage(tab.id, { message: c.UPDATED_SUBSCRIBERS });
          break;
        }
        case c.TRASH_SENDER_THREADS: {
          let start = new Date().getTime();

          await EmailService.shared.trashAllSenderThreads(message.data, (threadCount, total) => {
            chrome.tabs.sendMessage(tab.id, { message: c.UPDATE_PROGRESS, data: `Moved ${threadCount}/${total} threads to Trash...` });
          });
          chrome.tabs.sendMessage(tab.id, { message: c.TRASH_SENDER_THREADS });

          let elapsed = new Date().getTime() - start;
          let mins = elapsed / 60000;
          logger.shared.log({
            message: mins.toFixed(3) + " min, " + (elapsed / 1000 - mins * 60).toFixed(3) + " sec to trash all threads",
          });
          break;
        }
        default:
          logger.shared.log({
            data: message.message,
            message: "message not handled",
            type: "info"
          });
      }
      sendResponse();
    } catch (e) {
      logger.shared.log({
        data: e,
        message: "error runtime.onMessage.listener",
        type: "error"
      });
      chrome.tabs.sendMessage(tab.id, { message: c.ERROR });
    }
  })();
  return true;
});
