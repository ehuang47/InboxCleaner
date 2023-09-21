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

export function SubscriptionTable({ all_subs, storage_subs }) {
  const table = document.createElement("table");
  table.classList.add(["ic-table"]);
  table.addEventListener("click", (e) => {
    switch (e.target.getAttribute("name")) {
      case "address": {
        let searchForm;
        for (const form of document.forms) {
          if (form.role !== "search") continue;
          else {
            searchForm = form;
            break;
          }
        }
        for (const el of searchForm.elements) {
          if (el instanceof HTMLInputElement) {
            el.value = e.target.innerText;
          } else if (el.ariaLabel === "Search mail") {
            el.click();
          }
        }
      }
      case "move-trash": {
        break;
      }
      default:
    }
  });
  table.innerHTML = `<thead>
          <tr>
            <th>Sender</th>
            <th>Address</th>
            <th colspan="2">Email Actions</th>
          </tr>
        </thead>
        <tbody>
          ${all_subs.map(sub => `<tr>
            <td>${sub.title}</td>
            <td class="subscription-action" name="address">${sub.body}</td>
            <td><a href=${storage_subs[sub.body][1]}>Unsubscribe</a></td>
            <td class="subscription-action" name="move-trash">Move to trash</td>
          </tr>`).join("")}
        </tbody>`;
  return table;
}

export function MyButton({ id, innerText, onClick }) {
  const button = document.createElement("button",);
  button.innerText = innerText;
  button.id = id;
  button.addEventListener("click", onClick);
  return button;
}
