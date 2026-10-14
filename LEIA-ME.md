# Skinão do Esporte — versão inicial para avaliação

Aplicação própria para a loja da Feira Livre de Barreiras, Bahia. Inclui gestão interna e catálogo de produtos com envio de pedidos. Os dados ficam em SQLite no computador que executa o servidor. Não depende de serviços externos para registrar vendas.

Esta entrega é uma versão local funcional para avaliação. Não foi publicada na internet e não é uma cópia completa do Nex. A investigação do executável enviado com REA está documentada em `analise/RELATORIO-REA.md`.

## Como abrir no Windows

1. Tenha Python 3.11 ou superior instalado, obtido em https://www.python.org/downloads/. Não é necessário instalar bibliotecas com pip.
2. Extraia todo este ZIP para uma pasta gravável.
3. Para experimentar com produtos fictícios, abra `DEMONSTRACAO_WINDOWS.bat`. Para iniciar com a base vazia da loja, abra `INICIAR_WINDOWS.bat`.
4. O navegador abrirá em `http://127.0.0.1:8000/gestao`. Se não abrir automaticamente, copie esse endereço.
5. Usuário: **admin**. A senha aleatória do primeiro acesso é exibida na janela do servidor. Guarde-a. Ela só é exibida na criação de cada banco.
6. Deixe a janela do servidor aberta. Para encerrar, pressione Ctrl+C nela. Não execute demonstração e operação real ao mesmo tempo na mesma porta.

Se o Windows disser que Python não existe, instale-o e reabra o iniciador. Não há executável `.exe` próprio nesta entrega.

## Linux, macOS ou terminal

Dentro desta pasta:

```sh
python3 server.py --open-browser
```

Use `python` no Windows quando necessário. A gestão fica em `/gestao`; o catálogo para clientes fica em `/catalogo`.

Para testar sem misturar registros reais, use uma pasta extraída separadamente ou um banco separado:

```sh
SKINAO_DB=data/demonstracao.sqlite3 python3 server.py --demo --open-browser
```

`--demo` só inclui os produtos fictícios na criação de um banco novo. Nunca transforma uma base existente em demonstração nem apaga registros. Fotos reais não estão incluídas; o catálogo usa ilustrações de categoria.

## Fluxo de uso

1. **Configurações:** informe o WhatsApp e o endereço de retirada. O número usa 55 + DDD + telefone, sem pontuação.
2. **Produtos e estoque:** cadastre uma variação por SKU. Exemplo: camisa do mesmo time em M e G são dois cadastros. Informe preço, custo, estoque e mínimo. Time, tamanho, cor e qualidade ajudam a busca.
3. **Meu caixa:** abra com o fundo em dinheiro. Depois registre suprimentos e sangrias conforme a movimentação física da gaveta.
4. **Frente de caixa:** busque por nome, código, time ou tamanho, adicione produtos, selecione cliente e pagamento, revise o desconto e confirme o recebimento. O servidor calcula os preços e verifica estoque. O recibo pode ser impresso pelo navegador.
5. **Catálogo:** o cliente escolhe variações e informa nome e telefone. O pedido reserva imediatamente o estoque e aparece na gestão. O envio não cobra pagamento nem calcula entrega.
6. **Pedidos online:** combine pagamento e retirada. Confirme somente depois de receber. A confirmação gera venda sem descontar o estoque duas vezes. O preço e o custo do pedido são preservados, mesmo se o cadastro mudar. Cancelar um pedido pendente libera a reserva. Não há expiração automática: acompanhe os pendentes.
7. **Fechamento:** conte apenas o dinheiro da gaveta. Pix e cartões aparecem separados. O sistema grava o esperado, o contado e a diferença.

Estornos só são permitidos durante o mesmo caixa aberto da venda. Eles devolvem o estoque e retiram a venda do faturamento, mantendo o histórico. Uma devolução bancária precisa ser feita fora do aplicativo.

Os relatórios usam a data de Barreiras (America/Bahia). A margem bruta é faturamento líquido dos descontos menos custo dos produtos; não é lucro líquido e não inclui despesas, impostos, taxas ou frete. Os custos são preservados por venda. O ranking de produtos mostra valores antes do desconto geral.

## Backup e restauração

Na gestão, abra **Configurações → Baixar backup SQLite**. A cópia é consistente mesmo com o banco aberto. Vendas também podem ser exportadas como CSV em reais, com ponto e vírgula para facilitar a abertura no Excel.

O banco real padrão é `data/skinao.sqlite3`; o iniciador de demonstração usa `data/demonstracao.sqlite3`. Para restaurar:

1. Encerre o servidor e confirme que ninguém está usando o sistema.
2. Preserve uma cópia da pasta `data` atual.
3. Substitua o banco escolhido pelo arquivo de backup correspondente, mantendo o nome esperado. Se existirem os arquivos associados `-wal` e `-shm`, mova-os junto com o banco antigo para a cópia de segurança; não os misture com a cópia restaurada.
4. Inicie o sistema. A senha será a que estava válida na data do backup.

O backup contém informações de clientes e a senha protegida por hash. Trate-o como registro privado da empresa. Faça cópias regulares fora deste computador.

## Senha e configuração

Para escolher uma senha no primeiro início, configure `SKINAO_ADMIN_PASSWORD` com pelo menos 12 caracteres. O valor não altera uma senha que já existe. Para trocar ou recuperar a senha, pare o servidor e execute:

```sh
python3 server.py --reset-password
```

Digite e confirme a nova senha no terminal. Use o mesmo `SKINAO_DB` se estiver usando banco personalizado. As sessões terminam ao reiniciar o servidor ou após oito horas. O sistema possui um administrador; não há ainda contas de funcionários, permissões por cargo ou auditoria nominal.

Outras opções: `--port 8001` para outra porta; `SKINAO_DB` para o caminho do banco; `SKINAO_SECURE_COOKIE=1` para cookies Secure quando o endereço público estiver sob HTTPS.

## Acesso por clientes e publicação

O endereço `127.0.0.1` funciona somente no computador em que o servidor está rodando. Esta entrega não cria um endereço público. O servidor padrão de Python é adequado ao piloto local; a hospedagem de produção ainda precisa ser preparada.

Para testar em uma rede local confiável, pode-se executar `python3 server.py --host 0.0.0.0` e acessar pelo IP do computador. Isso exige configuração do firewall e mantém o computador ligado. Para publicar na internet, preparar servidor de produção, HTTPS com proxy reverso, backup externo e regras de acesso/rate limit adequadas. Não abra a porta diretamente no roteador para uso público. Os cookies Secure devem ser ativados somente quando HTTPS estiver configurado. Não há infraestrutura de hospedagem pronta neste pacote.

Não há emissão de NF-e/NFC-e, cobrança real de Pix/cartão, cálculo de frete, integração com marketplace, transferência de dados do Nex ou funcionamento offline no navegador. Pedidos podem ser enviados enquanto o servidor estiver acessível. O cadastro da loja começa vazio no modo normal: os produtos, preços e dados reais precisam ser fornecidos pela empresa.

## Verificação

Os testes de transações e acesso usam apenas a biblioteca padrão:

```sh
python3 -m unittest discover -s tests -v
```

Confira `VALIDACAO.md` para o que foi executado nesta entrega e os limites de verificação.
