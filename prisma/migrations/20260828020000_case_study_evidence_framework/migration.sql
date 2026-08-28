-- Adds the "evidence framework" fields for stronger, honest proof on case
-- studies: process improvements, a before/after comparison, and scale +
-- impact stat lists. All optional/defaulted so existing rows are unaffected,
-- and every section stays hidden on the public site until an admin actually
-- enters real, verified data.
ALTER TABLE "CaseStudy" ADD COLUMN "processImprovements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CaseStudy" ADD COLUMN "beforeState" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CaseStudy" ADD COLUMN "afterState" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CaseStudy" ADD COLUMN "scaleMetrics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CaseStudy" ADD COLUMN "impactMetrics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
