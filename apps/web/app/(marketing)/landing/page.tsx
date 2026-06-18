/*
 * Marketing Landing Page — Conversion-optimized, Apple/Vercel-level design.
 *
 * Sections:
 *   1. Navbar
 *   2. Hero — "Build your career site in minutes. Not weeks."
 *   3. Social Proof — Trusted by modern teams
 *   4. Problem → Solution
 *   5. Features (6 cards mapped to real system)
 *   6. Demo Preview (tabbed product shots)
 *   7. How It Works (4 steps)
 *   8. Pricing (geo-aware)
 *   9. Competitor Comparison
 *  10. Final CTA
 *  11. Footer
 */

import React from "react";
import { SkipLink } from "@/lib/design-system-components";
import Navbar from "@/components/marketing/Navbar";
import Hero from "@/components/marketing/Hero";
import SocialProof from "@/components/marketing/SocialProof";
import ProblemSolution from "@/components/marketing/ProblemSolution";
import Features from "@/components/marketing/Features";
import DemoPreview from "@/components/marketing/DemoPreview";
import HowItWorks from "@/components/marketing/HowItWorks";
import PricingSection from "@/components/marketing/PricingSection";
import Comparison from "@/components/marketing/Comparison";
import FinalCta from "@/components/marketing/FinalCta";
import Footer from "@/components/marketing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <SkipLink />
      <Navbar />
      <main id="main-content">
        <Hero />
        <SocialProof />
        <ProblemSolution />
        <Features />
        <DemoPreview />
        <HowItWorks />
        <PricingSection />
        <Comparison />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
