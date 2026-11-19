import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PackageMinus, Check, X, AlertCircle, Sparkles } from 'lucide-react';
import type { SleeveStockItem } from '../types';
import type { SleeveDeductionCandidate } from '../utils/sleeveUtils';

export interface DeductSleevesModalProps {
  isOpen: boolean;
  gameName: string;
  candidates: SleeveDeductionCandidate[];
  stock: SleeveStockItem[];
  onConfirm: (deductions: { stockItemId: string; quantity: number }[]) => void;
  onSkip: () => void;
  onCancel: () => void;
}

interface ItemRowState {
  id: string;
  candidate: SleeveDeductionCandidate;
  selectedStockId: string;
  deductQuantity: number;
  shouldDeduct: boolean;
}

export function DeductSleevesModal({
  isOpen,
  gameName,
  candidates,
  stock,
  onConfirm,
  onSkip,
  onCancel,
}: DeductSleevesModalProps) {
  const [rows, setRows] = useState<ItemRowState[]>([]);

  // Inicializar estado local quando os candidatos mudarem ou modal abrir
  useEffect(() => {
    if (!isOpen || !candidates || candidates.length === 0) {
      setRows([]);
      return;
    }

    setRows(
      candidates.map(c => {
        const bestStock = c.compatibleStock.length > 0 ? c.compatibleStock[0].item : undefined;
        const initialStockId = c.selectedStockId || (bestStock ? bestStock.id : '');
        const targetStock = stock.find(s => s.id === initialStockId);
        const avail = targetStock ? Number(targetStock.quantity) || 0 : 0;
        const initQty = targetStock ? Math.min(c.cardsToDeduct, avail) : 0;

        return {
          id: c.id,
          candidate: c,
          selectedStockId: initialStockId,
          deductQuantity: initQty,
          shouldDeduct: initQty > 0,
        };
      })
    );
  }, [isOpen, candidates, stock]);

  // Mapa de soma de deduções por stockItemId para calcular saldo restante preciso
  const totalDeductedByStockId = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.shouldDeduct && r.selectedStockId && r.deductQuantity > 0) {
        map.set(r.selectedStockId, (map.get(r.selectedStockId) || 0) + r.deductQuantity);
      }
    }
    return map;
  }, [rows]);

  if (!isOpen || candidates.length === 0) return null;

  const handleToggleDeduct = (rowId: string) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        const nextVal = !r.shouldDeduct;
        let nextQty = r.deductQuantity;
        if (nextVal && nextQty === 0 && r.selectedStockId) {
          const targetStock = stock.find(s => s.id === r.selectedStockId);
          const avail = targetStock ? Number(targetStock.quantity) || 0 : 0;
          nextQty = Math.min(r.candidate.cardsToDeduct, avail);
        }
        return { ...r, shouldDeduct: nextVal, deductQuantity: nextQty };
      })
    );
  };

  const handleSelectStock = (rowId: string, stockId: string) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        if (!stockId) {
          return { ...r, selectedStockId: '', deductQuantity: 0, shouldDeduct: false };
        }
        const targetStock = stock.find(s => s.id === stockId);
        const avail = targetStock ? Number(targetStock.quantity) || 0 : 0;
        const nextQty = Math.min(r.candidate.cardsToDeduct, avail);
        return {
          ...r,
          selectedStockId: stockId,
          deductQuantity: nextQty,
          shouldDeduct: nextQty > 0,
        };
      })
    );
  };

  const handleChangeQuantity = (rowId: string, qty: number) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        const targetStock = stock.find(s => s.id === r.selectedStockId);
        const maxAvail = targetStock ? Number(targetStock.quantity) || 0 : 0;
        const sanitized = Math.max(0, Math.min(maxAvail, qty));
        return {
          ...r,
          deductQuantity: sanitized,
          shouldDeduct: sanitized > 0,
        };
      })
    );
  };

  const totalDeductionsCount = rows
    .filter(r => r.shouldDeduct && r.selectedStockId && r.deductQuantity > 0)
    .reduce((sum, r) => sum + r.deductQuantity, 0);

  const activeRowsCount = rows.filter(r => r.shouldDeduct && r.selectedStockId && r.deductQuantity > 0).length;

  const handleConfirm = () => {
    const deductions = rows
      .filter(r => r.shouldDeduct && r.selectedStockId && r.deductQuantity > 0)
      .map(r => ({
        stockItemId: r.selectedStockId,
        quantity: r.deductQuantity,
      }));

    if (deductions.length === 0) {
      onSkip();
    } else {
      onConfirm(deductions);
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10050,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onClick={onCancel}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.2)',
          margin: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <PackageMinus size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Descontar Sleeves do Estoque?
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                Você configurou cartas sleevadas em <strong style={{ color: 'var(--text-main)' }}>{gameName}</strong>. Deseja abater esses sleeves do seu estoque?
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="btn"
            style={{ padding: '0.4rem', border: 'none', background: 'transparent' }}
            title="Cancelar e voltar à edição"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lista de Conjuntos Sleevados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Conjuntos Sleevados Detectados ({rows.length})
          </span>

          {rows.map(row => {
            const { candidate } = row;
            const currentSelectedStock = stock.find(s => s.id === row.selectedStockId);
            const totalStockQty = currentSelectedStock ? Number(currentSelectedStock.quantity) || 0 : 0;
            const deductionForThisStock = totalDeductedByStockId.get(row.selectedStockId) || 0;
            const balanceAfter = Math.max(0, totalStockQty - deductionForThisStock);
            const isInsufficient = currentSelectedStock && totalStockQty < candidate.cardsToDeduct;

            return (
              <div
                key={row.id}
                style={{
                  background: row.shouldDeduct ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${row.shouldDeduct ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Cabeçalho do Card */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={row.shouldDeduct}
                      onChange={() => handleToggleDeduct(row.id)}
                      style={{ width: '17px', height: '17px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                        {candidate.name ? `${candidate.name} - ` : ''}{candidate.sizeName}
                      </span>
                      <span style={{ marginLeft: '6px', fontSize: '0.8rem', color: '#94a3b8' }}>
                        ({candidate.dimensions})
                      </span>
                    </div>
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                      }}
                    >
                      🃏 {candidate.cardsToDeduct} cartas sleevadas
                    </span>

                    {(candidate.sleeveBrand || candidate.sleeveType) && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: '#cbd5e1',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        🏷️ {candidate.sleeveBrand || 'Sem marca'}{candidate.sleeveType ? ` (${candidate.sleeveType})` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Seleção do Estoque e Quantidade */}
                {row.shouldDeduct && (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '0.85rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Dropdown de Item do Estoque */}
                      <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Item de estoque correspondente:
                        </span>
                        <select
                          className="search-input"
                          value={row.selectedStockId}
                          onChange={e => handleSelectStock(row.id, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.65rem',
                            fontSize: '0.84rem',
                            borderColor: currentSelectedStock ? 'rgba(99, 102, 241, 0.4)' : 'rgba(245, 158, 11, 0.5)',
                          }}
                        >
                          {candidate.compatibleStock.length > 0 ? (
                            <optgroup label="Sleeves Compatíveis (Recomendados)">
                              {candidate.compatibleStock.map(({ item }) => (
                                <option key={item.id} value={item.id}>
                                  ⭐ {item.brand} - {item.model} {item.type ? `(${item.type})` : ''} — Disp: {item.quantity} un
                                </option>
                              ))}
                            </optgroup>
                          ) : (
                            <option value="" disabled>
                              Nenhum sleeve deste tamanho no estoque
                            </option>
                          )}

                          {stock.length > candidate.compatibleStock.length && (
                            <optgroup label="Outros sleeves do estoque">
                              {stock
                                .filter(s => !candidate.compatibleStock.some(c => c.item.id === s.id))
                                .map(item => (
                                  <option key={item.id} value={item.id}>
                                    {item.brand} - {item.model} {item.type ? `(${item.type})` : ''} — Disp: {item.quantity} un
                                  </option>
                                ))}
                            </optgroup>
                          )}

                          <option value="">(Não descontar do estoque)</option>
                        </select>
                      </div>

                      {/* Quantidade a Descontar */}
                      {row.selectedStockId && (
                        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            Qtd. a Descontar:
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => handleChangeQuantity(row.id, row.deductQuantity - 10)}
                              disabled={row.deductQuantity <= 0}
                              style={{ padding: '0.4rem 0.55rem', fontSize: '0.75rem' }}
                              title="Diminuir 10"
                            >
                              -10
                            </button>
                            <input
                              type="number"
                              className="search-input"
                              min={0}
                              max={totalStockQty}
                              value={row.deductQuantity}
                              onChange={e => handleChangeQuantity(row.id, parseInt(e.target.value) || 0)}
                              style={{ width: '70px', padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.85rem' }}
                            />
                            <button
                              type="button"
                              className="btn"
                              onClick={() => handleChangeQuantity(row.id, row.deductQuantity + 10)}
                              disabled={row.deductQuantity >= totalStockQty}
                              style={{ padding: '0.4rem 0.55rem', fontSize: '0.75rem' }}
                              title="Aumentar 10"
                            >
                              +10
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => handleChangeQuantity(row.id, Math.min(candidate.cardsToDeduct, totalStockQty))}
                              style={{ padding: '0.4rem 0.55rem', fontSize: '0.72rem', borderColor: 'rgba(99, 102, 241, 0.4)' }}
                              title="Preencher com o total de cartas necessário (ou máximo disponível)"
                            >
                              Máx
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Feedback do Saldo do Estoque */}
                    {currentSelectedStock && (
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                          paddingTop: '0.4rem',
                        }}
                      >
                        <div>
                          Estoque disponível: <strong style={{ color: 'var(--text-main)' }}>{totalStockQty}</strong> un → Saldo após desconto:{' '}
                          <strong style={{ color: balanceAfter > 0 ? '#34d399' : balanceAfter === 0 ? '#fbbf24' : '#f87171' }}>
                            {balanceAfter} un
                          </strong>
                        </div>

                        {isInsufficient && (
                          <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem' }}>
                            <AlertCircle size={13} />
                            Estoque disponível cobre {totalStockQty} das {candidate.cardsToDeduct} cartas necessárias
                          </span>
                        )}
                      </div>
                    )}

                    {!row.selectedStockId && (
                      <div style={{ fontSize: '0.78rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <AlertCircle size={14} />
                        Nenhum sleeve selecionado para dedução deste conjunto.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Resumo da Operação */}
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a7f3d0' }}>
            <Sparkles size={16} />
            <span>
              Total a abater do estoque:{' '}
              <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>
                {totalDeductionsCount} sleeve(s)
              </strong>{' '}
              em {activeRowsCount} conjunto(s)
            </span>
          </div>

          {totalDeductionsCount === 0 && (
            <span style={{ fontSize: '0.78rem', color: '#fbbf24' }}>
              Nenhum sleeve será descontado do estoque ao salvar.
            </span>
          )}
        </div>

        {/* Rodapé e Botões de Ação */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '1rem',
            marginTop: '0.25rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            style={{ fontSize: '0.85rem' }}
          >
            Cancelar
          </button>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSkip}
              style={{ fontSize: '0.85rem' }}
              title="Salva as alterações de sleeves sem alterar a quantidade de nenhum item no estoque"
            >
              Salvar sem Descontar
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              style={{
                fontSize: '0.85rem',
                padding: '0.55rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: totalDeductionsCount > 0 ? undefined : 'rgba(99, 102, 241, 0.4)',
              }}
            >
              <Check size={16} />
              {totalDeductionsCount > 0
                ? `Descontar (${totalDeductionsCount}) e Salvar`
                : 'Salvar Jogo'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
