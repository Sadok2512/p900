type ProbeTypeBadgeProps = {
  probeType?: unknown;
};

export default function ProbeTypeBadge({ probeType }: ProbeTypeBadgeProps) {
  const value = typeof probeType === 'string' ? probeType.trim() : '';
  if (!value) return null;

  const isVtap = value.toLowerCase() === 'vtap';
  return (
    <span
      title={`probe_type=${value}`}
      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
        isVtap
          ? 'border-success-line bg-success-soft text-success'
          : 'border-border bg-surface-2 text-muted-foreground'
      }`}
    >
      {value}
    </span>
  );
}
