import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CloudUpload,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GitCompare,
  Lock,
  LogOut,
  RefreshCw,
  Save,
  Search,
  Table2,
  Unlock,
} from 'lucide-react';
import { AuthDialog } from './components/AuthDialog.js';
import { CalendarView } from './components/CalendarView.js';
import { ComparisonView } from './components/ComparisonView.js';
import { GridView } from './components/GridView.js';
import { exportToCsv, exportToPdf, exportToXlsx } from './exportUtils.js';
import type {
  AuthRole,
  ScheduleDataset,
  ServerSyncStatus,
  ViewMode,
  WorkerMetadata,
  WorkerScheduleRow,
} from './types.js';

export function App() {
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<ServerSyncStatus | null>(null);
  const [dataset, setDataset] = useState<ScheduleDataset | null>(null);
  const [abortedError, setAbortedError] = useState<string | null>(null);

  // Navigation & Filters
  const [activeView, setActiveView] = useState<ViewMode>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');

  // Authentication & Edit Mode state
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [authRole, setAuthRole] = useState<AuthRole | null>(null);
  const [autoSyncInline, setAutoSyncInline] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editMode = Boolean(adminPassword && authRole);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/escala');
      const body = await res.json();

      if (!res.ok || body.aborted) {
        setDataset(null);
        setSyncStatus(body.status || null);
        setAbortedError(
          body.error ||
            'O arquivo escala.csv não foi encontrado no bucket do Supabase. Funcionalidade principal abortada.'
        );
      } else {
        setDataset(body.data);
        setSyncStatus(body.status);
        setAbortedError(null);
        setHasUnsavedChanges(false);
      }
    } catch {
      setDataset(null);
      setAbortedError('Não foi possível conectar ao servidor backend Hono.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleRetrySync = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (adminPassword) {
        headers['x-escala-password'] = adminPassword;
      }
      const res = await fetch('/api/escala/sync', {
        method: 'POST',
        headers,
      });
      const body = await res.json();
      if (!res.ok || body.aborted) {
        setDataset(null);
        setSyncStatus(body.status || null);
        setAbortedError(body.error || 'Falha ao sincronizar com o Supabase.');
      } else {
        setDataset(body.data);
        setSyncStatus(body.status);
        setAbortedError(null);
        showToast('Escala sincronizada com sucesso a partir do Supabase!');
      }
    } catch {
      setAbortedError('Falha de rede ao tentar sincronizar com o Supabase.');
    } finally {
      setLoading(false);
    }
  };

  // Push full dataset to Hono -> Supabase Storage Bucket
  const pushDatasetToSupabase = useCallback(
    async (updatedDataset: ScheduleDataset) => {
      if (!adminPassword) return;
      setSavingState('saving');
      try {
        const res = await fetch('/api/escala', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-escala-password': adminPassword,
          },
          body: JSON.stringify({ data: updatedDataset }),
        });

        const body = await res.json();
        if (!res.ok) {
          setSavingState('error');
          showToast(body.error || 'Erro ao salvar alterações no Supabase.');
          return;
        }

        setDataset(body.data);
        setSyncStatus(body.status);
        setHasUnsavedChanges(false);
        setSavingState('saved');
        showToast('Alterações salvas no cache local e sincronizadas com o Supabase!');
      } catch {
        setSavingState('error');
        showToast('Erro de conexão ao salvar no Supabase.');
      }
    },
    [adminPassword, showToast]
  );

  // Inline cell edit handler (used across Calendar, Comparison, and Grid views)
  const handleCellEdit = useCallback(
    (matricula: string, date: string, newValue: string) => {
      if (!dataset || !editMode) return;

      const updatedWorkers = dataset.workers.map((w) => {
        if (w.matricula !== matricula) return w;
        return {
          ...w,
          days: {
            ...w.days,
            [date]: newValue,
          },
        };
      });

      const nextDataset: ScheduleDataset = {
        ...dataset,
        workers: updatedWorkers,
      };

      setDataset(nextDataset);
      if (autoSyncInline) {
        pushDatasetToSupabase(nextDataset);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [dataset, editMode, autoSyncInline, pushDatasetToSupabase]
  );

  // Inline metadata edit handler (used in Grid view)
  const handleMetadataEdit = useCallback(
    (matricula: string, field: keyof WorkerMetadata, newValue: string) => {
      if (!dataset || !editMode) return;

      const updatedWorkers = dataset.workers.map((w) => {
        if (w.matricula !== matricula) return w;
        return {
          ...w,
          [field]: newValue,
        };
      });

      const sectorSet = new Set<string>();
      const roleSet = new Set<string>();
      for (const w of updatedWorkers) {
        if (w.setor) sectorSet.add(w.setor);
        if (w.funcao) roleSet.add(w.funcao);
      }

      const nextDataset: ScheduleDataset = {
        ...dataset,
        workers: updatedWorkers,
        sectors: Array.from(sectorSet).sort(),
        roles: Array.from(roleSet).sort(),
      };

      setDataset(nextDataset);
      if (autoSyncInline) {
        pushDatasetToSupabase(nextDataset);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [dataset, editMode, autoSyncInline, pushDatasetToSupabase]
  );

  const handleAddWorker = useCallback(
    (newWorker: WorkerScheduleRow) => {
      if (!dataset || !editMode) return;
      const nextDataset: ScheduleDataset = {
        ...dataset,
        workers: [newWorker, ...dataset.workers],
      };
      setDataset(nextDataset);
      if (autoSyncInline) {
        pushDatasetToSupabase(nextDataset);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [dataset, editMode, autoSyncInline, pushDatasetToSupabase]
  );

  const handleDeleteWorker = useCallback(
    (matricula: string) => {
      if (!dataset || !editMode) return;
      const nextDataset: ScheduleDataset = {
        ...dataset,
        workers: dataset.workers.filter((w) => w.matricula !== matricula),
      };
      setDataset(nextDataset);
      if (autoSyncInline) {
        pushDatasetToSupabase(nextDataset);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [dataset, editMode, autoSyncInline, pushDatasetToSupabase]
  );

  const handleAddDateColumn = useCallback(
    (newDate: string) => {
      if (!dataset || !editMode) return;
      if (dataset.dates.includes(newDate)) {
        showToast(`A data ${newDate} já existe na escala.`);
        return;
      }
      const nextDates = [...dataset.dates, newDate];
      const nextWorkers = dataset.workers.map((w) => ({
        ...w,
        days: { ...w.days, [newDate]: '08:48' },
      }));
      const nextDataset: ScheduleDataset = {
        ...dataset,
        dates: nextDates,
        workers: nextWorkers,
      };
      setDataset(nextDataset);
      if (autoSyncInline) {
        pushDatasetToSupabase(nextDataset);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [dataset, editMode, autoSyncInline, pushDatasetToSupabase, showToast]
  );

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adminPassword) return;

    setSavingState('saving');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/escala/upload', {
        method: 'POST',
        headers: {
          'x-escala-password': adminPassword,
        },
        body: formData,
      });

      const body = await res.json();
      if (!res.ok) {
        setSavingState('error');
        showToast(body.error || 'Erro ao fazer upload do CSV.');
        return;
      }

      setDataset(body.data);
      setSyncStatus(body.status);
      setAbortedError(null);
      setHasUnsavedChanges(false);
      setSavingState('saved');
      showToast('Novo escala.csv enviado e sincronizado com o bucket do Supabase!');
    } catch {
      setSavingState('error');
      showToast('Erro de rede ao enviar arquivo CSV.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filtered workers
  const filteredWorkers = useMemo(() => {
    if (!dataset) return [];
    const q = searchQuery.trim().toLowerCase();
    return dataset.workers.filter((w) => {
      if (selectedSector !== 'ALL' && w.setor !== selectedSector) return false;
      if (selectedRole !== 'ALL' && w.funcao !== selectedRole) return false;
      if (q) {
        const matchName = w.nome.toLowerCase().includes(q);
        const matchId = w.matricula.toLowerCase().includes(q);
        const matchSector = w.setor.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchSector) return false;
      }
      return true;
    });
  }, [dataset, searchQuery, selectedSector, selectedRole]);

  const filterSubtitle = useMemo(() => {
    const parts: string[] = [];
    if (selectedSector !== 'ALL') parts.push(`Setor: ${selectedSector}`);
    else parts.push('Todos os Setores');
    if (selectedRole !== 'ALL') parts.push(`Função: ${selectedRole}`);
    parts.push(`${filteredWorkers.length} colaboradores`);
    return parts.join(' · ');
  }, [selectedSector, selectedRole, filteredWorkers.length]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Brand Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
              <Calendar className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  TI Escala
                </h1>
                {editMode ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                    <Unlock className="h-3 w-3" aria-hidden="true" />
                    Modo Edição ({authRole})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    <Lock className="h-3 w-3 text-slate-400" aria-hidden="true" />
                    Somente Leitura
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Visualizador e Editor de Escala de Trabalho ·{' '}
                {syncStatus?.lastSyncedAt
                  ? `Sincronizado às ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString('pt-BR')}`
                  : 'Supabase Storage Sync'}
              </p>
            </div>
          </div>

          {/* Right Action Controls: Exports + Edit Mode Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {dataset && !abortedError && (
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 p-1">
                <span className="px-2 text-[11px] font-medium text-slate-400 hidden sm:inline">
                  Exportar:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    exportToPdf(filteredWorkers, dataset.dates, filterSubtitle, 'escala.pdf')
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer"
                  title="Exportar visualização filtrada para PDF"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => exportToXlsx(filteredWorkers, dataset.dates, 'escala.xlsx')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                  title="Exportar planilha colorida em formato Excel (.xlsx)"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  XLSX
                </button>
                <button
                  type="button"
                  onClick={() => exportToCsv(dataset.workers, dataset.dates, 'escala.csv')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 px-2.5 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/25 transition-colors cursor-pointer"
                  title="Exportar arquivo escala.csv original separado por ponto e vírgula"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  CSV
                </button>
              </div>
            )}

            {/* Edit Mode / Auth Controls */}
            {!editMode ? (
              <button
                type="button"
                onClick={() => setIsAuthDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Entrar no Modo Edição
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncInline}
                    onChange={(e) => setAutoSyncInline(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  Auto-salvar no Supabase
                </label>

                {!autoSyncInline && hasUnsavedChanges && dataset && (
                  <button
                    type="button"
                    onClick={() => pushDatasetToSupabase(dataset)}
                    disabled={savingState === 'saving'}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    {savingState === 'saving' ? 'Salvando...' : 'Salvar no Supabase'}
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/25 cursor-pointer"
                >
                  <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
                  Upload CSV
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdminPassword(null);
                    setAuthRole(null);
                    showToast('Modo Edição encerrado. Retornado para Somente Leitura.');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sair da Edição
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl border border-indigo-500/40 bg-slate-900/95 px-4 py-3 text-xs font-medium text-slate-100 shadow-2xl backdrop-blur-md"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 py-24 text-center">
            <RefreshCw
              className="h-8 w-8 animate-spin text-indigo-400 mb-3"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-slate-200">
              Sincronizando escala.csv a partir do Supabase Storage...
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Preparando o cache local da instância.
            </p>
          </div>
        ) : abortedError || !dataset ? (
          /* Critical Missing CSV / Aborted Functionality Screen */
          <div
            role="alert"
            className="mx-auto max-w-2xl my-12 rounded-3xl border border-rose-500/40 bg-slate-900/90 p-8 shadow-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-3 flex-1">
                <h2 className="text-lg font-bold text-white">
                  Funcionalidade Principal Abortada — Arquivo escala.csv Indisponível
                </h2>
                <p className="text-sm text-rose-200/90 leading-relaxed">
                  {abortedError}
                </p>

                {syncStatus && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs font-mono text-slate-300 space-y-1">
                    <div>
                      <span className="text-slate-500">Estado:</span>{' '}
                      <span className="text-rose-400 font-semibold">{syncStatus.state}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Bucket Supabase:</span>{' '}
                      <span>{syncStatus.bucket}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Caminho esperado:</span>{' '}
                      <span>{syncStatus.filePath}</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRetrySync}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Tentar Sincronizar Novamente
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Navigation Tabs + Global Filters Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-slate-800/90 bg-slate-900/75 p-3">
              {/* Accessible Tablist (modern-web-guidance: tabs) */}
              <div
                role="tablist"
                aria-label="Modos de visualização da escala"
                {...({ focusgroup: 'tablist nomemory' } as Record<string, string>)}
                className="flex items-center gap-1 overflow-x-auto"
              >
                <button
                  type="button"
                  role="tab"
                  id="tab-calendar"
                  aria-selected={activeView === 'calendar'}
                  {...(activeView === 'calendar' ? { focusgroupstart: '' } : {})}
                  onClick={() => setActiveView('calendar')}
                  className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeView === 'calendar'
                      ? 'bg-indigo-500/15 text-indigo-300 after:content-[""] after:absolute after:inset-x-2 after:bottom-0 after:border-b-[3px] after:border-indigo-400'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  Calendário
                </button>

                <button
                  type="button"
                  role="tab"
                  id="tab-compare"
                  aria-selected={activeView === 'compare'}
                  {...(activeView === 'compare' ? { focusgroupstart: '' } : {})}
                  onClick={() => setActiveView('compare')}
                  className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeView === 'compare'
                      ? 'bg-indigo-500/15 text-indigo-300 after:content-[""] after:absolute after:inset-x-2 after:bottom-0 after:border-b-[3px] after:border-indigo-400'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <GitCompare className="h-4 w-4" aria-hidden="true" />
                  Comparar Colaboradores
                </button>

                <button
                  type="button"
                  role="tab"
                  id="tab-grid"
                  aria-selected={activeView === 'grid'}
                  {...(activeView === 'grid' ? { focusgroupstart: '' } : {})}
                  onClick={() => setActiveView('grid')}
                  className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeView === 'grid'
                      ? 'bg-indigo-500/15 text-indigo-300 after:content-[""] after:absolute after:inset-x-2 after:bottom-0 after:border-b-[3px] after:border-indigo-400'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Table2 className="h-4 w-4" aria-hidden="true" />
                  Planilha / Grade (Excel)
                </button>
              </div>

              {/* Global Search & Sector/Role Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:flex-initial sm:w-64">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar nome ou matrícula..."
                    aria-label="Buscar colaborador por nome ou matrícula"
                    className="w-full rounded-xl border border-slate-700/90 bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-slate-400 hidden sm:inline" aria-hidden="true" />
                  <select
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                    aria-label="Filtrar por Setor"
                    className="rounded-xl border border-slate-700/90 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="ALL">Todos os Setores ({dataset.sectors.length})</option>
                    {dataset.sectors.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    aria-label="Filtrar por Função"
                    className="rounded-xl border border-slate-700/90 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="ALL">Todas as Funções</option>
                    {dataset.roles.map((r) => (
                      <option key={r} value={r}>
                        Função {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Active Tab Panel */}
            <div
              role="tabpanel"
              aria-labelledby={`tab-${activeView}`}
            >
              {activeView === 'calendar' && (
                <CalendarView
                  workers={filteredWorkers}
                  dates={dataset.dates}
                  editMode={editMode}
                  onCellEdit={handleCellEdit}
                />
              )}

              {activeView === 'compare' && (
                <ComparisonView
                  workers={filteredWorkers}
                  dates={dataset.dates}
                  editMode={editMode}
                  onCellEdit={handleCellEdit}
                />
              )}

              {activeView === 'grid' && (
                <GridView
                  workers={filteredWorkers}
                  dates={dataset.dates}
                  editMode={editMode}
                  onCellEdit={handleCellEdit}
                  onMetadataEdit={handleMetadataEdit}
                  onAddWorker={handleAddWorker}
                  onDeleteWorker={handleDeleteWorker}
                  onAddDateColumn={handleAddDateColumn}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* SHA-512 Authentication Modal */}
      <AuthDialog
        isOpen={isAuthDialogOpen}
        onClose={() => setIsAuthDialogOpen(false)}
        onSuccess={(pwd, role) => {
          setAdminPassword(pwd);
          setAuthRole(role);
          showToast(`Modo Edição habilitado como ${role.toUpperCase()}!`);
        }}
      />
    </div>
  );
}

