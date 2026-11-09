# Planejador de treino e monitoramento de IMC

Pacote independente para integrar ao HealthyTrack. A decoração aprovada contém halteres, garrafa de água e toalha, sem o Guerreiro Sapo.

## Conteúdo
- `index.html`, `styles.css`, `app.js`: página funcional, sem dependências de terceiros.
- `domain.js`: planos de treino e fórmula de IMC.
- `assets/`: equipamentos, fontes locais e licenças.
- `previa.png`: prévia visual aprovada; o funcionamento real começa sem medidas fictícias.
- `tests/domain.test.mjs`: testes da fórmula, limites e filtros.

## Abrir e integrar
1. Copie a pasta para os arquivos públicos do seu projeto, por exemplo `/planejador/`.
2. Sirva os arquivos por HTTP/HTTPS; não abra por `file://`, porque os módulos JavaScript precisam de um servidor.
3. Adicione a opção **Planejador de treino e monitoramento de IMC** ao menu ou index existente, apontando para `/planejador/`.
4. Para manter o cabeçalho e a sessão do seu projeto, converta o conteúdo de `<main>` para a tecnologia do frontend existente e mantenha as importações e os IDs usados pelo JavaScript, ou use esta página separadamente.
5. Os estilos foram pensados para a página independente. Ao incorporar diretamente, restrinja os seletores globais (`body`, `button`, `input`, títulos etc.) ao contêiner `#planejador-treino`, para não afetar o restante do site. Não inclua a página inteira em outra página com um segundo `<html>` ou `<body>`.
6. Não altere o backend existente nem crie uma autenticação paralela.

Para testar localmente: execute `python3 -m http.server 8765` nesta pasta e visite `http://localhost:8765/`. Os testes da fórmula podem ser executados com `node --test tests/domain.test.mjs` (Node 20+).

## Funcionalidades
- Filtros por objetivo (perder/manter peso) e experiência.
- Três planos gerais com sessões A/B, exercícios, séries, repetições, tempo e descanso.
- Marcação dos exercícios realizados e reinício da sessão.
- IMC a partir de peso em kg e altura em cm; aceita vírgula decimal.
- Histórico e gráfico das medidas adicionadas **apenas na sessão atual**.
- Sem envio de dados, cookies, serviços externos ou armazenamento permanente.

## Conectar o histórico à conta existente
O pacote não possui banco de dados ou login próprios. A integração deve usar as funcionalidades já existentes do HealthyTrack. O histórico não persiste ao atualizar ou fechar a página.

`app.js` emite dois eventos no `window`:
- `healthytrack:bmi-calculated`: `detail = { weight, height, value, category }`.
- `healthytrack:measurement-recorded`: os mesmos campos, mais `recordedAt` em ISO.

O ChatGPT pode ouvir esses eventos e conectar a gravação ao endpoint autenticado real do projeto. Os endereços não são conhecidos e não foram inventados. Valide os dados também no servidor, associe o registro ao usuário autenticado (nunca aceite um ID arbitrário como autorização), proteja leituras e exclusões, trate falhas e mostre confirmação somente após sucesso. Para restaurar o histórico, adapte `renderHistory()` a registros recebidos da conta; a lista atual é em memória. Não publique peso/altura em logs e não coloque credenciais neste pacote. Recalcule o IMC no servidor se salvar esse campo.

## IMC e limites de uso
Fórmula: `peso / (alturaEmCentimetros / 100)²`.
Categorias gerais para adultos: abaixo de 18,5, baixo peso; de 18,5 a menos de 25, faixa adequada; de 25 a menos de 30, sobrepeso; 30 ou mais, obesidade. A categoria usa o valor completo, não o arredondado mostrado.

IMC é triagem, não diagnóstico, e não mede gordura ou massa muscular. Não use estas faixas para crianças ou gestantes. Atletas e pessoas idosas podem precisar de outra interpretação. Uma faixa de IMC não determina automaticamente um treino ou uma meta de peso.

## Treinos
Os planos são sugestões ilustrativas, não prescrições individuais nem garantia de emagrecimento. Frequências e durações são aproximadas. Alterne A/B nos dias do plano; para o plano de quatro dias, use A/B/A/B. Não há definição automática de cargas. Procure um profissional para adaptar técnica, volume, descanso, capacidade física e condições de saúde; pare se houver dor, tontura ou mal-estar. A perda e a manutenção de peso dependem de vários fatores além do exercício.

## Checklist de integração
- Conferir acesso pelo menu e caminhos de imagens/fontes.
- Testar computador e celular, filtros, sessões, conclusão e reinício.
- Testar 78 kg / 170 cm: IMC 27,0, faixa de sobrepeso.
- Conferir dados inválidos, vírgula decimal e valores próximos aos limites.
- Confirmar que pesos reais só persistem após integrar ao sistema da conta.
- Validar autorização e isolamento de dados de cada usuário se conectar o histórico.
- Revisar os treinos com um profissional antes de apresentá-los como orientação individual.
