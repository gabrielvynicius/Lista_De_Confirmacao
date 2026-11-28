import { formatGuestName, normalizeName } from "./names.js";
import { connect, isDemo, readResponses, readSettings, saveBatch } from "./rsvp-publico-store.js";

const $ = (id) => document.getElementById(id);
const fields = ["nome", "classificacao", "status"];
const maxSlots = 12;
const batchSize = 4;
const form = $("response-form");
const review = $("review");
const template = $("person-template");
const deadlineFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const labels = (name) => Object.fromEntries([...template.content.querySelectorAll(`[name="${name}"] option`)]
  .map(({ value, textContent }) => [value, textContent]));
const ageLabels = labels("classificacao");
const statusLabels = labels("status");

let uid;
let settings;
let saved = [];
let journal;
let draft;
let saving = false;

const journalKey = () => "rsvp-envio-pendente:" + uid;
const slotsKey = () => "rsvp-posicoes-usadas:" + uid;
const canWrite = () => settings?.enabled && settings.deadline > Date.now();

function fillSummary(list, rows) {
  list.replaceChildren(...rows.map(({ nome, classificacao, status }) => {
    const item = document.createElement("li");
    item.textContent = `${nome} · ${ageLabels[classificacao]} · ${statusLabels[status]}`;
    return item;
  }));
}

function usedSlots() {
  const previouslyUsed = JSON.parse(localStorage.getItem(slotsKey()) || "[]");
  return new Set([...previouslyUsed, ...saved.map(({ slot }) => slot)]);
}

function rememberSlots(slots) {
  localStorage.setItem(slotsKey(), JSON.stringify([...new Set([...usedSlots(), ...slots])]));
}

function availableSlots() {
  const used = usedSlots();
  return Array.from({ length: maxSlots }, (_, index) => String(index + 1)).filter((slot) => !used.has(slot));
}

function refreshRows() {
  const rows = [...$("people").children];
  rows.forEach((row, index) => {
    row.querySelector("legend").textContent = `Convidado ${index + 1}`;
    const remove = row.querySelector(".remove-person");
    remove.setAttribute("aria-label", `Remover convidado ${index + 1}`);
    remove.hidden = Boolean(row.dataset.slot) || rows.length === 1;
  });
  const newRows = rows.filter((row) => !row.dataset.slot).length;
  $("add-person").disabled = newRows >= availableSlots().length;
  $("limit-note").hidden = !$("add-person").disabled;
}

function addPerson(person) {
  const row = template.content.firstElementChild.cloneNode(true);
  if (person) {
    row.dataset.slot = person.slot;
    for (const field of fields) row.querySelector(`[name="${field}"]`).value = person[field];
  }
  row.querySelector(".remove-person").addEventListener("click", () => {
    row.remove();
    refreshRows();
    $("add-person").focus();
  });
  const name = row.querySelector('[name="nome"]');
  name.addEventListener("input", () => name.setCustomValidity(""));
  $("people").append(row);
  return name;
}

function showForm() {
  if (!canWrite()) return;
  $("people").replaceChildren();
  $("form-message").textContent = "";
  if (settings.editing) saved.forEach(addPerson);
  if (!$("people").children.length && availableSlots().length) addPerson();
  form.hidden = !$("people").children.length;
  if (!form.hidden) refreshRows();
}

function showSaved() {
  form.hidden = true;
  $("thanks").hidden = true;
  $("existing").hidden = saved.length === 0;
  fillSummary($("existing-list"), saved);
  const mayEdit = saved.length && settings?.editing;
  $("edit").hidden = !(canWrite() && (mayEdit || availableSlots().length));
  $("edit").textContent = mayEdit ? "Alterar ou adicionar respostas" : "Adicionar novas respostas";
  if (!saved.length && canWrite()) showForm();
}

function openReview() {
  const plan = journal ?? draft;
  fillSummary($("review-list"), plan.rows);
  $("duplicates").hidden = Boolean(journal) || !plan.repeated.length;
  $("approve-duplicates").checked = false;
  $("send").disabled = !journal && plan.repeated.length > 0;
  $("send").textContent = journal ? "Continuar envio" : "Enviar respostas";
  $("back").hidden = Boolean(journal);
  $("stop").hidden = !journal;
  $("review-message").textContent = journal
    ? `${journal.done} de ${journal.items.length} respostas da última tentativa verificadas. Continue para consultar e enviar as demais.`
    : plan.repeated.length ? `Confira os nomes repetidos: ${plan.repeated.join(", ")}.` : "";
  if (!review.open) review.showModal();
}

async function load() {
  $("load-again").hidden = true;
  $("message").textContent = "Carregando suas respostas…";
  $("deadline").textContent = "Consultando o prazo de confirmação…";
  try {
    const [identity, configuration] = await Promise.all([
      connect(),
      readSettings().catch(() => null),
    ]);
    uid = identity;
    settings = configuration;
    $("deadline").textContent = settings?.deadline
      ? `Prazo de confirmação: ${deadlineFormat.format(settings.deadline)} (horário de Brasília)`
      : "Prazo de confirmação indisponível.";
    saved = (await readResponses(uid)).sort((a, b) => Number(a.slot) - Number(b.slot));
    rememberSlots([]);
    journal = JSON.parse(sessionStorage.getItem(journalKey()) || "null");
    showSaved();
    $("message").textContent = !settings?.deadline
      ? "Confira suas respostas salvas. O prazo está indisponível no momento."
      : !canWrite()
        ? "O envio de respostas está fechado. As respostas já registradas continuam disponíveis nesta sessão."
        : "";
    $("load-again").hidden = Boolean(settings?.deadline);
    if (journal) openReview();
  } catch {
    form.hidden = $("existing").hidden = true;
    $("message").textContent = "Não foi possível acessar suas respostas. Verifique a conexão e tente novamente neste navegador.";
    $("load-again").hidden = false;
    if (!settings?.deadline) $("deadline").textContent = "Prazo de confirmação indisponível.";
  }
}

$("load-again").addEventListener("click", () => void load());
$("edit").addEventListener("click", () => {
  showForm();
  form.querySelector("input")?.focus();
});
$("show-responses").addEventListener("click", () => void load());
$("add-person").addEventListener("click", () => {
  if ($("add-person").disabled) return;
  addPerson().focus();
  refreshRows();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (journal || !canWrite()) {
    $("form-message").textContent = "O envio está fechado ou há um envio a terminar. Consulte suas respostas.";
    return;
  }
  const slots = availableSlots();
  if ([...$("people").children].filter((row) => !row.dataset.slot).length > slots.length) {
    $("form-message").textContent = "As posições disponíveis mudaram. Remova um novo convidado ou recarregue para consultar suas respostas.";
    return;
  }
  const rows = [];
  const items = [];
  const names = new Map();
  const repeated = new Set();

  for (const row of $("people").children) {
    const controls = Object.fromEntries(fields.map((field) => [field, row.querySelector(`[name="${field}"]`)]));
    let nome;
    try {
      nome = formatGuestName(controls.nome.value);
    } catch (error) {
      controls.nome.setCustomValidity(error.message);
      controls.nome.reportValidity();
      return;
    }

    const key = normalizeName(nome);
    if (names.has(key)) repeated.add(names.get(key));
    else names.set(key, nome);

    const person = { nome, classificacao: controls.classificacao.value, status: controls.status.value };
    const previous = saved.find(({ slot }) => slot === row.dataset.slot);
    rows.push(person);
    if (previous && fields.every((field) => person[field] === previous[field])) continue;
    items.push({
      ...person, slot: previous?.slot ?? slots.shift(),
      baseVersion: previous?.versao ?? 0,
      eventoId: previous ? crypto.randomUUID() : "inicio",
    });
  }

  if (!items.length) {
    $("form-message").textContent = "Nenhuma resposta foi alterada.";
    return;
  }
  $("form-message").textContent = "";
  draft = { items, rows, repeated: [...repeated], done: 0 };
  openReview();
});

$("approve-duplicates").addEventListener("change", () => {
  $("send").disabled = !$("approve-duplicates").checked;
});
$("back").addEventListener("click", () => review.close());
review.addEventListener("cancel", (event) => {
  if (saving || journal) event.preventDefault();
});
$("stop").addEventListener("click", async () => {
  if (saving) return;
  $("stop").disabled = $("send").disabled = true;
  try {
    saved = (await readResponses(uid)).sort((a, b) => Number(a.slot) - Number(b.slot));
    rememberSlots([]);
    sessionStorage.removeItem(journalKey());
    journal = draft = undefined;
    review.close();
    $("message").textContent = "Envio interrompido. As respostas abaixo são as que estão salvas.";
    showSaved();
  } catch {
    $("review-message").textContent = "Não foi possível consultar o que foi salvo. Tente novamente com conexão.";
  } finally {
    $("stop").disabled = $("send").disabled = false;
  }
});

$("send").addEventListener("click", async () => {
  if (saving || (!journal && (!draft || (draft.repeated.length && !$("approve-duplicates").checked)))) return;
  saving = true;
  $("send").disabled = $("back").disabled = $("stop").disabled = true;

  try {
    if (!journal) {
      sessionStorage.setItem(journalKey(), JSON.stringify(draft));
      journal = draft;
    }
    while (journal.done < journal.items.length) {
      $("review-message").textContent = `Salvando respostas… ${journal.done} de ${journal.items.length} verificadas.`;
      const batch = journal.items.slice(journal.done, journal.done + batchSize);
      await saveBatch(uid, batch);
      journal.done += batch.length;
      sessionStorage.setItem(journalKey(), JSON.stringify(journal));
      rememberSlots(batch.map(({ slot }) => slot));
    }
    const { items } = journal;
    sessionStorage.removeItem(journalKey());
    journal = draft = undefined;
    review.close();
    form.hidden = $("existing").hidden = true;
    $("thanks").hidden = false;
    $("thanks-title").textContent = isDemo ? "Dados de demonstração salvos" : `Obrigado pela resposta, ${items[0].nome}!`;
    fillSummary($("saved-list"), items);
    $("reminder").hidden = isDemo || !settings?.editing || !items.some(({ status }) => status === "indeciso");
    $("reminder").textContent = "Você pode atualizar uma resposta indecisa neste navegador até o prazo.";
    $("message").textContent = "";
    $("thanks-title").focus();
  } catch (error) {
    const verified = journal ? `${journal.done} de ${journal.items.length} respostas verificadas. ` : "";
    const next = !journal
      ? "Não foi possível preparar o envio. Verifique se este navegador permite armazenar dados da sessão."
      : error.message === "conflict"
      ? "Uma resposta mudou em outra janela. Consulte as respostas salvas antes de continuar."
      : error.code === "permission-denied"
        ? "O servidor recusou o envio. O prazo ou as permissões podem ter mudado. Consulte as respostas salvas."
        : "Não foi possível concluir. Verifique a conexão e continue neste navegador.";
    $("review-message").textContent = verified + next;
    $("stop").hidden = !journal;
    $("back").hidden = Boolean(journal);
    $("duplicates").hidden = Boolean(journal) || !draft?.repeated.length;
    if (journal) $("send").textContent = "Continuar envio";
  } finally {
    saving = false;
    $("send").disabled = $("back").disabled = $("stop").disabled = false;
  }
});

if (isDemo) {
  $("preview-note").hidden = false;
  $("preview-note").textContent = "Demonstração privada. Use apenas nomes fictícios. As respostas ficam neste navegador e não são enviadas ao Firebase.";
}
void load();
