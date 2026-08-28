-- Adds the project-type filter category and a "featured" flag used by the
-- premium Case Studies index page. Both optional/defaulted so existing rows
-- are unaffected: projectType stays hidden from every filter and featured
-- defaults to false until an admin sets them.
ALTER TABLE "CaseStudy" ADD COLUMN "projectType" TEXT;
ALTER TABLE "CaseStudy" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
