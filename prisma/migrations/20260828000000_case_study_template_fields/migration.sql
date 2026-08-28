-- Adds the remaining fields needed for the full case-study page template
-- (summary, opportunity, how-it-works steps, key features, what's next).
-- All optional/defaulted so existing rows are unaffected and nothing shows
-- on the public site until an admin actually fills them in.
ALTER TABLE "CaseStudy" ADD COLUMN "summary" TEXT;
ALTER TABLE "CaseStudy" ADD COLUMN "opportunity" TEXT;
ALTER TABLE "CaseStudy" ADD COLUMN "howItWorks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CaseStudy" ADD COLUMN "keyFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CaseStudy" ADD COLUMN "whatsNext" TEXT;
