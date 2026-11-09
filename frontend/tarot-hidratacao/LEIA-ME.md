# Tarot da Hidratação integrado no WaterKraft

A funcionalidade é servida como página estática pelo Nginx do front-end em `/tarot-hidratacao/`. O atalho fica no cartão Livro do dia do dashboard. Não exige rota Express, autenticação nem chamadas ao backend.

O baralho visual e os significados foram atualizados a partir do pacote consolidado `tarot-hidratacao-completo.zip`: são 78 cartas únicas e um verso. `INVENTARIO.json` regista os ficheiros e respetivos hashes.

A página permite tirar três cartas (Passado, Presente e Futuro), virá-las individualmente e ler os significados na posição normal ou invertida. Os textos das cartas foram fornecidos em português; os controlos e títulos da experiência acompanham o idioma selecionado nas Configurações.

Os ficheiros `tarot-data.js`, `tarot.js`, `tarot.css` e `cartas/` compõem a funcionalidade. As imagens são carregadas por caminhos relativos à pasta `cartas/`.
