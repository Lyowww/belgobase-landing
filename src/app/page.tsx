import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { Hero } from "@/components/sections/Hero";
import { SocialProof } from "@/components/sections/SocialProof";
import { Process } from "@/components/sections/Process";
import { Industries } from "@/components/sections/Industries";
import { LeadPreview } from "@/components/sections/LeadPreview";
import { Results } from "@/components/sections/Results";
import { Pricing } from "@/components/sections/Pricing";
import { PlanComparison } from "@/components/sections/PlanComparison";
import { AddOns } from "@/components/sections/AddOns";
import { Enterprise } from "@/components/sections/Enterprise";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <Header />
      <main>
        <Hero />
        <SocialProof />
        <Process />
        <Industries />
        <LeadPreview />
        <Results />
        <Pricing />
        <PlanComparison />
        <AddOns />
        <Enterprise />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
