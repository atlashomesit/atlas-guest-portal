import { useState } from 'react';
import OptimizedImage from '../../ui/OptimizedImage';

interface Room {
  title: string;
  thumbnail: string;
  description: string;
  link?: string;
}

const ExclusiveService_Card = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Card Data
  const data: Room[] = [
    {
      title: "Sanctuary of Serenity",
      thumbnail: "",
      description: "Retreat to tranquil spaces where comfort meets style, offering you a peaceful escape at the heart of Atlas Homes.",
      link: "/rooms"
    },
    {
      title: "Tailored for Every Journey",
      thumbnail: "",
      description: "Find your perfect fit—our diverse accommodations are designed to suit every traveler, every story, every dream.",
      link: "/rooms"
    },
    {
      title: "Moments to Savor",
      thumbnail: "",
      description: "Delight in gourmet experiences and cozy corners, where every meal and every sip is a celebration of taste.",
      link: "/dining"
    },
    {
      title: "Celebrate Life's Milestones",
      thumbnail: "",
      description: "Host unforgettable gatherings in elegant spaces, with every detail crafted to make your special moments shine.",
      link: "/events"
    },
  ];

  return (
    <section className="py-16 px-4 lg:px-8 bg-bg-muted">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {data.map((item, index) => (
            <div
              key={item.title}
              className="group flex flex-col rounded-xl overflow-hidden bg-bg-surface shadow-level1 hover:shadow-level2 transition-all duration-300 border border-border-subtle"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="w-full h-48 overflow-hidden">
                <OptimizedImage
                  className={`object-cover w-full h-full transition-transform duration-700 ${hoveredIndex === index ? 'scale-105' : 'scale-100'}`}
                  src={item.thumbnail}
                  alt={item.title}
                  wrapperClassName="h-full"
                  sizes="(max-width: 768px) 100vw, 25vw"
                />
              </div>
              <div className="flex-1 flex flex-col gap-2 p-6">
                <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                <p className="text-text-muted mb-4 flex-1">{item.description}</p>

              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExclusiveService_Card;
