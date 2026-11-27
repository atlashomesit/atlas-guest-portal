import React from 'react';

export interface HostFrontPageStoryCardProps {
  hostName: string;
  propertyName: string;
  heroPhotoUrl?: string | null;
  aboutStory?: string | null;
  city?: string;
}

export const HostFrontPageStoryCard: React.FC<HostFrontPageStoryCardProps> = ({
  hostName,
  propertyName,
  heroPhotoUrl,
  aboutStory,
  city,
}) => {
  const story =
    aboutStory?.trim() ||
    `Welcome to ${propertyName}${city ? ` in ${city}` : ''}, hosted personally by ${hostName}.`;

  return (
    <section
      data-testid="host-front-page-story"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid sm:grid-cols-12"
    >
      {heroPhotoUrl && (
        <div className="sm:col-span-5">
          <img
            src={heroPhotoUrl}
            alt={`${propertyName} hosted by ${hostName}`}
            className="h-56 w-full object-cover sm:h-full"
            loading="lazy"
          />
        </div>
      )}
      <div className={heroPhotoUrl ? 'p-5 sm:col-span-7' : 'p-5 sm:col-span-12'}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Hosted by {hostName}
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">About {propertyName}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{story}</p>
      </div>
    </section>
  );
};
