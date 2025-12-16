export type ShortLinkKey = "101" | "102" | "201" | "202" | "301" | "302" | "penthouse" | "501";

export const shortLinkMap: Record<ShortLinkKey, string> = {
    "101": "/property_details/atlas-homes-room-101",
    "102": "/property_details/atlas-homes-room-102",
    "201": "/property_details/atlas-homes-room-201",
    "202": "/property_details/atlas-homes-room-202",
    "301": "/property_details/atlas-homes-room-301",
    "302": "/property_details/atlas-homes-room-302",
    "penthouse": "/property_details/atlas-penthouse-501",
    "501": "/property_details/atlas-homes-room-501",
};

export const shortLinkKeys = Object.keys(shortLinkMap) as ShortLinkKey[];
