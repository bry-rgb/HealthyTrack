(function () {
    const CHAVE_IDIOMA = "waterkraft-idioma";
    const CHAVE_UNIDADE = "waterkraft-unidade-agua";
    const idiomas = ["pt", "en", "de", "it", "fr", "es"];
    const ler = (chave, padrao) => { try { return localStorage.getItem(chave) || padrao; } catch (_) { return padrao; } };
    const estado = {
        get idioma() { const valor = ler(CHAVE_IDIOMA, "pt"); return valor === "pt-PT" || valor === "pt-BR" ? "pt" : idiomas.includes(valor) ? valor : "pt"; },
        get locale() { return { pt: "pt-PT", en: "en-GB", de: "de-DE", it: "it-IT", fr: "fr-FR", es: "es-ES" }[this.idioma]; },
        get unidade() { return ler(CHAVE_UNIDADE, "L") === "mL" ? "mL" : "L"; },
        definirIdioma(valor) {
            const valido = idiomas.includes(valor) ? valor : "pt";
            try { localStorage.setItem(CHAVE_IDIOMA, valido); } catch (_) {}
            document.documentElement.lang = this.locale;
            window.dispatchEvent(new CustomEvent("preferencias-waterkraft-alteradas"));
        },
        definirUnidade(valor) {
            try { localStorage.setItem(CHAVE_UNIDADE, valor === "mL" ? "mL" : "L"); } catch (_) {}
            window.dispatchEvent(new CustomEvent("preferencias-waterkraft-alteradas"));
        },
        formatarVolume(litros, casas = 2) {
            if (this.unidade === "mL") return `${Math.round(Number(litros) * 1000).toLocaleString(this.locale)} mL`;
            return `${Number(Number(litros).toFixed(casas)).toLocaleString(this.locale)} L`;
        }
    };
    document.documentElement.lang = estado.locale;
    window.WaterKraftPreferencias = estado;
})();
