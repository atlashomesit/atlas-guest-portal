import CommonBanner from "../../components/commonComponents/banner/CommonBanner";
import Parallax from "../../components/commonComponents/parallax/Parallax";
import NearByPlaces from "../../components/aboutpage_component/nearbyplaces/NearByPlaces";
import { resolveOptimizedAsset } from "../../utils/resolveOptimizedAsset";

const parallaxImage = resolveOptimizedAsset("destination_images/manali.webp");
const bannerImage = resolveOptimizedAsset("banner.jpg");

const About = () => {
    return (
        <section>
            <div>
                <CommonBanner image={bannerImage} PageName={'About Us'} />
            </div>
            <div className="tracking-wide py-20 px-8 lg:px-32 flex flex-col gap-8 text-justify">
                {/* Title */}
                <div>
                    <span className="text-4xl font-medium">
                        Welcome to Only stay
                    </span>
                </div>
                {/* Description */}
                <div className="text-base font-thin flex flex-col gap-6 px-4 sm:px-6 md:px-12 lg:px-16 xl:px-20 py-8 max-w-7xl mx-auto">
                    <p className="text-gray-700 text-justify">
                        Welcome to Only Stay, where luxury and tranquility converge to create an unparalleled escape. Our journey began with a passion for redefining hospitality, establishing a retreat that goes beyond accommodation to offer an immersive experience.
                    </p>
                    <p className="text-gray-700 text-justify">
                        At the heart of our ethos is a commitment to excellence. We pride ourselves on delivering exceptional hospitality, from the moment you step through our doors to the conclusion of your stay. Every detail, meticulously curated, reflects our dedication to providing a stay that exceeds expectations.
                    </p>
                    <p className="text-gray-700 text-justify">
                        Immerse yourself in the serenity of [Property Name], where a guest-centric approach ensures your comfort and satisfaction. From lavishly designed bedrooms to thoughtful amenities and a harmonious connection with nature, each element is crafted to elevate your experience.
                    </p>
                    <p className="text-gray-700 text-justify">
                        Join us and embark on a journey where luxury meets a profound sense of tranquility, creating moments that linger long after your departure.
                    </p>
                </div>

            </div>
            {/* Parallax */}
            <div>
                <Parallax image={parallaxImage} title={'Only Stay – Where Luxury Meets Tranquility'} description={'Escape to Only Stay, a sanctuary where elegance and serenity blend seamlessly. Experience unmatched hospitality, thoughtfully designed spaces, and a deep connection with nature—crafted to create moments that last a lifetime.'} />
            </div>
            {/* Nearby Places */}
            <div>
                <NearByPlaces />
            </div>
        </section>
    );
};

export default About;
