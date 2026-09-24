let agua = 0;
let metaAgua = 2.5;
let metaSalva = Number(localStorage.getItem("metaAgua"));
    if (metaSalva) {
        metaAgua = metaSalva;
    }
let falta = metaAgua - agua;
let selecionarMeta = document.getElementById("meta");
selecionarMeta.value = metaAgua;

let botaoMeta = document.getElementById("salvarMeta");
    botaoMeta.addEventListener("click", function () {
        metaAgua = Number(selecionarMeta.value);
        localStorage.setItem("metaAgua", metaAgua);
});
let mensagemMeta = document.getElementById("mensagemMeta");
let mensagemFalta = document.getElementById("mensagemFalta");
let quantidadeAgua = document.getElementById("agua");
let registrosAgua = JSON.parse(localStorage.getItem("registrosAgua")) || [];
let total = 0;
for (let i = 0; i < registrosAgua.length; i++) {
    total += registrosAgua[i].quantidade;
}
agua = total;
atualizarTela();

let botao = document.getElementById("botaoAgua");
let textoAgua = document.getElementById("agua");
let listaAgua = document.getElementById("listaAgua");

function atualizarTela(){
    quantidadeAgua.textContent = `${agua} L`;
    falta = metaAgua - agua;
    
    if (agua >= metaAgua) {
        mensagemMeta.textContent = "Meta Atingida 🎉";
        mensagemFalta.textContent =" ";
    } 
        else {
        mensagemFalta.textContent = `Ainda faltam ${falta} L`;
    }

}

function adicionarAgua(quantidade) {
    agua = agua + quantidade;
    atualizarTela();

    let registro = {
        quantidade: quantidade,
        horario: new Date()
    };
    registrosAgua.push(registro);
    localStorage.setItem("registrosAgua", JSON.stringify(registrosAgua));
    textoAgua.textContent = agua + " L";
    mostrarHistorico();
}

botao.addEventListener("click", function() {
    adicionarAgua(0.5);
})

function mostrarHistorico() {
    listaAgua.innerHTML = "";
    for (let i = 0; i < registrosAgua.length; i++) {
        let registro = registrosAgua[i];
        let item = document.createElement("p");
        item.textContent = "💧 " + registro.quantidade + " L";
        listaAgua.appendChild(item);
    }
}
mostrarHistorico();

function limparHistorico() {
    let resposta = confirm ("Tem certeza que deseja limpar o histórico?")
    if (resposta) {
    localStorage.removeItem("registrosAgua");
    registrosAgua = [];
    agua = 0;
    quantidadeAgua.textContent = `${agua} L`;
    mostrarHistorico();
    }
}
fetch("http://localhost:3000/api/registros-agua")
    .then(function (resposta) {
        return resposta.json();
    })
    .then(function (dados) {
        for (let i = 0; i < dados.length; i++) {
            console.log(dados[i]);
            console.log(dados[i].quantidade);
            listaAgua.innerHTML += dados[i].quantidade + "L - " + dados[i].horario + "<br>";
        }
    })

fetch("http://localhost:3000/api/registros-agua", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        quantidade: 0.5,
        horario: "12:30"    
    })
})