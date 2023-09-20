export function Instructions() {
  const div = document.createElement("div");
  div.innerHTML = `<p>If you've recently unsubscribed from an email address and would like to delete all of their emails from your inbox, follow the steps below.</p>
  <ol>
  <li id="li-0">Copy and paste their email address into the search bar and hit enter.</li>
  <li id="li-1">Check the box to select all emails, then select the option to 'Select all conversations that match this search'.</li>
  <li id="li-2">With all emails selected, click the trash bin 'Delete' icon.</li>
  </ol>
  `;
  return div;
}

export function SubscriptionTable(all_subs, storage_subs) {
  const table = document.createElement("table");
  table.innerHTML = `<thead>
          <tr>
            <th>Company</th>
            <th>Subscribed?</th>
            <th>Email Address</th>
            <th>Click To Unsubscribe</th>
          </tr>
        </thead>
        <tbody>
          ${all_subs.map(sub =>
    `<tr>
              <td>${sub.title}</td>
              <td>${storage_subs[sub.body][2]}</td>
              <td>${sub.body}</td>
              <td><a href=${storage_subs[sub.body][1]}>Unsubscribe</a></td>
            </tr>`
  ).join("")
    }
        </tbody>`;
  return table;
}
