-- Optional structured proof points on CaseStudy (technologies list + a
-- single verified impact headline). Both default to empty/null so existing
-- rows are unaffected and nothing shows on the public site until an admin
-- actually fills them in.
ALTER TABLE "CaseStudy" ADD COLUMN "technologies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CaseStudy" ADD COLUMN "impactHeadline" TEXT;

-- Optional extra context on the expanded contact form.
ALTER TABLE "ContactInquiry" ADD COLUMN "website" TEXT;
ALTER TABLE "ContactInquiry" ADD COLUMN "toolsUsed" TEXT;
ALTER TABLE "ContactInquiry" ADD COLUMN "timeline" TEXT;
