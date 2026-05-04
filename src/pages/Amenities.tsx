/* eslint-disable atlas-brand/no-atlas-string-leak -- TODO Task 16: replace with per-tenant content */
import StubPage from "./StubPage";

const Amenities = () => (
  <StubPage
    title="Amenities | Atlas Homestays"
    description="Amenities and services available at Atlas Homestays properties."
    heading="Amenities"
    body="From high-speed Wi-Fi to fully equipped kitchens, Atlas Homestays provides thoughtful amenities that support both leisure and business travelers."
    ctaHref="/contact"
    ctaLabel="Contact Us"
  />
);

export default Amenities;
