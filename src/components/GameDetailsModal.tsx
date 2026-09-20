import React from 'react';
import { X, Users, Star, Brain, Trophy, Calendar, ExternalLink, Pencil, Tag, Clock, Award, ShieldCheck } from 'lucide-react';
import type { GameData } from '../types';
import '../components.css';

interface GameDetailsModalProps {
  game: GameData | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (game: GameData) => void;
}

export function GameDetailsModal({ game, isOpen, onClose, onEdit }: GameDetailsModalProps) {
  if (!isOpen || !game) return null;

  const isOwned = String(game.status || '').toLowerCase().includes('coleção') || String(game.status || '').toLowerCase().includes('sim');
  const statusColor = isOwned ? 'var(--status-owned)' : 'var(--status-sold)';

  const spendNum = typeof game.spend === 'string' ? parseFloat(String(game.spend).replace(',', '.')) : Number(game.spend);
  const isGiftOrZero = isNaN(spendNum) || spendNum <= 0;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    padding: '1rem'
  };

  const panelStyle: React.CSSProperties = {
    width: '100%', maxWidth: '750px', padding: '0', position: 'relative',
    maxHeight: '92vh', overflowY: 'auto', overflowX: 'hidden',
    borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)'
  };

  const cleanDescription = (htmlStr?: string) => {
    if (!htmlStr) return null;
    const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
    return doc.body.textContent || "";
  };

  // Preferir descrição em português (Ludopedia), caso disponível
  const descriptionPtText = cleanDescription(game.descriptionPt);
  const descriptionEnText = cleanDescription(game.description);
  const mainDescription = descriptionPtText || descriptionEnText;

  return (
    <div className="modal-overlay" style={overlayStyle} onClick={onClose}>
      <div className="glass-panel animate-fade-in" style={panelStyle} onClick={e => e.stopPropagation()}>
        
        {/* Banner / Header Image */}
        <div style={{ position: 'relative', height: '260px', width: '100%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {(game.image || game.thumbnail) ? (
            <img 
              src={game.image || game.thumbnail} 
              alt={game.name}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'contain', backdropFilter: 'blur(10px)', padding: '1rem' }} 
            />
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Sem Imagem</div>
          )}
          
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ 
              position: 'absolute', top: '1rem', right: '1rem', 
              background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', 
              color: '#fff', borderRadius: '50%', width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'all 0.2s' 
            }}
          >
            <X size={20} />
          </button>

          <div className="status-badge" style={{ backgroundColor: statusColor, position: 'absolute', top: '1rem', left: '1rem' }}>
            {game.status}
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#fff' }}>{game.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <span className={`game-type ${String(game.type || '').toLowerCase().includes('expans') ? 'expansion' : 'base'}`}>
                  {game.type || 'Base'}
                </span>
                {game.yearPublished && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={14} /> {game.yearPublished}
                  </span>
                )}
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onEdit(game);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
            >
              <Pencil size={16} />
              Editar Jogo
            </button>
          </div>

          {/* Key Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {/* Jogadores Suportados + Votação Ideal Comunitária */}
            {(game.minPlayers || game.maxPlayers || game.suggestedPlayers) && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Users size={13} color="#6366f1" /> Jogadores
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {game.minPlayers === game.maxPlayers ? game.minPlayers : `${game.minPlayers || '?'} - ${game.maxPlayers || '?'}`}
                </div>
                {game.suggestedPlayers?.summary && (
                  <div style={{ fontSize: '0.72rem', color: '#a5b4fc', marginTop: '4px', fontWeight: 500 }}>
                    ★ {game.suggestedPlayers.summary}
                  </div>
                )}
              </div>
            )}

            {game.weight !== undefined && game.weight > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Brain size={13} color="#a855f7" /> Peso / Dificuldade
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {Number(game.weight.toFixed(2))} / 5
                </div>
              </div>
            )}

            {game.rank !== undefined && game.rank > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Trophy size={13} color="#10b981" /> Ranking BGG
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  #{game.rank}
                </div>
              </div>
            )}

            {game.rating !== undefined && game.rating > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Star size={13} color="#fbbf24" fill="#fbbf24" /> Nota BGG
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {game.rating.toFixed(1)} / 10
                </div>
                {game.geekRating !== undefined && game.geekRating > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '4px' }}>
                    Geek: {game.geekRating.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {game.ludoRating !== undefined && game.ludoRating > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Star size={13} color="#3b82f6" fill="#3b82f6" /> Nota Ludopedia
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {game.ludoRating.toFixed(1)} / 10
                </div>
              </div>
            )}

            {game.playtime !== undefined && game.playtime > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                  <Clock size={13} color="#ec4899" /> Tempo de Jogo
                </div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {game.playtime} min
                </div>
              </div>
            )}
          </div>

          {/* Prêmios e Distinções (boardgamehonor) */}
          {game.honors && game.honors.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Award size={15} color="#fbbf24" /> Prêmios & Distinções ({game.honors.length})
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '4px 0' }}>
                {game.honors.map((honor, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#fcd34d',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      padding: '3px 10px',
                      borderRadius: '16px',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🏆 {honor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Resumo / Descrição */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Resumo do Jogo
              </h3>
              {game.descriptionPt && (
                <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <ShieldCheck size={12} /> Sinopse em Português
                </span>
              )}
            </div>
            <div style={{ 
              background: 'rgba(0,0,0,0.2)', padding: '1rem 1.25rem', borderRadius: '12px', 
              fontSize: '0.92rem', lineHeight: '1.6', color: '#e2e8f0', 
              maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {mainDescription ? (
                mainDescription
              ) : (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Nenhum resumo disponível no momento. Clique em "Atualizar via API" para carregar dados do BGG e Ludopedia.
                </span>
              )}
            </div>
          </div>

          {/* Categorias / Mecânicas */}
          {((game.domains && game.domains.length > 0) || (game.mechanics && game.mechanics.length > 0)) && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Tag size={14} /> Categorias e Mecânicas
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {Array.from(new Set([...(game.mechanics || []), ...(game.domains || [])])).map((domain, idx) => (
                  <span 
                    key={idx}
                    style={{ 
                      background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', 
                      border: '1px solid rgba(99, 102, 241, 0.3)', 
                      padding: '3px 10px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 500 
                    }}
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Informações Financeiras & Links Externos */}
          <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            paddingTop: '1rem', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '1rem' 
          }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Valor Pago:</span>
                <strong style={{ fontSize: '1.1rem', color: isGiftOrZero ? '#34d399' : '#fff' }}>
                  {isGiftOrZero ? 'Presente/R$0' : Number(spendNum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Valor de Mercado:</span>
                <strong style={{ fontSize: '1.1rem', color: '#fff' }}>
                  {Number(game.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </div>
              {game.retailPrice !== undefined && game.retailPrice > 0 && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Menor Varejo:</span>
                  <strong style={{ fontSize: '1.05rem', color: '#38bdf8' }}>
                    {Number(game.retailPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </div>
              )}
              {game.usedPrice !== undefined && game.usedPrice > 0 && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Mercado Usados:</span>
                  <strong style={{ fontSize: '1.05rem', color: '#fb923c' }}>
                    {Number(game.usedPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </div>
              )}
              {String(game.status).toLowerCase().includes('vendido') && game.soldValue && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Vendido Por:</span>
                  <strong style={{ fontSize: '1.1rem', color: '#60a5fa' }}>
                    {Number(game.soldValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {game.bggId && (
                <a
                  href={`https://boardgamegeek.com/boardgame/${game.bggId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ExternalLink size={14} /> BGG
                </a>
              )}
              {game.ludoId && (
                <a
                  href={`https://ludopedia.com.br/jogo/${game.ludoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ExternalLink size={14} /> Ludopedia
                </a>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
