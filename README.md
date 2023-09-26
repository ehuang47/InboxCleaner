<h1 align="center">
<sub>
<img src="images/cleaning.png" height="38" width="38">
</sub>
InboxCleaner
</h1>

> A v3 manifest-based Chrome extension that parses a user's Gmail mailbox and generates a list of email subscriptions with their associated hyperlinks. Its purpose is to enable people to better manage their cluttered inboxes, which are often overrun by company newsletters that they aren't interested in.

- [Demo](#demo)
- [Technologies](#technologies)
- [Features](#features)
- [Other](#other)
- [Attributions](#attributions)

## Demo

![After Syncing](./assets/demo.png)

## Technologies

- InboxSDK (v2.0.1)
- Gmail API (v1)

## Features

As of 9/26/2023, InboxCleaner supports the following features:

- `Sync Now`: click this button to start parsing your mailbox for all email subscriptions (restricted to most recent 2500 emails due to quota limits).
- `Reset`: click this button to empty the browser's cached email subscriptions.
- `Unsubscribe`: click this to navigate to the url where you can submit the unsubscription form.
- Click the sender email address to search and view all threads that they've sent.
- Use the checkboxes and/or the trash icon to remove individual subscriptions.
- `Trash X threads`: click this button to delete all threads from this sender.

## Other

View a list of the current [issues](https://github.com/ehuang47/InboxCleaner/issues) or the [project](https://github.com/users/ehuang47/projects/1/views/1?groupedBy%5BcolumnId%5D=56045934).
View more documentation on the [wiki](https://github.com/ehuang47/InboxCleaner/wiki).

## Attributions

| Asset | Source |
| -- | -- |
| [Subscription Icon](./images/subscribe.png) | [Danteee82](https://www.flaticon.com/free-icon/subscribe_7048370?term=subscription&page=1&position=7&origin=tag&related_id=7048370) |
| [InboxCleaner Icon](./images/cleaning.png) | [kerismaker](https://www.flaticon.com/free-icon/cleaning_6792371?term=inbox+cleaner&page=1&position=1&origin=search&related_id=6792371) |
