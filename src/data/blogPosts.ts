/** Placeholder resolved at runtime by `getLocalizedBlogPosts` (CPO-001). */
export const TENANT_BRAND_PLACEHOLDER = "{{TENANT_BRAND}}";

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
  canonicalPath?: string;
}

export const blogPosts: BlogPost[] = [
  {
    id: "1",
    title: `Essential Guest Guide to ${TENANT_BRAND_PLACEHOLDER}`,
    slug: "essential-guest-guide",
    category: "guest-guides",
    excerpt: "Plan your arrival, explore nearby dining, and discover how to get the most from your stay.",
    content:
      "Explore the neighborhood, check in smoothly, and review our on-site amenities before you arrive.",
    featuredImage: "https://atlashomestorage.blob.core.windows.net/listing-images/101/img_9.jpg",
    metaTitle: `Guest Guide | ${TENANT_BRAND_PLACEHOLDER}`,
    metaDescription: `Arrival tips, local attractions, and stay recommendations for ${TENANT_BRAND_PLACEHOLDER} guests.`,
    canonicalPath: "/blog/essential-guest-guide",
  },
  {
    id: "2",
    title: `Hospitality Tech & AI at ${TENANT_BRAND_PLACEHOLDER}`,
    slug: "hospitality-tech-ai",
    category: "hospitality-tech",
    excerpt: `How ${TENANT_BRAND_PLACEHOLDER} uses automation, security, and smart features to improve each visit.`,
    content: "Learn how smart entry, responsive support, and automation make your stay seamless.",
    featuredImage: "https://atlashomestorage.blob.core.windows.net/listing-images/102/img_2.jpg",
    metaTitle: `Hospitality Tech & AI | ${TENANT_BRAND_PLACEHOLDER}`,
    metaDescription: `Discover the technology powering comfort, safety, and service at ${TENANT_BRAND_PLACEHOLDER}.`,
    canonicalPath: "/blog/hospitality-tech-ai",
  },
  {
    id: "3",
    title: "Best Homestays in Hyderabad for Work and Weekend Trips",
    slug: "homestays-in-hyderabad",
    category: "guest-guides",
    excerpt: "A practical shortlist for travelers who want comfort, fast check-in, and reliable neighborhoods.",
    content:
      "Compare neighborhoods, commute windows, and must-have amenities before choosing your Hyderabad stay.",
    featuredImage: "https://atlashomestorage.blob.core.windows.net/listing-images/103/img_1.jpg",
    metaTitle: "Homestays in Hyderabad | Atlas Stays Blog",
    metaDescription: "Explore how to choose the right Hyderabad homestay by area, budget, and trip type.",
    canonicalPath: "/blog/homestays-in-hyderabad",
  },
  {
    id: "4",
    title: "Rooms vs Homes: Which Marketplace Category Fits Your Trip?",
    slug: "rooms-vs-homes",
    category: "hospitality-tech",
    excerpt: "Understand when to book a room listing versus a whole-home listing for better value.",
    content:
      "Use trip length, group size, and privacy needs to pick the best category across marketplace stays.",
    featuredImage: "https://atlashomestorage.blob.core.windows.net/listing-images/104/img_3.jpg",
    metaTitle: "Rooms vs Homes | Atlas Stays Blog",
    metaDescription: "A quick guide to choosing between room and home category listings on Atlas Stays.",
    canonicalPath: "/blog/rooms-vs-homes",
  },
];

function localizeBlogText(text: string, brandName: string): string {
  return text.split(TENANT_BRAND_PLACEHOLDER).join(brandName);
}

/** CPO-001: personalize shared blog templates for the active tenant (marketplace baseline unchanged). */
export function getLocalizedBlogPosts(brandName: string): BlogPost[] {
  return blogPosts.map((post) => ({
    ...post,
    title: localizeBlogText(post.title, brandName),
    excerpt: localizeBlogText(post.excerpt, brandName),
    content: localizeBlogText(post.content, brandName),
    metaTitle: post.metaTitle ? localizeBlogText(post.metaTitle, brandName) : undefined,
    metaDescription: post.metaDescription ? localizeBlogText(post.metaDescription, brandName) : undefined,
  }));
}
