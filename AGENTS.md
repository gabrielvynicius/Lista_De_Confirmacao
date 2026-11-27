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

Funcionalidades planejadas:

- Identificação segura do convidado.
- Confirmação individual.
- Confirmação familiar.
- Registro de presença ou ausência.
- Consulta de confirmação existente.
- Alteração de resposta.
- Prevenção de duplicidades.
- Controle de acompanhantes autorizados.
- Mensagem de agradecimento.

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

O site está apresentando uma tela branca após o envio de arquivos possivelmente vazios.

As próximas tarefas deverão ser:

1. Analisar a estrutura atual e o histórico de commits.
2. Recuperar o código original da página de presentes.
3. Preservar as funcionalidades existentes.
4. Criar a nova página inicial.
5. Integrar a navegação.
6. Desenvolver a confirmação de presença.
7. Configurar o Firebase.
8. Desenvolver o painel administrativo.
9. Realizar testes e publicar.
