const formulario = document.getElementById("formAvaliacao");

formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const token = sessionStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const dadosAvaliacao = {
        faixa_etaria: formulario.faixaEtaria.value,
        peso: formulario.peso.value || null,
        atividade: formulario.atividade.value,
        exercicio_calor: formulario.exercicioCalor.value,
        limite_liquidos: formulario.limiteLiquidos.value,
        unidade: formulario.unidade.value
    };

    try {
        const resposta = await fetch("http://localhost:3000/api/avaliacao-inicial", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(dadosAvaliacao)
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(resultado.mensagem || "Não foi possível concluir a avaliação");
        }

        sessionStorage.setItem("avaliacaoInicialConcluida", "true");
        window.location.href = "index.html";
    } catch (erro) {
        console.error("Erro ao concluir avaliação:", erro);
        alert(erro.message);
    }
});