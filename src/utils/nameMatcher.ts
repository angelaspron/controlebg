/**
 * Normaliza um nome de jogo removendo diacríticos, pontuação e espaços extras.
 */
export function normalizeGameName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stopwords e palavras comuns em títulos de jogos de tabuleiro
 */
const COMMON_GAME_WORDS = new Set([
  'game', 'jogo', 'board', 'cards', 'cartas', 'deluxe', 'edition', 'edicao',
  'versao', 'version', 'the', 'of', 'and', 'a', 'an', 'in', 'on', 'os', 'as',
  'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na'
]);

/**
 * Compara dois nomes de jogos com tolerância para aliases, traduções e nomes parciais
 * (Ex: "Arnak" <-> "As Ruínas Perdidas de Arnak" <-> "Lost Ruins of Arnak")
 * Protege contra falsos positivos entre Jogos Base e Expansões.
 */
export function matchesGameName(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  const n1 = normalizeGameName(name1);
  const n2 = normalizeGameName(name2);

  // 1. Igualdade exata após normalização
  if (n1 === n2) return true;

  // 2. Proteção estrita contra colisão entre Jogo Base e Expansão
  const isExp1 = n1.includes('expans') || n1.includes('expansion');
  const isExp2 = n2.includes('expans') || n2.includes('expansion');
  if (isExp1 !== isExp2) return false;

  // 3. Substring direta se o termo mais curto tiver pelo menos 4 caracteres não genéricos
  const [shorterStr, longerStr] = n1.length <= n2.length ? [n1, n2] : [n2, n1];
  if (shorterStr.length >= 4 && !COMMON_GAME_WORDS.has(shorterStr)) {
    const regex = new RegExp(`\\b${shorterStr}\\b`, 'i');
    if (regex.test(longerStr)) {
      return true;
    }
  }

  // 4. Tokenização e comparação por palavras significativas
  const words1 = n1.split(' ').filter(w => w.length >= 3 && !COMMON_GAME_WORDS.has(w));
  const words2 = n2.split(' ').filter(w => w.length >= 3 && !COMMON_GAME_WORDS.has(w));

  if (words1.length > 0 && words2.length > 0) {
    const [shorterWords, longerWords] = words1.length <= words2.length ? [words1, words2] : [words2, words1];

    // Se o nome mais curto tem apenas 1 palavra distinta (ex: "arnak", "gloomhaven", "scythe")
    if (shorterWords.length === 1 && shorterWords[0].length >= 4) {
      if (longerWords.includes(shorterWords[0])) {
        return true;
      }
    }

    // Se todas as palavras significativas do nome mais curto estão no nome mais longo
    if (shorterWords.length > 1 && shorterWords.every(w => longerWords.includes(w))) {
      return true;
    }

    // Identificação de token chave distintivo (comprimento >= 5, como "arnak", "wingspan")
    const sharedDistinctive = words1.filter(w => w.length >= 5 && words2.includes(w));
    if (sharedDistinctive.length > 0) {
      return true;
    }
  }

  return false;
}
