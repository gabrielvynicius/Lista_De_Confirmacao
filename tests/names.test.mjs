import assert from "node:assert/strict";
import test from "node:test";
import { formatGuestName, normalizeName } from "../js/names.js";

const validNames = [
  ["GaBriEL VyniCius", "GABRIEL VYNICIUS"],
  ["ana claudia", "ANA CLAUDIA"],
  ["João da Silva", "JOÃO DA SILVA"],
  ["Maria   Aparecida", "MARIA APARECIDA"],
  ["  Ana\u00a0\tD’Ávila-Sá  ", "ANA D’ÁVILA-SÁ"],
  ["d'Ávila‑Sá", "D'ÁVILA‑SÁ"],
  ["Luz", "LUZ"],
  ["Joa\u0303o", "JOÃO"],
  ["Aparecidaa", "APARECIDAA"],
  ["李 小龍", "李 小龍"],
  ["नम्रता", "नम्रता"],
];

for (const [input, expected] of validNames) {
  test(`formata ${JSON.stringify(input)} preservando a grafia`, () => {
    assert.equal(formatGuestName(input), expected);
  });
}

for (const name of ["Ana 2", "Maria ٢", "João 😀", "Ana👩🏽‍💻", "Ana🇧🇷", "A\uFE0F", "A\u20E3", "Ana!", "-Ana"]) {
  test(`rejeita caracteres inválidos em ${JSON.stringify(name)}`, () => {
    assert.throws(() => formatGuestName(name), /letras, espaços, hífens e apóstrofos/);
  });
}

test("rejeita nomes vazios ou compostos apenas de espaços", () => {
  assert.throws(() => formatGuestName(""), /Informe o nome/);
  assert.throws(() => formatGuestName(" \t\u00a0"), /Informe o nome/);
});

test("valida o comprimento após converter o nome para maiúsculas", () => {
  assert.equal(formatGuestName("a".repeat(160)).length, 160);
  assert.throws(() => formatGuestName("ß".repeat(81)), /até 160 caracteres/);
});

test("compara ignorando acentos, capitalização e espaços excedentes", () => {
  assert.equal(normalizeName("  JOÃO\u00a0 da   SILVA  "), normalizeName("Joao da Silva"));
  assert.equal(normalizeName("D’ÁVILA-SÁ"), "d’avila-sa");
  assert.equal(normalizeName("Straße"), normalizeName(formatGuestName("Straße")));
});

test("preserva a separação entre palavras e a grafia na comparação", () => {
  assert.notEqual(normalizeName("Ana Maria"), normalizeName("Anamaria"));
  assert.notEqual(normalizeName("Aparecidaa"), normalizeName("Aparecida"));
});
