import Image from "next/image";

interface CountryFlagProps {
  code: string | null | undefined;
  size?: number;
  className?: string;
}

export function CountryFlag({ code, size = 24, className }: CountryFlagProps) {
  if (!code) return null;
  const src = `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
  const width = size;
  const height = Math.round(size * 0.67);
  return (
    <span
      style={{ display: "inline-block", width, height, flexShrink: 0, borderRadius: 2, overflow: "hidden" }}
      className={className}
    >
      <Image
        src={src}
        alt={code}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        unoptimized
      />
    </span>
  );
}
