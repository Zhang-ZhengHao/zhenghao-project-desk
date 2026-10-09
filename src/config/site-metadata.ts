import type { Metadata } from "next";

const PREVIEW_TITLE = "Zhenghao Project Desk | Work in progress";
const PREVIEW_DESCRIPTION =
  "A work-in-progress project intake portal for Zhenghao Zhang's independent full-stack development services. Project intake is not open yet.";

export function createSiteMetadata(): Metadata {
  return {
    description: PREVIEW_DESCRIPTION,
    icons: {
      icon: "/favicon.svg",
    },
    metadataBase: null,
    openGraph: {
      description: PREVIEW_DESCRIPTION,
      siteName: "Zhenghao Project Desk",
      title: PREVIEW_TITLE,
      type: "website",
    },
    robots: {
      follow: false,
      index: false,
      noarchive: true,
      nosnippet: true,
    },
    title: PREVIEW_TITLE,
  };
}
