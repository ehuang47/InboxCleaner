## 2021-09-07

- First setting up the Chrome extension. Unaware of manifest.json and the difference between
  background, content, and popup scripts. I was confused about why inboxsdk (v2) would not work with
  manifest v3, until reading the chrome documentation.

## 2021-10-20

- Beginning to learn about communication between content/popup/background script through single-time
  messaging and long-lived ports. Background scripts execute immediately when first unpacking or
  updating, content scripts load when accessing webpages, and popup scripts are based on clicking
  the browser button. Starting to get the hang of callback functions and content script limitations.
- Followed a basic chrome extension tutorial on popup scripts for opening a new tab equal to the
  current tab.

## 2021-11-01

- Understanding html files should load javascript files at the bottom so they have knowledge of the
  DOM elements. First experience with jQuery syntax $() and CSS syntax.
- After completing the tutorial, I began migrating back to v2 in order to play with inboxsdk and
  make sense of their documentation.

## 2021-12-01

- Created custom 'man' icon with Google logo color scheme, but icons wouldn't load in inboxsdk
  buttons.
- Managed to create the collapsible "subscriptions" UI and add labels to every thread row view.
  After understanding the general structure of their API, I realized inboxsdk lacked an efficient way
  to extract the email message contents from the front page inbox. I could only wait for the user to
  click on a thread before I could access messages.
- I decided to use gapi so that I could load all threads and parse their emails directly from the
  inbox page. I luckily found a code sample explaining how to load gapi client library in a chrome
  extension. It was redundant by using chrome.identity and gapi.authorize to obtain an oauth2 token.
  I condensed the code, resulting in chrome.identity > xmlhttprequest load client script > load client.
- Manifest required 'content_security_policy' to explicitly allow google api urls and unsafe-eval
  if I wanted to load the gapi client. I also needed to set oauth client id and scopes. I proceed
  with gmail.modify because it only lets me view and read, not delete (security???)

## 2021-12-02

- Set up gapi and my sync button using a flag to indicate the token is available. I planned out the
  order of events in TODO comments. I decided to stick with just the subscriptions section instead of
  other ideas for the extension.

## 2021-12-03

- Gapi requests had previously failed because I never set the token obtained by chrome.identity.
- Responses from gapi requests were of strange format, so it took trial and error of logging it to
  understand how to parse it correctly and obtain the objects documented in the gmail API.

## 2021-12-05

- Imported a B64 library because google responses encode/decode with base64_url.
- Had to read up on email parsing, mime types, etc. to figure out how to properly parse emails.
- Gapi's batch API had issues with deprecation and it using the global path origin
- I began naively parsing messages, their parts and payloads with a while loop.

## 2021-12-09

- Used recursion for parsing email messageparts, which condensed code and was more accurate.
- Switched to non-deprecated api requests (google requests using discovery services urls)
- Miserably failing to create a raw http batch request (the format was not well documented) and
  gave up. Requests were received but met with 400, probably due to incorrect format. Unsure of
  effects on performance by not batching.
- Removed B64 library because atob works just fine, if you manually replace -+ \_/

## 2021-12-12

- Successfully implemented functions that extract the sender, email address, and unsubscribe link
- Took a while to realize how asynchronous functions worked in this context, and how to wait for
  all the promises to resolve before entering the next loop to get a list of threads. Switched to an
  'async' 'await' model, where calls to thread.list must be synchronous, because the next while loop
  iteration depends on the nextPageToken.

## 2021-12-14

- Gathering the resolved promises of nested asynchronous function calls was conceptually the most difficult part to implement. I have an outer while loop that calls thread.list every iteration, and then it calls a function that acts as an inner loop for each thread and calls thread.get.
  - I had to promise.all every thread.get and return a promise that resolves only after promise.all completes.
  - The outer while loop must then promise.all for every one of those inner loop promise.alls.
  - Only after the outer loop promise.all resolves, is when I may check the unsubscription list.
- This outer promise.all must also be wrapped in a promise so that I can finally send a completion message that will tell the content script to refresh the browser.
- I used epochs as a stopping point, in case users sync multiple times, to avoid redundancy.
- I needed to synchronously use chrome.get in the content script to avoid it being called for every handler activation. Now I am able to properly display the unsubscription data.
- I had a bug where my reset wouldn't clear the last synced and sub list.
- Added some minor features for row labeling (subscribe vs unsubscribe) and page refreshing.

## 2021-12-15

- Created HTML elements from scratch to put as instructions in the collapsible section.
- I had issues with the row onclick function callback being unable to correctly navigate to the respective row's unsubscribe link. There was no event parameter, meaning I am unable to figure out which row the click corresponds to. This forced me to manually scan the document for the html injected by inbox and assign javascript onclick listeners to the text element.

## 2021-12-16

- I thought I was clever by checking email headers for the sender (to see if we've already scanned their email before) to filter out earlier and improve performance. It caused more errors and underreported how many subscriptions there were. Thankfully for github commit reversions, I got rid of that.
- I learned that I need to catch all my promises or the extension will crash, and I learned that not all header senders were uniform.

## 2021-12-21

- Removed test files (popup script and page, jquery script, css folder).
  - Removed related code in background and content script.
- Added a flow document to explain the self-defined functions and the chronological execution of code during user interaction.
- Adding table of contents for markdown pages, rearranging file locations.

## 2021-12-22

- Listed file hierarchy in flow.md
- Moved background.js to /js folder.
- Polishing README.md with html section to display logo.

## 2023-09-04

- Moving main scripts to root and modules to `/scripts`
- Updating to v3 manifest, changing `background.js` to `service_worker.js`
  - Getting rid of any global variables and scoping them within functions
  - Taking out any functions related to emails, thread parsing to `EmailService.js`
    - Had to update their parameters because they were impure and updated global variables
- Migrating from long-lived port connection to one-time messaging because service_workers should not add listeners in callbacks/promises.
- 