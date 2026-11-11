import crypto from 'node:crypto';
import type { Context, Next } from 'hono';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from './config.ts';
import type { AuthRole } from './types.ts';

export function hashPasswordSha512(plainPassword: string): string {
  return crypto.createHash('sha512').update(plainPassword, 'utf8').digest('hex');
}

export function safeCompareHexHashes(hashA: string, hashB: string): boolean {
  const cleanA = hashA.trim().toLowerCase();
  const cleanB = hashB.trim().toLowerCase();
  if (cleanA.length !== 128 || cleanB.length !== 128) {
    return false;
  }
  const bufA = Buffer.from(cleanA, 'utf8');
  const bufB = Buffer.from(cleanB, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface AuthVerificationResult {
  valid: boolean;
  role?: AuthRole;
  error?: string;
}

export class AuthService {
  private config: AppConfig;
  private supabase: SupabaseClient | null = null;

  constructor(config: AppConfig) {
    this.config = config;
    if (config.isConfigured) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  async verifyPassword(plainPassword: string): Promise<AuthVerificationResult> {
    if (!plainPassword || typeof plainPassword !== 'string') {
      return { valid: false, error: 'Senha não informada.' };
    }

    if (!this.supabase || !this.config.isConfigured) {
      return {
        valid: false,
        error: `Servidor sem configuração do Supabase (${this.config.missingVars.join(', ')}).`,
      };
    }

    const candidateHash = hashPasswordSha512(plainPassword);

    const { data, error } = await this.supabase
      .from(this.config.supabaseAuthTable)
      .select('role, password_hash')
      .in('role', ['administrator', 'system']);

    if (error) {
      console.error('[AuthService] Erro ao consultar tabela de autenticação no Supabase:', error.message);
      return {
        valid: false,
        error: `Erro ao consultar tabela public.${this.config.supabaseAuthTable} no Supabase: ${error.message}`,
      };
    }

    if (!data || data.length === 0) {
      return {
        valid: false,
        error: `Nenhuma credencial cadastrada em public.${this.config.supabaseAuthTable}. Execute sql/init_auth.sql no Supabase.`,
      };
    }

    for (const row of data) {
      const dbRole = row.role as string;
      const dbHash = (row.password_hash as string) || '';
      if (
        (dbRole === 'administrator' || dbRole === 'system') &&
        safeCompareHexHashes(candidateHash, dbHash)
      ) {
        return { valid: true, role: dbRole };
      }
    }

    return { valid: false, error: 'Senha inválida.' };
  }

  /**
   * Hono middleware that protects mutation endpoints using `x-escala-password`
   * header or `Authorization: Bearer <password>`.
   */
  middleware() {
    return async (c: Context, next: Next) => {
      const headerPassword = c.req.header('x-escala-password');
      const authHeader = c.req.header('authorization');
      let password = headerPassword || '';

      if (!password && authHeader?.toLowerCase().startsWith('bearer ')) {
        password = authHeader.slice(7).trim();
      }

      if (!password) {
        return c.json(
          {
            error: 'Acesso negado. Autenticação de administrador ou sistema é obrigatória para editar a escala.',
          },
          401
        );
      }

      const result = await this.verifyPassword(password);
      if (!result.valid || !result.role) {
        return c.json(
          {
            error: result.error || 'Senha inválida ou não autorizada.',
          },
          403
        );
      }

      c.set('authRole', result.role);
      await next();
    };
  }
}

