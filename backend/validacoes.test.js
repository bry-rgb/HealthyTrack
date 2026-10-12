function senhaValida(senha) {
    return typeof senha === "string" && senha.length >= 8;
}

test("rejeita senhas com menos de 8 caracteres", function () {
    expect(senhaValida("abc123")).toBe(false);
});

test("aceita senhas com pelo menos 8 caracteres", function () {
    expect(senhaValida("Aventura123")).toBe(true);
});
test("rejeita valores que não são texto", function () {
    expect(senhaValida(12345678)).toBe(false);
});