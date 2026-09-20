import { useState, useEffect, useRef, useMemo } from 'react';
import type { GameData } from '../types';
import { GameCard } from './GameCard';

interface VirtualGameGridProps {
  games: GameData[];
  selectedGameIds: Set<string>;
  updatingGameIds: Set<string>;
  onEditGame: (game: GameData) => void;
  onClickDetails: (game: GameData) => void;
  onToggleSelect: (id: string) => void;
}

const ESTIMATED_ROW_HEIGHT = 440; // Altura aproximada do GameCard + gap
const MIN_CARD_WIDTH = 280;
const GAP = 24; // 1.5rem gap
const OVERSCAN_ROWS = 2; // Linhas de folga acima e abaixo

export function VirtualGameGrid({
  games,
  selectedGameIds,
  updatingGameIds,
  onEditGame,
  onClickDetails,
  onToggleSelect,
}: VirtualGameGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1200;
  });
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerHeight : 800;
  });

  // Atualiza dimensões do container
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
      setViewportHeight(window.innerHeight);
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener('resize', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Monitora scroll da janela
  useEffect(() => {
    const handleScroll = () => {
      setScrollTop(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calcula quantidade de colunas que cabem
  const columnsCount = useMemo(() => {
    if (containerWidth <= 768) return 1; // Coluna única nativa em dispositivos móveis
    const cols = Math.floor((containerWidth + GAP) / (MIN_CARD_WIDTH + GAP));
    return Math.max(1, cols);
  }, [containerWidth]);

  // Agrupa jogos em linhas
  const rows = useMemo(() => {
    const grouped: GameData[][] = [];
    for (let i = 0; i < games.length; i += columnsCount) {
      grouped.push(games.slice(i, i + columnsCount));
    }
    return grouped;
  }, [games, columnsCount]);

  // Se a coleção for pequena (<= 30 jogos), renderiza diretamente sem virtualização
  const shouldVirtualize = games.length > 30;

  // Calcula intervalo de linhas visíveis
  const { startIndex, endIndex, topOffset, bottomOffset } = useMemo(() => {
    if (!shouldVirtualize) {
      return { startIndex: 0, endIndex: rows.length, topOffset: 0, bottomOffset: 0 };
    }

    const containerOffsetTop = containerRef.current
      ? containerRef.current.getBoundingClientRect().top + window.scrollY
      : 0;

    const relativeScrollTop = Math.max(0, scrollTop - containerOffsetTop);

    const startRow = Math.max(0, Math.floor(relativeScrollTop / ESTIMATED_ROW_HEIGHT) - OVERSCAN_ROWS);
    const visibleRowCount = Math.ceil(viewportHeight / ESTIMATED_ROW_HEIGHT) + OVERSCAN_ROWS * 2;
    const endRow = Math.min(rows.length, startRow + visibleRowCount);

    const top = startRow * ESTIMATED_ROW_HEIGHT;
    const bottom = Math.max(0, (rows.length - endRow) * ESTIMATED_ROW_HEIGHT);

    return {
      startIndex: startRow,
      endIndex: endRow,
      topOffset: top,
      bottomOffset: bottom,
    };
  }, [shouldVirtualize, rows.length, scrollTop, viewportHeight]);

  const visibleRows = useMemo(() => {
    return rows.slice(startIndex, endIndex);
  }, [rows, startIndex, endIndex]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      {shouldVirtualize && topOffset > 0 && (
        <div style={{ height: `${topOffset}px`, width: '100%' }} aria-hidden="true" />
      )}

      <div 
        className="games-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: columnsCount === 1 ? '1fr' : `repeat(${columnsCount}, 1fr)`,
          gap: `${GAP}px`,
        }}
      >
        {visibleRows.flatMap((row) =>
          row.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onEdit={onEditGame}
              onClickDetails={onClickDetails}
              isSelected={selectedGameIds.has(game.id)}
              isUpdating={updatingGameIds.has(game.id)}
              onToggleSelect={onToggleSelect}
            />
          ))
        )}
      </div>

      {shouldVirtualize && bottomOffset > 0 && (
        <div style={{ height: `${bottomOffset}px`, width: '100%' }} aria-hidden="true" />
      )}
    </div>
  );
}
