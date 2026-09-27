import { UseCasePage, createUseCaseMetadata } from "@/components/UseCasePage";

export const generateMetadata = createUseCaseMetadata("klantenbestand-analyseren");
export default function Page(props: { params: Promise<{ locale: string }> }) {
  return <UseCasePage {...props} slug="klantenbestand-analyseren" />;
}
