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
// FORMATAÇÃO DE DATA
// ============================================================
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(date));
}

export function formatDateFull(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

// Mês e ano atual para filtros de dashboard
export function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = new Date(year, month, 1).toISOString().split("T")[0];
  const to = new Date(year, month + 1, 0).toISOString().split("T")[0];
  return { from, to, year, month: month + 1 };
}

// Nome do mês atual
export function getCurrentMonthName(): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date());
}
