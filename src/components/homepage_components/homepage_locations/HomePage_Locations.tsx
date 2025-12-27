import { useEffect } from "react";
import { Link } from "react-router-dom";

import Heading from "../../commonComponents/heading/Heading";
import { rooms, defaultRoomHighlights } from "../../../content/rooms";
import { trackEvent } from "../../../utils/analytics";

import "./homepage_location.css";

const fallbackImage = "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80";

const HomePage_Locations = () => {
  useEffect(() => {
    trackEvent(
      "listings_browse",
      {
        total: rooms.length,
        surface: "home_locations",
      },
      { route: "/" },
    );
  }, []);

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-bg-surface scroll-mt-28" id="our-homes">
      <div className="max-w-7xl mx-auto">
        <Heading title="Our Homes" id="our-homes" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {rooms.map((room) => {
            const highlights = room.highlights?.length ? room.highlights : defaultRoomHighlights;

            return (
              <div
                key={room.roomNo}
                className="rounded-2xl shadow-level1 bg-white overflow-hidden border border-border-subtle flex flex-col"
              >
                <Link to={room.route} className="block">
                  <img
                    src={room.imageSrc ?? fallbackImage}
                    alt={room.title}
                    className="w-full h-52 object-cover"
                    loading="lazy"
                    onError={(event) => {
                      const target = event.currentTarget;
                      if (target.src !== fallbackImage) {
                        target.src = fallbackImage;
                      }
                    }}
                  />
                </Link>

                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Atlas Homes</p>
                    <h3 className="text-xl font-semibold text-text-primary">{room.title}</h3>
                    {room.tagline && (
                      <p className="text-sm text-text-secondary mt-1">{room.tagline}</p>
                    )}
                  </div>

                  <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1 flex-1">
                    {highlights.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>

                  <div className="flex gap-3 flex-wrap">
                    <Link
                      to={room.route}
                      className="inline-flex items-center justify-center rounded-full bg-[color:var(--cta-primary)] px-4 py-2 text-sm font-semibold text-white shadow-level1 transition hover:-translate-y-0.5"
                    >
                      View details
                    </Link>
                    <Link
                      to={room.route}
                      className="inline-flex items-center justify-center rounded-full border border-border-subtle px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-[color:var(--cta-primary)] hover:text-[color:var(--cta-primary)]"
                    >
                      Book
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HomePage_Locations;
