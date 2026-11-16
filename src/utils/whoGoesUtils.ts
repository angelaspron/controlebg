import type { CSSProperties } from 'react';

export const QUEM_VAI_CARDS: string[] = [
  "Vai quem fizer a melhor imitação",
  "Vai quem foi o último a ir no banheiro",
  "Vai quem fizer o melhor truque de mágicas",
  "Vai quem tem o maior dedo mindinho",
  "Vai quem tem mais moedas no bolso",
  "Vai quem foi o último a ir para o hospital",
  "Vai quem tem o cabelo mais comprido",
  "Vai quem tem o maior pé",
  "Vai quem tem menos letras no nome completo",
  "Vai quem tem mais amigos no Facebook",
  "Vai quem for o próximo a fazer aniversário",
  "Vai quem tem mais tatuagens",
  "Vai quem nasceu mais longe daqui",
  "Vai quem foi o último a ver um fantasma",
  "Vai quem tem mais jogos de tabuleiro",
  "Vai quem tem mais irmãos",
  "Vai quem tem menos bateria no celular",
  "Vai quem pula mais alto",
  "Vai quem tem a maior cicatriz",
  "Vai quem teve a maior queimadura",
  "Vai quem tem mais alarmes configurados no celular",
  "Vai quem tem mais botões na roupa",
  "Vai quem tem mais cores diferentes na roupa",
  "Vai quem tem mais vogais no primeiro nome",
  "Vai quem nasceu no dia de número mais alto",
  "Vai quem tem mais cores diferentes no calçado",
  "Vai quem tem menos espaço de armazenamento disponível no celular"
];

export function getCardSpriteStyle(cardIndex: number): CSSProperties {
  const safeIndex = Math.max(0, Math.min(QUEM_VAI_CARDS.length - 1, cardIndex));
  
  return {
    backgroundImage: `url('/boardgame-cards/quem-vai-cards/card-${safeIndex}.png')`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  };
}

