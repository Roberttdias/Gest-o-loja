# REA — NexAdmin enviado como referência

## Resultado

O REA 6.4.0 foi usado pela CLI local, sem alterar configurações do agente. Foi possível inspecionar cabeçalhos e seções do executável com o adaptador GNU objdump. Não foi possível recuperar a lógica comercial, reconstruir telas ou confirmar comportamento do programa em execução. A versão da Skinão é uma implementação própria baseada nas necessidades da empresa e nos fluxos publicamente documentados, não uma recuperação do código do Nex.

## Arquivos e integridade

O primeiro anexo, `NexAdmin.zip`, é o último volume de um ZIP dividido: o registro final indica disco 1, e a entrada `NexAdmin.exe` começa no disco 0. A parte `NexAdmin.z01`, enviada depois, completou o conjunto.

Os dois volumes foram concatenados em uma cópia de trabalho. Apenas nessa cópia foram ajustados os números de disco e o offset do diretório central para leitura como ZIP único. Os anexos originais foram preservados. A extração passou na verificação CRC do ZIP e produziu um executável PE com **50.295.048 bytes**.

SHA-256 do executável:

```text
17bf16a06a1091d379af09c5788671af9339c35dba2c5a1c77c81a8f214c6c33
```

Os hashes dos volumes e o método de reconstituição estão em `reassembly.json`. O executável do Nex e seus volumes não são redistribuídos neste pacote.

## Evidências REA observadas

Comandos executados sobre o arquivo reconstituído:

```sh
node /workspace/rea/scripts/rea.mjs inspect-with-objdump /workspace/work/skinao/NexAdmin.exe file_headers --json
node /workspace/rea/scripts/rea.mjs inspect-with-objdump /workspace/work/skinao/NexAdmin.exe section_headers --json
```

| Pergunta | Resultado | Evidência |
| --- | --- | --- |
| Qual o formato reconhecido pelo provedor? | `pei-i386`, arquitetura `i386` | `ev_668b0b307c288d36e569838850cf183636223549c96e1879fbbc03c585ce54c7` |
| Qual endereço inicial foi reportado? | `0x0794e000` | Mesma evidência de cabeçalhos |
| Quais seções foram reportadas? | 8 seções; uma nomeada `.rsrc`; várias sem nome | `ev_bf3f16ae3babfb50edc7cbf00adfd17a18a65beb23764188b6d0f1667b581403` |
| O arquivo mudou durante as chamadas? | Hash anterior e posterior iguais; `artifact_changed=false` | Ambas as evidências |
| Houve truncamento do resultado? | `output_truncated=false`; saída e término completos | Ambas as evidências |

Os JSONs `nex-headers-rea.json` e `nex-sections-rea.json` preservam os resultados completos. O campo genérico `subject.format` do envelope permanece `unknown`; a identificação `pei-i386` acima vem da saída bruta do GNU objdump preservada pelo REA. Não foi feita uma sonda independente da versão do objdump, que permanece desconhecida no envelope.

## Limitações observadas

- `inspect-pe-resources` rejeitou um intervalo de recurso que não estava inteiramente apoiado por bytes de uma única seção: `Resource range is not entirely file-backed in one section.` Não há inventário de recursos bem-sucedido a partir dessa chamada. Isso não demonstra que o aplicativo inteiro esteja corrompido.
- `inspect NexAdmin.exe` retornou `provider_unavailable`: Ghidra, Hopper e IDA não estavam configurados. Nenhum deles foi instalado nem houve descompilação.
- O programa Windows não foi executado neste ambiente Linux. Não houve login no Nex, acesso ao banco de uma loja nem observação de vendas reais.
- A tentativa inicial de obter a referência na web também falhou. Os anexos substituíram a necessidade de baixar o executável.
- Cabeçalhos e seções não demonstram algoritmos de preço, regras de estoque, sincronização ou telas. Não se infere equivalência funcional dessas evidências.

## Referência funcional e decisões próprias

A documentação pública do Nex descreve produtos, estoque, vendas, clientes, caixa e pedidos online: https://www.programanex.com.br/ajuda. Esses módulos orientaram o escopo; não são descobertas de engenharia reversa do binário.

As adaptações da Skinão — variações por time/tamanho/cor/qualidade, catálogo com retirada, reservas transacionais, preservação dos valores do pedido e painel de margem bruta — são decisões de implementação baseadas no relato do usuário. Foram verificadas na aplicação própria conforme `../VALIDACAO.md`.

## Estado da investigação

- Identidade e integridade do arquivo: respondidas.
- Cabeçalhos e seções: respondidos dentro do alcance do provedor.
- Recursos PE: tentativa sem sucesso; lacuna registrada.
- Lógica interna, telas e execução do Nex: não verificadas.
- Aplicação própria para a Skinão: implementada para avaliação local; não demonstra cobertura integral do Nex.

Para continuar a análise interna, será necessário um provedor nativo compatível configurado; para comparar telas e fluxos, um ambiente Windows com o Nex funcionando ou capturas fornecidas pelo usuário. Este relatório não depende de alterações em configuração, licença ou mecanismos de proteção do Nex.
