/*
 * Central block schema registry — single source of truth.
 *
 * Modeled after the Employ Inc / TinaCMS career site architecture.
 * Each block maps to a visual section on the career page.
 *
 * To add a new block:
 *   1. Add a schema entry here
 *   2. Create a registerXBlock.tsx in app/editor/blocks/
 *   3. Import & call it in app/editor/page.tsx
 *   4. Add a renderer in apps/web/lib/renderer.tsx
 *   Sidebar auto-renders — no changes needed.
 */

export type FieldType = "text" | "textarea" | "select" | "boolean" | "image" | "list";

export interface SelectOption {
  label: string;
  value: string;
}

export interface ListItemField {
  name: string;
  label: string;
  type: "text" | "textarea";
  default?: string;
}

export interface BlockField {
  name: string;
  label: string;
  type: FieldType;
  default?: string | boolean;
  options?: SelectOption[];
  /** For type === "list": describe the shape of each list item */
  listFields?: ListItemField[];
  /** For type === "list": default list items */
  defaultItems?: Record<string, string>[];
}

export interface BlockSchema {
  label: string;
  category: string;
  fields: BlockField[];
}

/* ------------------------------------------------------------------ */
/*  Color / alignment option helpers                                   */
/* ------------------------------------------------------------------ */

const colorOptions: SelectOption[] = [
  { label: "Blue", value: "blue" },
  { label: "Teal", value: "teal" },
  { label: "Green", value: "green" },
  { label: "Red", value: "red" },
  { label: "Pink", value: "pink" },
  { label: "Purple", value: "purple" },
  { label: "Orange", value: "orange" },
  { label: "Yellow", value: "yellow" },
  { label: "Gray", value: "gray" },
  { label: "White", value: "white" },
];

const alignOptions: SelectOption[] = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];

/* ------------------------------------------------------------------ */
/*  Block schemas — all 17 blocks                                      */
/* ------------------------------------------------------------------ */

export const blockSchemas: Record<string, BlockSchema> = {
  /* ─── 1. Hero ─────────────────────────────────────────────────── */
  hero: {
    label: "Hero",
    category: "Layout",
    fields: [
      { name: "title", label: "Title", type: "text", default: "Build Your Career With Us" },
      { name: "subtitle", label: "Subtitle", type: "textarea", default: "Join our team and make an impact. Explore open roles below." },
      { name: "ctaText", label: "Button Text", type: "text", default: "View Open Positions" },
      { name: "ctaLink", label: "Button Link", type: "text", default: "#positions" },
      { name: "backgroundImage", label: "Background Image", type: "image", default: "" },
      { name: "textAlign", label: "Text Alignment", type: "select", default: "center", options: alignOptions },
      { name: "color", label: "Color Scheme", type: "select", default: "blue", options: colorOptions },
    ],
  },

  /* ─── 2. Content ──────────────────────────────────────────────── */
  content: {
    label: "Content",
    category: "Layout",
    fields: [
      { name: "title", label: "Heading", type: "text", default: "About Us" },
      { name: "body", label: "Body Text", type: "textarea", default: "Tell your company story here. Share your mission, values, and what makes your workplace special." },
      { name: "textAlign", label: "Text Alignment", type: "select", default: "left", options: alignOptions },
      { name: "color", label: "Background Color", type: "select", default: "white", options: colorOptions },
    ],
  },

  /* ─── 3. Features ─────────────────────────────────────────────── */
  features: {
    label: "Features",
    category: "Layout",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Why Work With Us" },
      { name: "subtitle", label: "Section Subtitle", type: "textarea", default: "Discover the benefits of joining our team." },
      {
        name: "items",
        label: "Features",
        type: "list",
        listFields: [
          { name: "icon", label: "Icon (emoji)", type: "text", default: "🤝" },
          { name: "title", label: "Title", type: "text", default: "Feature Title" },
          { name: "desc", label: "Description", type: "textarea", default: "Feature description goes here." },
        ],
        defaultItems: [
          { icon: "🤝", title: "Great Culture", desc: "A collaborative, inclusive workplace." },
          { icon: "📈", title: "Growth Opportunities", desc: "Learn and advance your career." },
          { icon: "⚖️", title: "Work-Life Balance", desc: "Flexible schedules and remote options." },
        ],
      },
      { name: "color", label: "Color Scheme", type: "select", default: "blue", options: colorOptions },
    ],
  },

  /* ─── 4. Testimonial ──────────────────────────────────────────── */
  testimonial: {
    label: "Testimonial",
    category: "Layout",
    fields: [
      { name: "quote", label: "Quote", type: "textarea", default: "Working here has been an incredible journey. The team is supportive and the work is meaningful." },
      { name: "author", label: "Author Name", type: "text", default: "Jane Doe" },
      { name: "role", label: "Author Role", type: "text", default: "Software Engineer" },
      { name: "avatarUrl", label: "Avatar Image", type: "image", default: "" },
      { name: "color", label: "Background Color", type: "select", default: "gray", options: colorOptions },
    ],
  },

  /* ─── 5. Carousel ─────────────────────────────────────────────── */
  carousel: {
    label: "Carousel",
    category: "Media",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Life at Our Company" },
      {
        name: "slides",
        label: "Slides",
        type: "list",
        listFields: [
          { name: "image", label: "Image URL", type: "text", default: "" },
          { name: "caption", label: "Caption", type: "text", default: "Slide" },
        ],
        defaultItems: [
          { image: "", caption: "Team Building" },
          { image: "", caption: "Office Life" },
          { image: "", caption: "Company Events" },
        ],
      },
      { name: "autoplay", label: "Auto-play", type: "boolean", default: true },
    ],
  },

  /* ─── 6. Accordion ────────────────────────────────────────────── */
  accordion: {
    label: "Accordion",
    category: "Layout",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Frequently Asked Questions" },
      {
        name: "items",
        label: "Accordion Items",
        type: "list",
        listFields: [
          { name: "question", label: "Question", type: "text", default: "New question?" },
          { name: "answer", label: "Answer", type: "textarea", default: "Answer goes here." },
        ],
        defaultItems: [
          { question: "What is the interview process?", answer: "Our process includes an initial phone screen, technical interview, and on-site meeting." },
          { question: "Do you offer remote work?", answer: "Yes, we offer hybrid and fully remote options for most roles." },
          { question: "What benefits do you offer?", answer: "Health insurance, 401k matching, unlimited PTO, and more." },
        ],
      },
    ],
  },

  /* ─── 7. CTA Button ───────────────────────────────────────────── */
  "cta-button": {
    label: "CTA Button",
    category: "Actions",
    fields: [
      { name: "title", label: "Heading", type: "text", default: "Ready to Apply?" },
      { name: "subtitle", label: "Subheading", type: "textarea", default: "Take the next step in your career journey." },
      { name: "buttonText", label: "Button Text", type: "text", default: "Apply Now" },
      { name: "buttonLink", label: "Button Link", type: "text", default: "#apply" },
      { name: "color", label: "Color Scheme", type: "select", default: "blue", options: colorOptions },
    ],
  },

  /* ─── 8. Search Bar ───────────────────────────────────────────── */
  "search-bar": {
    label: "Search Bar",
    category: "Jobs",
    fields: [
      { name: "title", label: "Heading", type: "text", default: "Find Your Next Role" },
      { name: "placeholder", label: "Placeholder Text", type: "text", default: "Search by title, keyword, or location…" },
      { name: "showLocationFilter", label: "Show Location Filter", type: "boolean", default: true },
      { name: "color", label: "Color Scheme", type: "select", default: "blue", options: colorOptions },
    ],
  },

  /* ─── 9. Search Results ───────────────────────────────────────── */
  "search-results": {
    label: "Search Results",
    category: "Jobs",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Open Positions" },
      { name: "subtitle", label: "Section Subtitle", type: "textarea", default: "Find the role that's right for you." },
      { name: "itemsPerPage", label: "Items Per Page", type: "select", default: "10", options: [
        { label: "5", value: "5" },
        { label: "10", value: "10" },
        { label: "20", value: "20" },
        { label: "50", value: "50" },
      ]},
      { name: "showFacets", label: "Show Filters", type: "boolean", default: true },
      { name: "showSearch", label: "Show Search Bar", type: "boolean", default: true },
      { name: "department", label: "Default Department", type: "select", default: "all", options: [
        { label: "All Departments", value: "all" },
        { label: "Engineering", value: "engineering" },
        { label: "Design", value: "design" },
        { label: "Marketing", value: "marketing" },
        { label: "Sales", value: "sales" },
        { label: "Operations", value: "operations" },
      ]},
    ],
  },

  /* ─── 10. Job Details ─────────────────────────────────────────── */
  "job-details": {
    label: "Job Details",
    category: "Jobs",
    fields: [
      { name: "showApplyButton", label: "Show Apply Button", type: "boolean", default: true },
      { name: "showShareButtons", label: "Show Share Buttons", type: "boolean", default: true },
      { name: "showRelatedJobs", label: "Show Related Jobs", type: "boolean", default: true },
      { name: "applyButtonText", label: "Apply Button Text", type: "text", default: "Apply for This Job" },
      { name: "color", label: "Color Scheme", type: "select", default: "blue", options: colorOptions },
    ],
  },

  /* ─── 11. Job Category ────────────────────────────────────────── */
  "job-category": {
    label: "Job Category",
    category: "Jobs",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Explore by Category" },
      { name: "subtitle", label: "Section Subtitle", type: "textarea", default: "Browse open positions by department." },
      { name: "showCount", label: "Show Job Count", type: "boolean", default: true },
      { name: "color", label: "Color Scheme", type: "select", default: "blue", options: colorOptions },
    ],
  },

  /* ─── 12. Join Talent Network ─────────────────────────────────── */
  "join-talent-network": {
    label: "Join Talent Network",
    category: "Actions",
    fields: [
      { name: "title", label: "Heading", type: "text", default: "Join Our Talent Network" },
      { name: "subtitle", label: "Description", type: "textarea", default: "Don't see the right role? Sign up to be notified when new positions open." },
      { name: "buttonText", label: "Button Text", type: "text", default: "Join Now" },
      { name: "showNameFields", label: "Show Name Fields", type: "boolean", default: true },
      { name: "showResumeUpload", label: "Show Resume Upload", type: "boolean", default: false },
      { name: "color", label: "Color Scheme", type: "select", default: "blue", options: colorOptions },
    ],
  },

  /* ─── 13. Video & Text ────────────────────────────────────────── */
  "video-and-text": {
    label: "Video & Text",
    category: "Media",
    fields: [
      { name: "title", label: "Heading", type: "text", default: "See What It's Like" },
      { name: "body", label: "Description", type: "textarea", default: "Watch our team share their experiences working here." },
      { name: "videoUrl", label: "Video URL (YouTube/Vimeo)", type: "text", default: "" },
      { name: "videoPosition", label: "Video Position", type: "select", default: "left", options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ]},
      { name: "ctaText", label: "Button Text", type: "text", default: "" },
      { name: "ctaLink", label: "Button Link", type: "text", default: "#" },
    ],
  },

  /* ─── 14. Personalization ─────────────────────────────────────── */
  personalization: {
    label: "Personalization",
    category: "Smart",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Recommended For You" },
      { name: "showRecentSearches", label: "Show Recent Searches", type: "boolean", default: true },
      { name: "showRecentJobs", label: "Show Recently Viewed Jobs", type: "boolean", default: true },
      { name: "showRecommendedJobs", label: "Show Recommended Jobs", type: "boolean", default: true },
      { name: "showTrendingSearches", label: "Show Trending Searches", type: "boolean", default: false },
    ],
  },

  /* ─── 15. Show/Hide Tab ───────────────────────────────────────── */
  "show-hide-tab": {
    label: "Show/Hide Tab",
    category: "Layout",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Explore Our Teams" },
      {
        name: "tabs",
        label: "Tabs",
        type: "list",
        listFields: [
          { name: "label", label: "Tab Label", type: "text", default: "Tab" },
          { name: "content", label: "Tab Content", type: "textarea", default: "Tab content here." },
        ],
        defaultItems: [
          { label: "Engineering", content: "Our engineering team builds products used by millions." },
          { label: "Design", content: "Our designers craft beautiful, intuitive experiences." },
          { label: "Marketing", content: "Our marketing team drives growth and brand awareness." },
        ],
      },
    ],
  },

  /* ─── 16. Image Text Grid ─────────────────────────────────────── */
  "image-text-grid": {
    label: "Image Text Grid",
    category: "Media",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Our Values" },
      {
        name: "items",
        label: "Grid Items",
        type: "list",
        listFields: [
          { name: "image", label: "Image URL", type: "text", default: "" },
          { name: "title", label: "Title", type: "text", default: "Value" },
          { name: "desc", label: "Description", type: "textarea", default: "Description here." },
        ],
        defaultItems: [
          { image: "", title: "Innovation", desc: "We push boundaries and embrace new ideas." },
          { image: "", title: "Collaboration", desc: "We achieve more by working together." },
          { image: "", title: "Impact", desc: "We make a meaningful difference every day." },
        ],
      },
    ],
  },

  /* ─── 17. Light Box ───────────────────────────────────────────── */
  "light-box": {
    label: "Light Box",
    category: "Media",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Gallery" },
      { name: "subtitle", label: "Section Subtitle", type: "textarea", default: "A glimpse into our workplace." },
      {
        name: "images",
        label: "Gallery Images",
        type: "list",
        listFields: [
          { name: "url", label: "Image URL", type: "text", default: "" },
          { name: "caption", label: "Caption", type: "text", default: "Photo" },
        ],
        defaultItems: [
          { url: "", caption: "Office Space" },
          { url: "", caption: "Team Outing" },
          { url: "", caption: "Workspace" },
        ],
      },
      { name: "columns", label: "Grid Columns", type: "select", default: "3", options: [
        { label: "2 Columns", value: "2" },
        { label: "3 Columns", value: "3" },
        { label: "4 Columns", value: "4" },
      ]},
    ],
  },

  /* ─── 18. Job Alert Notification ──────────────────────────────── */
  "job-alert": {
    label: "Job Alert",
    category: "Actions",
    fields: [
      { name: "title", label: "Heading", type: "text", default: "Get Job Alerts" },
      { name: "subtitle", label: "Description", type: "textarea", default: "Be the first to know when new jobs are posted." },
      { name: "buttonText", label: "Button Text", type: "text", default: "Set Up Alert" },
      { name: "showFrequencySelector", label: "Show Frequency Selector", type: "boolean", default: true },
      { name: "color", label: "Color Scheme", type: "select", default: "blue", options: colorOptions },
    ],
  },

  /* ─── 19. Navigate Back ───────────────────────────────────────── */
  "navigate-back": {
    label: "Navigate Back",
    category: "Navigation",
    fields: [
      { name: "label", label: "Button Label", type: "text", default: "← Back to All Jobs" },
      { name: "link", label: "Back Link", type: "text", default: "/jobs" },
    ],
  },

  /* ─── 20. Button (basic element) ──────────────────────────────── */
  "basic-button": {
    label: "Button",
    category: "Basic Elements",
    fields: [
      { name: "text", label: "Button Text", type: "text", default: "Click Me" },
      { name: "link", label: "Link URL", type: "text", default: "#" },
      { name: "color", label: "Color", type: "select", default: "blue", options: colorOptions },
      { name: "variant", label: "Style", type: "select", default: "solid", options: [
        { label: "Solid", value: "solid" },
        { label: "Outline", value: "outline" },
        { label: "Ghost", value: "ghost" },
      ]},
    ],
  },

  /* ─── 21. Image (basic element) ───────────────────────────────── */
  "basic-image": {
    label: "Image",
    category: "Basic Elements",
    fields: [
      { name: "src", label: "Image", type: "image", default: "" },
      { name: "alt", label: "Alt Text", type: "text", default: "" },
      { name: "width", label: "Max Width", type: "select", default: "full", options: [
        { label: "Small (320px)", value: "320px" },
        { label: "Medium (640px)", value: "640px" },
        { label: "Large (960px)", value: "960px" },
        { label: "Full Width", value: "full" },
      ]},
    ],
  },

  /* ─── 22. Spacer (basic element) ──────────────────────────────── */
  spacer: {
    label: "Spacer",
    category: "Basic Elements",
    fields: [
      { name: "height", label: "Height", type: "select", default: "48px", options: [
        { label: "Small (24px)", value: "24px" },
        { label: "Medium (48px)", value: "48px" },
        { label: "Large (80px)", value: "80px" },
        { label: "XL (120px)", value: "120px" },
      ]},
    ],
  },

  /* ─── 23. Divider (basic element) ─────────────────────────────── */
  divider: {
    label: "Divider",
    category: "Basic Elements",
    fields: [
      { name: "color", label: "Color", type: "select", default: "gray", options: colorOptions },
    ],
  },

  /* ─── 24. Navbar ──────────────────────────────────────────────── */
  navbar: {
    label: "Navbar",
    category: "Navigation",
    fields: [
      { name: "companyName", label: "Company Name", type: "text", default: "Acme Inc." },
      { name: "logoUrl", label: "Logo Image URL", type: "image", default: "" },
      { name: "showCta", label: "Show CTA Button", type: "boolean", default: true },
      { name: "ctaText", label: "CTA Button Text", type: "text", default: "View Jobs" },
      { name: "ctaLink", label: "CTA Button Link", type: "text", default: "#positions" },
      {
        name: "links",
        label: "Nav Links",
        type: "list",
        listFields: [
          { name: "label", label: "Label", type: "text", default: "Link" },
          { name: "url", label: "URL", type: "text", default: "#" },
        ],
        defaultItems: [
          { label: "About", url: "#about" },
          { label: "Teams", url: "#teams" },
          { label: "Benefits", url: "#benefits" },
        ],
      },
      { name: "variant", label: "Style", type: "select", default: "light", options: [
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
        { label: "Transparent", value: "transparent" },
      ]},
    ],
  },

  /* ─── 25. Footer ──────────────────────────────────────────────── */
  footer: {
    label: "Footer",
    category: "Navigation",
    fields: [
      { name: "companyName", label: "Company Name", type: "text", default: "Acme Inc." },
      { name: "copyright", label: "Copyright Text", type: "text", default: "© 2026 Acme Inc. All rights reserved." },
      { name: "description", label: "Description", type: "textarea", default: "Building the future of work." },
      {
        name: "links",
        label: "Footer Links",
        type: "list",
        listFields: [
          { name: "label", label: "Label", type: "text", default: "Link" },
          { name: "url", label: "URL", type: "text", default: "#" },
        ],
        defaultItems: [
          { label: "Privacy Policy", url: "/privacy" },
          { label: "Terms of Service", url: "/terms" },
          { label: "Contact Us", url: "/contact" },
        ],
      },
      {
        name: "socialLinks",
        label: "Social Links",
        type: "list",
        listFields: [
          { name: "platform", label: "Platform (linkedin/twitter/facebook/instagram)", type: "text", default: "linkedin" },
          { name: "url", label: "URL", type: "text", default: "#" },
        ],
        defaultItems: [
          { platform: "linkedin", url: "#" },
          { platform: "twitter", url: "#" },
        ],
      },
      { name: "variant", label: "Style", type: "select", default: "dark", options: [
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
      ]},
    ],
  },

  /* ─── 26. Notification Banner ─────────────────────────────────── */
  "notification-banner": {
    label: "Notification Banner",
    category: "Layout",
    fields: [
      { name: "text", label: "Banner Text", type: "text", default: "🎉 We're hiring! Check out our latest openings." },
      { name: "linkText", label: "Link Text", type: "text", default: "View Jobs" },
      { name: "linkUrl", label: "Link URL", type: "text", default: "#positions" },
      { name: "variant", label: "Style", type: "select", default: "info", options: [
        { label: "Info (Blue)", value: "info" },
        { label: "Success (Green)", value: "success" },
        { label: "Warning (Yellow)", value: "warning" },
        { label: "Error (Red)", value: "error" },
      ]},
      { name: "dismissible", label: "Dismissible", type: "boolean", default: true },
    ],
  },

  /* ─── 27. Stats Counter ───────────────────────────────────────── */
  "stats-counter": {
    label: "Stats Counter",
    category: "Layout",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "By the Numbers" },
      { name: "subtitle", label: "Section Subtitle", type: "textarea", default: "Our impact in numbers." },
      {
        name: "items",
        label: "Statistics",
        type: "list",
        listFields: [
          { name: "value", label: "Value", type: "text", default: "100+" },
          { name: "label", label: "Label", type: "text", default: "Metric" },
        ],
        defaultItems: [
          { value: "500+", label: "Employees Worldwide" },
          { value: "50+", label: "Open Positions" },
          { value: "4.8", label: "Glassdoor Rating" },
          { value: "95%", label: "Employee Retention" },
        ],
      },
    ],
  },

  /* ─── 28. Team Grid ───────────────────────────────────────────── */
  "team-grid": {
    label: "Team Grid",
    category: "Layout",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Meet Our Team" },
      { name: "subtitle", label: "Section Subtitle", type: "textarea", default: "The people behind our success." },
      {
        name: "members",
        label: "Team Members",
        type: "list",
        listFields: [
          { name: "name", label: "Name", type: "text", default: "Team Member" },
          { name: "role", label: "Role", type: "text", default: "Role" },
          { name: "image", label: "Photo URL", type: "text", default: "" },
          { name: "linkedinUrl", label: "LinkedIn URL", type: "text", default: "#" },
        ],
        defaultItems: [
          { name: "Sarah Chen", role: "VP of Engineering", image: "", linkedinUrl: "#" },
          { name: "Marcus Johnson", role: "Head of Design", image: "", linkedinUrl: "#" },
          { name: "Priya Patel", role: "Director of People", image: "", linkedinUrl: "#" },
          { name: "Alex Rivera", role: "CTO", image: "", linkedinUrl: "#" },
        ],
      },
    ],
  },

  /* ─── 29. Social Proof / Logo Bar ─────────────────────────────── */
  "social-proof": {
    label: "Social Proof",
    category: "Layout",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Trusted By" },
      {
        name: "logos",
        label: "Logos",
        type: "list",
        listFields: [
          { name: "name", label: "Company Name", type: "text", default: "Company" },
          { name: "imageUrl", label: "Logo Image URL", type: "text", default: "" },
        ],
        defaultItems: [
          { name: "Forbes", imageUrl: "" },
          { name: "TechCrunch", imageUrl: "" },
          { name: "Glassdoor", imageUrl: "" },
          { name: "Inc. 5000", imageUrl: "" },
        ],
      },
      { name: "variant", label: "Style", type: "select", default: "light", options: [
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
      ]},
    ],
  },

  /* ─── 30. Application Status Tracker ──────────────────────────── */
  "application-status": {
    label: "Application Status",
    category: "Actions",
    fields: [
      { name: "title", label: "Section Title", type: "text", default: "Track Your Application" },
      { name: "subtitle", label: "Section Subtitle", type: "textarea", default: "Enter your email to check your application status." },
      {
        name: "steps",
        label: "Status Steps",
        type: "list",
        listFields: [
          { name: "label", label: "Step Label", type: "text", default: "Step" },
          { name: "description", label: "Description", type: "text", default: "Step description." },
        ],
        defaultItems: [
          { label: "Applied", description: "We received your application." },
          { label: "Screening", description: "Our team is reviewing your profile." },
          { label: "Interview", description: "You'll be invited for an interview." },
          { label: "Offer", description: "Congratulations! An offer is on the way." },
        ],
      },
      { name: "color", label: "Color Scheme", type: "select", default: "blue", options: colorOptions },
    ],
  },
};

/**
 * Derive default props from a block schema.
 * List fields produce a JSON-stringified array as their default.
 */
export function getDefaultProps(type: string): Record<string, any> {
  const schema = blockSchemas[type];
  if (!schema) return {};
  const props: Record<string, any> = {};
  for (const f of schema.fields) {
    if (f.type === "list") {
      props[f.name] = f.defaultItems || [];
    } else {
      props[f.name] = f.default ?? "";
    }
  }
  return props;
}
