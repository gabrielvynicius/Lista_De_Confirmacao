# Portal de casamento — Ana Claudia & Gabriel

O portal é estático e usa o SDK modular do Firebase via CDN. Pode ser servido pelo GitHub Pages, sem instalação de dependências ou etapa de build.

## Configurar a confirmação de presença

1. Revise o arquivo `firestore.rules` e compare-o com as regras vigentes, em especial se houver integrações externas ao portal. As regras desta fase foram preparadas no repositório e devem ser publicadas manualmente na aba **Regras** do Cloud Firestore.
2. Mantenha o login por e-mail e senha e os documentos de administradores ativos. O painel novo e as regras devem entrar em uso juntos. Depois de publicar as regras, use o painel desta fase para alterações de presença, inclusive enquanto a versão antiga ainda estiver no GitHub Pages. O painel antigo não grava o histórico exigido pelas novas regras.
3. No painel, abra **Configurações do casamento** e salve o prazo inicial **01/12/2026 às 23h59, horário de Brasília**. Se preferir inicializar pelo console, crie o documento `configuracoes/casamento` com os campos abaixo.

   | Campo | Tipo | Valor inicial |
   | --- | --- | --- |
   | `prazo` | Timestamp | `2026-12-02T02:59:00Z` |
   | `aberta` | Boolean | `true` |
   | `permitirAlteracoes` | Boolean | `true` |

   A confirmação pública fica bloqueada se o documento estiver indisponível. A cada envio, o Firestore compara seu relógio com o prazo. No instante do prazo o recebimento termina. Para reabrir após o vencimento, salve uma nova data futura e selecione **Abertas até o prazo**.

4. Na tabela de convidados ou de grupos familiares, use **Convite de…** e **Gerar link**. Compartilhe cada link em particular com as pessoas autorizadas. O link é a credencial do convite. Qualquer pessoa que o receba tem acesso às respostas das pessoas que ainda estão vinculadas a ele. Um novo link substitui o acesso das pessoas incluídas e preserva suas respostas. Remover alguém de um grupo revoga o acesso dessa pessoa pelo link familiar. Durante a homologação privada, os links apontam para a prévia. Gere os links a partir do domínio oficial quando for distribuí-los aos convidados. Gerar um link no mesmo projeto Firebase invalida os links anteriores para as pessoas incluídas, inclusive entre ambientes.
5. Faça a homologação com convidados de teste. Se estiver usando o projeto de produção, os cadastros e as respostas efetuados na prévia gravam dados reais.

O código contém 192 bits aleatórios, fica no fragmento do link e pode ser colado manualmente. Linhas do formulário são associadas ao ID de cada pessoa, inclusive quando dois convidados têm o mesmo nome. As regras bloqueiam listagens públicas, protegem os dados administrativos e exigem uma transação com histórico para alterações públicas. É possível enviar até quatro respostas por vez para respeitar os limites das consultas das regras do Firestore. Para famílias maiores, reabra o mesmo convite e responda pelos demais.

### Convidados adicionais

A inclusão depende de aprovação. A proposta é receber pedidos por contato privado com os noivos, revisar a disponibilidade e cadastrar a pessoa pelo painel antes de liberar acesso. A página só aceita pessoas já cadastradas e incluídas no convite.

### Compatibilidade e histórico

Os registros existentes continuam usando os códigos de faixa `crianca`, `adolescente` e `adulto`, exibidos respectivamente como até 7, de 8 a 17 e 18 anos ou mais. Revise a classificação antiga caso ela tenha sido preenchida com outros limites. O estado legado `pendente` é exibido como **Sem resposta**. Respostas anteriores sem datas preservam os status existentes. As datas são preenchidas quando houver uma gravação de resposta ou alteração auditada.

Cada evento em `convidados/{id}/historico/{evento}` grava a faixa, o status, a origem e o horário do servidor. As regras permitem acrescentar um evento coerente com a alteração, mas impedem que clientes editem ou apaguem eventos existentes. Os dados de convidados e os códigos não devem ser versionados.

O fluxo utiliza apenas Firestore e o login administrativo já existente, dentro dos limites de uso do plano Spark. Não requer Cloud Functions, servidor próprio ou uma conta Firebase para cada convidado.
