import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HostFrontPageStoryCard } from './HostFrontPageStoryCard';

describe('BNB-047 HostFrontPageStoryCard', () => {
  it('renders custom host front-page photo and About story', () => {
    render(
      <HostFrontPageStoryCard
        hostName="Meera Nair"
        propertyName="Wayanad Spice Homestay"
        heroPhotoUrl="https://cdn.example.com/wayanad.jpg"
        aboutStory="Our family has grown cardamom here for three generations."
      />
    );
    expect(screen.getByTestId('host-front-page-story')).toBeTruthy();
    expect(screen.getByAltText(/Wayanad Spice Homestay/i)).toBeTruthy();
    expect(screen.getByText(/three generations/i)).toBeTruthy();
  });
});
