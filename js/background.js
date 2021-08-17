console.log("Highlight breaks upon pressing the extension?");
let br = document.getElementsByTagName('br');
for (elmt of br) {
  elmt.style['background-color'] = '#DFFF00';
}