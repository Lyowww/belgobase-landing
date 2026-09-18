import { notFound } from "next/navigation";
import { WorkspaceApp } from "@/components/workspace/WorkspaceApp";
import { isLocale } from "@/i18n/config";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AppPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <WorkspaceApp locale={locale} />;
}
