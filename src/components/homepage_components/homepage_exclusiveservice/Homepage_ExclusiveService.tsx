import ExclusiveService_Card from "./ExclusiveService_Card";

const Homepage_ExclusiveService = () => {
  return (
    <section className="py-16 md:py-4 bg-bg-muted">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="text-center flex flex-col gap-4">
          <span className="text-accent-primary font-medium tracking-wider uppercase text-sm">Elite Experiences</span>
          <h2 className="text-3xl lg:text-4xl font-bold text-text-primary">Discover Our Exclusive Services</h2>
          <div className="w-24 h-1 bg-accent-primary mx-auto rounded"></div>
          <p className="text-text-muted max-w-2xl mx-auto">
            Experience the finest in hospitality with our exclusive range of services and luxurious amenities.
          </p>
        </div>

        <ExclusiveService_Card />

      </div>
    </section>
  );
};

export default Homepage_ExclusiveService;
