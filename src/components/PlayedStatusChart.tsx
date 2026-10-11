import { useMemo, useState } from 'react';
import type { GameData } from '../types';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Dices, PieChart as PieIcon, BarChart3, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import '../components.css';

interface PlayedStatusChartProps {
  games: GameData[];
}

export function PlayedStatusChart({ games }: PlayedStatusChartProps) {
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');

  const stats = useMemo(() => {
    let basePlayed = 0;
    let baseUnplayed = 0;
    let expPlayed = 0;
    let expUnplayed = 0;

    for (const g of games) {
      const typeLower = String(g.type || '').toLowerCase();
      const isExp = typeLower.includes('expans') || typeLower.includes('expansion');
      const isPlayed = Boolean(g.isPlayed);

      if (isExp) {
        if (isPlayed) expPlayed++;
        else expUnplayed++;
      } else {
        if (isPlayed) basePlayed++;
        else baseUnplayed++;
      }
    }

    const total = basePlayed + baseUnplayed + expPlayed + expUnplayed;
    const totalPlayed = basePlayed + expPlayed;
    const totalUnplayed = baseUnplayed + expUnplayed;
    const playedRate = total > 0 ? Math.round((totalPlayed / total) * 100) : 0;

    return {
      basePlayed,
      baseUnplayed,
      expPlayed,
      expUnplayed,
      total,
      totalPlayed,
      totalUnplayed,
      playedRate,
    };
  }, [games]);

  const chartData = useMemo(() => [
    { name: 'Jogos Base Jogados', value: stats.basePlayed, color: '#10b981' },
    { name: 'Jogos Base Não Jogados', value: stats.baseUnplayed, color: '#38bdf8' },
    { name: 'Expansões Jogadas', value: stats.expPlayed, color: '#8b5cf6' },
    { name: 'Expansões Não Jogadas', value: stats.expUnplayed, color: '#f43f5e' },
  ], [stats]);

  const hasData = stats.total > 0;

  return (
    <div className="glass-panel" style={{
      padding: '1.5rem',
      borderRadius: 'var(--border-radius)',
      background: 'rgba(30, 41, 59, 0.65)',
      backdropFilter: 'blur(16px)',
      border: '1px solid var(--glass-border)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      marginBottom: '1rem',
      position: 'relative',
    }}>
      {/* Header do Dashboard Analítico */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.25rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #10b981, #6366f1)',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}>
            <Dices size={20} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Rastreamento de Partidas: Tipo & Status
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                {stats.playedRate}% Jogados
              </span>
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Cruzamento analítico de Jogos Base vs Expansões (Status Jogado / Não Jogado)
            </p>
          </div>
        </div>

        {/* Alternador de Visualização (Donut / Barras) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0, 0, 0, 0.25)', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setChartType('donut')}
            className="btn"
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              borderRadius: '6px',
              border: 'none',
              background: chartType === 'donut' ? 'var(--accent)' : 'transparent',
              color: chartType === 'donut' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
            title="Exibir gráfico de rosca (donut)"
          >
            <PieIcon size={14} /> Rosca
          </button>
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className="btn"
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8rem',
              borderRadius: '6px',
              border: 'none',
              background: chartType === 'bar' ? 'var(--accent)' : 'transparent',
              color: chartType === 'bar' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
            title="Exibir gráfico de barras verticais"
          >
            <BarChart3 size={14} /> Barras
          </button>
        </div>
      </div>

      {/* Grid de Conteúdo: Cards de Métricas + Gráfico Visual */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        alignItems: 'center'
      }}>
        {/* Lado Esquerdo: Cards Comparativos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem'
          }}>
            {/* 1. Jogos Base Jogados */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              transition: 'var(--transition)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#6ee7b7', fontWeight: 600 }}>Base Jogados</span>
                <CheckCircle2 size={16} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>
                {stats.basePlayed}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {stats.total > 0 ? `${Math.round((stats.basePlayed / stats.total) * 100)}% do total` : '0%'}
              </div>
            </div>

            {/* 2. Jogos Base Não Jogados */}
            <div style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              transition: 'var(--transition)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#7dd3fc', fontWeight: 600 }}>Base Não Jogados</span>
                <Clock size={16} color="#38bdf8" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>
                {stats.baseUnplayed}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {stats.total > 0 ? `${Math.round((stats.baseUnplayed / stats.total) * 100)}% do total` : '0%'}
              </div>
            </div>

            {/* 3. Expansões Jogadas */}
            <div style={{
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              transition: 'var(--transition)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#c4b5fd', fontWeight: 600 }}>Expansões Jogadas</span>
                <Sparkles size={16} color="#8b5cf6" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#8b5cf6' }}>
                {stats.expPlayed}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {stats.total > 0 ? `${Math.round((stats.expPlayed / stats.total) * 100)}% do total` : '0%'}
              </div>
            </div>

            {/* 4. Expansões Não Jogadas */}
            <div style={{
              background: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              transition: 'var(--transition)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#fda4af', fontWeight: 600 }}>Exp. Não Jogadas</span>
                <Clock size={16} color="#f43f5e" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f43f5e' }}>
                {stats.expUnplayed}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {stats.total > 0 ? `${Math.round((stats.expUnplayed / stats.total) * 100)}% do total` : '0%'}
              </div>
            </div>
          </div>

          {/* Barra de Progresso Geral */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Aproveitamento da Coleção</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>
                {stats.totalPlayed} de {stats.total} jogos jogados
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${stats.playedRate}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10b981, #8b5cf6)',
                borderRadius: '4px',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        </div>

        {/* Lado Direito: Gráfico Visual Recharts */}
        <div style={{
          height: 250,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {!hasData ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Nenhum dado disponível para os filtros atuais.
            </div>
          ) : chartType === 'donut' ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(15, 23, 42, 0.8)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const num = Number(value) || 0;
                    const pct = stats.total > 0 ? ((num / stats.total) * 100).toFixed(1) : '0';
                    return [`${num} jogo(s) (${pct}%)`, name];
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    fontSize: '0.85rem'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="rgba(255, 255, 255, 0.5)"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis stroke="rgba(255, 255, 255, 0.5)" allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [`${value} jogos`, name]}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    fontSize: '0.85rem'
                  }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
