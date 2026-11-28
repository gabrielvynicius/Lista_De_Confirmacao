import { doc, getDocFromServer, runTransaction } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "../config/firebase-config.js";
import {
  ages, answers, codePattern, formatDate, maxResponses, normalizeName, personRef, recordResponse, settingsRef,
} from "./rsvp-model.js";

const $ = (id) => document.getElementById(id);
const message = $("message");
const review = $("review");
let access;
let reviewed;
let settings;
let inviteRequest = 0;

function canRespond() {
  return settings?.aberta === true && settings.prazo?.toMillis?.() > Date.now();
}

function answered(person) {
  return person.status !== "pendente" || person.primeiraRespostaEm != null;
}

function writable(person) {
  return canRespond() && (!answered(person) || settings.permitirAlteracoes === true);
}

async function loadSettings() {
  settings = null;
  $("deadline").textContent = "Consultando o prazo de confirmação…";
  try {
    settings = (await getDocFromServer(settingsRef)).data();
  } catch {
    // O convite ainda pode ser consultado quando as configurações estiverem indisponíveis.
  }
  const date = formatDate(settings?.prazo);
  $("deadline").textContent = date
    ? `Prazo de confirmação: ${date} (horário de Brasília)`
    : "Prazo de confirmação indisponível.";
}

function fillSummary(target, people) {
  target.replaceChildren(...people.map(({ nome, rotulo, classificacao, status }) => {
    const item = document.createElement("li");
    item.textContent = [rotulo || nome, ages[classificacao], answers[status]].filter(Boolean).join(" · ");
    return item;
  }));
}

function selectWithLabel(label, name, placeholder, items) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const select = document.createElement("select");
  select.name = name;
  select.required = true;
  select.append(new Option(placeholder, ""), ...items.map(([value, caption]) => new Option(caption, value)));
  wrapper.append(select);
  return wrapper;
}

function countInputs() {
  const rows = [...$("people").children];
  rows.forEach((row, index) => {
    row.querySelector("legend").textContent = `Convidado ${index + 1}`;
    const button = row.querySelector(".remove-person");
    button.hidden = rows.length === 1;
    button.setAttribute("aria-label", `Remover convidado ${index + 1}`);
  });
  $("add-person").disabled = rows.length >= Math.min(maxResponses, access.eligible.length);
}

function addPerson() {
  if ($("people").children.length >= Math.min(maxResponses, access.eligible.length)) return;
  const row = document.createElement("fieldset");
  row.append(document.createElement("legend"));
  const choices = access.eligible.map(({ id, rotulo }) => [id, rotulo]);
  const roster = selectWithLabel("Pessoa do convite", "id", "Selecione uma pessoa", choices);
  if (choices.length === 1) {
    roster.querySelector("select").value = choices[0][0];
    roster.hidden = true;
  }
  const name = document.createElement("label");
  name.textContent = "Nome completo";
  const input = document.createElement("input");
  input.name = "nome";
  input.required = true;
  input.maxLength = 160;
  input.autocomplete = "off";
  input.placeholder = "Digite seu nome completo";
  name.append(input);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "portal-link remove-person";
  remove.textContent = "Remover";
  remove.addEventListener("click", () => {
    row.remove();
    countInputs();
    $("add-person").focus();
  });
  row.append(roster, name, selectWithLabel("Faixa etária", "classificacao", "Selecione uma faixa etária", Object.entries(ages)),
    selectWithLabel("Resposta sobre a presença", "status", "Selecione uma resposta", Object.entries(answers)), remove);
  $("people").append(row);
  countInputs();
  return roster.hidden ? input : roster.querySelector("select");
}

function showInvite(code, people) {
  const counts = new Map();
  for (const { nome } of people) {
    const key = normalizeName(nome);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const person of people) {
    const { nome, position } = person;
    person.rotulo = counts.get(normalizeName(nome)) > 1 ? `${nome} — pessoa ${position} do convite` : nome;
  }
  const eligible = people.filter(writable);
  access = { code, eligible };
  message.textContent = "";
  $("attendance").hidden = false;
  $("people").replaceChildren();
  const existing = people.filter(answered);
  fillSummary($("existing"), existing);
  $("existing").hidden = existing.length === 0;
  const note = [];
  if (existing.length) note.push("Já existe uma resposta registrada para as pessoas abaixo.");
  if (!settings?.prazo) note.push("As respostas estão indisponíveis no momento.");
  else if (!canRespond()) note.push("As confirmações estão encerradas. Você ainda pode consultar as respostas deste convite.");
  else if (existing.length && !settings.permitirAlteracoes) note.push("As alterações de respostas estão desativadas.");
  else if (existing.length) note.push("O código validou o convite. Para atualizar uma resposta, selecione a pessoa e preencha os campos novamente.");
  if (eligible.length > maxResponses) note.push(`Envie até ${maxResponses} respostas por vez e volte a abrir este convite para responder pelas demais pessoas.`);
  $("invite-note").textContent = note.join(" ");
  $("response-form").hidden = !eligible.length;
  if (eligible.length) addPerson();
}

async function openInvite(code) {
  const request = ++inviteRequest;
  $("attendance").hidden = $("thanks").hidden = true;
  $("invite-form").hidden = $("portal-nav").hidden = false;
  $("reminder").hidden = true;
  review.close();
  $("open-invite").disabled = true;
  access = null;
  message.textContent = "Validando o convite…";
  try {
    await loadSettings();
    const invite = (await getDocFromServer(doc(db, "convites", code))).data();
    if (!Array.isArray(invite?.pessoas)) throw new Error("invalid-invite");
    const results = await Promise.all(invite.pessoas.map(async (id, index) => {
      try {
        const person = await getDocFromServer(personRef(code, id));
        return person.exists() ? { ...person.data(), id, position: index + 1 } : null;
      } catch (error) {
        if (error.code === "permission-denied") return null;
        throw error;
      }
    }));
    if (inviteRequest !== request) return;
    const people = results.filter(Boolean);
    if (!people.length) throw new Error("invalid-invite");
    $("invite-code").value = "";
    showInvite(code, people);
  } catch (error) {
    if (inviteRequest !== request) return;
    message.textContent = error.message === "invalid-invite"
      ? "Convite não encontrado ou substituído. Confira o código ou fale com os noivos."
      : "Não foi possível abrir o convite. Verifique a conexão ou tente novamente mais tarde.";
  } finally {
    if (inviteRequest === request) $("open-invite").disabled = false;
  }
}

$("invite-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const code = $("invite-code").value.trim().toLowerCase();
  if (!codePattern.test(code)) {
    message.textContent = "Digite o código completo recebido no convite.";
    return;
  }
  void openInvite(code);
});

$("add-person").addEventListener("click", () => addPerson()?.focus());

$("response-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const ids = new Set();
  const responses = [];
  for (const row of $("people").children) {
    const value = (name) => row.querySelector(`[name="${name}"]`).value;
    const id = value("id");
    const input = value("nome").trim();
    const person = access.eligible.find((item) => item.id === id);
    const normalized = normalizeName(input);
    if (ids.has(id)) {
      message.textContent = "A mesma pessoa foi selecionada mais de uma vez. Remova a resposta repetida.";
      return;
    }
    if (!person || normalized !== normalizeName(person.nome)) {
      message.textContent = "Confira se o nome completo corresponde à pessoa selecionada no convite.";
      return;
    }
    // Um nome pode corresponder a mais de um ID autorizado no mesmo convite.
    ids.add(id);
    responses.push({ id, nome: person.nome, rotulo: person.rotulo, nomeInformado: input, classificacao: value("classificacao"), status: value("status") });
  }
  message.textContent = "";
  reviewed = responses;
  fillSummary($("review-list"), reviewed);
  $("review-message").textContent = "";
  review.showModal();
});

$("back").addEventListener("click", () => review.close());
review.addEventListener("cancel", (event) => {
  if ($("send").disabled) event.preventDefault();
});

$("send").addEventListener("click", async () => {
  const active = access;
  const { code } = active;
  const responses = reviewed;
  $("send").disabled = $("back").disabled = true;
  $("review-message").textContent = "Registrando respostas…";
  try {
    await loadSettings();
    if (!canRespond()) throw new Error("closed");
    await runTransaction(db, async (transaction) => {
      const refs = responses.map(({ id }) => personRef(code, id));
      const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
      snapshots.forEach((snapshot, index) => {
        const previous = snapshot.data();
        const response = responses[index];
        if (!previous || normalizeName(previous.nome) !== normalizeName(response.nomeInformado)) throw new Error("stale");
        if (answered(previous) && !settings.permitirAlteracoes) throw new Error("already-answered");
        const guestRef = doc(db, "convidados", response.id);
        const changes = recordResponse(transaction, guestRef, previous,
          { ...response, nomeInformado: previous.nome }, "convidado");
        transaction.update(guestRef, changes);
        const { status, classificacao, primeiraRespostaEm, ultimaAlteracaoRespostaEm } = changes;
        transaction.update(refs[index], { status, classificacao, primeiraRespostaEm, ultimaAlteracaoRespostaEm });
      });
    });
    if (access !== active) return;
    review.close();
    $("attendance").hidden = $("invite-form").hidden = $("portal-nav").hidden = true;
    $("thanks").hidden = false;
    $("thanks-title").textContent = `Obrigado pela resposta, ${responses[0].nome}!`;
    fillSummary($("saved-list"), responses);
    if (responses.some(({ status }) => status === "indeciso")) {
      const deadline = `${formatDate(settings.prazo)} (horário de Brasília)`;
      $("reminder").textContent = settings.permitirAlteracoes
        ? `Para atualizar uma resposta indecisa, reabra o convite até ${deadline}.`
        : `O prazo é ${deadline}. Como as alterações públicas estão desativadas, fale com os noivos se precisar atualizar sua resposta.`;
      $("reminder").hidden = false;
    }
    $("thanks-title").focus();
  } catch (error) {
    if (access !== active) return;
    const errors = {
      closed: settings?.prazo ? "As confirmações estão encerradas." : "Não foi possível verificar o prazo. Nenhuma resposta foi registrada.",
      stale: "O convite mudou. Abra o convite novamente antes de enviar.",
      "already-answered": "Já existe uma resposta registrada e as alterações estão desativadas. Reabra o convite para consultar.",
    };
    $("review-message").textContent = errors[error.message] || (error.code === "permission-denied"
      ? "O envio foi recusado. O prazo, a permissão ou o convite podem ter mudado. Abra o convite novamente."
      : "Não foi possível confirmar a gravação. Verifique a conexão e consulte o convite antes de tentar novamente.");
  } finally {
    $("send").disabled = $("back").disabled = false;
  }
});

function openLinkedInvite() {
  const code = new URLSearchParams(location.hash.slice(1)).get("convite");
  if (code && codePattern.test(code)) void openInvite(code);
  else void loadSettings();
}

$("open-invite").disabled = false;
window.addEventListener("hashchange", openLinkedInvite);
openLinkedInvite();
