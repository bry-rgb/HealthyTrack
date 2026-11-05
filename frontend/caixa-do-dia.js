// CAIXA DO DIA — dica de saúde + frase de uma grande mulher
// Muda sozinha à meia-noite (pela data do aparelho). Não precisa de base de dados.
(function () {
  var CONTEUDOS = [
  {
    "dica": "Beba um copo de água logo ao acordar para reidratar o corpo.",
    "frase": "Nada na vida deve ser temido, apenas compreendido.",
    "autora": "Marie Curie",
    "papel": "Física e química, dupla Nobel"
  },
  {
    "dica": "Faça uma caminhada de 20 minutos depois do almoço.",
    "frase": "Eu aprendi ao longo dos anos que, quando se toma uma decisão, isso diminui o medo.",
    "autora": "Rosa Parks",
    "papel": "Ativista dos direitos civis"
  },
  {
    "dica": "Inclua pelo menos três cores diferentes de vegetais no prato.",
    "frase": "A forma mais eficaz de fazer algo é fazê-lo.",
    "autora": "Amelia Earhart",
    "papel": "Pioneira da aviação"
  },
  {
    "dica": "Desligue os ecrãs uma hora antes de dormir.",
    "frase": "Uma criança, um professor, um livro e uma caneta podem mudar o mundo.",
    "autora": "Malala Yousafzai",
    "papel": "Ativista, Nobel da Paz"
  },
  {
    "dica": "Faça cinco respirações profundas sempre que se sentir tenso.",
    "frase": "Nunca se arrependa de nada que a fez sorrir.",
    "autora": "Frida Kahlo",
    "papel": "Pintora"
  },
  {
    "dica": "Troque um snack açucarado por um punhado de frutos secos.",
    "frase": "Ninguém pode fazê-la sentir-se inferior sem o seu consentimento.",
    "autora": "Eleanor Roosevelt",
    "papel": "Diplomata e ativista"
  },
  {
    "dica": "Alongue-se durante cinco minutos a cada duas horas sentado.",
    "frase": "Eu atribuo o meu sucesso a isto: nunca dei nem aceitei desculpas.",
    "autora": "Florence Nightingale",
    "papel": "Fundadora da enfermagem moderna"
  },
  {
    "dica": "Durma entre 7 e 9 horas para recuperar corpo e mente.",
    "frase": "Se não gosta de algo, mude-o. Se não pode mudá-lo, mude a sua atitude.",
    "autora": "Maya Angelou",
    "papel": "Escritora e poetisa"
  },
  {
    "dica": "Prefira as escadas ao elevador sempre que possível.",
    "frase": "Lute pelas coisas que lhe importam, mas de forma que leve os outros consigo.",
    "autora": "Ruth Bader Ginsburg",
    "papel": "Juíza do Supremo Tribunal dos EUA"
  },
  {
    "dica": "Coma devagar: pouse os talheres entre cada garfada.",
    "frase": "Sou livre quando aprendo a pensar por mim.",
    "autora": "Simone de Beauvoir",
    "papel": "Filósofa e escritora"
  },
  {
    "dica": "Passe pelo menos 15 minutos ao ar livre e ao sol.",
    "frase": "Cada pessoa precisa de fazer a sua parte para mudar o mundo.",
    "autora": "Wangari Maathai",
    "papel": "Ambientalista, Nobel da Paz"
  },
  {
    "dica": "Mantenha uma garrafa de água sempre à vista.",
    "frase": "A imaginação é a faculdade da descoberta, preeminentemente.",
    "autora": "Ada Lovelace",
    "papel": "Primeira programadora da história"
  },
  {
    "dica": "Escreva três coisas pelas quais é grata antes de dormir.",
    "frase": "Era uma vez, e sempre será, a coragem de começar.",
    "autora": "Clarice Lispector",
    "papel": "Escritora"
  },
  {
    "dica": "Reduza o sal: tempere com ervas aromáticas e limão.",
    "frase": "Se eles não lhe derem um lugar à mesa, traga uma cadeira dobrável.",
    "autora": "Shirley Chisholm",
    "papel": "Primeira congressista negra dos EUA"
  },
  {
    "dica": "Faça uma pausa de 10 minutos sem telemóvel durante o dia.",
    "frase": "O que fazemos é menos que uma gota no oceano, mas sem ela o oceano seria menor.",
    "autora": "Madre Teresa de Calcutá",
    "papel": "Missionária, Nobel da Paz"
  },
  {
    "dica": "Comece o dia com uma peça de fruta inteira em vez de sumo.",
    "frase": "Não sou uma mulher de palavras, sou uma mulher de ações.",
    "autora": "Maria da Penha",
    "papel": "Ativista contra a violência doméstica"
  },
  {
    "dica": "Faça 10 agachamentos enquanto espera o café.",
    "frase": "Sempre que uma mulher se defende, defende todas as mulheres.",
    "autora": "Maya Angelou",
    "papel": "Escritora e poetisa"
  },
  {
    "dica": "Junte uma fonte de proteína a cada refeição principal.",
    "frase": "As únicas limitações são as que impomos a nós próprias.",
    "autora": "Katherine Johnson",
    "papel": "Matemática da NASA"
  },
  {
    "dica": "Lave bem as mãos antes de cada refeição.",
    "frase": "Não há barreira, fechadura ou ferrolho que possa impor à liberdade da minha mente.",
    "autora": "Virginia Woolf",
    "papel": "Escritora"
  },
  {
    "dica": "Beba chá de ervas em vez de um refrigerante.",
    "frase": "As esperanças e os sonhos das pessoas são o que move o mundo.",
    "autora": "Hedy Lamarr",
    "papel": "Atriz e inventora"
  },
  {
    "dica": "Use a postura certa: ombros relaxados e ecrã à altura dos olhos.",
    "frase": "Vamos esquecer a palavra impossível.",
    "autora": "Zilda Arns",
    "papel": "Médica e fundadora da Pastoral da Criança"
  },
  {
    "dica": "Planeie as refeições da semana para evitar escolhas apressadas.",
    "frase": "Sonhar é acordar-se para dentro.",
    "autora": "Cecília Meireles",
    "papel": "Poetisa"
  },
  {
    "dica": "Inclua leguminosas, como grão ou feijão, duas vezes por semana.",
    "frase": "Tudo no mundo começou com um sim.",
    "autora": "Clarice Lispector",
    "papel": "Escritora"
  },
  {
    "dica": "Dance a sua música preferida durante cinco minutos.",
    "frase": "Comecei a escrever porque não encontrava as histórias que queria ler.",
    "autora": "Toni Morrison",
    "papel": "Escritora, Nobel da Literatura"
  },
  {
    "dica": "Proteja a pele com protetor solar, mesmo em dias nublados.",
    "frase": "Seja curiosa, não julgadora.",
    "autora": "Jane Goodall",
    "papel": "Primatóloga"
  },
  {
    "dica": "Coma peixe rico em ómega-3 pelo menos uma vez por semana.",
    "frase": "A ciência não tem sexo.",
    "autora": "Bertha Lutz",
    "papel": "Cientista e sufragista"
  },
  {
    "dica": "Reserve um momento do dia só para si, sem tarefas.",
    "frase": "A liberdade é uma luta constante.",
    "autora": "Angela Davis",
    "papel": "Filósofa e ativista"
  },
  {
    "dica": "Mastigue bem os alimentos para facilitar a digestão.",
    "frase": "Quem tem medo do lobo não vai ao bosque, e eu sempre fui ao bosque.",
    "autora": "Chiquinha Gonzaga",
    "papel": "Compositora e maestrina"
  },
  {
    "dica": "Marque os seus exames de rotina em dia.",
    "frase": "Eu sou o meu próprio refúgio.",
    "autora": "Carolina Maria de Jesus",
    "papel": "Escritora"
  },
  {
    "dica": "Troque o pão branco por pão integral.",
    "frase": "Ninguém nasce mulher: torna-se mulher.",
    "autora": "Simone de Beauvoir",
    "papel": "Filósofa e escritora"
  },
  {
    "dica": "Faça uma pausa para olhar ao longe a cada 20 minutos de ecrã.",
    "frase": "Nós realizamos aquilo em que acreditamos.",
    "autora": "Nísia Floresta",
    "papel": "Educadora e escritora"
  },
  {
    "dica": "Ligue a alguém de quem gosta: as relações também são saúde.",
    "frase": "O amor é o único caminho para a paz.",
    "autora": "Irena Sendler",
    "papel": "Salvou 2500 crianças na II Guerra"
  },
  {
    "dica": "Evite comer nas duas horas antes de deitar.",
    "frase": "Eu não tenho medo de tempestades, porque estou a aprender a navegar o meu barco.",
    "autora": "Louisa May Alcott",
    "papel": "Escritora"
  },
  {
    "dica": "Experimente uma receita nova com vegetais da época.",
    "frase": "A frase mais perigosa da língua é: sempre fizemos assim.",
    "autora": "Grace Hopper",
    "papel": "Pioneira da computação"
  },
  {
    "dica": "Faça uma sessão curta de meditação de cinco minutos.",
    "frase": "O amor-próprio é a raiz de tudo.",
    "autora": "Dandara dos Palmares",
    "papel": "Guerreira quilombola"
  },
  {
    "dica": "Evite bebidas alcoólicas durante a semana.",
    "frase": "Quanto mais tempo leva, mais significado tem.",
    "autora": "Carmen Miranda",
    "papel": "Cantora e atriz"
  },
  {
    "dica": "Arrume o quarto: um espaço calmo ajuda a dormir melhor.",
    "frase": "A esperança é a coisa com penas que pousa na alma.",
    "autora": "Emily Dickinson",
    "papel": "Poetisa"
  },
  {
    "dica": "Leve a sua própria marmita saudável para o trabalho.",
    "frase": "Coragem é a primeira das qualidades humanas.",
    "autora": "Anita Garibaldi",
    "papel": "Revolucionária"
  },
  {
    "dica": "Sorria e ria mais: o riso reduz o stress.",
    "frase": "Quero ser lembrada como alguém que deixou o mundo melhor.",
    "autora": "Princesa Diana",
    "papel": "Humanitária"
  },
  {
    "dica": "Termine o dia com um alongamento suave para relaxar.",
    "frase": "Viver é a coisa mais rara do mundo.",
    "autora": "Florbela Espanca",
    "papel": "Poetisa"
  }
];

  function indiceDeHoje() {
    var h = new Date();
    var dias = Math.floor(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()) / 86400000);
    return dias % CONTEUDOS.length;
  }

  function mostrar() {
    var c = CONTEUDOS[indiceDeHoje()];
    var el = function (id) { return document.getElementById(id); };
    if (!el("dicaDoDia")) return;
    el("dicaDoDia").textContent = c.dica;
    el("fraseDoDia").textContent = "“" + c.frase + "”";
    el("autoraDoDia").textContent = c.autora;
    el("papelDoDia").textContent = c.papel;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mostrar);
  else mostrar();
})();
