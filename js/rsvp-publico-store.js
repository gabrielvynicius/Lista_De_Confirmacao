import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  browserLocalPersistence, initializeAuth, setPersistence, signInAnonymously,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection, doc, getDocFromServer, getDocsFromServer, getFirestore, runTransaction, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "../config/firebase-config.js";

const app = initializeApp(firebaseConfig, "rsvp-publico");
const db = getFirestore(app);
let auth;
let session;

export const isDemo = false;

async function authenticate() {
  auth ??= initializeAuth(app, { persistence: browserLocalPersistence });
  await auth.authStateReady();
  await setPersistence(auth, browserLocalPersistence);
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  if (!user.isAnonymous) throw new Error("session");
  return user.uid;
}

export function connect() {
  session ??= (navigator.locks
    ? navigator.locks.request("rsvp-publico-auth", authenticate)
    : authenticate()).catch((error) => {
    session = undefined;
    throw error;
  });
  return session;
}

export async function readSettings() {
  const [activation, wedding] = await Promise.all([
    getDocFromServer(doc(db, "configuracoes", "rsvpPublico")),
    getDocFromServer(doc(db, "configuracoes", "casamento")),
  ]);
  const settings = wedding.data();
  return {
    enabled: activation.data()?.ativa === true && settings?.aberta === true,
    deadline: settings?.prazo?.toMillis?.() ?? null,
    editing: settings?.permitirAlteracoes === true,
  };
}

export async function readResponses(uid) {
  const snapshot = await getDocsFromServer(collection(db, "rsvpEnvios", uid, "rsvpPessoas"));
  return snapshot.docs.map((person) => ({ ...person.data(), slot: person.id }));
}

export function saveBatch(uid, entries) {
  if (auth.currentUser?.uid !== uid) throw new Error("session");
  return runTransaction(db, async (transaction) => {
    const refs = entries.map(({ slot }) => doc(db, "rsvpEnvios", uid, "rsvpPessoas", slot));
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));

    for (const [index, entry] of entries.entries()) {
      const { nome, classificacao, status, baseVersion, eventoId } = entry;
      const current = snapshots[index].data();
      const estado = { nome, classificacao, status, versao: baseVersion + 1 };
      const alreadySaved = current?.eventoId === eventoId
        && Object.entries(estado).every(([key, value]) => current[key] === value);
      if (alreadySaved) continue;
      if (baseVersion === 0 ? current : current?.versao !== baseVersion) throw new Error("conflict");

      const timestamp = serverTimestamp();
      const data = { ...estado, eventoId, atualizadoEm: timestamp };
      const person = refs[index];
      if (baseVersion === 0) transaction.set(person, { ...data, criadoEm: timestamp });
      else transaction.update(person, data);
      transaction.set(doc(person, "historico", eventoId), {
        tipo: baseVersion === 0 ? "criacao" : "alteracao", origem: "convidado", em: timestamp, estado,
      });
    }
  });
}
