import React, { useState } from 'react';
import { LogIn, UserPlus, KeyRound, Mail, User, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import '../index.css';

interface LoginScreenProps {
  onSuccess?: () => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const { signIn, signUp, resetPassword } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [customUsername, setCustomUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetFormState = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleModeChange = (newMode: 'login' | 'register' | 'forgot') => {
    resetFormState();
    setMode(newMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (!identifier.trim()) {
      setErrorMessage('Por favor, informe seu e-mail ou usuário.');
      return;
    }
    if (!password) {
      setErrorMessage('Por favor, informe sua senha.');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(identifier.trim(), password);
    setIsLoading(false);

    if (error) {
      if (error.includes('Invalid login credentials') || error.includes('invalid_grant')) {
        setErrorMessage('E-mail/usuário ou senha incorretos.');
      } else {
        setErrorMessage(error);
      }
    } else {
      if (onSuccess) onSuccess();
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (!identifier.trim()) {
      setErrorMessage('Por favor, informe um e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    const { error, needsEmailConfirmation } = await signUp(
      identifier.trim(),
      password,
      customUsername.trim() || undefined
    );
    setIsLoading(false);

    if (error) {
      if (error.includes('User already registered')) {
        setErrorMessage('Este e-mail ou usuário já está cadastrado. Faça login ou recupere sua senha.');
      } else {
        setErrorMessage(error);
      }
    } else {
      if (needsEmailConfirmation) {
        setSuccessMessage('Conta criada com sucesso! Verifique seu e-mail para confirmar seu cadastro e em seguida faça login.');
        setMode('login');
      } else {
        setSuccessMessage('Conta criada e autenticada com sucesso!');
        if (onSuccess) onSuccess();
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (!identifier.trim()) {
      setErrorMessage('Por favor, informe seu e-mail.');
      return;
    }

    setIsLoading(true);
    const { error } = await resetPassword(identifier.trim());
    setIsLoading(false);

    if (error) {
      setErrorMessage(error);
    } else {
      setSuccessMessage('Se o e-mail estiver cadastrado, um link para redefinição de senha foi enviado.');
    }
  };

  return (
    <div className="app-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-color)', padding: '1.5rem' }}>
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 100 }}>
        <ThemeToggle />
      </div>
      <div 
        className="glass-panel animate-fade-in login-screen-card" 
        style={{ 
          padding: '2.5rem', 
          maxWidth: '460px', 
          width: '100%', 
          textAlign: 'center', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          borderRadius: '16px'
        }}
      >
        {/* Logo e Título */}
        <div style={{ margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
          <img 
            src="/logo.png" 
            alt="Boardgame Manager Logo" 
            style={{ width: '280px', maxWidth: '100%', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0px 0px 10px rgba(99,102,241,0.25))' }} 
          />
        </div>
        
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '700', marginBottom: '0.25rem', color: '#fff' }}>
            ControleBG
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {mode === 'login' && 'Acesse sua coleção e estoque de sleeves de qualquer navegador.'}
            {mode === 'register' && 'Crie sua conta para sincronizar seus jogos na nuvem.'}
            {mode === 'forgot' && 'Informe seu e-mail para recuperar o acesso.'}
          </p>
        </div>

        {/* Notificações de Erro ou Sucesso */}
        {errorMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.85rem',
            textAlign: 'left'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#86efac',
            fontSize: '0.85rem',
            textAlign: 'left'
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Abas Alternar Login / Cadastro */}
        {mode !== 'forgot' && (
          <div style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '0.5rem'
          }}>
            <button
              type="button"
              onClick={() => handleModeChange('login')}
              style={{
                flex: 1,
                padding: '0.6rem',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
                background: mode === 'login' ? 'var(--primary-color, #6366f1)' : 'transparent',
                color: mode === 'login' ? '#fff' : 'var(--text-muted)'
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('register')}
              style={{
                flex: 1,
                padding: '0.6rem',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
                background: mode === 'register' ? 'var(--primary-color, #6366f1)' : 'transparent',
                color: mode === 'register' ? '#fff' : 'var(--text-muted)'
              }}
            >
              Criar Conta
            </button>
          </div>
        )}

        {/* Formulário de Login */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="login-identifier" style={{ display: 'block', textAlign: 'left', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                E-mail ou Usuário
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  id="login-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="seu@email.com ou usuario"
                  className="search-input"
                  style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.4rem', borderRadius: '8px' }}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label htmlFor="login-password" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => handleModeChange('forgot')}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha secreta"
                  className="search-input"
                  style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 2.4rem', borderRadius: '8px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem' }} 
              disabled={isLoading || !identifier.trim() || !password}
            >
              {isLoading ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <LogIn size={18} />
                  Entrar
                </>
              )}
            </button>
          </form>
        )}

        {/* Formulário de Cadastro */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label htmlFor="reg-email" style={{ display: 'block', textAlign: 'left', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                E-mail
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  id="reg-email"
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="exemplo@gmail.com"
                  className="search-input"
                  style={{ width: '100%', padding: '0.7rem 0.7rem 0.7rem 2.4rem', borderRadius: '8px' }}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-user" style={{ display: 'block', textAlign: 'left', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Nome de Usuário (Opcional)
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  id="reg-user"
                  type="text"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  placeholder="Seu apelido na Ludopedia / BGG"
                  className="search-input"
                  style={{ width: '100%', padding: '0.7rem 0.7rem 0.7rem 2.4rem', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-pass" style={{ display: 'block', textAlign: 'left', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Senha (mínimo 6 caracteres)
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  id="reg-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Crie uma senha segura"
                  className="search-input"
                  style={{ width: '100%', padding: '0.7rem 2.5rem 0.7rem 2.4rem', borderRadius: '8px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm" style={{ display: 'block', textAlign: 'left', marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Confirmar Senha
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  id="reg-confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita sua senha"
                  className="search-input"
                  style={{ width: '100%', padding: '0.7rem 0.7rem 0.7rem 2.4rem', borderRadius: '8px' }}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '1rem', marginTop: '0.5rem' }} 
              disabled={isLoading || !identifier.trim() || !password || !confirmPassword}
            >
              {isLoading ? (
                <span>Criando conta...</span>
              ) : (
                <>
                  <UserPlus size={18} />
                  Criar Conta
                </>
              )}
            </button>
          </form>
        )}

        {/* Recuperação de Senha */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="forgot-email" style={{ display: 'block', textAlign: 'left', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                E-mail cadastrado
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  id="forgot-email"
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="seu@email.com"
                  className="search-input"
                  style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.4rem', borderRadius: '8px' }}
                  autoFocus
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '1rem' }} 
              disabled={isLoading || !identifier.trim()}
            >
              {isLoading ? 'Enviando...' : 'Enviar Link de Redefinição'}
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('login')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                marginTop: '0.25rem'
              }}
            >
              <ArrowLeft size={14} /> Voltar para o Login
            </button>
          </form>
        )}

        {/* Rodapé Informativo */}
        <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>
            Conectado ao Supabase Cloud (<span style={{ color: '#818cf8' }}>ControleBG</span>)
          </p>
        </div>
      </div>
    </div>
  );
}
