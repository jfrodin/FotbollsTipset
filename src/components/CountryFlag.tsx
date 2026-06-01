import Image from "next/image";

interface CountryFlagProps {
  code: string | null | undefined;
  size?: number;
  className?: string;
}

export function CountryFlag({ code, size = 24, className }: CountryFlagProps) {
  if (!code) return null;
  const src = `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
  return (
    <Image
      src={src}
      alt={code}
      width={size}
      height={size * 0.67}
      className={className}
      style={{ objectFit: "cover", borderRadius: 2 }}
      unoptimized
    />
  );
}
