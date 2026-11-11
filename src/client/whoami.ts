// "whoami": matrícula do colaborador escolhido pelo usuário, guardada no navegador.
// O WebView do app Android reabre a tela já no mesmo colaborador.
const WHOAMI_KEY = 'escala.whoami';

export function readWhoami(): string | null {
  try {
    return window.localStorage.getItem(WHOAMI_KEY);
  } catch {
    // Armazenamento bloqueado: a escolha vale só nesta sessão.
    return null;
  }
}

export function writeWhoami(matricula: string): void {
  try {
    window.localStorage.setItem(WHOAMI_KEY, matricula);
  } catch {
    // Ignorado: a página continua funcionando sem persistir.
  }
}
