import { doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "../config/firebase-config.js";

export const statuses = { pendente: "Sem resposta", confirmado: "Confirmado", ausente: "Ausente", indeciso: "Indeciso" };
export const ages = { crianca: "Criança de até 7 anos", adolescente: "De 8 a 17 anos", adulto: "18 anos ou mais" };
export const answers = {
  confirmado: "Sim, estarei presente!",
  ausente: "Infelizmente, não poderei comparecer.",
  indeciso: "Ainda estou indeciso(a).",
};
export const codePattern = /^[a-f0-9]{48}$/;
export const maxResponses = 4;
export const settingsRef = doc(db, "configuracoes", "casamento");
const formatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function formatDate(timestamp) {
  return timestamp?.toDate ? formatter.format(timestamp.toDate()) : "";
}

export function normalizeName(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/gu, " ");
}

export function statusOf(guest) {
  return Object.hasOwn(statuses, guest.status) ? guest.status : "pendente";
}

export function personRef(code, id) {
  return doc(db, "convites", code, "pessoas", id);
}

export function mirrorFields(guest) {
  return {
    nome: guest.nome,
    status: statusOf(guest),
    classificacao: Object.hasOwn(ages, guest.classificacao) ? guest.classificacao : null,
    primeiraRespostaEm: guest.primeiraRespostaEm ?? null,
    ultimaAlteracaoRespostaEm: guest.ultimaAlteracaoRespostaEm ?? null,
  };
}

export function recordResponse(transaction, guestRef, previous, fields, origin) {
  const event = doc(guestRef, "historico", crypto.randomUUID());
  const now = serverTimestamp();
  const changes = {
    status: fields.status,
    classificacao: fields.classificacao,
    nomeInformado: fields.nomeInformado,
    primeiraRespostaEm: previous.primeiraRespostaEm ?? (fields.status === "pendente" ? null : now),
    ultimaAlteracaoRespostaEm: now,
    historicoId: event.id,
  };
  transaction.set(event, {
    status: changes.status,
    classificacao: changes.classificacao,
    nomeInformado: changes.nomeInformado,
    em: now,
    origem: origin,
  });
  return changes;
}
