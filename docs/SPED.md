# SPED — Plano (Fase 4, planejado)

> Status: **planejado / não implementado**. SPED real exige uma camada fiscal/contábil completa.
> Hoje a saída para o contador é a **Exportação Contábil** (CSV de lançamentos a débito/crédito).

## O que é
O SPED é um conjunto de obrigações em arquivos de texto posicionais, validados pelo PVA da Receita:
- **EFD ICMS/IPI** e **EFD-Contribuições** (fiscal)
- **ECD** (contábil — Livro Diário/Razão) e **ECF** (apuração do IRPJ/CSLL)

## Por que ainda não é viável aqui
Os blocos do SPED exigem dados que o MVP financeiro **não modela**: notas fiscais completas (itens,
CFOP, NCM, tributos), plano de contas oficial, partidas contábeis detalhadas, participantes etc.
Gerar SPED sem esses dados produziria arquivos inválidos.

## Caminho recomendado
1. Concluir a **camada fiscal** (emissão/captura de NF-e com itens e tributos — ver `FISCAL.md`).
2. Definir o **plano de contas** e o mapeamento categoria → conta contábil.
3. Modelar **partidas contábeis** completas (hoje a Exportação Contábil gera uma versão simplificada).
4. Implementar os **geradores de layout** por bloco (registros |0000|, |C100|, |I150| etc.) com validação.

## Ponte atual
A **Exportação Contábil** já entrega lançamentos D/C em CSV que o contador consegue importar no
software dele (ex.: Domínio/Contábil), cobrindo a necessidade imediata até o SPED nativo existir.
