import logger from "../services/LoggerService";
export function formatAllSubs(storage_subs, all_subs) {
  if (storage_subs && Object.keys(storage_subs).length > 0) {
    const subs = storage_subs;
    for (const key in subs) {
      // key = email, subs = { [name, unsub link, isSubscribed bool], ... }
      // logger.shared.log({
      //   data: { key, sub: subs[key] },
      //   message: "transforming subs from",
      //   type: "info"
      // });
      all_subs.push({
        title: subs[key][0],
        body: key,
        shortDetailText: "Unsubscribe",
        isRead: true,
        labels: subs[key][2]
          ? [{ title: "Subscribed", foregroundColor: "white", backgroundColor: "gold" }]
          : [{ title: "Unsubscribed", foregroundColor: "white", backgroundColor: "pink" }],
      });
    }
    all_subs.sort((a, b) => a.body.toLowerCase().localeCompare(b.body.toLowerCase()));
    return true;
  }
  return false;
}

export function labelThreadRowViews(storage_subs) {
  // for each thread row that we see, attach a label to indicate if this is a subscribed email
  return (ThreadRowView) => {
    var contact = ThreadRowView.getContacts()[0];
    if (storage_subs && storage_subs.hasOwnProperty(contact.emailAddress)) {
      const [name, unsubUrl, isSubscribed] = storage_subs[contact.emailAddress];
      ThreadRowView.addLabel({
        title: isSubscribed ? "Subscribed" : "Unsubscribed",
        foregroundColor: "white",
        backgroundColor: isSubscribed ? "gold" : "pink",
      });
    }
  };
}
