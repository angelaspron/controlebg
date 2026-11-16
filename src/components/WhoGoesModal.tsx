import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Dices, ExternalLink } from 'lucide-react';
import { QUEM_VAI_CARDS, getCardSpriteStyle } from '../utils/whoGoesUtils';
import '../components.css';

export interface WhoGoesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number | null;
}

export function WhoGoesModal({ isOpen, onClose, initialIndex }: WhoGoesModalProps) {
  const deckRef = useRef<number[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [remainingCount, setRemainingCount] = useState<number>(QUEM_VAI_CARDS.length);
  const [animationKey, setAnimationKey] = useState<number>(0);

  const drawNextCard = useCallback(() => {
    let currentDeck = deckRef.current.length > 0 
      ? [...deckRef.current] 
      : QUEM_VAI_CARDS.map((_, idx) => idx);

    const randomIndex = Math.floor(Math.random() * currentDeck.length);
    const chosenCard = currentDeck.splice(randomIndex, 1)[0];

    if (chosenCard !== undefined) {
      deckRef.current = currentDeck;
      setCurrentCardIndex(chosenCard);
      setRemainingCount(currentDeck.length);
      setAnimationKey(prev => prev + 1);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialIndex !== undefined && initialIndex !== null) {
        setCurrentCardIndex(initialIndex);
      } else {
        drawNextCard();
      }
    }
  }, [isOpen, initialIndex, drawNextCard]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' || e.key === 'Enter') {
        drawNextCard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, drawNextCard]);

  if (!isOpen) return null;

  const currentText = QUEM_VAI_CARDS[currentCardIndex] || "Vai quem começar primeiro";
  const spriteStyle = getCardSpriteStyle(currentCardIndex);

  return (
    <div 
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div 
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '1.75rem',
          position: 'relative',
          maxHeight: '92vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          borderRadius: '16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '50%',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          title="Fechar (Esc)"
        >
          <X size={22} />
        </button>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
          <Dices size={24} color="var(--accent)" /> Quem vai ?
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 1.25rem 0' }}>
          Uma carta escolhe quem começa a partida.
        </p>

        {/* Card visual estilo Family Guy */}
        <div 
          key={animationKey}
          style={{
            width: '100%',
            maxWidth: '310px',
            backgroundColor: '#efe4cb',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
            border: '2px solid rgba(255, 255, 255, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            color: '#25211d',
            animation: 'board-who-goes-reveal 0.25s ease-out',
          }}
        >
          <div 
            style={{
              ...spriteStyle,
              aspectRatio: '3 / 4',
              width: '100%',
              backgroundColor: '#dbeafe',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }}
            role="img"
            aria-label={currentText}
          />
          <div style={{
            padding: '1rem 1.1rem 1.25rem',
            minHeight: '4.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontWeight: 800,
            fontSize: '1.08rem',
            lineHeight: '1.28',
            color: '#25211d',
            backgroundColor: '#efe4cb',
          }}>
            {currentText}
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div style={{
          marginTop: '1.25rem',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {remainingCount === 0
              ? "Baralho completo. O próximo sorteio começa uma nova rodada."
              : remainingCount === 1
              ? "Resta 1 carta nesta rodada."
              : `Restam ${remainingCount} cartas nesta rodada.`}
          </div>

          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={drawNextCard}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              maxWidth: '280px',
              padding: '0.65rem 1.2rem',
              fontSize: '0.95rem',
              fontWeight: 600,
            }}
          >
            <Dices size={18} />
            Sortear outra
          </button>

          <a 
            href="https://ludopedia.com.br/jogo/quem-vai" 
            target="_blank" 
            rel="noreferrer"
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
              marginTop: '0.1rem',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#38bdf8'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            Inspirado no jogo Quem Vai? (Ludopedia)
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
