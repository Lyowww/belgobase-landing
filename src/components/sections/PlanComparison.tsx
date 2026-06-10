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

const plans = [
  { key: "starter" as const, name: "Starter", highlight: false },
  { key: "growth" as const, name: "Growth", highlight: true },
  { key: "scale" as const, name: "Scale", highlight: false },
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

function MobilePlanValue({
  value,
}: {
  value: string | boolean;
}) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="h-4 w-4 shrink-0 text-primary" />
    ) : (
      <Minus className="h-4 w-4 shrink-0 text-border" />
    );
  }
  return <span className="text-sm font-medium text-deep-navy">{value}</span>;
}

export function PlanComparison() {
  return (
    <section
      id="comparison"
      className="noise-overlay relative bg-white py-16 sm:py-24 md:py-32"
    >
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Plan Comparison"
          title="Compare plans at a glance"
          description="Every plan includes official KBO data, GDPR-safe delivery, and Excel export."
        />

        {/* Mobile: stacked plan cards */}
        <SectionReveal>
          <div className="space-y-4 md:hidden">
            {plans.map((plan) => (
              <div
                key={plan.key}
                className={cn(
                  "overflow-hidden rounded-xl border",
                  plan.highlight
                    ? "border-primary bg-primary/5"
                    : "border-border/60 bg-white",
                )}
              >
                <div
                  className={cn(
                    "border-b px-4 py-3",
                    plan.highlight
                      ? "border-primary/20 bg-primary/10"
                      : "border-border/60 bg-light-bg/50",
                  )}
                >
                  <h3
                    className={cn(
                      "text-sm font-semibold",
                      plan.highlight ? "text-primary" : "text-deep-navy",
                    )}
                  >
                    {plan.name}
                    {plan.highlight && (
                      <span className="ml-2 text-xs font-normal text-primary/80">
                        · Most Popular
                      </span>
                    )}
                  </h3>
                </div>
                <ul className="divide-y divide-border/40">
                  {features.map((feature) => (
                    <li
                      key={feature.name}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="min-w-0 flex-1 text-xs text-muted">
                        {feature.name}
                      </span>
                      <MobilePlanValue value={feature[plan.key]} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionReveal>

        {/* Desktop: comparison table */}
        <SectionReveal>
          <div className="hidden overflow-hidden rounded-2xl border border-border/60 shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-border bg-light-bg/80">
                    <th className="sticky left-0 z-10 min-w-[180px] bg-light-bg/95 px-4 py-4 text-left text-sm font-semibold text-deep-navy backdrop-blur-sm lg:px-6">
                      Feature
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-deep-navy lg:px-6">
                      Starter
                    </th>
                    <th className="relative bg-primary/5 px-4 py-4 text-center text-sm font-semibold text-primary lg:px-6">
                      <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
                      Growth
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-deep-navy lg:px-6">
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
                        i % 2 === 0 ? "bg-white" : "bg-light-bg/30",
                      )}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-3 text-sm text-muted lg:px-6 lg:py-4">
                        {feature.name}
                      </td>
                      <td className="px-4 py-3 text-center lg:px-6 lg:py-4">
                        <CellValue value={feature.starter} />
                      </td>
                      <td className="bg-primary/5 px-4 py-3 text-center lg:px-6 lg:py-4">
                        <CellValue value={feature.growth} />
                      </td>
                      <td className="px-4 py-3 text-center lg:px-6 lg:py-4">
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
