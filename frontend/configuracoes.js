const alternarTema = document.getElementById("alternarTema");
const estadoTema = document.getElementById("estadoTema");

function atualizarControloTema() {
    const escuro = window.HealthyTrackTema.atual === "escuro";
    alternarTema.checked = escuro;
    estadoTema.textContent = escuro ? "Modo escuro ativado." : "Modo claro ativado.";
}

alternarTema.addEventListener("change", function () {
    const tema = alternarTema.checked ? "escuro" : "claro";
    window.HealthyTrackTema.definir(tema);
    estadoTema.textContent = tema === "escuro" ? "Modo escuro ativado." : "Modo claro ativado.";
});

window.addEventListener("storage", atualizarControloTema);
atualizarControloTema();


const seletorIdioma = document.getElementById("seletorIdioma");
const seletorUnidade = document.getElementById("seletorUnidade");
seletorIdioma.value = window.WaterKraftPreferencias.idioma;
seletorUnidade.value = window.WaterKraftPreferencias.unidade;
seletorIdioma.addEventListener("change", () => {
    window.WaterKraftPreferencias.definirIdioma(seletorIdioma.value);
    const mensagens = { pt: "Idioma guardado.", en: "Language saved.", de: "Sprache gespeichert.", it: "Lingua salvata.", fr: "Langue enregistrée.", es: "Idioma guardado." };
    document.getElementById("estadoTema").textContent = mensagens[seletorIdioma.value];
});
seletorUnidade.addEventListener("change", () => {
    window.WaterKraftPreferencias.definirUnidade(seletorUnidade.value);
    const mensagens = { pt: "Unidade guardada.", en: "Unit saved.", de: "Einheit gespeichert.", it: "Unità salvata.", fr: "Unité enregistrée.", es: "Unidad guardada." };
    document.getElementById("estadoTema").textContent = mensagens[window.WaterKraftPreferencias.idioma];
});
