export type PublicProject = Readonly<{
  boundary: string;
  description: string;
  evidenceLabel: "Synthetic data" | "Self-initiated concept";
  image: Readonly<{
    alt: string;
    height: number;
    src: string;
    width: number;
  }>;
  repositoryUrl: `https://github.com/Zhang-ZhengHao/${string}`;
  stack: string;
  title: string;
}>;

export const publicProjects = [
  {
    boundary:
      "All identities and outcomes are synthetic. v0.2.0 is a pre-release.",
    description:
      "React and FastAPI operations desk for payment, refund, and fulfillment exceptions with role-based access, an action audit trail, and signed webhook replay handling.",
    evidenceLabel: "Synthetic data",
    image: {
      alt: "CommerceOps Desk exception queue beside an open refund case with assignment, internal note, resolution, and audit controls.",
      height: 855,
      src: "/images/projects/commerceops-desk.png",
      width: 1152,
    },
    repositoryUrl: "https://github.com/Zhang-ZhengHao/commerce-ops-desk",
    stack: "React / FastAPI / SQLite demo / PostgreSQL CI",
    title: "CommerceOps Desk",
  },
  {
    boundary:
      "It does not send messages or provide production accounts or durable storage.",
    description:
      "Streamlit workflow for redacted XLSX or CSV messages, human-reviewed reply drafts, formula-like cells escaped on export, and deterministic offline processing by default.",
    evidenceLabel: "Synthetic data",
    image: {
      alt: "Chinese-language lead queue showing synthetic customer messages, intent and funnel filters, reply drafts, and workbook export controls.",
      height: 940,
      src: "/images/projects/ecommerce-lead-automation.png",
      width: 1600,
    },
    repositoryUrl:
      "https://github.com/Zhang-ZhengHao/ecommerce-lead-automation",
    stack: "Python / Streamlit / pandas",
    title: "E-commerce Lead Automation",
  },
  {
    boundary: "It is not a production ERP or a client launch.",
    description:
      "Responsive ERP concept covering access, procurement, inventory, sales, and accounting through role-oriented interface flows in a tested static prototype.",
    evidenceLabel: "Self-initiated concept",
    image: {
      alt: "HAURUX ERP operational dashboard showing synthetic order, stock, approval, workload, decision, and recent activity data.",
      height: 724,
      src: "/images/projects/haurux-erp.png",
      width: 1240,
    },
    repositoryUrl: "https://github.com/Zhang-ZhengHao/haurux-erp-portfolio",
    stack: "HTML / CSS / JavaScript",
    title: "HAURUX ERP Concept",
  },
] as const satisfies readonly PublicProject[];
