import dynamic from "next/dynamic";
import { Header } from "@/components/layout/Header";
import { FloatingToolbar } from "@/components/layout/FloatingToolbar";
import { StickyCTA } from "@/components/layout/StickyCTA";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { Hero } from "@/components/sections/Hero";
import { SocialProof } from "@/components/sections/SocialProof";

const Process = dynamic(
  () => import("@/components/sections/Process").then((m) => ({ default: m.Process })),
);
const Industries = dynamic(
  () => import("@/components/sections/Industries").then((m) => ({ default: m.Industries })),
);
const LeadPreview = dynamic(
  () => import("@/components/sections/LeadPreview").then((m) => ({ default: m.LeadPreview })),
);
const Results = dynamic(
  () => import("@/components/sections/Results").then((m) => ({ default: m.Results })),
);
const Pricing = dynamic(
  () => import("@/components/sections/Pricing").then((m) => ({ default: m.Pricing })),
);
const PlanComparison = dynamic(
  () =>
    import("@/components/sections/PlanComparison").then((m) => ({
      default: m.PlanComparison,
    })),
);
const AddOns = dynamic(
  () => import("@/components/sections/AddOns").then((m) => ({ default: m.AddOns })),
);
const Enterprise = dynamic(
  () => import("@/components/sections/Enterprise").then((m) => ({ default: m.Enterprise })),
);
const FAQ = dynamic(
  () => import("@/components/sections/FAQ").then((m) => ({ default: m.FAQ })),
);
const FinalCTA = dynamic(
  () => import("@/components/sections/FinalCTA").then((m) => ({ default: m.FinalCTA })),
);

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <Header />
      <FloatingToolbar />
      <StickyCTA />
      <main className="min-w-0 overflow-x-hidden">
        <Hero />
        <SocialProof />
        <div className="section-lazy">
          <Process />
        </div>
        <div className="section-lazy">
          <Industries />
        </div>
        <div className="section-lazy">
          <LeadPreview />
        </div>
        <div className="section-lazy">
          <Results />
        </div>
        <div className="section-lazy">
          <Pricing />
        </div>
        <div className="section-lazy">
          <PlanComparison />
        </div>
        <div className="section-lazy">
          <AddOns />
        </div>
        <div className="section-lazy">
          <Enterprise />
        </div>
        <div className="section-lazy">
          <FAQ />
        </div>
        <div className="section-lazy">
          <FinalCTA />
        </div>
      </main>
      <Footer />
    </>
  );
}
