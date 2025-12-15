export type ShortLinkKey = "101" | "102" | "201" | "202" | "301" | "302" | "penthouse" | "501";

export const shortLinkMap: Record<ShortLinkKey, string> = {
    "101": "https://www.atlashomestays.com/property_details/atlas-homes-room-101",
    "102": "https://www.atlashomestays.com/property_details/atlas-homes-room-102",
    "201": "https://www.atlashomestays.com/property_details/atlas-homes-room-201",
    "202": "https://www.atlashomestays.com/property_details/atlas-homes-room-202",
    "301": "https://www.atlashomestays.com/property_details/atlas-homes-room-301",
    "302": "https://www.atlashomestays.com/property_details/atlas-homes-room-302",
    "penthouse": "https://www.atlashomestays.com/property_details/atlas-penthouse-501",
    "501": "https://www.atlashomestays.com/property_details/atlas-penthouse-501",
};

export const shortLinkKeys = Object.keys(shortLinkMap) as ShortLinkKey[];
