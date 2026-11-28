# Portal de Casamento — Ana Claudia & Gabriel

## Contexto

Estamos desenvolvendo um portal digital para o casamento de Ana Claudia e Gabriel.

- Data: 06/02/2027.
- Horário: 15h.
- Local: Sítio Verde Flor — Espaço & Eventos, Planaltina-DF.
- Idioma: português brasileiro.
- Hospedagem: GitHub Pages.

## Identidade visual

- Lavanda: #B6A1D2.
- Azul bebê: #D5E5F4.
- Branco: #FFFFFF.
- Fundo suave: #FAF8FD.
- Design elegante, delicado, romântico e moderno.
- Layout responsivo, priorizando dispositivos móveis.
- Animações suaves e discretas.
- Tipografia elegante e de fácil leitura.

## Objetivo do sistema

Criar um portal integrado de confirmação de presença, lista de presentes e gerenciamento administrativo do casamento.

Existe uma página de presentes desenvolvida anteriormente, cujo código e funcionalidades devem ser preservados.

## Estrutura planejada

- index.html: página inicial.
- confirmacao.html: confirmação de presença.
- presentes.html: lista de presentes existente.
- admin.html: painel administrativo.
- css/style.css: estilos globais.
- css/confirmacao.css: estilos da confirmação.
- css/admin.css: estilos administrativos.
- js/confirmacao.js: lógica de confirmação.
- js/admin.js: lógica administrativa.
- config/firebase-config.js: configuração do Firebase.
- assets/: imagens, fontes e ícones.

Preservar os arquivos originais até que todas as referências e dependências sejam verificadas.

## Fluxo de navegação

A página inicial deverá possuir duas opções independentes:

1. Confirmar presença.
2. Presentear o casal.

O convidado poderá acessar a lista de presentes independentemente de ter confirmado presença.

Após registrar uma confirmação ou recusa, apresentar uma mensagem de agradecimento e oferecer as opções de presentear o casal ou finalizar.

A página de presentes também deverá disponibilizar acesso à confirmação de presença.

## Confirmação de presença

O fluxo aprovado deve coletar os nomes dos convidados por um link público único. O primeiro acesso não exige cadastro prévio, código de convite ou criação manual de conta.

- Permitir que uma pessoa registre nome completo, faixa etária e status de presença para si e para familiares, com revisão antes do envio.
- Exibir os registros automaticamente no painel administrativo, sem aprovação manual. Preservar os grupos familiares existentes e permitir a associação pelo painel.
- Usar autenticação anônima do Firebase para vincular o envio à sessão. Permitir alterações pelo próprio autor segundo o prazo e as permissões configuradas. Tratar a perda de acesso com os noivos, sem recuperação por nome.
- Separar respostas públicas de dados administrativos privados. Restringir o acesso ao próprio envio, manter o histórico protegido e usar medidas de prevenção de spam compatíveis com o plano Spark.
- Preservar o prazo de confirmação, o encerramento antecipado, a configuração de alterações, o histórico e a lista de presentes.

### Nomes de convidados

- Compartilhar a função de tratamento entre o painel administrativo e o futuro formulário público.
- Gravar nomes em maiúsculas, preservando acentos, hífens e apóstrofos. Remover espaços nas extremidades e reduzir espaços excedentes entre partes do nome.
- Rejeitar números e emojis. Preservar a grafia informada, inclusive nomes de uma só palavra.
- Normalizar capitalização, acentos e espaços apenas na chave de comparação. Usar IDs distintos para identificar pessoas. Nomes iguais ou semelhantes são apenas indícios de duplicidade e não devem bloquear o envio nem mesclar homônimos automaticamente.
- Aplicar a padronização ao cadastrar ou salvar uma edição. Preservar a grafia dos registros existentes até que sejam editados, sem migração automática.

## Painel administrativo

Funcionalidades planejadas:

- Login seguro dos administradores.
- Cadastro de convidados.
- Cadastro de grupos familiares.
- Total de convidados.
- Total de confirmados.
- Total de ausentes.
- Total de pendentes.
- Pesquisa e filtros.
- Gerenciamento de confirmações.
- Exportação de dados em CSV compatível com Excel.
- Gerenciamento de presentes, mediante análise da implementação existente.

## Banco de dados e segurança

Utilizar preferencialmente Firebase Authentication e Cloud Firestore, após aprovação da configuração.

- Não armazenar dados pessoais dos convidados no repositório público.
- Não armazenar senhas ou credenciais privadas no código.
- Implementar regras de segurança no banco de dados.
- Restringir o acesso administrativo a usuários autorizados.
- Impedir que convidados consultem ou alterem registros de terceiros.
- Não simular confirmações bem-sucedidas quando o banco de dados não estiver configurado.
- Não utilizar localStorage como banco de dados definitivo.

## Regras de desenvolvimento

- Preservar as funcionalidades existentes.
- Trabalhar com HTML, CSS e JavaScript, salvo necessidade técnica justificada.
- Manter compatibilidade com GitHub Pages.
- Utilizar caminhos relativos entre arquivos.
- Desenvolver código organizado, modular e documentado.
- Evitar dependências desnecessárias.
- Testar as alterações antes da publicação.
- Não modificar dados de pagamento ou Pix sem autorização.
- Não realizar alterações diretamente na branch main.
- Utilizar branches separadas e Pull Requests.
- Não implementar funcionalidades fora do escopo solicitado.
- Informar erros, limitações e configurações pendentes.

## Prioridade atual

Implementar o novo fluxo de confirmação em etapas pequenas e independentes, partindo da branch `main`.

1. Padronizar e validar nomes no cadastro e na edição administrativa.
2. Definir o modelo de dados público, a autoria, o histórico e as regras do Firestore.
3. Criar o formulário público com autenticação anônima e revisão do envio.
4. Integrar os registros ao painel e sinalizar possíveis duplicidades.
5. Validar alterações de respostas, proteção contra spam e a sequência de implantação.

O PR #4, dedicado ao gerenciamento de códigos de convite, deve permanecer sem merge enquanto o fluxo por link único é desenvolvido.
