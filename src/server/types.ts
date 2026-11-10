export type AuthRole = 'administrator' | 'system';

export interface WorkerMetadata {
  matricula: string;
  nome: string;
  setor: string;
  funcao: string;
  sabado: string;
  domingo: string;
  escalaSemanal: string;
  entrada: string;
  inicioIntervalo: string;
  retornoIntervalo: string;
  escalaFimDeSemana: string;
  saida: string;
  totalIntervalo: string;
  totalLogado: string;
}

export interface WorkerScheduleRow extends WorkerMetadata {
  /** Keyed by date header in DD/MM/YYYY format */
  days: Record<string, string>;
}

export interface ScheduleDataset {
  dates: string[];
  workers: WorkerScheduleRow[];
  sectors: string[];
  roles: string[];
}

export type SyncStateCode =
  | 'INITIALIZING'
  | 'READY'
  | 'ERROR_MISSING_CSV'
  | 'ERROR_CONFIG';

export interface ServerSyncStatus {
  state: SyncStateCode;
  message: string;
  lastSyncedAt: string | null;
  bucket: string;
  filePath: string;
  workerCount: number;
  dateCount: number;
}

