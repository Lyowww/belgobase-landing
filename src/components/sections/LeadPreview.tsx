"use client";

import { motion } from "framer-motion";
import {
  Building2,
  BarChart3,
  Mail,
  Phone,
  MapPin,
  Search,
  Filter,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SectionReveal } from "@/components/ui/SectionReveal";

const included = [
  {
    icon: Building2,
    title: "Company Details",
    description:
      "Name, VAT number, legal form, address, status, and incorporation date.",
  },
  {
    icon: BarChart3,
    title: "Sector Data",
    description: "Filter by industry, activity, and NACE codes.",
  },
  {
    icon: Mail,
    title: "Contact Details",
    description: "Available phone numbers and email addresses.",
  },
  {
    icon: BarChart3,
    title: "Company Insights",
    description: "Company age and other targeting attributes.",
  },
];

const lookalikeInsights = [
  "Geographic hotspots",
  "Key industries & NACE codes",
  "Common legal forms",
  "Company age patterns",
  "Similar companies ranked by match",
];

const sampleRows = [
  {
    name: "InnoTech Solutions BVBA",
    vat: "BE 0123.456.789",
    sector: "62.01 - Software",
    city: "Leuven",
    email: "info@innotech.be",
    phone: "+32 16 123 456",
  },
  {
    name: "Capital Advisory SPRL",
    vat: "BE 0987.654.321",
    sector: "69.20 - Accounting",
    city: "Brussels",
    email: "contact@capitaladv.be",
    phone: "+32 2 456 7890",
  },
  {
    name: "Flanders Logistics NV",
    vat: "BE 0456.789.012",
    sector: "49.41 - Freight",
    city: "Antwerp",
    email: "sales@flogistics.be",
    phone: "+32 3 234 5678",
  },
];

export function LeadPreview() {
  return (
    <section id="lead-preview" className="section-alt noise-overlay relative py-24 md:py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          eyebrow="Lead List Preview"
          title="Preview Your Lead List"
          description="Stop searching manually on LinkedIn or Google. Receive a ready-to-use B2B leads list built around your exact criteria."
        />

        <div className="grid gap-12 lg:grid-cols-2">
          <SectionReveal direction="left">
            <div className="mb-8">
              <h3 className="mb-6 text-lg font-semibold text-deep-navy">
                What&apos;s included
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {included.map((item) => (
                  <motion.div
                    key={item.title}
                    whileHover={{ y: -3 }}
                    className="rounded-xl border border-border/60 bg-white p-5"
                  >
                    <item.icon className="mb-3 h-5 w-5 text-primary" />
                    <h4 className="mb-1 text-sm font-semibold text-deep-navy">
                      {item.title}
                    </h4>
                    <p className="text-xs leading-relaxed text-muted">
                      {item.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-6">
              <h3 className="mb-2 text-lg font-semibold text-deep-navy">
                Find More Companies Like Your Best Customers
              </h3>
              <p className="mb-4 text-sm text-muted">
                Provide 10–30 existing customers and we&apos;ll identify similar
                companies across 2M+ Belgian businesses.
              </p>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-primary">
                What we typically uncover
              </p>
              <ul className="space-y-2">
                {lookalikeInsights.map((insight) => (
                  <li
                    key={insight}
                    className="flex items-center gap-2 text-sm text-deep-navy"
                  >
                    <span className="text-emerald-500">✓</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          </SectionReveal>

          <SectionReveal direction="right" delay={0.15}>
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-xl shadow-primary/5">
              <div className="flex items-center gap-3 border-b border-border/60 bg-light-bg/80 px-5 py-4">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
                </div>
                <span className="text-xs font-medium text-muted">
                  BelgoBase Lead Explorer
                </span>
              </div>

              <div className="border-b border-border/40 p-4">
                <div className="flex gap-3">
                  <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
                    <Search className="h-4 w-4 text-muted" />
                    <span className="text-sm text-muted">
                      IT Services · Flanders · BVBA
                    </span>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm text-muted"
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-light-bg/50 text-xs text-muted">
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">
                        Sector
                      </th>
                      <th className="px-4 py-3 font-medium">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map((row, i) => (
                      <motion.tr
                        key={row.vat}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className="border-b border-border/30 transition-colors hover:bg-primary/5"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-deep-navy">{row.name}</p>
                          <p className="text-xs text-muted">{row.vat}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted sm:hidden">
                            <MapPin className="h-3 w-3" />
                            {row.city}
                          </p>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <p className="text-deep-navy">{row.sector}</p>
                          <p className="flex items-center gap-1 text-xs text-muted">
                            <MapPin className="h-3 w-3" />
                            {row.city}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="flex items-center gap-1 text-xs text-deep-navy">
                            <Mail className="h-3 w-3 text-primary" />
                            {row.email}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                            <Phone className="h-3 w-3" />
                            {row.phone}
                          </p>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between bg-light-bg/50 px-4 py-3 text-xs text-muted">
                <span>Showing 3 of 1,247 matches</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-600">
                  94% data completeness
                </span>
              </div>
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
