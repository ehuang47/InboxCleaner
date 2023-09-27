import * as c from "../constants";
import { MyButton } from "./common";

export default function SubscriptionTable({ storageSubs, render, onTrashThreads }) {
  const selectedSubs = new Set();

  const container = document.createElement("div");
  container.appendChild(MyButton({
    id: "delete-selected-btn",
    innerText: "Delete selected",
    classes: ["ic-btn", "ic-mb"],
    onClick: async () => {
      if (selectedSubs.size === 0) return;

      const storage = await chrome.storage.local.get([c.ALL_SUBS]);
      for (const sender of selectedSubs) {
        delete storage[c.ALL_SUBS][sender];
      }
      await chrome.storage.local.set(storage);
      render();
    }
  }));

  const table = document.createElement("table");
  table.classList.add(["ic-table"]);

  table.addEventListener("click", async (e) => {
    switch (e.target.getAttribute("name")) {
      case "address": { // populate search field and auto-search
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
        break;
      }
      case "move-trash": {
        const parentRow = e.target.closest("tr");
        const sender = parentRow.id;
        await onTrashThreads(sender);
        break;
      }
      case "delete-subscription": {
        const storage = await chrome.storage.local.get([c.ALL_SUBS]);
        const parentRow = e.target.closest("tr");
        const sender = parentRow.id;
        delete storage[c.ALL_SUBS][sender];
        await chrome.storage.local.set(storage);
        render();
        break;
      }
      case "subs-checkbox-all": {
        // undoes the default behavior if we clicked the checkbox itself
        if (e.target instanceof HTMLInputElement) {
          e.target.checked = !e.target.checked;
        }
        const checkboxes = table.querySelectorAll("input[type='checkbox']");
        const checkboxAll = checkboxes[0];
        checkboxes.forEach((box, i) => {
          if (i === 0) {
            box.checked = !box.checked;
            return;
          }
          // all other checkboxes should match
          box.checked = checkboxAll.checked;
          const parentRow = box.closest("tr");
          const sender = parentRow.id;
          if (checkboxAll.checked) {
            selectedSubs.add(sender);
          } else {
            selectedSubs.delete(sender);
          }
        });
        break;
      }
      case "subs-checkbox": {
        // undoes the default behavior if we clicked the checkbox itself
        if (e.target instanceof HTMLInputElement) {
          e.target.checked = !e.target.checked;
        }
        const parentRow = e.target.closest("tr");
        const checkbox = parentRow.querySelector("input[type='checkbox']");
        checkbox.checked = !checkbox.checked;
        const sender = parentRow.id;
        if (checkbox.checked) {
          selectedSubs.add(sender);
        } else {
          selectedSubs.delete(sender);
        }
        break;
      }
      default:
    }
  });
  const trashIcon = ({ name }) => `<svg name="${name}" xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 448 512"><!--! Font Awesome Free 6.4.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. --><path name="${name}" d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0H284.2c12.1 0 23.2 6.8 28.6 17.7L320 32h96c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 96 0 81.7 0 64S14.3 32 32 32h96l7.2-14.3zM32 128H416V448c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V128zm96 64c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16V432c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16z"/></svg>`;

  table.innerHTML = `<thead>
          <tr>
            <th class>
              <div class="ic-icon" name="subs-checkbox-all">
                <input type="checkbox" id="subs-checkbox-all" name="subs-checkbox-all"/>
                <label for="subs-checkbox-all" name="subs-checkbox-all"></label>
              </div>
            </th>
            <th>Sender</th>
            <th>Address</th>
            <th colspan="2">Email Actions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(storageSubs).map(([email, { name, unsubLink, threadIdList }]) => `<tr id=${email}>
            <td>
              <div class="ic-icon" name="subs-checkbox">
                <input type="checkbox" id="${email}-checkbox" name="subs-checkbox"/>
                <label for="${email}-checkbox" name="subs-checkbox"></label>
              </div>
            </td>
            <td>${name}</td>
            <td class="subscription-action" name="address">${email}</td>
            <td>${unsubLink ? `<a href=${unsubLink}>Unsubscribe</a>` : ""}</td>
            <td class="subscription-action" name="move-trash">Trash ${threadIdList.length} threads</td>
            <td>
              <div class="ic-icon" name="delete-subscription">
              ${trashIcon({ name: "delete-subscription" })}
              </div>
            </td>
          </tr>`).join("")}
        </tbody>`;

  container.appendChild(table);
  return container;
}
