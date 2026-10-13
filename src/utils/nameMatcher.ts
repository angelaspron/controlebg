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
 * Stopwords e palavras comuns / temáticas em títulos de jogos de tabuleiro
 */
const COMMON_GAME_WORDS = new Set([
  'game', 'jogo', 'board', 'cards', 'cartas', 'deluxe', 'edition', 'edicao',
  'versao', 'version', 'the', 'of', 'and', 'a', 'an', 'in', 'on', 'os', 'as',
  'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na',
  // Palavras temáticas genéricas e termos de franquia que não identificam um jogo exclusivamente
  'castles', 'castle', 'marvel', 'star', 'wars', 'dune', 'chronicles', 'tales',
  'legends', 'legend', 'heroes', 'hero', 'battles', 'battle', 'age', 'world',
  'city', 'quest', 'kingdom', 'island', 'century', 'king', 'kings', 'lord',
  'lords', 'realm', 'realms', 'adventures', 'adventure', 'war', 'empire'
]);

// Mapeamento de termos comuns traduzidos (PT <-> EN)
const TRANSLATION_MAP: Record<string, string> = {
  'ruinas': 'ruins',
  'perdidas': 'lost',
  'colonizadores': 'settlers',
  'ilha': 'island',
  'castelo': 'castle',
  'castelos': 'castles',
};

/**
 * Palavras que identificam edições, versões ou especificações de fabricação/localização
 */
const EDITION_OR_VERSION_WORDS = new Set([
  'edicao', 'edition', 'versao', 'version', 'deluxe', 'collector', 'collectors',
  'brasileira', 'brasil', 'brazilian', 'nacional', 'internacional', 'segunda',
  'second', 'terceira', 'third', 'quarta', 'fourth', 'reimpressao'
]);

/**
 * Prefixos e afixos conhecidos de títulos consolidados de jogos base e suas traduções
 */
const KNOWN_TITLE_AFFIXES = new Set([
  'ruinas', 'perdidas', 'lost', 'ruins', 'settlers', 'colonizadores'
]);

function stemOrTranslate(w: string): string {
  return TRANSLATION_MAP[w] || w;
}

/**
 * Verifica se uma string de nome possui subtítulo temático característico de expansão ou título derivado
 * (Ex: "Wyrmspan: Academia dos Dragões", "Terraforming Mars: Prelúdio")
 */
export function hasExpansionSubtitle(rawName: string): boolean {
  if (!rawName) return false;
  const match = rawName.match(/[:\-\u2013]\s*(.+)$/);
  if (!match) return false;
  const subNorm = normalizeGameName(match[1]);
  const subWords = subNorm.split(' ')
    .filter(w => w.length >= 3 && !COMMON_GAME_WORDS.has(w) && !EDITION_OR_VERSION_WORDS.has(w));
  return subWords.length > 0;
}

/**
 * Compara dois nomes de jogos com tolerância para aliases, traduções e nomes parciais
 * (Ex: "Arnak" <-> "As Ruínas Perdidas de Arnak" <-> "Lost Ruins of Arnak")
 * Protege estritamente contra falsos positivos entre Jogos Base e Expansões e títulos distintos da mesma franquia.
 */
export function matchesGameName(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  const n1 = normalizeGameName(name1);
  const n2 = normalizeGameName(name2);

  // 1. Igualdade exata após normalização
  if (n1 === n2) return true;

  // 2. Proteção estrita contra colisão entre Jogo Base e Expansão (por subtítulo temático ou flag)
  const hasSub1 = hasExpansionSubtitle(name1);
  const hasSub2 = hasExpansionSubtitle(name2);
  if (hasSub1 !== hasSub2) return false;

  const isExp1 = n1.includes('expans') || n1.includes('expansion');
  const isExp2 = n2.includes('expans') || n2.includes('expansion');
  if (isExp1 !== isExp2) return false;

  // 3. Proteção contra numerais distintos (ex: "Page 1 Game" vs "Page 2 Game", "Season 1" vs "Season 2")
  const nums1 = (n1.match(/\b\d+\b/g) || []).join(' ');
  const nums2 = (n2.match(/\b\d+\b/g) || []).join(' ');
  if (nums1 && nums2 && nums1 !== nums2) return false;

  // 3. Tokenização e comparação por palavras significativas
  const words1 = n1.split(' ')
    .filter(w => w.length >= 3 && !COMMON_GAME_WORDS.has(w))
    .map(stemOrTranslate);
  const words2 = n2.split(' ')
    .filter(w => w.length >= 3 && !COMMON_GAME_WORDS.has(w))
    .map(stemOrTranslate);

  if (words1.length > 0 && words2.length > 0) {
    const [shorterWords, longerWords] = words1.length <= words2.length ? [words1, words2] : [words2, words1];

    // Se o nome mais curto tem apenas 1 palavra distinta (ex: "arnak", "gloomhaven", "scythe")
    if (shorterWords.length === 1 && shorterWords[0].length >= 4 && !COMMON_GAME_WORDS.has(shorterWords[0])) {
      if (longerWords.includes(shorterWords[0])) {
        // As demais palavras do nome mais longo devem ser apenas qualificadores conhecidos ou termos de edição
        const extraWords = longerWords.filter(
          w => w !== shorterWords[0] && !EDITION_OR_VERSION_WORDS.has(w) && !KNOWN_TITLE_AFFIXES.has(w)
        );
        if (extraWords.length === 0) {
          return true;
        }
      }
    }

    // Se todas as palavras significativas do nome mais curto estão no nome mais longo
    if (shorterWords.length > 1 && shorterWords.every(w => longerWords.includes(w))) {
      const extraWords = longerWords.filter(
        w => !shorterWords.includes(w) && !EDITION_OR_VERSION_WORDS.has(w) && !KNOWN_TITLE_AFFIXES.has(w)
      );
      if (extraWords.length === 0) {
        return true;
      }
    }
  }

  return false;
}
