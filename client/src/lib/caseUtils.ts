export const CASE_STATUS_META: Record<string, { label: string; className: string }> = {
  pending_payment: {
    label: "待繳款",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  paid: {
    label: "已繳款",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  appealing: {
    label: "申訴中",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  closed: {
    label: "結案",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

export function getCaseStatusMeta(status: string) {
  return CASE_STATUS_META[status] ?? { label: status, className: "border-slate-200 bg-slate-100 text-slate-700" };
}

export function formatDateTime(value: Date | string | number | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatDate(value: Date | string | number | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatCurrency(amount: number | null | undefined) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

export function toDateTimeLocal(value: Date | string | number) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
