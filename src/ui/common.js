export function Instructions() {
  const div = document.createElement("div");
  div.innerHTML = `
  <details>
    <summary>How do I use this?</summary>
    <p>Press "Sync Now" to find all email subscriptions (checks the 2500 most recent emails since last synced). <br> If you want to scan everything, please reset and sync again.</p>
    <h4>What can this extension do?</h4>
    <ol>
    <li id="li-0">Click the sender address if you'd like to search and filter all their threads.</li>
    <li id="li-1">Click the "Unsubscribe" link to navigate to the webpage to process your unsubscription.</li>
    <li id="li-2">Click "Trash threads" to move all sender's threads to trash.</li>
    <li id="li-3">Click the trash icon to delete this subscription from the list. Alternatively, select multiple using the left-hand checkboxes and press "Delete selected"</li>
    </ol>
  </details>
  `;
  return div;
}

export function MyButton({ id, innerText, classes, onClick }) {
  const button = document.createElement("button",);
  button.innerText = innerText;
  button.id = id;
  button.addEventListener("click", onClick);
  button.classList.add(...classes);
  return button;
}
