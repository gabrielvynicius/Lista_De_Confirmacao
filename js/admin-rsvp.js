import {
  collection, doc, getDocFromServer, getDocsFromServer, query, runTransaction, setDoc, Timestamp, where,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "../config/firebase-config.js";
import { codePattern, mirrorFields, personRef, settingsRef } from "./rsvp-model.js";

const $ = (id) => document.getElementById(id);
const form = $("settings-form");
const invite = $("invite-dialog");
const settingsStatus = $("settings-message");
let settingsSession;
let invitation;

export function resetRsvpAdmin() {
  settingsSession = undefined;
  invitation = undefined;
  form.reset();
  $("settings-save").disabled = true;
  settingsStatus.textContent = "";
  invite.close();
  clearInviteLink();
  $("invite-people").textContent = "";
  $("invite-message").textContent = "";
  $("create-invite").disabled = false;
  $("invite-close").disabled = false;
}

export async function loadRsvpAdmin() {
  const active = {};
  settingsSession = active;
  settingsStatus.textContent = "Carregando configurações…";
  try {
    const settings = (await getDocFromServer(settingsRef)).data();
    if (settingsSession !== active) return;
    if (settings) {
      const format = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      });
      $("settings-deadline").value = format.format(settings.prazo.toDate()).replace(" ", "T");
      $("settings-open").value = String(settings.aberta);
      $("settings-changes").checked = settings.permitirAlteracoes;
    }
    settingsStatus.textContent = settings ? "" : "Informe o prazo inicial para ativar as confirmações.";
    $("settings-save").disabled = false;
  } catch {
    if (settingsSession === active) settingsStatus.textContent = "Configurações indisponíveis. Verifique as regras do Firestore ou entre novamente.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!settingsSession || $("settings-save").disabled) return;
  const active = settingsSession;
  const date = new Date($("settings-deadline").value + ":00-03:00");
  if (!Number.isFinite(date.getTime())) {
    settingsStatus.textContent = "Informe uma data e hora válidas para o prazo.";
    return;
  }
  $("settings-save").disabled = true;
  settingsStatus.textContent = "Salvando configurações…";
  try {
    await setDoc(settingsRef, {
      prazo: Timestamp.fromDate(date),
      aberta: $("settings-open").value === "true",
      permitirAlteracoes: $("settings-changes").checked,
    });
    if (settingsSession === active) settingsStatus.textContent = "Configurações salvas.";
  } catch {
    if (settingsSession === active) settingsStatus.textContent = "Não foi possível salvar. Verifique a conexão e as regras do Firestore.";
  } finally {
    if (settingsSession === active) $("settings-save").disabled = false;
  }
});

function inviteCode(person) {
  return codePattern.test(person.conviteCodigo ?? "") ? person.conviteCodigo : null;
}

function scopedPeople(active) {
  return active.people.filter((person) => inviteCode(person) && (person.conviteFamiliaId ?? null) === active.familyId);
}

function clearInviteLink() {
  $("invite-result").hidden = true;
  for (const id of ["invite-code", "invite-link"]) $(id).value = "";
  $("invite-access").textContent = "";
  $("share-invite").removeAttribute("href");
}

function showInviteLink(code, people) {
  const link = new URL("confirmacao.html", location.href);
  link.hash = "convite=" + code;
  const whatsapp = new URL("https://wa.me/");
  whatsapp.searchParams.set("text", "Olá! Use este convite para responder sobre sua presença no casamento: " + link.href);
  $("invite-code").value = code;
  $("invite-link").value = link.href;
  $("invite-access").textContent = "Pessoas com acesso: " + people.map(({ nome }) => nome).join(", ");
  $("share-invite").href = whatsapp.href;
  $("invite-result").hidden = false;
}

function updateInviteButtons(active) {
  $("create-invite").textContent = active.people.some(inviteCode) ? "Gerar novo convite" : "Gerar convite";
  $("create-invite").disabled = active.busy || !active.people.length;
  $("revoke-invite").hidden = !scopedPeople(active).length;
  $("revoke-invite").disabled = active.busy;
  $("invite-close").disabled = active.busy;
}

export async function openInviteAdmin(people, familyId = null) {
  const active = { people, familyId, busy: true };
  invitation = active;
  clearInviteLink();
  $("invite-title").textContent = familyId ? "Convite familiar" : "Convite individual";
  $("invite-people").textContent = people.map(({ nome }) => nome).join(", ");
  $("invite-message").textContent = "Consultando convite…";
  updateInviteButtons(active);
  invite.showModal();

  try {
    const linked = scopedPeople(active);
    const codes = [...new Set(linked.map(inviteCode))];
    if (codes.length === 1) {
      const [code] = codes;
      const current = (await getDocFromServer(doc(db, "convites", code))).data();
      if (invitation !== active) return;
      const authorized = linked.filter(({ id }) => current?.pessoas?.includes(id));
      if (authorized.length) {
        showInviteLink(code, authorized);
        $("invite-message").textContent = "Compartilhe o código somente com as pessoas autorizadas.";
      } else {
        $("invite-message").textContent = "O link anterior está indisponível. Gere um novo convite.";
      }
    } else {
      $("invite-message").textContent = codes.length > 1
        ? "O grupo tem mais de um código registrado. Gere um novo convite para reunir as pessoas em um único link."
        : people.length ? "Nenhum convite ativo para esta opção." : "Cadastre convidados neste grupo antes de gerar o link.";
    }
  } catch {
    if (invitation === active) $("invite-message").textContent = "Não foi possível consultar o convite. Verifique a conexão.";
  } finally {
    if (invitation === active) {
      active.busy = false;
      updateInviteButtons(active);
    }
  }
}

$("invite-close").addEventListener("click", () => invite.close());
invite.addEventListener("cancel", (event) => {
  if (invitation?.busy) event.preventDefault();
});
invite.addEventListener("close", () => {
  invitation = undefined;
  clearInviteLink();
});

async function changeInvite(revoke) {
  const active = invitation;
  if (!active || active.busy) return;
  const people = revoke ? scopedPeople(active) : active.people;
  if (!people.length) return;
  if (!revoke && people.length > 100) {
    $("invite-message").textContent = "Para mais de 100 pessoas, gere convites individuais.";
    return;
  }

  const confirmation = revoke
    ? "Revogar este convite? As pessoas vinculadas a ele perderão o acesso pelo link. As respostas registradas serão mantidas."
    : "Gerar um novo convite? Os links anteriores deixarão de dar acesso às pessoas incluídas. As respostas registradas serão mantidas.";
  if ((revoke || people.some(inviteCode)) && !window.confirm(confirmation)) return;

  active.busy = true;
  updateInviteButtons(active);
  $("invite-message").textContent = revoke ? "Revogando convite…" : "Gerando convite…";
  try {
    const code = revoke ? null : Array.from(crypto.getRandomValues(new Uint8Array(24)),
      (value) => value.toString(16).padStart(2, "0")).join("");
    const ids = people.map(({ id }) => id);
    const saved = await runTransaction(db, async (transaction) => {
      if (active.familyId) {
        const group = await transaction.get(doc(db, "familias", active.familyId));
        if (!group.exists()) throw new Error("changed");
        if (!revoke) {
          const members = await getDocsFromServer(query(collection(db, "convidados"), where("familiaId", "==", active.familyId)));
          const expected = new Set(ids);
          if (members.size !== ids.length || members.docs.some(({ id }) => !expected.has(id))) throw new Error("changed");
        }
      }
      const guests = await Promise.all(ids.map((id) => transaction.get(doc(db, "convidados", id))));
      for (const [index, guest] of guests.entries()) {
        const data = guest.data();
        const original = people[index];
        if (!data || (active.familyId && data.familiaId !== active.familyId)
          || inviteCode(data) !== inviteCode(original)
          || (data.conviteFamiliaId ?? null) !== (original.conviteFamiliaId ?? null)) {
          throw new Error("changed");
        }
      }

      if (code) transaction.set(doc(db, "convites", code), { pessoas: ids });
      for (const guest of guests) {
        transaction.update(guest.ref, { conviteCodigo: code, conviteFamiliaId: code ? active.familyId : null });
        if (code) transaction.set(personRef(code, guest.id), mirrorFields(guest.data()));
      }
      return guests.map((guest) => ({
        ...guest.data(), id: guest.id, conviteCodigo: code, conviteFamiliaId: code ? active.familyId : null,
      }));
    });

    if (invitation !== active) return;
    const byId = new Map(saved.map((person) => [person.id, person]));
    active.people = active.people.map((person) => byId.get(person.id) ?? person);
    if (code) showInviteLink(code, saved);
    else clearInviteLink();
    $("invite-message").textContent = code
      ? "Convite gerado. Compartilhe somente com as pessoas autorizadas."
      : "Convite revogado. As respostas registradas foram mantidas.";
  } catch (error) {
    if (invitation !== active) return;
    if (error.message === "changed") clearInviteLink();
    $("invite-message").textContent = error.message === "changed"
      ? "O cadastro ou o convite mudou. Feche esta janela e abra a opção novamente."
      : "Não foi possível concluir a operação. Verifique a conexão e as regras do Firestore.";
  } finally {
    if (invitation === active) {
      active.busy = false;
      updateInviteButtons(active);
    }
  }
}

$("create-invite").addEventListener("click", () => void changeInvite(false));
$("revoke-invite").addEventListener("click", () => void changeInvite(true));

$("copy-invite").addEventListener("click", async () => {
  const active = invitation;
  try {
    await navigator.clipboard.writeText($("invite-link").value);
    if (invitation === active) $("invite-message").textContent = "Link copiado.";
  } catch {
    if (invitation !== active) return;
    $("invite-link").select();
    $("invite-message").textContent = "Selecione e copie o link do convite.";
  }
});
