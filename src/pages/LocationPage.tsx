import { useState } from "react";
import SEO from "../components/SEO";
import { Card } from "../components/ui/Card";
import { Typography } from "../components/ui/Typography";

const MAP_EMBED_URL = "https://maps.google.com/maps?q=17.4746,78.3872&z=15&output=embed";

const transportOptions = [
  {
    title: "Metro",
    details: "Kukatpally and KPHB Colony Metro stations are within a 10-15 minute drive for quick access across the city.",
  },
  {
    title: "Airport",
    details: "Rajiv Gandhi International Airport is about 45 minutes away via ORR, with reliable cab availability day and night.",
  },
  {
    title: "Road connectivity",
    details: "Easy access to Mumbai Highway, JNTU Road, and the ORR for commuting towards Hitech City, Gachibowli, or BHEL.",
  },
];

const nearbyAmenities = [
  {
    title: "Daily essentials",
    details: "Supermarkets, pharmacies, and local bakeries within a 5-10 minute drive for everyday needs.",
  },
  {
    title: "Dining",
    details: "A mix of local eateries and popular chains around Kukatpally, JNTU, and KPHB for quick meals or dine-in plans.",
  },
  {
    title: "Healthcare",
    details: "Multi-specialty hospitals and clinics nearby to handle routine visits and emergencies.",
  },
];

const landmarks = [
  {
    title: "Business hubs",
    details: "Proximity to Hitech City, Gachibowli, and Financial District for tech parks and corporate offices.",
  },
  {
    title: "Education",
    details: "Universities and colleges around Kukatpally and Miyapur, with straightforward commutes by metro or cab.",
  },
  {
    title: "Leisure",
    details: "Shopping streets, malls, and cinemas across KPHB, Miyapur, and Kukatpally for entertainment.",
  },
];

const LocationPage = () => {
  const [mapFailed, setMapFailed] = useState(false);

  return (
    <div className="px-4 md:px-10 lg:px-20 py-16 bg-bg-muted">
      <SEO
        title="Location & Neighborhood | Atlas Homestays"
        description="Discover the Kukatpally neighborhood, access routes, and nearby essentials for Atlas Homestays."
      />

      <div className="max-w-6xl mx-auto space-y-12">
        <header className="space-y-3 text-center">
          <Typography variant="subtitle" className="uppercase tracking-[0.2em] text-primary font-semibold">
            Atlas Homestays
          </Typography>
          <Typography as="h1" variant="h1" className="text-text-primary">
            Location & Neighborhood
          </Typography>
          <Typography className="text-text-muted text-lg">
            Find transport options, nearby dining, shopping, and corporate hubs close to Atlas Homestays so you can plan your
            arrival and daily commute with ease.
          </Typography>
        </header>

        <Card className="p-0 overflow-hidden shadow-level2">
          <div className="relative bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
            <div className="relative h-[280px] md:h-[420px]">
              <iframe
                title="Atlas Homestays location in Kukatpally"
                src={MAP_EMBED_URL}
                className="absolute inset-0 w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                onError={() => setMapFailed(true)}
              />
              {mapFailed && (
                <div className="absolute inset-0 flex items-center justify-center bg-bg-surface text-center p-8">
                  <Typography className="text-text-muted">
                    Map preview is currently unavailable. Open in{" "}
                    <a
                      href="https://maps.google.com/?q=17.4746,78.3872"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-semibold"
                    >
                      Google Maps
                    </a>{" "}
                    to view directions to Atlas Homestays in Kukatpally.
                  </Typography>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="space-y-3 h-full">
            <Typography as="h2" variant="h2" className="text-text-primary">
              Transport options
            </Typography>
            <div className="space-y-3">
              {transportOptions.map((option) => (
                <div key={option.title} className="space-y-1">
                  <Typography as="h3" variant="h3" className="text-text-primary">
                    {option.title}
                  </Typography>
                  <Typography className="text-text-muted">{option.details}</Typography>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 h-full">
            <Typography as="h2" variant="h2" className="text-text-primary">
              Nearby amenities
            </Typography>
            <div className="space-y-3">
              {nearbyAmenities.map((amenity) => (
                <div key={amenity.title} className="space-y-1">
                  <Typography as="h3" variant="h3" className="text-text-primary">
                    {amenity.title}
                  </Typography>
                  <Typography className="text-text-muted">{amenity.details}</Typography>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="space-y-3">
          <Typography as="h2" variant="h2" className="text-text-primary">
            Landmarks & proximity
          </Typography>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {landmarks.map((landmark) => (
              <div key={landmark.title} className="space-y-1">
                <Typography as="h3" variant="h3" className="text-text-primary">
                  {landmark.title}
                </Typography>
                <Typography className="text-text-muted">{landmark.details}</Typography>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LocationPage;
