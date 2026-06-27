const COLORS: Record<string, string> = {
  free: "!text-success",
  reserved: "!text-accent-2",
  sold: "!text-text-muted",
  succeeded: "!text-success",
  pending: "!text-accent-2",
  canceled: "!text-danger",
};

const LABELS: Record<string, string> = {
  free: "свободна",
  reserved: "резерв",
  sold: "продана",
  succeeded: "оплачен",
  pending: "ожидает",
  canceled: "отменён",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${COLORS[status] ?? ""}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
