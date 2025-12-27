import { Link, useParams } from "react-router-dom";

import { homes, defaultHomeHighlights } from "../../content/homes";

const HomeDetails = () => {
  const { roomNo } = useParams<{ roomNo: string }>();
  const room = homes.find((item) => item.roomNo === roomNo);

  const highlights = room?.highlights?.length ? room.highlights : defaultHomeHighlights;

  if (!room) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-text-primary">Home not found</h1>
        <p className="mt-3 text-text-secondary">
          We could not find that home. Please return to the catalog to see available stays.
        </p>
        <Link to="/#our-homes" className="inline-flex mt-6 rounded-full bg-[color:var(--cta-primary)] px-4 py-2 text-white font-semibold">
          Back to Our Homes
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 py-12 flex flex-col gap-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-text-muted">Atlas Homes</p>
        <h1 className="text-4xl font-bold text-text-primary">{room.title}</h1>
        {room.tagline && <p className="mt-2 text-lg text-text-secondary">{room.tagline}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <img
            src={room.imageSrc}
            alt={room.title}
            className="w-full h-80 object-cover rounded-2xl shadow-level1"
            loading="lazy"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-level1 border border-border-subtle p-5 h-fit">
          <h2 className="text-xl font-semibold text-text-primary mb-3">Highlights</h2>
          <ul className="list-disc pl-5 space-y-2 text-text-secondary">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/contact"
          className="inline-flex items-center justify-center rounded-full bg-[color:var(--cta-primary)] px-5 py-3 text-sm font-semibold text-white shadow-level1 transition hover:-translate-y-0.5"
        >
          Contact to book
        </Link>
        <Link
          to="/#our-homes"
          className="inline-flex items-center justify-center rounded-full border border-border-subtle px-5 py-3 text-sm font-semibold text-text-primary transition hover:border-[color:var(--cta-primary)] hover:text-[color:var(--cta-primary)]"
        >
          Back to Our Homes
        </Link>
      </div>
    </section>
  );
};

export default HomeDetails;
