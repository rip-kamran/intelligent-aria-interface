import ariaLogoAsset from "@/assets/aria-logo.png.asset.json";

export function AriaLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={ariaLogoAsset.url}
      alt="Aria"
      width={512}
      height={512}
      className={className}
      style={{ filter: "drop-shadow(0 0 12px oklch(0.82 0.14 210 / 0.35))" }}
    />
  );
}
