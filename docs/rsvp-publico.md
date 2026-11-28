# RSVP público — modelo e regras da Etapa 2

O contrato desta etapa prepara a confirmação por um link único. O formulário e a integração da lista ao painel ficam para as próximas etapas. O fluxo por convite, os convidados cadastrados manualmente, os grupos familiares, o histórico existente e a lista de presentes continuam usando suas estruturas atuais. Nenhum dado precisa ser migrado.

## Dados

| Caminho | Finalidade |
| --- | --- |
| `configuracoes/rsvpPublico` | Campo booleano `ativa`. Sem o documento ou com o campo em `false`, o Firestore recusa criações e alterações públicas. |
| `configuracoes/casamento` | Configuração existente com `aberta`, `prazo` (Timestamp) e `permitirAlteracoes`. |
| `rsvpEnvios/{uid}/rsvpPessoas/{slot}` | Uma pessoa do envio, identificada pelo UID do Firebase Authentication e pela posição estável de `1` a `12`. O documento pai do envio é implícito. |
| `rsvpEnvios/{uid}/rsvpPessoas/{slot}/historico/{eventoId}` | Eventos de criação, alteração e exclusão, legíveis apenas por administradores ativos. |

Uma resposta contém exatamente `nome`, `classificacao`, `status`, `versao`, `eventoId`, `criadoEm` e `atualizadoEm`. As classificações são `crianca`, `adolescente` e `adulto`. Os status públicos são `confirmado`, `ausente` e `indeciso`. A resposta pública não armazena telefone, observações internas ou dados de administração. A integração futura do painel pode associar informações privadas usando o mesmo par UID e posição, em documentos separados com acesso administrativo.

O cliente deve chamar `formatGuestName` de `js/names.js` antes de enviar. As regras verificam o formato com letras Unicode, acentos e separadores admitidos, comprimento de até 160 e rejeição de números, emojis e espaços excedentes. A conversão de caixa para todos os sistemas de escrita e a normalização NFC são feitas no cliente. As regras do Firestore validam o formato, mas não executam a mesma conversão Unicode. A chave da futura comparação de nomes será derivada para revisão administrativa. Ela não deve decidir o ID, o acesso ou a fusão de dois registros.

## Leitura e gravação

- Uma sessão autenticada com o provedor `anonymous` lê somente as respostas atuais do seu UID. A leitura continua disponível após o prazo, mesmo com alterações fechadas. O histórico e a consulta global reservada `collectionGroup("rsvpPessoas")` são administrativos.
- As gravações públicas exigem ativação e confirmação aberta, com `request.time < prazo`. Alterar uma resposta exige também `permitirAlteracoes == true`. Administradores ativos podem editar e excluir depois do prazo. Usuários públicos não excluem respostas.
- Na criação, o cliente mantém uma posição fixa para cada pessoa do rascunho e usa uma transação com a resposta e o evento `inicio`. O registro começa com versão `1`. Ambos os timestamps da resposta e `em` do evento usam o horário do servidor. Se a posição já existir ao repetir um envio, o cliente consulta a gravação existente, em vez de tentar outra posição.
- Na edição, o cliente compara a versão lida com a versão que o usuário editou. A mesma transação grava a próxima versão, um UUID para o evento e o novo horário de atualização. A data de criação é preservada. O evento tem `tipo`, `origem`, `em` e `estado`. O estado contém nome, classificação, status e versão da resposta.
- Na exclusão administrativa, a mesma transação remove a resposta atual e acrescenta o evento fixo `exclusao` com o estado anterior. O Firestore mantém os documentos de histórico. O evento `inicio` também impede que o mesmo slot seja recriado após exclusão. Defina a retenção dos dados pessoais de histórico com os noivos, pois eles continuam privados e armazenados.
- Reserve até 12 posições por UID e use lotes de até quatro pessoas por operação atômica. Quatro foram validadas no emulador. Se houver vários lotes, o formulário deve acompanhar quais foram confirmados e repetir só os pendentes, mantendo seus IDs. Isso respeita o orçamento de acessos das regras do Firestore. O limite por UID reduz abuso por uma sessão, mas não impede que alguém crie novas contas anônimas. App Check e monitoramento de cotas são etapas complementares.

## Configuração manual futura

1. No Firebase Console, em **Authentication → Método de login**, habilite **Anônimo** antes da homologação do formulário. Mantenha **E-mail/senha** ativo para os administradores. O dono do envio é o UID da sessão anônima, sem identificação ou recuperação por nome.
2. Antes de publicar regras, exporte o texto das regras vigentes. O arquivo `firestore.rules` no Git contém as regras finais da etapa anterior mais o novo contrato. Se o ambiente ainda usa regras transitórias, **não o substitua por inteiro**. Revise e acrescente apenas as funções e os blocos desta etapa às regras vigentes, ou decida separadamente a migração das regras antigas. O bloco novo começa em `anonymousOwner` e termina na listagem administrativa de `rsvpPessoas`. Ele reutiliza os auxiliares `admin`, `validAge` e `validAnswer`, presentes nas regras finais e na proposta transitória. Assim o fluxo atual de convites preserva as permissões que estão efetivamente em produção. A proposta transitória anterior também restringe a leitura de `casamento` e impede salvar `aberta: true` pelo painel. Antes de abrir o novo fluxo, revise essas restrições para o prazo público e a reabertura administrativa, mantendo o acesso legado por convite conforme a decisão de implantação.
3. Crie `configuracoes/rsvpPublico` com `ativa` do tipo Boolean e valor **false**. Confira o documento `configuracoes/casamento`, incluindo o Timestamp do prazo e os dois campos booleanos.
4. Após homologar as etapas do formulário e do painel, publique as regras revisadas manualmente e valide primeiro o painel atual. Só então habilite `ativa` para o novo fluxo. Para suspender apenas novas gravações públicas, volte `ativa` para `false`. Para reverter as regras, restaure o texto salvo. A reversão não apaga dados.
5. O modelo usa Authentication e Firestore, sem Cloud Functions. Monitore as cotas do Spark e avalie App Check com o domínio oficial antes da abertura. Os testes desta etapa usam o Firestore emulado e não dependem de habilitar Authentication no projeto real.

## Teste local

Com Java e o emulador oficial do Firestore, carregue `firestore.rules` no projeto descartável `demo-rsvp-publico`. Exemplo com o JAR do emulador oficial.

```sh
java -jar /caminho/cloud-firestore-emulator.jar --host 127.0.0.1 --port 8796 --project_id demo-rsvp-publico --rules firestore.rules
node --test tests/rsvp-rules.test.mjs
```

O teste usa apenas loopback e limpa o projeto emulado `demo-rsvp-publico` antes da execução. Use `FIRESTORE_EMULATOR_PORT` para outra porta. As credenciais do teste simulam as identidades aceitas pelo emulador. Nenhum dado ou credencial de produção é usado.
