# Verificação da entrega — 14/10/2026

## Testes de acesso e transações

Comando: `python3 -m unittest discover -s tests -v`.

Resultado: **6 testes passaram**, usando servidor HTTP real em loopback e banco SQLite temporário.

- Login, saída, sessão, proteção CSRF, rejeição de origem externa, catálogo sem custos nem dados de autenticação e backup protegido.
- Venda com cliente, desconto, estoque, saldo em dinheiro e estorno sem duplicação.
- Pedido com preço calculado no servidor; reserva imediata; preservação do preço original; confirmação única; Pix separado do dinheiro físico.
- Dois pedidos simultâneos pela última unidade: apenas um aceito; cancelamento libera a reserva.
- Transações inválidas e itens repetidos não geram venda nem descontam estoque; SKU duplicado e ajuste negativo inválido são rejeitados.
- Sangria, suprimento, fechamento com diferença, restrição de estorno após fechamento, exportação CSV protegida contra fórmulas e cópia SQLite íntegra.

## Navegador

Chromium instalado no ambiente Linux, com Playwright e servidor local temporário. **13 verificações passaram**, sem erros de JavaScript ou de recursos no console ao fim da execução.

1. Login e painel no computador.
2. Abertura de caixa.
3. Cadastro de cliente.
4. Cadastro e busca de variação.
5. Venda com desconto e recibo.
6. Pedido público em contexto sem sessão administrativa.
7. Conversão do pedido em venda.
8. Conferência de baixa única e reposição do estoque.
9. Fechamento separando dinheiro e Pix.
10. Relatório reunindo vendas do balcão e do catálogo.
11. Configuração de WhatsApp.
12. Catálogo em largura de 390 px, sem transbordamento horizontal.
13. Gestão em largura de 390 px, sem transbordamento horizontal e com controles de configurações e saída acessíveis na navegação.

As imagens de prévia usam produtos e transações fictícios, identificados como demonstração. Os bancos temporários de teste não fazem parte do pacote.

Também passaram `node --check static/app.js` e a compilação sintática Python. Não foi necessário instalar dependências do aplicativo.

## Limites

Não foram verificados Windows, macOS, impressora física, leitor de código de barras, acesso por uma rede real de loja nem hospedagem pública. O iniciador Windows é fornecido, mas sua execução naquele sistema não foi testada. A impressão usa o diálogo padrão do navegador.

Não houve publicação: os helpers locais de preparação e publicação de Sites não estavam disponíveis neste ambiente, e a aplicação entregue usa servidor Python e SQLite, que exigem hospedagem própria ou adaptação de infraestrutura. Nenhum Site vazio foi registrado.

Não houve decompilação completa nem execução do Nex. Os resultados reais do REA e os limites da investigação constam no relatório separado. A validação da aplicação própria não demonstra equivalência com o comportamento interno do Nex.
