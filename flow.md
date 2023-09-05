# Modules

- [Modules](#modules)
  - [Content](#content)
    - [content.js](#contentjs)
  - [Background](#background)
    - [EmailService.js](#emailservicejs)
  - [Execution Flow](#execution-flow)

## Content

### content.js

| Method | Description |
| - | - |
| getFromLocal(key) | - An async function that returns something from `chrome.storage.local`. <br> - `key`, the key used to access an object in storage. |
| instructionHTML() | - Dynamically creates a paragraph explaining how to use G-Manager to delete unsubscribed emails. |
| loadInboxSDK() | - An async function that initializes SDK handlers and makes calls to inject components into the Gmail UI. |

## Background

### EmailService.js

| Method | Description |
| - | - |
| parseMessagePart(part) | - Returns the decoded html content of the email message or empty string "". <br> - `part`, the messagepart defined by the Gmail API. |
| getUnsubLink(html) | - Returns the href url of an HTML element with outerText containing '**unsubscribe**' (case-insensitive) or null. <br> - `html`, the DOM element form of the text html that was returned by `parseMessagePart(part)`. |
| getHeaderUnsubLink(headers) | - Returns the unsubscription url from an email header or null. <br> - `headers`, the list of headers in the email thread. |
| getSender(headers) | - Returns an object containing the **name** and **email** stored in the email header. <br> - `headers`, the list of headers in the email thread. |
| extractThreadData(threads) | - Parses email threads and decides whether their metadata should be stored in the subscription list. <br> - `threads`, the list of email threads that were received by requests to `threads.list()`. |
| getThreads() | - An async function that gathers the list of N threads at a time and extracts their data. |

## Execution Flow

- Background script executes upon G-Manager installation or update. It sets the rules for what webpages to activate on and initializes a listener for runtime.onConnect. We execute `chrome.identity.getAuthToken()`, which displays a pop-up window for signing into gmail to allow authorization and access to the user inboxes.
  - Retrieves an OAuth2 access token for making http requests to API functions, possible auto-removes invalid, cached tokens. We then load Google's JS client libraries.
- Here, we assign a callback function, **window.gapi_onload**, that will load the GAPI client only after an XMLHTTPRequest to get the GAPI client script executes. It's because the gapi-client script defines a window["gapi_onload"] as the callback function for after it finishes loading. After executing the client script and loading it, we `client.setToken()` to ensure that our GAPI requests are authorized.
- When the user navigates to their gmail inbox page, it launches the content script, which uses `runtime.connect()` to establish a long-lived communication port. This port is assigned a listener whose purpose is to refresh the window (usually after updating the storage, to update the UI). It then calls `loadInboxSDK()` to inject the base UI subscription section on the inbox page. There are two ways the user can prompt the content script to communicate with the background script, which are **Sync Now** (a button) and **Reset** (click on the instructions). Either action sends a port message to the background script.
- If the background script gets a **Reset** message, it clears the local storage and variables and responds through the port which makes the content script reload the page. This feature is only intended for testing and debugging.
- If it is a **Sync Now** message, the background script first checks the storage for a previous subscriptions list, **all_subs**, and **last_synced** time, in order to have the proper variable values. Then, it calls `getThreads()`, which begins the process of repeating calls to `threads.list()` and `extractThreadData()`. After every callback completes execution, **all_subs** and **last_synced** should be properly up-to-date. We then update the local storage and respond through the port to have the changes reflect in the UI.
