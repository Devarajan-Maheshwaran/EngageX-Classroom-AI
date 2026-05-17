// ShinyText — ported from Health-Data-Wallet
// Recoloured: white → light-gray → white shimmer (no sky-blue tint)
export function ShinyText({ text, className = '' }) {
  return (
    <span
      className={`inline-block text-transparent bg-clip-text shiny-text-anim ${className}`}
    >
      {text}
    </span>
  );
}
