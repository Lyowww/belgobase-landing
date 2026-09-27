import { UseCasePage, createUseCaseMetadata } from "@/components/UseCasePage";

export const generateMetadata = createUseCaseMetadata("prospectielijsten");
export default function Page(props: { params: Promise<{ locale: string }> }) {
  return <UseCasePage {...props} slug="prospectielijsten" />;
}
