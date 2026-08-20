import { useMemo } from 'react';
import { X } from 'lucide-react';
import type { GameData } from '../types';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import '../components.css';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: GameData[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function ReportsModal({ isOpen, onClose, games }: ReportsModalProps) {
  
  // 1. Tipos de Jogo
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    games.forEach(g => {
      const typeStr = String(g.type || 'Desconhecido').trim();
      const type = typeStr === '' ? 'Desconhecido' : typeStr;
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [games]);

  // 2. Status
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    games.forEach(g => {
      const statusStr = String(g.status || 'Desconhecido').trim();
      const status = statusStr === '' ? 'Desconhecido' : statusStr;
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [games]);

  // 3. Faixas de Preço Pago
  const priceData = useMemo(() => {
    const ranges = {
      'Grátis / Presente': 0,
      'Até R$ 100': 0,
      'R$ 101 - 250': 0,
      'R$ 251 - 500': 0,
      'Mais de R$ 500': 0,
    };
    games.forEach(g => {
      const statusStr = String(g.status || '').toLowerCase();
      if (!statusStr.includes('desejo')) {
        let p = 0;
        if (typeof g.spend === 'number') {
          p = g.spend;
        } else if (typeof g.spend === 'string') {
          p = parseFloat(g.spend.replace(',', '.')) || 0;
        }
        
        if (p <= 0) ranges['Grátis / Presente']++;
        else if (p <= 100) ranges['Até R$ 100']++;
        else if (p <= 250) ranges['R$ 101 - 250']++;
        else if (p <= 500) ranges['R$ 251 - 500']++;
        else ranges['Mais de R$ 500']++;
      }
    });
    return Object.keys(ranges).map(k => ({ name: k, quantidade: ranges[k as keyof typeof ranges] }));
  }, [games]);

  // 4. Peso / Dificuldade
  const weightData = useMemo(() => {
    const ranges = {
      'Leve (< 2.0)': 0,
      'Médio-Leve (2.0 - 2.5)': 0,
      'Médio (2.5 - 3.5)': 0,
      'Pesado (> 3.5)': 0,
    };
    games.forEach(g => {
      const w = Number(g.weight) || 0;
      if (w > 0) {
        if (w < 2.0) ranges['Leve (< 2.0)']++;
        else if (w <= 2.5) ranges['Médio-Leve (2.0 - 2.5)']++;
        else if (w <= 3.5) ranges['Médio (2.5 - 3.5)']++;
        else ranges['Pesado (> 3.5)']++;
      }
    });
    return Object.keys(ranges).map(k => ({ name: k, quantidade: ranges[k as keyof typeof ranges] }));
  }, [games]);

  // 5. Estilo / Domínios (Top 10)
  const domainData = useMemo(() => {
    const counts: Record<string, number> = {};
    games.forEach(g => {
      if (g.domains && Array.isArray(g.domains)) {
        g.domains.forEach(d => {
          const domainStr = String(d).trim();
          if (domainStr) {
            counts[domainStr] = (counts[domainStr] || 0) + 1;
          }
        });
      } else if (typeof g.domains === 'string') {
        const domains = String(g.domains).split(',').map(d => d.trim());
        domains.forEach(d => {
          if (d) counts[d] = (counts[d] || 0) + 1;
        });
      }
    });
    const sorted = Object.keys(counts).map(k => ({ name: k, quantidade: counts[k] })).sort((a, b) => b.quantidade - a.quantidade);
    return sorted.slice(0, 10);
  }, [games]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '1200px', height: '90vh', padding: '2rem', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', 
          border: 'none', color: 'var(--text-muted)', cursor: 'pointer', zIndex: 10
        }}>
          <X size={28} />
        </button>
        
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.8rem', textAlign: 'center' }}>Estatísticas da Coleção</h2>
        
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
          
          {/* Tipo de Jogo */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Proporção: Base vs Expansões</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`} outerRadius={100} fill="#8884d8" dataKey="value">
                    {typeData.map((_entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Status da Coleção</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`} outerRadius={100} fill="#8884d8" dataKey="value">
                    {statusData.map((_entry, index) => <Cell key={`cell-${index}`} fill={COLORS[(index+2) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Preço Pago */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Faixas de Preço Pago</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priceData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" angle={-25} textAnchor="end" height={60} />
                  <YAxis stroke="rgba(255,255,255,0.5)" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <Bar dataKey="quantidade" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dificuldade */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Dificuldade / Peso</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weightData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" angle={-15} textAnchor="end" height={60} />
                  <YAxis stroke="rgba(255,255,255,0.5)" allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <Bar dataKey="quantidade" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)'}}>*Requer dados do BGG no jogo</div>
            </div>
          </div>

          {/* Domínios */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gridColumn: '1 / -1', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Top 10 Categorias e Mecânicas</h3>
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domainData} layout="vertical" margin={{ top: 20, right: 30, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="rgba(255,255,255,0.5)" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.8)" width={200} tick={{fontSize: 12}} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                  <Bar dataKey="quantidade" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem'}}>*Requer atualizar os jogos individualmente via BGG ou Ludopedia</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
