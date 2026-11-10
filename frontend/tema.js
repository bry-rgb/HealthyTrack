(function () {
    const chave = "healthytrack-tema";

    function lerTema() {
        try {
            return localStorage.getItem(chave) === "escuro" ? "escuro" : "claro";
        } catch (erro) {
            return "claro";
        }
    }

    function aplicarTema(tema) {
        const valido = tema === "escuro" ? "escuro" : "claro";
        document.documentElement.dataset.tema = valido;
        try {
            localStorage.setItem(chave, valido);
        } catch (erro) {
            // Mantém o tema ativo nesta página mesmo se o armazenamento estiver indisponível.
        }
    }

    document.documentElement.dataset.tema = lerTema();
    window.HealthyTrackTema = {
        get atual() { return lerTema(); },
        definir: aplicarTema
    };
    window.addEventListener("storage", function (evento) {
        if (evento.key === chave) {
            document.documentElement.dataset.tema = evento.newValue === "escuro" ? "escuro" : "claro";
        }
    });
})();
