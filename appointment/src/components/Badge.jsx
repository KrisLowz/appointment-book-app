export default function Badge({ children }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: 'var(--primary-bg)',
        color: 'var(--primary)',
        borderRadius: 'var(--radius-full)',
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}
