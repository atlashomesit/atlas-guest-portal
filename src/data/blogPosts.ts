export type BlogCategory = "guest-guides" | "hospitality-tech";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: BlogCategory;
  excerpt: string;
  content: string;
  featuredImage?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export const blogPosts: BlogPost[] = [
  {
    id: "1",
    title: "Essential Guest Guide to Atlas Homestays",
    slug: "essential-guest-guide",
    category: "guest-guides",
    excerpt: "Plan your arrival, explore nearby dining, and discover how to get the most from your stay.",
    content:
      "Explore the neighborhood, check in smoothly, and review our on-site amenities before you arrive.",
    featuredImage: "https://atlashomestorage.blob.core.windows.net/listing-images/101/img_9.jpg",
    metaTitle: "Guest Guide | Atlas Homestays",
    metaDescription: "Arrival tips, local attractions, and stay recommendations for Atlas Homestays guests.",
  },
  {
    id: "2",
    title: "Hospitality Tech & AI at Atlas Homestays",
    slug: "hospitality-tech-ai",
    category: "hospitality-tech",
    excerpt: "How Atlas Homestays uses automation, security, and smart features to improve each visit.",
    content: "Learn how smart entry, responsive support, and automation make your stay seamless.",
    featuredImage: "https://atlashomestorage.blob.core.windows.net/listing-images/102/img_2.jpg",
    metaTitle: "Hospitality Tech & AI | Atlas Homestays",
    metaDescription: "Discover the technology powering comfort, safety, and service at Atlas Homestays.",
  },
];
