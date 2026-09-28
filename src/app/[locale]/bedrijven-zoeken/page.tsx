import { UseCasePage, createUseCaseMetadata } from "@/components/UseCasePage";

export const generateMetadata = createUseCaseMetadata("bedrijven-zoeken");
export default function Page(props: { params: Promise<{ locale: string }> }) {
  return <UseCasePage {...props} slug="bedrijven-zoeken" />;
}
