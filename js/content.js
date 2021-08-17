console.log("Highlight paragraphs immediately upon opening a webpage");
let pg = document.getElementsByTagName('p');
for (element of pg) {
  element.style['background-color'] = '#FF00FF';
}