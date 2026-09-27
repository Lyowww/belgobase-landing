import { UseCasePage, createUseCaseMetadata } from "@/components/UseCasePage";

export const generateMetadata = createUseCaseMetadata("bedrijfsanalyse");
export default function Page(props: { params: Promise<{ locale: string }> }) {
  return <UseCasePage {...props} slug="bedrijfsanalyse" />;
}
