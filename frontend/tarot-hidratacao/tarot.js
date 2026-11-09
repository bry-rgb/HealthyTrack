(function () {
  var data = window.TAROT_DATA;
  var idioma = window.WaterKraftPreferencias ? window.WaterKraftPreferencias.idioma : "pt";
  var textos = {
    pt: { kicker: "✦ ARCANOS DO PÂNTANO ✦", titulo: "Tarot da Hidratação", subtitulo: "Concentra-te na tua pergunta, baralha as cartas e vira-as uma a uma.", voltar: "← Voltar ao WaterKraft", tirar: "Baralhar e tirar 3 cartas", deNovo: "Baralhar de novo", passado: "Passado", presente: "Presente", futuro: "Futuro", final: "O guerreiro sapo bebe um gole de água e sorri: o teu caminho está traçado. ✦" },
    en: { kicker: "✦ SWAMP ARCANA ✦", titulo: "Hydration Tarot", subtitulo: "Focus on your question, shuffle the cards, and turn them over one by one.", voltar: "← Back to WaterKraft", tirar: "Shuffle and draw 3 cards", deNovo: "Shuffle again", passado: "Past", presente: "Present", futuro: "Future", final: "The frog warrior takes a sip of water and smiles: your path is laid out. ✦" },
    de: { kicker: "✦ SÜMPEL-ARKANA ✦", titulo: "Tarot der Flüssigkeit", subtitulo: "Konzentriere dich auf deine Frage, mische die Karten und decke sie nacheinander auf.", voltar: "← Zurück zu WaterKraft", tirar: "Mischen und 3 Karten ziehen", deNovo: "Erneut mischen", passado: "Vergangenheit", presente: "Gegenwart", futuro: "Zukunft", final: "Der Froschkrieger trinkt einen Schluck Wasser und lächelt: Dein Weg ist gezeichnet. ✦" },
    it: { kicker: "✦ ARCANI DELLA PALUDE ✦", titulo: "Tarocchi dell’idratazione", subtitulo: "Concentrati sulla tua domanda, mescola le carte e scoprile una alla volta.", voltar: "← Torna a WaterKraft", tirar: "Mescola e pesca 3 carte", deNovo: "Mescola di nuovo", passado: "Passato", presente: "Presente", futuro: "Futuro", final: "Il guerriero rana beve un sorso d'acqua e sorride: il tuo cammino è tracciato. ✦" },
    fr: { kicker: "✦ ARCANES DU MARAIS ✦", titulo: "Tarot de l’hydratation", subtitulo: "Concentre-toi sur ta question, mélange les cartes et retourne-les une à une.", voltar: "← Retour à WaterKraft", tirar: "Mélanger et tirer 3 cartes", deNovo: "Mélanger à nouveau", passado: "Passé", presente: "Présent", futuro: "Futur", final: "Le guerrier grenouille boit une gorgée d'eau et sourit : ton chemin est tracé. ✦" },
    es: { kicker: "✦ ARCANOS DEL PANTANO ✦", titulo: "Tarot de la hidratación", subtitulo: "Concéntrate en tu pregunta, baraja las cartas y descubre una a una.", voltar: "← Volver a WaterKraft", tirar: "Barajar y sacar 3 cartas", deNovo: "Barajar de nuevo", passado: "Pasado", presente: "Presente", futuro: "Futuro", final: "El guerrero rana bebe un sorbo de agua y sonríe: tu camino está trazado. ✦" }
  }[idioma] || { kicker: "✦ ARCANOS DO PÂNTANO ✦", titulo: "Tarot da Hidratação", subtitulo: "Concentra-te na tua pergunta, baralha as cartas e vira-as uma a uma.", voltar: "← Voltar ao WaterKraft", tirar: "Baralhar e tirar 3 cartas", deNovo: "Baralhar de novo", passado: "Passado", presente: "Presente", futuro: "Futuro", final: "O guerreiro sapo bebe um gole de água e sorri: o teu caminho está traçado. ✦" };
  var POS = [textos.passado, textos.presente, textos.futuro];
  var spread = document.getElementById("tarot-spread");
  var btn = document.getElementById("tarot-shuffle");
  var final = document.getElementById("tarot-final");

  document.documentElement.lang = window.WaterKraftPreferencias ? window.WaterKraftPreferencias.locale : "pt-PT";
  document.title = textos.titulo + " | WaterKraft";
  document.getElementById("tarot-kicker").textContent = textos.kicker;
  document.getElementById("tarot-title").textContent = textos.titulo;
  document.getElementById("tarot-sub").textContent = textos.subtitulo;
  document.getElementById("tarot-back").textContent = textos.voltar;
  btnText();
  function btnText() { btn.textContent = textos.tirar; final.textContent = textos.final; }

  function draw(n) {
    var pool = data.deck.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, n).map(function (c) { return { card: c, reversed: Math.random() < 0.3 }; });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  btn.addEventListener("click", function () {
    btn.textContent = textos.deNovo;
    final.hidden = true;
    spread.innerHTML = "";
    var opened = 0;
    draw(3).forEach(function (d, i) {
      var slot = el("div", "tarot-slot");
      slot.style.animationDelay = i * 120 + "ms";
      slot.appendChild(el("p", "tarot-pos", POS[i].toUpperCase()));
      var card = el("button", "tarot-card");
      card.setAttribute("aria-label", "Virar carta do " + POS[i]);
      var inner = el("div", "tarot-inner");
      var back = el("div", "tarot-face");
      var bi = el("img"); bi.src = data.back; bi.alt = ""; back.appendChild(bi);
      var front = el("div", "tarot-face tarot-front" + (d.reversed ? " reversed" : ""));
      var fi = el("img"); fi.src = d.card.image; fi.alt = d.card.name; front.appendChild(fi);
      if (d.card.overlay) front.appendChild(el("span", "tarot-rank", d.card.overlay));
      inner.appendChild(back); inner.appendChild(front); card.appendChild(inner);
      slot.appendChild(card);
      card.addEventListener("click", function () {
        if (inner.classList.contains("flipped")) return;
        inner.classList.add("flipped");
        card.setAttribute("aria-label", d.card.name);
        var info = el("div", "tarot-info");
        var h = el("h2", null, d.card.name + " ");
        if (d.reversed) h.appendChild(el("small", null, "(invertida)"));
        info.appendChild(h);
        info.appendChild(el("p", null, d.reversed ? d.card.reversed : d.card.upright));
        slot.appendChild(info);
        if (++opened === 3) final.hidden = false;
      });
      spread.appendChild(slot);
    });
  });
})();
