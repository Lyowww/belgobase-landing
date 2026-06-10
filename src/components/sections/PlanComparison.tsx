"use client";

import { Check, Minus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { cn } from "@/lib/utils";

const features = [
  { name: "Company count", starter: "500", growth: "2,000", scale: "5,000" },
  { name: "Contact enrichment", starter: "Basic", growth: "Full", scale: "Premium" },
  { name: "Delivery time", starter: "24 hours", growth: "Hours", scale: "< 4 hours" },
  { name: "Sector filtering", starter: true, growth: true, scale: true },
  { name: "NACE code filtering", starter: false, growth: true, scale: true },
  { name: "Revenue & employee filters", starter: false, growth: true, scale: true },
  { name: "Client exclusion", starter: true, growth: true, scale: true },
  { name: "Lookalike analysis", starter: false, growth: false, scale: true },
  { name: "Dedicated review", starter: false, growth: false, scale: true },
  { name: "Priority support", starter: false, growth: true, scale: true },
];

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-4 w-4 text-primary" />
    ) : (
      <Minus className="mx-auto h-4 w-4 text-border" />
    );
  }
  return <span className="text-sm text-deep-navy">{value}</span>;
}

export function PlanComparison() {
  return (
    <section id="comparison" className="noise-overlay relative bg-white py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          eyebrow="Plan Comparison"
          title="Compare plans at a glance"
          description="Every plan includes official KBO data, GDPR-safe delivery, and Excel export."
        />

        <SectionReveal>
          <div className="overflow-hidden rounded-2xl border border-border/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-border bg-light-bg/80">
                    <th className="sticky left-0 z-10 bg-light-bg/95 px-6 py-4 text-left text-sm font-semibold text-deep-navy backdrop-blur-sm">
                      Feature
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-deep-navy">
                      Starter
                    </th>
                    <th className="relative px-6 py-4 text-center text-sm font-semibold text-primary">
                      <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                      Growth
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-deep-navy">
                      Scale
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, i) => (
                    <tr
                      key={feature.name}
                      className={cn(
                        "border-b border-border/40 transition-colors hover:bg-primary/5",
                        i % 2 === 0 && "bg-white",
                        i % 2 === 1 && "bg-light-bg/30",
                      )}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-6 py-4 text-sm text-muted backdrop-blur-sm">
                        {feature.name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <CellValue value={feature.starter} />
                      </td>
                      <td className="bg-primary/5 px-6 py-4 text-center">
                        <CellValue value={feature.growth} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <CellValue value={feature.scale} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
