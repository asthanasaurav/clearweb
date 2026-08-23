const $ = (id) => document.getElementById(id);
$('nav').addEventListener('submit', (e) => { e.preventDefault(); window.clearweb.navigate($('url').value); });
$('back').onclick = () => window.clearweb.back();
$('forward').onclick = () => window.clearweb.forward();
$('reload').onclick = () => window.clearweb.reload();
$('home').onclick = () => window.clearweb.home();
window.clearweb.onState((state) => {
  $('url').value = state.url || '';
  $('title').textContent = state.title || 'New Tab';
  $('back').style.opacity = state.canGoBack ? '1' : '.35';
  $('forward').style.opacity = state.canGoForward ? '1' : '.35';
});
