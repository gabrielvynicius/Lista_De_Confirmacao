import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  addDoc, collection, deleteDoc, doc, getDocFromServer, getDocsFromServer, limit, onSnapshot,
  query, runTransaction, serverTimestamp, updateDoc, where,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { auth, db } from "../config/firebase-config.js";

import { loadRsvpAdmin, openInviteAdmin, resetRsvpAdmin } from "./admin-rsvp.js";
import { ages, formatDate, mirrorFields, normalizeName, personRef, recordResponse, statuses, statusOf } from "./rsvp-model.js";

const $ = (id) => document.getElementById(id);
const nameOrder = new Intl.Collator("pt-BR", { sensitivity: "base" });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const loginForm = $("login-form");
const guestForm = $("guest-form");
const familyForm = $("family-form");
const deleteForm = $("delete-form");
const familyDeleteForm = $("family-delete-form");
const dialogs = [guestForm, familyForm, deleteForm, familyDeleteForm];
let session;
let authReady = false;

function classificationOf(guest) {
  return Object.hasOwn(ages, guest.classificacao) ? ages[guest.classificacao] : "";
}

function records(snapshot) {
  return snapshot.docs
    .map((record) => ({ ...record.data(), id: record.id }))
    .sort((a, b) => nameOrder.compare(a.nome, b.nome));
}

function field(form, name) {
  return form.elements.namedItem(name);
}

function clearSession(message) {
  session?.unsubscribe.forEach((stop) => stop());
  session = undefined;
  resetRsvpAdmin();
  for (const form of dialogs) {
    form.closest("dialog").close();
    form.reset();
    form.querySelector(".form-message").textContent = "";
    form.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    delete form.dataset.id;
  }
  field(guestForm, "familiaId").replaceChildren(new Option("Sem grupo familiar", ""));
  $("delete-description").textContent = "";
  $("family-delete-description").textContent = "";
  clearTables();
  $("dashboard").hidden = true;
  $("admin-name").textContent = "";
  $("dashboard-message").textContent = "";
  $("family-message").textContent = "";
  $("search").value = "";
  $("status-filter").value = "";
  $("logout").disabled = false;
  document.querySelectorAll(".metrics dd").forEach((element) => { element.textContent = "—"; });
  for (const id of ["add-guest", "add-family", "export"]) $(id).disabled = true;
  $("login").hidden = false;
  $("login-message").textContent = message;
}

async function endSession(message) {
  clearSession(message);
  $("login-submit").disabled = true;
  try {
    await signOut(auth);
  } catch {
    $("login-message").textContent = "Não foi possível encerrar a sessão. Recarregue a página.";
  }
}

function isActiveAdmin(snapshot) {
  const data = snapshot.data();
  return data?.role === "admin" && data.ativo === true;
}

async function openSession(user) {
  const active = { unsubscribe: [], guests: null, families: null, authorized: false };
  session = active;
  const adminRef = doc(db, "administradores", user.uid);

  try {
    const administrator = await getDocFromServer(adminRef);
    if (session !== active || auth.currentUser?.uid !== user.uid) return;
    if (!isActiveAdmin(administrator)) {
      await endSession("Esta conta não tem acesso administrativo ativo.");
      return;
    }
    active.authorized = true;
    $("admin-name").textContent = administrator.data().nome || "Administração do casamento";
    $("login").hidden = true;
    $("dashboard").hidden = false;
    void loadRsvpAdmin();
    $("dashboard-title").focus();
    $("dashboard-message").textContent = "Carregando convidados e famílias…";

    const handleReadError = (error) => {
      if (session !== active) return;
      const message = error.code === "permission-denied"
        ? "O Firestore negou o acesso ao painel. Verifique a autorização e as regras."
        : "Não foi possível sincronizar o painel. Entre novamente para tentar outra vez.";
      void endSession(message);
    };

    active.unsubscribe.push(onSnapshot(adminRef, { includeMetadataChanges: true }, (snapshot) => {
      if (session !== active || snapshot.metadata.fromCache) return;
      if (!isActiveAdmin(snapshot)) {
        void endSession("O acesso administrativo foi encerrado.");
      } else {
        $("admin-name").textContent = snapshot.data().nome || "Administração do casamento";
      }
    }, handleReadError));

    for (const [path, key] of [["convidados", "guests"], ["familias", "families"]]) {
      active.unsubscribe.push(onSnapshot(collection(db, path), { includeMetadataChanges: true }, (snapshot) => {
        if (session !== active || snapshot.metadata.hasPendingWrites) return;
        active[key] = snapshot.metadata.fromCache ? null : records(snapshot);
        renderDashboard(active);
      }, handleReadError));
    }
  } catch (error) {
    if (session !== active) return;
    const message = error.code === "permission-denied"
      ? "Não foi possível verificar o acesso administrativo desta conta no Firestore."
      : "Não foi possível verificar a autorização. Verifique a conexão e tente novamente.";
    await endSession(message);
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    clearSession("Verificando acesso administrativo…");
    $("login-submit").disabled = true;
    void openSession(user);
  } else {
    clearSession($("login-submit").disabled && authReady ? $("login-message").textContent : "");
    $("login-submit").disabled = false;
    authReady = true;
  }
}, () => clearSession("Não foi possível iniciar a autenticação. Recarregue a página."));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if ($("login-submit").disabled) return;
  $("login-submit").disabled = true;
  $("login-message").textContent = "Entrando…";
  const email = field(loginForm, "email").value.trim();
  const password = field(loginForm, "senha").value;
  field(loginForm, "senha").value = "";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    $("login-message").textContent = error.code === "auth/network-request-failed"
      ? "Falha na conexão. Tente novamente."
      : "Não foi possível entrar. Verifique o e-mail e a senha e tente novamente.";
    $("login-submit").disabled = false;
  }
});

$("logout").addEventListener("click", () => {
  loginForm.reset();
  void endSession("Sessão encerrada.");
});

function ready(active) {
  return active?.authorized && active.guests !== null && active.families !== null;
}

function clearTables() {
  for (const id of ["guest-rows", "family-rows"]) $(id).replaceChildren();
  for (const id of ["guest-table", "family-table"]) $(id).hidden = true;
  for (const id of ["results", "family-results"]) $(id).textContent = "";
}

function renderDashboard(active) {
  const available = Boolean(ready(active));
  for (const id of ["add-guest", "add-family", "export"]) $(id).disabled = !available;
  if (!available) {
    for (const form of dialogs) form.closest("dialog").close();
    clearTables();
    document.querySelectorAll(".metrics dd").forEach((element) => { element.textContent = "—"; });
    if (active.loaded) $("dashboard-message").textContent = "Aguardando conexão com o Firestore…";
    return;
  }

  if (!active.loaded || $("dashboard-message").textContent.startsWith("Aguardando")) {
    $("dashboard-message").textContent = "";
  }
  active.loaded = true;
  const guests = active.guests;
  const confirmed = guests.filter((guest) => statusOf(guest) === "confirmado").length;
  const absent = guests.filter((guest) => statusOf(guest) === "ausente").length;
  const metrics = {
    total: guests.length,
    confirmed,
    absent,
    pending: guests.filter((guest) => statusOf(guest) === "pendente").length,
    undecided: guests.filter((guest) => statusOf(guest) === "indeciso").length,
    teenagers: guests.filter((guest) => guest.classificacao === "adolescente").length,
    adults: guests.filter((guest) => guest.classificacao === "adulto").length,
    children: guests.filter((guest) => guest.classificacao === "crianca").length,
    percentage: percent.format(guests.length ? confirmed / guests.length : 0),
  };
  for (const [id, value] of Object.entries(metrics)) $(id).textContent = value;
  renderGuests();
  renderFamilies(active);
}

function familyName(active, guest) {
  return active.families.find((family) => family.id === guest.familiaId)?.nome
    || (guest.familiaId ? "Grupo indisponível" : "Sem grupo familiar");
}

function renderGuests() {
  if (!ready(session)) return;
  const query = normalizeName($("search").value.trim());
  const status = $("status-filter").value;
  const guests = session.guests.filter((guest) =>
    normalizeName(String(guest.nome ?? "")).includes(query) && (!status || statusOf(guest) === status));
  const rows = guests.map((guest) => {
    const row = document.createElement("tr");
    const cells = [
      [null, guest.nome || "Sem nome"],
      ["Classificação", classificationOf(guest) || "—"],
      ["Família", familyName(session, guest)],
      ["Status", statuses[statusOf(guest)]],
      ["Primeira resposta", formatDate(guest.primeiraRespostaEm) || "—"],
      ["Última alteração", formatDate(guest.ultimaAlteracaoRespostaEm) || "—"],
    ];
    for (const [label, value] of cells) {
      const cell = row.insertCell();
      if (label) cell.dataset.label = label;
      cell.textContent = value;
    }
    addRowActions(row, guest, [["Editar", openGuest], ["Excluir", openDelete],
      ["Convite de", (person) => openInviteAdmin([person])]]);
    return row;
  });
  $("guest-rows").replaceChildren(...rows);
  $("guest-table").hidden = !rows.length;
  $("results").textContent = guests.length
    ? `${guests.length} de ${session.guests.length} convidados`
    : "Nenhum convidado encontrado.";
}

function addRowActions(row, record, actions) {
  const container = document.createElement("div");
  container.className = "actions";
  for (const [label, action] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-label", `${label} ${record.nome}`);
    button.addEventListener("click", () => action(record));
    container.append(button);
  }
  row.insertCell().append(container);
}

function renderFamilies(active) {
  const counts = new Map();
  for (const guest of active.guests) {
    if (guest.familiaId) counts.set(guest.familiaId, (counts.get(guest.familiaId) ?? 0) + 1);
  }
  const rows = active.families.map((family) => {
    const row = document.createElement("tr");
    row.insertCell().textContent = family.nome;
    const count = row.insertCell();
    count.dataset.label = "Convidados vinculados";
    count.textContent = counts.get(family.id) ?? 0;
    addRowActions(row, family, [["Editar grupo", openFamily], ["Excluir grupo", openFamilyDelete],
      ["Convite de", (group) => openInviteAdmin(active.guests.filter((guest) => guest.familiaId === group.id), group.id)]]);
    return row;
  });
  $("family-rows").replaceChildren(...rows);
  $("family-table").hidden = !rows.length;
  $("family-results").textContent = rows.length ? "" : "Nenhum grupo familiar cadastrado.";
  if ($("family-delete-dialog").open) updateFamilyDelete(counts);
}

function updateFamilyDelete(counts) {
  const id = familyDeleteForm.dataset.id;
  const family = session.families.find((item) => item.id === id);
  if (!family) return;
  const count = counts.get(id) ?? 0;
  const linked = count === 1 ? "1 convidado vinculado" : `${count} convidados vinculados`;
  $("family-delete-description").textContent = count
    ? `O grupo “${family.nome}” tem ${linked}. Desvincule os convidados antes de excluir o grupo. Os registros deles serão preservados.`
    : `Deseja excluir o grupo “${family.nome}”? O grupo tem 0 convidados vinculados.`;
  $("unlink-family").hidden = count === 0;
  $("delete-family").hidden = count > 0;
}

$("search").addEventListener("input", renderGuests);
$("status-filter").addEventListener("change", renderGuests);

function openDialog(form, id = "") {
  if (!ready(session)) return;
  form.dataset.id = id;
  field(form, "nome")?.setCustomValidity("");
  form.querySelector(".form-message").textContent = "";
  form.closest("dialog").showModal();
}

function openGuest(guest) {
  if (!ready(session)) return;
  guestForm.reset();
  const family = field(guestForm, "familiaId");
  family.replaceChildren(new Option("Sem grupo familiar", ""), ...session.families.map(
    ({ id, nome }) => new Option(nome, id),
  ));
  if (guest?.familiaId && !session.families.some(({ id }) => id === guest.familiaId)) {
    family.add(new Option("Grupo indisponível", guest.familiaId));
  }
  field(guestForm, "nome").value = guest?.nome ?? "";
  field(guestForm, "classificacao").value = guest ? (classificationOf(guest) ? guest.classificacao : "") : "adulto";
  family.value = guest?.familiaId ?? "";
  field(guestForm, "telefone").value = guest?.telefone ?? "";
  field(guestForm, "status").value = guest ? statusOf(guest) : "pendente";
  field(guestForm, "observacoes").value = guest?.observacoes ?? "";
  $("guest-title").textContent = guest ? "Editar convidado" : "Novo convidado";
  openDialog(guestForm, guest?.id);
}

function openDelete(guest) {
  $("delete-description").textContent = `Você deseja excluir ${guest.nome || "este convidado"}?`;
  openDialog(deleteForm, guest.id);
}

$("add-guest").addEventListener("click", () => openGuest());
$("add-family").addEventListener("click", () => openFamily());

function openFamily(family) {
  familyForm.reset();
  field(familyForm, "nome").value = family?.nome ?? "";
  $("family-title").textContent = family ? "Editar grupo familiar" : "Novo grupo familiar";
  $("save-family").textContent = family ? "Salvar grupo" : "Cadastrar grupo";
  openDialog(familyForm, family?.id);
}

function openFamilyDelete(family) {
  openDialog(familyDeleteForm, family.id);
  renderFamilies(session);
}

function handleForm(form, write, successMessage, statusId = "dashboard-message") {
  const dialog = form.closest("dialog");
  const message = form.querySelector(".form-message");
  const buttons = [...form.querySelectorAll("button")];
  const submit = buttons.at(-1);
  form.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => {
    if (submit.disabled) event.preventDefault();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const active = session;
    if (!ready(active) || submit.disabled) return;
    buttons.forEach((button) => { button.disabled = true; });
    message.textContent = "Salvando no Firestore…";
    try {
      const result = await write(form.dataset.id, event.submitter?.value);
      if (session !== active) return;
      dialog.close();
      $(statusId).textContent = result ?? successMessage;
    } catch (error) {
      if (session !== active) return;
      const detail = error.code === "permission-denied"
        ? "O Firestore negou a operação. Verifique a autorização e as regras."
        : error instanceof RegistryError ? error.message : "Não foi possível concluir a operação. Tente novamente.";
      if (dialog.open) message.textContent = detail;
      else $(statusId).textContent = detail;
    } finally {
      if (session === active) buttons.forEach((button) => { button.disabled = false; });
    }
  });
}

for (const form of [guestForm, familyForm]) {
  const name = field(form, "nome");
  name.addEventListener("input", () => { name.setCustomValidity(""); });
  form.addEventListener("submit", (event) => {
    if (name.value.trim()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    name.setCustomValidity("Informe um nome.");
    name.reportValidity();
  });
}

handleForm(guestForm, (id) => {
  const values = Object.fromEntries(new FormData(guestForm));
  const guest = {
    nome: values.nome.trim(),
    classificacao: values.classificacao,
    familiaId: values.familiaId || null,
    telefone: values.telefone.trim(),
    status: values.status,
    observacoes: values.observacoes.trim(),
    atualizadoEm: serverTimestamp(),
  };
  const guestRef = id ? doc(db, "convidados", id) : doc(collection(db, "convidados"));
  return runTransaction(db, async (transaction) => {
    const previous = id ? await transaction.get(guestRef) : null;
    if (previous && !previous.exists()) throw new RegistryError("Este convidado já foi excluído.");
    if (guest.familiaId && previous?.data().familiaId !== guest.familiaId) {
      const familyRef = doc(db, "familias", guest.familiaId);
      const family = await transaction.get(familyRef);
      if (!family.exists()) throw new RegistryError("Este grupo foi excluído. Escolha outro grupo.");
      // Novos vínculos alteram o grupo para que uma exclusão ou desvinculação concorrente seja reavaliada.
      transaction.update(familyRef, { vinculosAtualizadosEm: serverTimestamp() });
    }
    const before = previous?.data() ?? {};
    const revokeFamilyInvite = before.conviteFamiliaId && before.familiaId !== guest.familiaId;
    if (revokeFamilyInvite) {
      guest.conviteCodigo = null;
      guest.conviteFamiliaId = null;
    }
    const attendanceChanged = statusOf(before) !== guest.status
      || (guest.classificacao !== before.classificacao && (guest.status !== "pendente" || before.historicoId));
    const changes = attendanceChanged
      ? recordResponse(transaction, guestRef, before, { ...guest, nomeInformado: before.nomeInformado ?? "" }, "administracao")
      : {};
    if (!revokeFamilyInvite && before.conviteCodigo && (attendanceChanged || guest.nome !== before.nome || guest.classificacao !== before.classificacao)) {
      // Preserve os timestamps anteriores quando a edição não muda a resposta.
      transaction.set(personRef(before.conviteCodigo, id), mirrorFields({ ...before, ...guest, ...changes }));
    }
    if (id) transaction.update(guestRef, { ...guest, ...changes });
    else transaction.set(guestRef, { ...guest, ...changes, criadoEm: serverTimestamp() });
  });
}, "Convidado salvo.");

class RegistryError extends Error {}

handleForm(familyForm, async (id) => {
  const nome = field(familyForm, "nome").value.trim();
  if (id) {
    await updateDoc(doc(db, "familias", id), { nome, atualizadoEm: serverTimestamp() });
    return "Nome do grupo familiar atualizado.";
  }
  await addDoc(collection(db, "familias"), { nome, criadoEm: serverTimestamp() });
  return "Grupo familiar cadastrado.";
}, "", "family-message");

handleForm(familyDeleteForm, async (id, action) => {
  if (action !== "delete" && action !== "unlink") return;
  const familyRef = doc(db, "familias", id);
  return runTransaction(db, async (transaction) => {
    const family = await transaction.get(familyRef);
    if (!family.exists()) throw new RegistryError("Este grupo familiar já foi excluído.");
    const matches = query(collection(db, "convidados"), where("familiaId", "==", id),
      limit(action === "delete" ? 1 : 500));
    const linked = await getDocsFromServer(matches);

    if (action === "delete") {
      if (!linked.empty) throw new RegistryError("O grupo ainda tem convidados vinculados. Desvincule-os antes de excluir.");
      transaction.delete(familyRef);
      return "Grupo familiar excluído.";
    }

    if (linked.size >= 500) {
      throw new RegistryError("O grupo tem 500 ou mais convidados. Desvincule alguns na edição de convidados e tente novamente.");
    }
    const guests = await Promise.all(linked.docs.map(({ ref }) => transaction.get(ref)));
    const members = guests.filter((guest) => guest.data()?.familiaId === id);
    for (const guest of members) {
      const change = { familiaId: null, atualizadoEm: serverTimestamp() };
      if (guest.data().conviteFamiliaId) {
        change.conviteCodigo = null;
        change.conviteFamiliaId = null;
      }
      transaction.update(guest.ref, change);
    }
    transaction.update(familyRef, { vinculosAtualizadosEm: serverTimestamp() });
    const count = members.length;
    return count === 1 ? "1 convidado desvinculado." : `${count} convidados desvinculados.`;
  });
}, "", "family-message");

handleForm(deleteForm, (id) => deleteDoc(doc(db, "convidados", id)), "Convidado excluído.");

function csvCell(value, preserveText = false) {
  const text = String(value ?? "");
  // O Excel interpreta determinados prefixos como fórmulas, mesmo em campos entre aspas.
  const formula = /^[\s\u0000-\u001f\ufeff]*[=+\-@＝＋－＠]/u.test(text);
  const sanitized = text && (preserveText || formula) ? "'" + text : text;
  return '"' + sanitized.replaceAll('"', '""') + '"';
}

$("export").addEventListener("click", () => {
  const active = session;
  if (!ready(active)) return;
  const header = ["Nome completo", "Faixa etária", "Grupo familiar", "Telefone", "Status", "Observações", "Primeira resposta (Brasília)", "Última alteração (Brasília)"];
  const rows = active.guests.map((guest) => [
    guest.nome, classificationOf(guest), familyName(active, guest),
    guest.telefone, statuses[statusOf(guest)], guest.observacoes,
    formatDate(guest.primeiraRespostaEm), formatDate(guest.ultimaAlteracaoRespostaEm),
  ].map((value, index) => csvCell(value, index === 3)).join(";"));
  const csv = ["\ufeff" + header.map((value) => csvCell(value)).join(";"), ...rows].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "convidados-casamento.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
