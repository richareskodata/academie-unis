// Choix du thème (clair, sombre ou système), appliqué avant l'affichage pour éviter un flash.
(function () {
  var KEY = "unis-theme";
  function get() { try { return localStorage.getItem(KEY) || "auto"; } catch (e) { return "auto"; } }
  function apply(t) {
    var r = document.documentElement;
    if (t === "light" || t === "dark") r.setAttribute("data-theme", t); else r.removeAttribute("data-theme");
  }
  apply(get());
  window.UNIS_THEME = { get: get, set: function (t) { try { localStorage.setItem(KEY, t); } catch (e) {} apply(t); } };
})();
