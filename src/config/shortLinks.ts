export type ShortLinkKey = "101" | "102" | "201" | "202" | "301" | "302" | "penthouse" | "501";

export const shortLinkMap: Record<ShortLinkKey, string> = {
    "101": "/property_details/atlas-homes-room-101?tenant=atlas",
    "102": "/property_details/atlas-homes-room-102?tenant=atlas",
    "201": "/property_details/atlas-homes-room-201?tenant=atlas",
    "202": "/property_details/atlas-homes-room-202?tenant=atlas",
    "301": "/property_details/atlas-homes-room-301?tenant=atlas",
    "302": "/property_details/atlas-homes-room-302?tenant=atlas",
    "penthouse": "/property_details/atlas-penthouse-501?tenant=atlas",
    "501": "/property_details/atlas-homes-room-501?tenant=atlas",
};

export const shortLinkKeys = Object.keys(shortLinkMap) as ShortLinkKey[];
