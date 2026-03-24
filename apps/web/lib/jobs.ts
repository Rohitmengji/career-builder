/*
 * Sample job listings for the career site.
 * In production this would come from an ATS API.
 */

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  salary: string;
  posted: string;
  description: string;
  requirements: string[];
  niceToHave: string[];
  benefits: string[];
}

export const sampleJobs: Job[] = [
  {
    id: "sr-frontend-eng",
    title: "Senior Frontend Engineer",
    department: "Engineering",
    location: "San Francisco, CA (Hybrid)",
    type: "Full-time",
    salary: "$160K – $200K",
    posted: "2 days ago",
    description:
      "We're looking for a Senior Frontend Engineer to lead the development of our next-generation career platform. You'll work closely with design and product to craft beautiful, performant experiences used by millions of job seekers.",
    requirements: [
      "5+ years of experience with React and TypeScript",
      "Strong understanding of modern CSS (Tailwind, CSS Grid, Flexbox)",
      "Experience with Next.js or similar SSR frameworks",
      "Passion for UI/UX and accessibility",
    ],
    niceToHave: [
      "Experience with GrapesJS or visual editors",
      "Background in design systems",
      "Contributions to open source",
    ],
    benefits: [
      "Competitive salary + equity",
      "Remote-friendly with hybrid option",
      "Unlimited PTO",
      "Health, dental, and vision insurance",
      "$2,000 annual learning budget",
    ],
  },
  {
    id: "product-designer",
    title: "Product Designer",
    department: "Design",
    location: "New York, NY (Remote)",
    type: "Full-time",
    salary: "$140K – $180K",
    posted: "3 days ago",
    description:
      "Join our design team to shape the future of how companies build their career sites. You'll own the end-to-end design process from research to pixel-perfect delivery.",
    requirements: [
      "4+ years of product design experience",
      "Proficiency with Figma and prototyping tools",
      "Strong portfolio showing UX problem-solving",
      "Experience designing for B2B SaaS products",
    ],
    niceToHave: [
      "Experience with design systems at scale",
      "Basic HTML/CSS knowledge",
      "Background in HR tech or recruiting",
    ],
    benefits: [
      "Competitive salary + equity",
      "Fully remote option",
      "Unlimited PTO",
      "Health, dental, and vision insurance",
      "Home office stipend",
    ],
  },
  {
    id: "fullstack-engineer",
    title: "Full Stack Engineer",
    department: "Engineering",
    location: "Austin, TX (Remote)",
    type: "Full-time",
    salary: "$150K – $190K",
    posted: "1 week ago",
    description:
      "We're seeking a Full Stack Engineer to build and scale our core platform. You'll work across the stack from React frontends to Node.js APIs and database design.",
    requirements: [
      "4+ years of full-stack development experience",
      "Proficient in TypeScript, Node.js, and React",
      "Experience with PostgreSQL or similar databases",
      "Understanding of RESTful API design",
    ],
    niceToHave: [
      "Experience with Next.js app router",
      "Familiarity with CI/CD pipelines",
      "Interest in developer experience tooling",
    ],
    benefits: [
      "Competitive salary + equity",
      "Fully remote",
      "Unlimited PTO",
      "Health, dental, and vision insurance",
      "Annual team retreats",
    ],
  },
  {
    id: "marketing-manager",
    title: "Marketing Manager",
    department: "Marketing",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$120K – $150K",
    posted: "5 days ago",
    description:
      "Lead our growth marketing initiatives and help us reach more companies looking to build world-class career sites. You'll own demand generation, content strategy, and campaign execution.",
    requirements: [
      "5+ years of B2B marketing experience",
      "Proven track record with demand generation",
      "Experience with marketing automation tools",
      "Strong analytical and writing skills",
    ],
    niceToHave: [
      "Experience in HR tech industry",
      "Familiarity with product-led growth",
      "Event marketing experience",
    ],
    benefits: [
      "Competitive salary + bonus",
      "Hybrid work model",
      "Unlimited PTO",
      "Health, dental, and vision insurance",
      "Professional development budget",
    ],
  },
  {
    id: "devops-engineer",
    title: "DevOps Engineer",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
    salary: "$145K – $185K",
    posted: "1 week ago",
    description:
      "Help us build and maintain the infrastructure that powers thousands of career sites. You'll work on CI/CD, monitoring, security, and cloud architecture.",
    requirements: [
      "3+ years of DevOps or SRE experience",
      "Experience with AWS or GCP",
      "Proficiency with Docker and Kubernetes",
      "Strong scripting skills (Bash, Python)",
    ],
    niceToHave: [
      "Terraform or Pulumi experience",
      "Security certifications",
      "Experience with edge computing / CDN",
    ],
    benefits: [
      "Competitive salary + equity",
      "Fully remote",
      "Unlimited PTO",
      "Health, dental, and vision insurance",
      "Home office stipend",
    ],
  },
  {
    id: "customer-success-manager",
    title: "Customer Success Manager",
    department: "Sales",
    location: "New York, NY (Hybrid)",
    type: "Full-time",
    salary: "$100K – $130K",
    posted: "3 days ago",
    description:
      "Be the voice of our customers and ensure they get maximum value from our platform. You'll manage a portfolio of enterprise accounts and drive adoption and retention.",
    requirements: [
      "3+ years of customer success or account management",
      "Experience with SaaS platforms",
      "Excellent communication and presentation skills",
      "Data-driven approach to customer health",
    ],
    niceToHave: [
      "HR tech or recruiting industry experience",
      "Experience with Salesforce or HubSpot",
      "Technical aptitude for product demos",
    ],
    benefits: [
      "Competitive salary + commission",
      "Hybrid work model",
      "Unlimited PTO",
      "Health, dental, and vision insurance",
      "Career growth opportunities",
    ],
  },
];
