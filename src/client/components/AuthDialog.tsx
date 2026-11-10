import React, { useEffect, useId, useRef, useState } from 'react';
import { KeyRound, Lock, ShieldCheck, X } from 'lucide-react';
import type { AuthRole } from '../types.js';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (password: string, role: AuthRole) => void;
}

export function AuthDialog({ isOpen, onClose, onSuccess }: AuthDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync open state with native showModal() / close()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      setPassword('');
      setError(null);
      dialog.showModal();
      setTimeout(() => inputRef.current?.focus(), 30);
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Native close listener + fallback for browsers without closedby="any"
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    dialog.addEventListener('close', handleNativeClose);

    // Fallback for browsers without <dialog closedby> support (modern-web-guidance: light-dismiss-a-dialog)
    let cleanupFallback: (() => void) | undefined;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
      cleanupFallback = () => dialog.removeEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      cleanupFallback?.();
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Digite a senha de Administrador ou Sistema.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        setError(data.error || 'Senha inválida. Verifique suas credenciais.');
        setLoading(false);
        return;
      }

      setLoading(false);
      onSuccess(password, data.role as AuthRole);
      dialogRef.current?.close();
    } catch {
      setError('Erro de conexão ao verificar senha no servidor.');
      setLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="m-auto w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-0 text-slate-100 shadow-2xl"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-white">
                Habilitar Modo Edição
              </h2>
              <p className="text-xs text-slate-400">
                Acesso restrito a <span className="text-indigo-300 font-medium">Administrator</span> ou{' '}
                <span className="text-indigo-300 font-medium">System</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar modal de autenticação"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="escala-admin-password"
              className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Senha de Acesso (SHA-512)
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                id="escala-admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha de administrador ou sistema..."
                autoComplete="current-password"
                autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300"
            >
              {error}
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              No Modo Edição, clique em qualquer célula na Grade, Calendário ou Comparador para editar
              inline. Todas as alterações são sincronizadas diretamente com o bucket do Supabase.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? 'Verificando...' : 'Desbloquear Edição'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

