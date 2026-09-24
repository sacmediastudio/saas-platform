export default function Btn({ children, variant = "primary", className = "", as: As = "a", ...rest }: any) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-7 min-h-[52px] text-[15px] font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/30";
  const styles: Record<string, string> = {
    primary: "bg-lime text-forest hover:-translate-y-0.5 hover:brightness-105",
    dark: "bg-forest text-white hover:-translate-y-0.5 hover:bg-forest/90",
    ghost: "border border-forest/15 text-forest hover:-translate-y-0.5 hover:border-forest/40 hover:bg-forest/[0.03]",
  };
  return (
    <As className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </As>
  );
}
