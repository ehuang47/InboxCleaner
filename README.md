# G-Manager
## Description

> G-Manager is a v2 manifest-based Chrome extension that parses a user's Gmail inbox and generates a list of email subscriptions with their associated hyperlinks. Its purpose is to enable people to better manage their cluttered inboxes, which are often overrun by company newsletters that they aren't interested in.

## Technologies

- InboxSDK (v2)
- Gmail API (v1)

## Features

As of 12/17/2021, G-Manager only supports the following:
- `Sync Now` is a button that will begin gathering the subscribed emails from your inbox.
- `Reset` is the clickable instructions that will empty the browser storage of all email data.
- `Unsubscribe` is the clickable text that navigates you to the url where you can submit the unsubscription form.

## Bugs & Issues

- Some emails can have invalid or expired unsubscription links and will still be accepted.
- Cannot auto-delete emails with current permissions for security reasons.
- Some companies or entities use automated service to generate hundreds of unique emails.

## To-Do

- Phase out InboxSDK by writing and inject custom HTML/CSS into Gmail to make v3 migration simpler.
  - Implement a way to select certain entries and delete them from the subcription list.
  - Catch all promises.
  - Relocate the unsubscribe button closer to the email.
  - Clicking the email auto searches for it in the inbox.
- Modularize .js functions into other files.
- Find a more secure way to load gapi-client than to send XMLHTTPRequest and eval() result.
- Implement popup notification that explains to users why we need permisisons to read their emails.
- Syncing will display a 'loading bar' that approximates % how close to completion based on query rate.
- Apply for Gmail to increase query rate quota?
