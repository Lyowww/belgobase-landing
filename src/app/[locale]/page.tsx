import dynamic from "next/dynamic";
import { ComingSoon } from "@/components/ComingSoon";
import { createLocalizedPageMetadata } from "@/lib/seo/metadata";
import { Header } from "@/components/layout/Header";
import { comingSoonEnabled } from "@/lib/site";
import { FloatingToolbar } from "@/components/layout/FloatingToolbar";
import { StickyCTA } from "@/components/layout/StickyCTA";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { ScrollRestoration } from "@/components/layout/ScrollRestoration";
import { SectionSkeleton } from "@/components/ui/SectionSkeleton";
import { Hero } from "@/components/sections/Hero";

const SocialProof = dynamic(
  () => import("@/components/sections/SocialProof").then((m) => ({ default: m.SocialProof })),
  { loading: () => <SectionSkeleton /> },
);
const Process = dynamic(
  () => import("@/components/sections/Process").then((m) => ({ default: m.Process })),
  { loading: () => <SectionSkeleton /> },
);
const Industries = dynamic(
  () => import("@/components/sections/Industries").then((m) => ({ default: m.Industries })),
  { loading: () => <SectionSkeleton /> },
);
const LeadPreview = dynamic(
  () => import("@/components/sections/LeadPreview").then((m) => ({ default: m.LeadPreview })),
  { loading: () => <SectionSkeleton /> },
);
const Results = dynamic(
  () => import("@/components/sections/Results").then((m) => ({ default: m.Results })),
  { loading: () => <SectionSkeleton /> },
);
const Pricing = dynamic(
  () => import("@/components/sections/Pricing").then((m) => ({ default: m.Pricing })),
  { loading: () => <SectionSkeleton /> },
);
const PlanComparison = dynamic(
  () =>
    import("@/components/sections/PlanComparison").then((m) => ({
      default: m.PlanComparison,
    })),
  { loading: () => <SectionSkeleton /> },
);
const AddOns = dynamic(
  () => import("@/components/sections/AddOns").then((m) => ({ default: m.AddOns })),
  { loading: () => <SectionSkeleton /> },
);
const Enterprise = dynamic(
  () => import("@/components/sections/Enterprise").then((m) => ({ default: m.Enterprise })),
  { loading: () => <SectionSkeleton /> },
);
const FAQ = dynamic(
  () => import("@/components/sections/FAQ").then((m) => ({ default: m.FAQ })),
  { loading: () => <SectionSkeleton /> },
);
const FinalCTA = dynamic(
  () => import("@/components/sections/FinalCTA").then((m) => ({ default: m.FinalCTA })),
  { loading: () => <SectionSkeleton /> },
);

export const generateMetadata = createLocalizedPageMetadata();

export default function Home() {
  if (comingSoonEnabled) {
    return <ComingSoon />;
  }

  return (
    <>
      <ScrollRestoration />
      <ScrollProgress />
      <Header />
      <FloatingToolbar />
      <StickyCTA />
      <main className="min-w-0 overflow-x-hidden [overflow-anchor:none]">
        <Hero />
        <div className="section-lazy section-lazy--social">
          <SocialProof />
        </div>
        <div className="section-lazy section-lazy--process">
          <Process />
        </div>
        <div className="section-lazy section-lazy--default">
          <Industries />
        </div>
        <div className="section-lazy section-lazy--default">
          <LeadPreview />
        </div>
        <div className="section-lazy section-lazy--default">
          <Results />
        </div>
        <div className="section-lazy section-lazy--pricing">
          <Pricing />
        </div>
        <div className="section-lazy section-lazy--pricing">
          <PlanComparison />
        </div>
        <div className="section-lazy section-lazy--default">
          <AddOns />
        </div>
        <div className="section-lazy section-lazy--enterprise">
          <Enterprise />
        </div>
        <div className="section-lazy section-lazy--faq">
          <FAQ />
        </div>
        <div className="section-lazy section-lazy--cta">
          <FinalCTA />
        </div>
      </main>
      <Footer />
    </>
  );
}
