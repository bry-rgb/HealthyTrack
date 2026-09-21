let agua = 0;
let metaAgua = 2.5;
let falta = metaAgua - agua;
let mensagemMeta = document.getElementById("mensagemMeta");
let mensagemFalta = document.getElementById("mensagemFalta");

if (agua >= metaAgua) {
    mensagemMeta.textContent = "Meta Atingida 🎉";
} else {
    mensagemFalta.textContent = `Ainda faltam ${falta} L`;
}

let registrosAgua = JSON.parse(localStorage.getItem("registrosAgua")) || [];
let total = 0;
for (let i = 0; i < registrosAgua.length; i++) {
total += registrosAgua[i].quantidade;
}
agua = total;

console.log(total);

let quantidadeAgua = document.getElementById("agua");
quantidadeAgua.textContent = `${agua} L`;

let botao = document.getElementById("botaoAgua");
let textoAgua = document.getElementById("agua");
let listaAgua = document.getElementById("listaAgua");

function adicionarAgua(quantidade) {
    agua = agua + quantidade;
    falta = metaAgua - agua;

    if (agua >= metaAgua) {
    mensagemMeta.textContent = "Meta Atingida 🎉";
    mensagemFalta.textContent = " ";
}
        else{
    mensagemFalta.textContent = `Quase lá! Faltam: ${falta} L`;
}

    let registro = {
        quantidade: quantidade,
        horario: new Date()
    };
    registrosAgua.push(registro);
    localStorage.setItem("registrosAgua", JSON.stringify(registrosAgua));
    textoAgua.textContent = agua + " L";
    mostrarHistorico();
    console.log(registrosAgua);
    
    for (let i = 0; i < registrosAgua.length; i++) {
    console.log(registrosAgua[i].quantidade);
}
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

