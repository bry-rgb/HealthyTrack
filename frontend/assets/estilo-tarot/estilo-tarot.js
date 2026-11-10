/* Estilo Tarot — funções de desenho. Recebem os dados da API do HealthyTrack. */
(function (g) {
  var WD = ["S", "T", "Q", "Q", "S", "S", "D"]; // segunda a domingo
  var MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function lit(v, locale) { return Number(v).toLocaleString(locale || "pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " L"; }

  /** dias: resposta de GET /api/calendario-hidratacao?mes=AAAA-MM ; mes: "AAAA-MM" */
  function renderCalendario(root, mes, dias, opts) {
    opts = opts || {};
    var p = mes.split("-"), ano = +p[0], m = +p[1] - 1;
    var porData = {}; (dias || []).forEach(function (d) { porData[d.data.slice(0, 10)] = d; });
    var hoje = new Date(); var hojeStr = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0") + "-" + String(hoje.getDate()).padStart(2, "0");
    root.innerHTML = "";
    root.appendChild(h("div", "tt-orn", "☾ ✦ ☽"));
    root.appendChild(h("h2", "tt-title", "Calendário de hidratação"));
    var nav = h("div", "tt-month");
    var prev = h("button", null, "‹"), next = h("button", null, "›");
    prev.onclick = function () { opts.onMudarMes && opts.onMudarMes(-1); };
    next.onclick = function () { opts.onMudarMes && opts.onMudarMes(1); };
    var mesNome = new Date(ano, m, 1).toLocaleDateString(opts.locale || "pt-PT", { month: "long" });
    nav.appendChild(prev); nav.appendChild(h("span", null, mesNome + " " + ano)); nav.appendChild(next);
    root.appendChild(nav);
    var grid = h("div", "tt-grid");
    WD.forEach(function (w) { grid.appendChild(h("div", "tt-wd", w)); });
    var offset = (new Date(ano, m, 1).getDay() + 6) % 7;
    for (var i = 0; i < offset; i++) grid.appendChild(h("div", "tt-day tt-empty"));
    var nDias = new Date(ano, m + 1, 0).getDate();
    for (var d = 1; d <= nDias; d++) {
      var ds = ano + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      var info = porData[ds];
      var cell = h("div", "tt-day" + (ds === hojeStr ? " tt-today" : ""));
      cell.appendChild(h("span", "tt-n", d));
      if (info) {
        var total = +info.total_litros, meta = +info.meta_diaria || 1;
        if (total <= 0) cell.appendChild(h("i", "tt-moon"));
        else { var drop = h("i", "tt-drop"); drop.style.setProperty("--fill", Math.min(100, Math.round(total / meta * 100)) + "%"); cell.appendChild(drop); }
        cell.title = lit(total, opts.locale) + " de " + lit(meta, opts.locale);
      } else if (ds > hojeStr) cell.classList.add("tt-empty");
      grid.appendChild(cell);
    }
    root.appendChild(grid);
    root.appendChild(h("div", "tt-legend",
      '<span><i class="tt-drop"></i>Meta atingida</span><span><i class="tt-drop" style="--fill:50%"></i>Parcial</span><span><i class="tt-moon"></i>Não bebeu</span><span>✦ Hoje</span>'));
    var hojeInfo = porData[hojeStr];
    if (hojeInfo) {
      var pct = Math.min(100, (+hojeInfo.total_litros / (+hojeInfo.meta_diaria || 1)) * 100);
      var hero = h("div", "tt-hero");
      hero.innerHTML = '<img src="' + (opts.sapo || "img/sapo.png") + '" alt="Guerreiro sapo"><div class="tt-hero-copy"><h3>Dia ' + hoje.getDate() + " · " + lit(hojeInfo.total_litros, opts.locale) + " de " + lit(hojeInfo.meta_diaria, opts.locale) + '</h3><div class="tt-bar"><i style="width:' + pct + '%"></i></div></div>';
      root.appendChild(hero);
    }
  }

  var SELOS_PADRAO = [
    { dias: 3, romano: "III", nome: "A Gota", icone: "💧" },
    { dias: 7, romano: "VII", nome: "A Lagoa", icone: "🪷" },
    { dias: 14, romano: "XIV", nome: "A Temperança", icone: "🏆" },
    { dias: 21, romano: "XXI", nome: "O Rio", icone: "🏞️" },
    { dias: 30, romano: "XXX", nome: "A Lua Cheia", icone: "🌕" },
    { dias: 100, romano: "C", nome: "O Oceano", icone: "🌊" },
  ];

  /** perfil: resposta de GET /api/perfil ; selos opcional (lista própria) */
  function renderSelos(root, perfil, selos, opts) {
    opts = opts || {}; selos = selos || SELOS_PADRAO;
    root.innerHTML = "";
    var sun = h("div", "tt-sun", '<img src="' + (opts.sapo || "img/sapo.png") + '" alt="Guerreiro sapo">');
    root.appendChild(sun);
    var atual = Number(perfil.sequencia_atual) || 0;
    var recorde = Number(perfil.maior_sequencia) || 0;
    root.appendChild(h("div", "tt-streak", "<small>Sequência atual</small><b>" + atual + (atual === 1 ? " dia" : " dias") + "</b><small>Recorde: " + recorde + (recorde === 1 ? " dia" : " dias") + "</small>"));
    var grid = h("div", "tt-seals");
    var seloAtual = selos.reduce(function (indice, selo, i) { return perfil.sequencia_atual >= selo.dias ? i : indice; }, -1);
    selos.forEach(function (s, indice) {
      var ok = perfil.maior_sequencia >= s.dias; // o recorde mantém os selos conquistados
      var el = h("button", "tt-seal" + (ok ? "" : " tt-locked") + (indice === seloAtual ? " tt-current" : ""));
      el.type = "button";
      el.setAttribute("aria-label", ok ? s.nome + ", conquistado. Ver detalhes." : "Selo bloqueado. Ver dias necessários.");
      var conteudo = s.imagem ? '<img class="tt-ico-imagem" src="assets/selos/' + s.imagem + '" alt="">' : '<span class="tt-ico">' + s.icone + "</span>";
      el.innerHTML = '<span class="tt-medal"><span class="tt-roman">' + s.romano + "</span>" + conteudo + (ok ? "" : '<span class="tt-lock" aria-hidden="true">🔒</span>') + '</span><span class="tt-label">' + s.nome + '</span><span class="tt-days">' + s.dias + ' dias</span>';
      el.title = s.dias + " dias seguidos";
      el.addEventListener("click", function () { if (opts.onSeloClick) opts.onSeloClick(s, ok, el); });
      grid.appendChild(el);
    });
    root.appendChild(grid);
  }

  g.EstiloTarot = { renderCalendario: renderCalendario, renderSelos: renderSelos, SELOS_PADRAO: SELOS_PADRAO };
})(window);
