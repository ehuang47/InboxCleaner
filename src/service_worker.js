import "@inboxsdk/core/background.js";
import EmailService from "./services/EmailService";
import * as c from "./constants";
import logger from "./services/LoggerService";
import { getStoredThreads } from "./services/EmailService/utils";

// when extension is installed, updated, or chrome is updated
chrome.runtime.onInstalled.addListener((details) => {
  // gets previous extension version, reason "oninstalled" activated, and maybe ID
  logger.shared.log({
    message: "Triggered onInstalled due to: " + details.reason,
    type: "info"
  });

  // setting rules for page actions & taking action when accessing a page that meets all criteria
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostContains: ".google.com", schemes: ["https"] },
          }),
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()],
      },
    ]);
  });
});

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

  handleMessages(message, sender, sendResponse);


  return true;
});

async function getUserSubs(message, sender, sendResponse) {
  if (message.message === c.GET_USER_SUBS) {
    const { emailAddress } = await EmailService.shared.getUserProfile();
    const storage = await getStoredThreads(emailAddress);

    logger.shared.log({
      data: { userEmail: emailAddress, storage },
      message: "get_user_subs",
      type: "info"
    });
    sendResponse({ userEmail: emailAddress, storage });
  }
}

async function handleMessages(message, sender, sendResponse) {
  let tab;
  try {
    const queriedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    tab = queriedTabs[0];
    switch (message.message) {
      case c.GET_USER_SUBS: {
        const { emailAddress } = await EmailService.shared.getUserProfile();
        const storage = await getStoredThreads(emailAddress);

        logger.shared.log({
          data: { userEmail: emailAddress, storage },
          message: "get_user_subs",
          type: "info"
        });
        sendResponse({ userEmail: emailAddress, storage });
        return true;
      }
      case c.SYNC: {
        await EmailService.shared.syncAllThreads({
          sendProgress: (threadCount) => {
            chrome.tabs.sendMessage(tab.id, { message: c.UPDATE_PROGRESS, data: `Synced ${threadCount} threads...` });
          }
        });
        chrome.tabs.sendMessage(tab.id, { message: c.UPDATED_SUBSCRIBERS });
        break;
      }
      case c.RESET: {
        await EmailService.shared.resetAccountSubscriptions();
        chrome.tabs.sendMessage(tab.id, { message: c.UPDATED_SUBSCRIBERS });
        break;
      }
      case c.TRASH_SENDER_THREADS: {
        await EmailService.shared.trashAllSenderThreads({
          sender: message.data,
          sendProgress: (threadCount, total) => {
            chrome.tabs.sendMessage(tab.id, { message: c.UPDATE_PROGRESS, data: `Moved ${threadCount}/${total} threads to Trash...` });
          }
        });
        chrome.tabs.sendMessage(tab.id, { message: c.TRASH_SENDER_THREADS });
        break;
      }
      default:
        logger.shared.log({
          data: message.message,
          message: "message not handled",
          type: "info"
        });
    }
    sendResponse({});
  } catch (e) {
    logger.shared.log({
      data: e,
      message: "error runtime.onMessage.listener",
      type: "error"
    });
    chrome.tabs.sendMessage(tab.id, { message: c.ERROR });
  }
}
