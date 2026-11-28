// Cada parte começa com uma letra. Hífens e apóstrofos são preservados entre partes.
const namePattern = /^\p{L}[\p{L}\p{M}]*(?:[ '\u2019\u2010\u2011-]\p{L}[\p{L}\p{M}]*)*$/u;
const emojiPattern = /[\p{Extended_Pictographic}\p{Variation_Selector}\u20e3]/u;
const maxNameLength = 160;

function cleanSpaces(value) {
  return value.trim().replace(/\s+/gu, " ");
}

export function formatGuestName(value) {
  const cleaned = cleanSpaces(value).normalize("NFC");
  if (!cleaned) throw new Error("Informe o nome completo do convidado.");
  if (!namePattern.test(cleaned) || emojiPattern.test(cleaned)) {
    throw new Error("Use apenas letras, espaços, hífens e apóstrofos no nome. Números e emojis não são aceitos.");
  }

  const name = cleaned.toLocaleUpperCase("pt-BR").normalize("NFC");
  if (name.length > maxNameLength) throw new Error("O nome deve ter até 160 caracteres.");
  return name;
}

// Uma chave serve para comparação e busca. A identidade continua sendo o ID do convidado.
export function normalizeName(value) {
  const letters = value.normalize("NFD").replace(/\p{M}/gu, "");
  return cleanSpaces(letters.toLocaleUpperCase("pt-BR").toLocaleLowerCase("pt-BR"));
}
