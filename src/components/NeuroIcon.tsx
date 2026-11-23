/** Ícone do Neuro Links: neurônios (corpos com dendritos) ligados por sinapses — no traço dos ícones do app. */
export function NeuroIcon({ size = 16, className = '', style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={'lucide neuro-icon ' + className} style={style} aria-hidden="true">
      <path d="M8.2 10.2 15.6 6.6" />
      <path d="M8.4 12.6 15.4 17.2" />
      <path d="M17.6 8.6v6.6" />
      <path d="M4.2 8.6 2.6 7" />
      <path d="M4 13.6 2.4 15.2" />
      <path d="M20.2 4.4 21.6 3" />
      <path d="M20 19.6 21.6 21" />
      <circle cx="6" cy="11.2" r="2.8" fill="currentColor" fillOpacity=".18" />
      <circle cx="17.8" cy="5.6" r="2.4" />
      <circle cx="17.6" cy="18" r="2.4" />
    </svg>
  );
}
