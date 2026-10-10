let token = sessionStorage.getItem("token");

if (!token) {
    window.location.href = "login.html";
}

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
    fetch("http://localhost:3000/api/registros-agua", {
        method: "POST",
       headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + sessionStorage.getItem("token")
},
        body: JSON.stringify(registro)
    })
     .then(function (resposta) {
        return resposta.json();
    })
   .then(function (dados) {
    return fetch("http://localhost:3000/api/registros-agua", {
        headers: {
            "Authorization": "Bearer " + sessionStorage.getItem("token")
        }
    });
})
    .then(function (resposta) {
        return resposta.json();
    })
    .then(function (dados) {
        mostrarHistorico(dados);
    });
    
}

botao.addEventListener("click", function() {
    adicionarAgua(0.5);
})

// mostrar histórico de registros de água
function mostrarHistorico(registros) {
    listaAgua.innerHTML = "";
    for (let i = 0; i < registros.length; i++) {
        let registro = registros[i];
        let item = document.createElement("p");
        let data = new Date(registro.horario);
        let hora = data.toLocaleTimeString("pt-PT",{
            hour: "2-digit",
            minute: "2-digit"
        });
        item.textContent = "💧 " + registro.quantidade + " L - " + hora;
        listaAgua.appendChild(item);
    }
}
fetch("http://localhost:3000/api/registros-agua", {
    headers: {
        "Authorization": "Bearer " + sessionStorage.getItem("token")
    }
})
    .then(function (resposta) {
        return resposta.json();
    })
    .then(function (dados) {
        let total = 0;
        for (let i = 0; i < dados.length; i++) {
            total += Number(dados[i].quantidade);
        }
        agua = total;
        atualizarTela();
        mostrarHistorico(dados);
    });

function limparHistorico() {
    let resposta = confirm ("Tem certeza que deseja limpar o histórico?")
    if (resposta) {
   fetch("http://localhost:3000/api/registros-agua", {
    method: "DELETE",
    headers: {
        "Authorization": "Bearer " + sessionStorage.getItem("token")
    }
})
        .then(function (resposta) {
            return resposta.json();
        })
        .then(function (dados) {
            agua = 0;
            atualizarTela();
            mostrarHistorico([]);
        });
    }
}

let botaoLogout = document.getElementById("botaoLogout");

botaoLogout.addEventListener("click", function () {
    sessionStorage.removeItem("token");
    window.location.href = "login.html";
});
