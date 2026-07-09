"use client";

import type { ReactNode } from "react";
import { contactEmail, contactPhone, contactPhoneHref } from "@/lib/site";
import { useTranslations } from "@/providers/TranslationsProvider";

const footerLinks = {
  product: [
    { labelKey: "footer.process" as const, href: "#process" },
    { labelKey: "footer.industries" as const, href: "#industries" },
    { labelKey: "footer.database" as const, href: "#database" },
    { labelKey: "footer.pricing" as const, href: "#pricing" },
  ],
  legal: [
    { labelKey: "footer.privacy" as const, href: "/privacy" },
    { labelKey: "footer.terms" as const, href: "/terms" },
  ],
};

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-deep-navy">{title}</h3>
      {children}
    </div>
  );
}

function FooterLinkList({
  links,
  t,
}: {
  links: { labelKey: string; href: string }[];
  t: (key: string) => string;
}) {
  return (
    <ul className="space-y-2.5">
      {links.map((link) => (
        <li key={link.labelKey}>
          <a
            href={link.href}
            className="text-sm text-muted transition-colors hover:text-deep-navy"
          >
            {t(link.labelKey)}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Footer() {
  const { t } = useTranslations();

  return (
    <footer className="border-t border-border bg-surface pt-12 pb-sticky-cta sm:pt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] lg:gap-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-md shadow-primary/20">
                <span className="text-sm font-bold text-white">B</span>
              </div>
              <span className="text-base font-semibold text-deep-navy">BelgoBase</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              {t("footer.tagline")}
            </p>
            <p className="mt-3 text-xs text-muted sm:text-sm">{t("footer.stats")}</p>
          </div>

          <FooterColumn title={t("footer.product")}>
            <FooterLinkList links={footerLinks.product} t={t} />
          </FooterColumn>

          <FooterColumn title={t("footer.company")}>
            <ul className="space-y-2.5">
              <li>
                <span className="text-sm font-medium text-deep-navy">{t("footer.contact")}</span>
                <div className="mt-1.5 flex flex-col gap-1">
                  <a
                    href={contactPhoneHref}
                    className="text-sm text-muted transition-colors hover:text-deep-navy"
                  >
                    {contactPhone}
                  </a>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-sm text-muted transition-colors hover:text-deep-navy"
                  >
                    {contactEmail}
                  </a>
                </div>
              </li>
              <li>
                <a
                  href="#faq"
                  className="text-sm text-muted transition-colors hover:text-deep-navy"
                >
                  {t("footer.faq")}
                </a>
              </li>
            </ul>
          </FooterColumn>

          <FooterColumn title={t("footer.legal")}>
            <FooterLinkList links={footerLinks.legal} t={t} />
          </FooterColumn>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center sm:mt-12">
          <p className="text-sm text-muted">
            © 2026 BelgoBase. {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}
