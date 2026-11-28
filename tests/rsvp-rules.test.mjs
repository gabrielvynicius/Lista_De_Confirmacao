import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { formatGuestName } from "../js/names.js";

const port = Number(process.env.FIRESTORE_EMULATOR_PORT ?? "8796");
assert.ok(Number.isInteger(port) && port > 0 && port <= 65535, "Porta do emulador inválida");

const emulator = `http://127.0.0.1:${port}`;
const project = "demo-rsvp-publico";
const database = `projects/${project}/databases/(default)`;
const documents = database + "/documents";
const api = `${emulator}/v1/${documents}`;
const owner = "owner";

function token(uid, provider = "anonymous") {
  // O emulador oficial aceita tokens sem assinatura. Este helper só acessa loopback.
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return encode({ alg: "none", typ: "JWT" }) + "." + encode({
    sub: uid,
    user_id: uid,
    aud: project,
    iss: `https://securetoken.google.com/${project}`,
    iat: now,
    exp: now + 3600,
    firebase: { sign_in_provider: provider },
  }) + ".";
}

const ana = token("ana");
const bia = token("bia");
const admin = token("admin", "password");
const personPath = (uid, slot = "1") => `rsvpEnvios/${uid}/rsvpPessoas/${slot}`;
const snapshot = { nome: "JOÃO D’ÁVILA-SÁ", classificacao: "adulto", status: "confirmado", versao: 1 };

function firestoreValue(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "object") return { mapValue: { fields: fields(value) } };
  return { stringValue: value };
}

function fields(value) {
  return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, firestoreValue(item)]));
}

function request(suffix, auth, method = "GET", payload) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = "Bearer " + auth;
  return fetch(api + suffix, { method, headers, body: payload && JSON.stringify(payload) });
}

async function expect(response, code) {
  const result = await response;
  const body = await result.json().catch(() => null);
  assert.equal(result.status, code, JSON.stringify(body));
  return body;
}

function put(path, value, auth = owner) {
  return request("/" + path, auth, "PATCH", { fields: fields(value) });
}

function wedding({ open = true, editing = true, expired = false } = {}) {
  const prazo = new Date(Date.now() + (expired ? -1 : 1) * 86400000);
  return expect(put("configuracoes/casamento", { aberta: open, permitirAlteracoes: editing, prazo }), 200);
}

function commit(auth, writes) {
  return request(":commit", auth, "POST", { writes });
}

const serverTimestamp = (fieldPath) => ({ fieldPath, setToServerValue: "REQUEST_TIME" });

function event(path, id, kind, origin, state) {
  return {
    update: { name: `${documents}/${path}/historico/${id}`, fields: fields({ tipo: kind, origem: origin, estado: state }) },
    currentDocument: { exists: false },
    updateTransforms: [serverTimestamp("em")],
  };
}

function create(path, state = snapshot, extra = {}) {
  return [
    {
      update: { name: `${documents}/${path}`, fields: fields({ ...state, eventoId: "inicio", ...extra }) },
      currentDocument: { exists: false },
      updateTransforms: [serverTimestamp("criadoEm"), serverTimestamp("atualizadoEm")],
    },
    event(path, "inicio", "criacao", "convidado", state),
  ];
}

function edit(path, state, origin = "convidado", eventId = randomUUID()) {
  const { nome, classificacao, status, versao } = state;
  return [
    {
      update: { name: `${documents}/${path}`, fields: fields({ nome, classificacao, status, versao, eventoId: eventId }) },
      updateMask: { fieldPaths: ["nome", "classificacao", "status", "versao", "eventoId"] },
      currentDocument: { exists: true },
      updateTransforms: [serverTimestamp("atualizadoEm")],
    },
    event(path, eventId, "alteracao", origin, state),
  ];
}

test("regras do RSVP público no emulador oficial", async (t) => {
  // Apaga apenas o projeto de demonstração deste teste no emulador local.
  const reset = await fetch(`${emulator}/emulator/v1/${database}/documents`, { method: "DELETE" });
  assert.ok(reset.ok, "Inicie um emulador com as regras do repositório");
  await expect(put("administradores/admin", { role: "admin", ativo: true }), 200);
  await expect(put("administradores/inativo", { role: "admin", ativo: false }), 200);
  await expect(put("convidados/legado", { nome: "LEGADO", status: "pendente", classificacao: "adulto" }), 200);

  const first = personPath("ana");
  const updated = { ...snapshot, status: "ausente", versao: 2 };

  await t.test("ativação, validação e isolamento no cadastro", async () => {
    await wedding();
    await expect(commit(ana, create(first)), 403);
    await expect(put("configuracoes/rsvpPublico", { ativa: true }, ana), 403);
    await expect(put("configuracoes/rsvpPublico", { ativa: true }, admin), 200);
    await expect(commit(undefined, create(first)), 403);
    await expect(commit(bia, create(first)), 403);
    await expect(commit(token("ana", "password"), create(first)), 403);
    await expect(commit(ana, create(personPath("ana", "13"))), 403);
    await expect(commit(ana, create(personPath("ana", "01"))), 403);
    for (const nome of ["ANA 2", "ANA ٢", "ANA 😀", "ANA  SILVA", " ANA", "ANA ", "ANA!", "ANA\uFE0F", "ANA\u20E3", "A".repeat(161)]) {
      await expect(commit(ana, create(first, { ...snapshot, nome })), 403);
    }
    await expect(commit(ana, create(first, { ...snapshot, classificacao: "senior" })), 403);
    await expect(commit(ana, create(first, { ...snapshot, status: "pendente" })), 403);
    await expect(commit(ana, create(first, snapshot, { telefone: "Privado" })), 403);
    await expect(commit(ana, create(first, snapshot, { observacoes: "Privado" })), 403);
    await expect(commit(ana, create(first).slice(0, 1)), 403);
    const badEvent = create(first);
    badEvent[1] = event(first, "inicio", "criacao", "convidado", { ...snapshot, status: "ausente" });
    await expect(commit(ana, badEvent), 403);
    await expect(commit(ana, create(first)), 200);
  });

  await t.test("consulta própria e listagem administrativa sem exposição a terceiros", async () => {
    await expect(request("/" + first, ana), 200);
    await expect(request("/rsvpEnvios/ana/rsvpPessoas", ana), 200);
    for (const auth of [undefined, bia, token("ana", "password"), token("inativo", "password")]) {
      await expect(request("/" + first, auth), 403);
      await expect(request("/rsvpEnvios/ana/rsvpPessoas", auth), 403);
    }
    await expect(request("/convidados/legado", ana), 403);
    await expect(request("/convidados/legado", admin), 200);
    await expect(request("/" + first + "/historico/inicio", ana), 403);
    await expect(request("/" + first + "/historico/inicio", admin), 200);
    const all = { structuredQuery: { from: [{ collectionId: "rsvpPessoas", allDescendants: true }] } };
    await expect(request(":runQuery", admin, "POST", all), 200);
    await expect(request(":runQuery", ana, "POST", all), 403);
  });

  await t.test("reenvio simultâneo, lotes e homônimos", async () => {
    const path = personPath("ana", "2");
    const writes = create(path);
    const results = await Promise.all([commit(ana, writes), commit(ana, writes)]);
    assert.equal(results.filter(({ ok }) => ok).length, 1);
    assert.ok([403, 409].includes(results.find(({ ok }) => !ok).status));
    await expect(request("/" + path + "/historico", admin), 200);
    await expect(commit(ana, create(path)), 403);
    const names = ["Luz", "Ana d'Ávila‑Sá", "李 小龍", "María Álvarez"];
    const people = names.flatMap((nome, i) =>
      create(personPath("ana", String(i + 3)), { ...snapshot, nome: formatGuestName(nome) }));
    await expect(commit(ana, people), 200);
    await expect(commit(ana, create(personPath("ana", "12"))), 200);
    const list = await expect(request("/rsvpEnvios/ana/rsvpPessoas", ana), 200);
    assert.equal(list.documents.length, 7);
    assert.equal(list.documents.filter((item) => item.fields.nome.stringValue === snapshot.nome).length, 3);
  });

  await t.test("edição e histórico atômicos, com bloqueio do prazo pelo servidor", async () => {
    await expect(commit(bia, edit(first, updated)), 403);
    await expect(commit(ana, edit(first, { ...updated, versao: 3 })), 403);
    await expect(commit(ana, edit(first, updated).slice(0, 1)), 403);
    await expect(commit(ana, edit(first, updated).slice(1)), 403);
    await expect(commit(ana, edit(first, updated, "administracao")), 403);
    const badTime = edit(first, updated);
    badTime[0].updateMask.fieldPaths.push("criadoEm");
    badTime[0].update.fields.criadoEm = firestoreValue(new Date(0));
    await expect(commit(ana, badTime), 403);
    await wedding({ editing: false });
    await expect(commit(ana, edit(first, updated)), 403);
    const editsDisabledNew = personPath("bia");
    await expect(commit(bia, create(editsDisabledNew)), 200);
    await wedding({ expired: true });
    await expect(commit(ana, edit(first, updated)), 403);
    await expect(commit(bia, create(personPath("bia", "2"))), 403);
    await expect(request("/" + first, ana), 200);
    await expect(request("/" + first, ana, "DELETE"), 403);
    await wedding({ open: false });
    await expect(commit(ana, edit(first, updated)), 403);
    await wedding();
    await expect(put("configuracoes/rsvpPublico", { ativa: false }, admin), 200);
    await expect(commit(ana, edit(first, updated)), 403);
    await expect(request("/" + first, ana), 200);
    await expect(put("configuracoes/rsvpPublico", { ativa: true }, admin), 200);
    const writes = edit(first, updated);
    await expect(commit(ana, writes), 200);
    await expect(commit(ana, writes), 403);
    await expect(request("/" + first + "/historico/inicio", admin, "DELETE"), 403);
    await expect(put(first + "/historico/inicio", { tipo: "alteracao" }, admin), 403);
  });

  await t.test("admin edita e exclui após o prazo preservando o histórico", async () => {
    await wedding({ expired: true });
    const finalState = { ...updated, status: "indeciso", versao: 3 };
    await expect(commit(admin, edit(first, finalState, "administracao")), 200);
    await expect(request("/" + first, admin, "DELETE"), 403);
    const writes = [
      { delete: `${documents}/${first}`, currentDocument: { exists: true } },
      event(first, "exclusao", "exclusao", "administracao", finalState),
    ];
    await expect(commit(ana, writes), 403);
    await expect(commit(admin, writes), 200);
    await expect(request("/" + first, ana), 404);
    const history = await expect(request("/" + first + "/historico", admin), 200);
    assert.deepEqual(history.documents.map((item) => item.fields.tipo.stringValue).sort(),
      ["alteracao", "alteracao", "criacao", "exclusao"]);
    await wedding();
    await expect(commit(ana, create(first)), 403);
    await expect(request("/convidados/legado", admin), 200);
  });
});
