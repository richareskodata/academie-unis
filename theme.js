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

// Protection contre l'inclusion du site dans une page tierce (iframe).
// La directive CSP frame-ancestors n'est pas appliquée lorsqu'elle est déclarée dans une balise <meta>,
// et GitHub Pages ne permet pas d'envoyer d'en-têtes HTTP : on masque donc la page si elle est encadrée.
(function () {
  if (window.top !== window.self) {
    document.documentElement.style.display = "none";
    try { window.top.location.replace(window.self.location.href); } catch (e) {}
  }
})();

// Si l'application n'a rien affiché au bout de 15 secondes (fichier bloqué, réseau coupé),
// on remplace « Chargement… » par un message utile.
setTimeout(function () {
  if (window.UNIS_READY) return;
  var app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = '<main class="solo" id="main"><div class="solo-card"><h1>Chargement impossible</h1>' +
    '<p class="lead">L\'académie met trop de temps à se charger. Vérifiez votre connexion à internet, puis rechargez la page.</p>' +
    '<button class="btn" type="button" id="unis-reload">Recharger la page</button></div></main>';
  var b = document.getElementById("unis-reload");
  if (b) b.addEventListener("click", function () { location.reload(); });
}, 15000);

// Polices chargées sans bloquer l'affichage : si Google Fonts est lent ou bloqué,
// la page s'affiche immédiatement avec les polices du système.
(function () {
  var l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap";
  document.head.appendChild(l);
})();
