function senhaValida(senha) {
    return typeof senha === "string" && senha.length >= 8;
}

module.exports = { senhaValida };