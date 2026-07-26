import ariaLogo from "@/assets/aria-logo.png";

export function AriaLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={ariaLogo}
      alt="Aria"
      width={512}
      height={512}
      className={className}
      style={{ filter: "drop-shadow(0 0 12px oklch(0.82 0.14 210 / 0.35))" }}
    />
  );
}
