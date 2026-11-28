import {
  doc, getDocFromServer, runTransaction, setDoc, Timestamp,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "../config/firebase-config.js";
import { mirrorFields, personRef, settingsRef } from "./rsvp-model.js";

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
  $("invite-link").value = "";
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

export function openInviteAdmin(people, familyId = null) {
  invitation = { people, familyId };
  $("invite-people").textContent = people.map(({ nome }) => nome).join(", ");
  $("invite-link").value = "";
  $("invite-result").hidden = true;
  $("invite-message").textContent = people.length ? "" : "Cadastre convidados neste grupo antes de gerar o link.";
  $("create-invite").disabled = !people.length;
  invite.showModal();
}

$("invite-close").addEventListener("click", () => invite.close());
invite.addEventListener("cancel", (event) => {
  if (invitation?.saving) event.preventDefault();
});
invite.addEventListener("close", () => {
  invitation = undefined;
  $("invite-link").value = "";
});

$("create-invite").addEventListener("click", async () => {
  const active = invitation;
  if (!active || !active.people.length || active.saving) return;
  if (active.people.length > 100) {
    $("invite-message").textContent = "Para mais de 100 pessoas, gere convites individuais.";
    return;
  }
  active.saving = true;
  $("create-invite").disabled = $("invite-close").disabled = true;
  $("invite-message").textContent = "Gerando convite…";
  try {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(24)),
      (value) => value.toString(16).padStart(2, "0")).join("");
    const ids = active.people.map(({ id }) => id);
    await runTransaction(db, async (transaction) => {
      const guests = await Promise.all(ids.map((id) => transaction.get(doc(db, "convidados", id))));
      if (guests.some((guest) => !guest.exists() || (active.familyId && guest.data().familiaId !== active.familyId))) {
        throw new Error("changed");
      }
      transaction.set(doc(db, "convites", code), { pessoas: ids });
      for (const guest of guests) {
        transaction.update(guest.ref, { conviteCodigo: code, conviteFamiliaId: active.familyId });
        transaction.set(personRef(code, guest.id), mirrorFields(guest.data()));
      }
    });
    if (invitation !== active) return;
    const link = new URL("confirmacao.html", location.href);
    link.hash = "convite=" + code;
    $("invite-link").value = link.href;
    $("invite-result").hidden = false;
    $("invite-message").textContent = "Convite gerado. Compartilhe somente com as pessoas autorizadas.";
    $("invite-link").select();
  } catch (error) {
    if (invitation !== active) return;
    $("invite-message").textContent = error.message === "changed"
      ? "Os convidados do grupo mudaram. Feche esta janela e tente novamente."
      : "Não foi possível gerar o convite. Verifique a conexão e as regras do Firestore.";
    $("create-invite").disabled = false;
  } finally {
    if (invitation === active) {
      active.saving = false;
      $("invite-close").disabled = false;
    }
  }
});

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
