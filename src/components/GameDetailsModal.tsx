import { X, Users, Trophy, Clock, Calendar, Info, UserCheck } from 'lucide-react';
import type { GameData } from '../types';

interface GameDetailsModalProps {
  game: GameData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function GameDetailsModal({ game, isOpen, onClose }: GameDetailsModalProps) {
  if (!isOpen || !game) return null;

  return (
    <div className="modal-overlay animate-fade-in" style={{ zIndex: 999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div 
        className="modal-content animate-scale-in" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '600px', width: '90%', padding: 0, overflow: 'hidden', background: '#121212' }}
      >
        <div style={{ position: 'relative' }}>
          {/* Header Cover - Blurred background + contained image */}
          <div style={{ 
            height: '250px', 
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            backgroundColor: '#0a0a0a'
          }}>
            <div style={{
              position: 'absolute',
              top: -20, left: -20, right: -20, bottom: -20,
              backgroundImage: `url(${game.image || game.thumbnail || ''})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center',
              filter: 'blur(15px)',
              opacity: 0.4,
              zIndex: 1
            }} />
            <img 
              src={game.image || game.thumbnail || ''} 
              alt={game.name} 
              style={{ 
                maxHeight: '100%', 
                maxWidth: '100%', 
                zIndex: 2, 
                position: 'relative', 
                objectFit: 'contain',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
              }} 
            />
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 60%, rgba(18,18,18,1) 100%)',
              zIndex: 3
            }} />
          </div>

          <button 
            className="btn btn-icon" 
            onClick={onClose} 
            style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: '50%', zIndex: 10 }}
          >
            <X size={20} />
          </button>
          
          <div style={{ position: 'absolute', bottom: '-20px', left: '30px', right: '30px', zIndex: 10 }}>
             <h2 style={{ fontSize: '2rem', margin: 0, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>{game.name}</h2>
          </div>
        </div>

        <div style={{ padding: '40px 30px 30px', overflowY: 'auto', maxHeight: '60vh' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px', marginBottom: '30px' }}>
             
             <div style={{ background: '#1e1e1e', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
               <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 <Calendar size={14} /> ANO
               </div>
               <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{game.yearPublished || '—'}</div>
             </div>

             <div style={{ background: '#1e1e1e', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
               <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 <Users size={14} /> JOGADORES
               </div>
               <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                 {game.minPlayers === game.maxPlayers 
                   ? (game.minPlayers || '—') 
                   : `${game.minPlayers || '?'} - ${game.maxPlayers || '?'}`}
               </div>
             </div>

             <div style={{ background: '#1e1e1e', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
               <div style={{ fontSize: '0.75rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                 <UserCheck size={14} color="#38bdf8" /> JOGADORES IDEAL
               </div>
               <div style={{ fontSize: '1.2rem', fontWeight: 600, color: game.bggBestPlayers ? '#38bdf8' : '#888' }}>
                 {game.bggBestPlayers ? `${game.bggBestPlayers} jogadores` : '—'}
               </div>
             </div>

             <div style={{ background: '#1e1e1e', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
               <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 <Clock size={14} /> DURAÇÃO
               </div>
               <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                 {game.playtime ? `${game.playtime}m` : (game.ludoAveragePlaytime ? `${game.ludoAveragePlaytime}m` : '—')}
               </div>
             </div>

             <div style={{ background: '#1e1e1e', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
               <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 <Info size={14} /> PESO (BGG)
               </div>
               <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{game.weight ? `${game.weight.toFixed(2)} / 5` : '—'}</div>
             </div>

             <div style={{ background: '#1e1e1e', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
               <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 <Trophy size={14} /> RANKING (BGG)
               </div>
               <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{game.rank ? `#${game.rank}` : '—'}</div>
             </div>

          </div>

          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#fff' }}>Como funciona</h3>
            <p style={{ color: '#ccc', lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
              {game.description 
                ? String(typeof game.description === 'object' ? JSON.stringify(game.description) : game.description).replace(/&amp;/g, '&').replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&mdash;/g, '—').replace(/&[a-z]+;/gi, '') 
                : 'Nenhum resumo disponível no momento.'}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
