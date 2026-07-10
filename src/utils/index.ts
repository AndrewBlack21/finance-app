// ============================================================
// FORMATAÇÃO DE MOEDA — multi-moeda
// ============================================================
export function formatCurrency(amount: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// ============================================================
// FORMATAÇÃO DE DATA (Corrigido o Bug de Fuso Horário)
// ============================================================
export function formatDate(date: string): string {
  // O SEGREDO ESTÁ AQUI: Se a data vier sem hora (ex: 2026-07-10),
  // forçamos para ser meio-dia (T12:00:00). Assim, o UTC-3 do Brasil
  // vai cair para as 09:00 da manhã do mesmo dia, e não para o dia anterior!
  const safeDate = date.includes("T") ? date : `${date}T12:00:00`;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(safeDate));
}

export function formatDateFull(date: string): string {
  const safeDate = date.includes("T") ? date : `${date}T12:00:00`;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(safeDate));
}

// Mês e ano atual para filtros de dashboard
export function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // NOVO CÁLCULO: Removemos o .toISOString() que causava o pulo de mês
  // se o utilizador abrisse a app de madrugada.
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { from, to, year, month: month + 1 };
}

// Nome do mês atual
export function getCurrentMonthName(): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date());
}

// ============================================================
// VALIDAÇÕES DE REGRAS DE NEGÓCIO
// ============================================================
export function canPayInvoice(
  invoiceMonth: number,
  invoiceYear: number,
): boolean {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  if (invoiceYear > currentYear) return false;
  if (invoiceYear === currentYear && invoiceMonth > currentMonth) return false;

  return true;
}
