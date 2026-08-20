import Image from "next/image";

/**
 * Envoltorio sobre next/image — pensado para las fotos que suben los
 * negocios (platos, perfiles, fondos), que vienen de una URL externa
 * (R2/S3) casi siempre, pero ocasionalmente todavía en base64 (fotos
 * de antes de migrar a R2, ver README). next/image no puede optimizar
 * un data URI, así que esas se muestran tal cual — no hay pérdida real
 * porque de todos modos no se pueden comprimir más desde acá.
 */
export default function SmartImage({
  src,
  alt,
  width,
  height,
  fill,
  className,
  sizes,
  priority,
}: {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) return null;

  if (src.startsWith("data:")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} />;
  }

  if (fill) {
    return <Image src={src} alt={alt} fill className={className} sizes={sizes} priority={priority} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 400}
      height={height ?? 400}
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}
