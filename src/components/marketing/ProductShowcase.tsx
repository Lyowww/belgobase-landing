import Image from "next/image";
import type { Locale } from "@/i18n/config";
import {
  productShowcaseCopy,
  type ProductVariant,
  workspaceProcessCopy,
} from "./marketing-copy";
import styles from "./ProductShowcase.module.css";

const productAssets: Record<
  ProductVariant,
  { src: string; width: number; height: number }
> = {
  selection: {
    src: "/product/belgobase-selectie-20261022.webp",
    width: 1600,
    height: 900,
  },
  financial: {
    src: "/product/belgobase-financial.webp",
    width: 1600,
    height: 1000,
  },
  workspace: {
    src: "/product/belgobase-workspace.webp",
    width: 1600,
    height: 1000,
  },
};

export function ProductShowcase({
  locale,
  variant = "selection",
  compact = false,
}: {
  locale: Locale;
  variant?: "selection" | "financial" | "workspace";
  compact?: boolean;
}) {
  const asset = productAssets[variant];
  const copy = productShowcaseCopy[locale][variant];
  const isFeaturedWorkspace = variant === "workspace" && !compact;

  const productImage = (
    <Image
      className={isFeaturedWorkspace ? styles.workspaceImage : styles.image}
      src={asset.src}
      width={asset.width}
      height={asset.height}
      sizes={
        compact
          ? "(max-width: 600px) 270vw, (max-width: 700px) 100vw, 720px"
          : "(max-width: 600px) 270vw, (max-width: 1500px) calc(100vw - 40px), 1280px"
      }
      alt={copy.alt}
      loading={isFeaturedWorkspace ? "eager" : undefined}
      fetchPriority={isFeaturedWorkspace ? "high" : undefined}
    />
  );

  return (
    <figure
      className={`${styles.showcase} ${compact ? styles.compact : ""}`}
      data-variant={variant}
    >
      {isFeaturedWorkspace ? (
        <div className={`${styles.imageFrame} ${styles.workspaceFrame}`}>
          <div className={styles.processRail}>
            <p className={styles.processHeading}>
              {workspaceProcessCopy[locale].heading}
            </p>
            <ol
              className={styles.processSteps}
              aria-label={workspaceProcessCopy[locale].ariaLabel}
            >
              {workspaceProcessCopy[locale].steps.map((step, index) => (
                <li className={styles.processStep} key={step}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.stepLabel}>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.workspaceCrop}>{productImage}</div>
        </div>
      ) : (
        <div className={styles.imageFrame}>{productImage}</div>
      )}
      <figcaption className={styles.caption}>
        <span className={styles.captionLabel}>{copy.eyebrow}</span>
        <span>{copy.caption}</span>
      </figcaption>
    </figure>
  );
}
