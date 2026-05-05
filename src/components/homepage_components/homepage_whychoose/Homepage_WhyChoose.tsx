import { useState, useEffect } from 'react';
import { MdOutlineDone } from 'react-icons/md';
import OptimizedImage from '../../ui/OptimizedImage';
import { getTenantContext } from '../../../tenant/tenantContext';

const getFeatureData = (brandName: string) => ({
    images: [
        'https://atlashomestorage.blob.core.windows.net/listing-images/201/img_11.jpg',
        'https://atlashomestorage.blob.core.windows.net/listing-images/301/img_8.jpg',
    ],
    title: `Why Choose ${brandName}?`,
    description:
        `At ${brandName}, we believe that where you stay is just as important as where you go. Experience the perfect blend of luxury, comfort, and exceptional service that makes every stay memorable.`,
    features: [
        {
            title: "Comfort Redefined",
            description:
                "Each of our stays is thoughtfully designed to provide the perfect blend of coziness and sophistication, ensuring a home away from home."
        },
        {
            title: "Unmatched Hospitality",
            description:
                "Our warm and attentive team goes the extra mile to cater to your every need, making your experience truly personalized and stress-free."
        },
        {
            title: "Prime Locations",
            description:
                "Whether you crave the serenity of nature or the buzz of the city, our properties are strategically located to offer easy access to your favorite spots."
        },
        {
            title: "Value for Money",
            description:
                "Enjoy luxury experiences that won't break the bank. We bring you premium stays at competitive rates."
        },
        {
            title: "Memorable Experiences",
            description:
                "From bespoke recommendations to curated local activities, we go beyond accommodation to create memories that last a lifetime."
        }
    ]
});

const Homepage_WhyChoose = () => {
    const tenant = getTenantContext();
    // RA-006 §3.6: brand-neutral fallback so unresolved tenant context doesn't leak Atlas.
    const brandName = tenant?.name ?? "Our Homestays";
    const featureData = getFeatureData(brandName);

    const [activeFeature, setActiveFeature] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveFeature((prev) => (prev + 1) % featureData.features.length);
        }, 4000);
        return () => clearInterval(interval);
    }, [featureData.features.length]);

    return (
        <section className="py-16 lg:py-24 bg-gradient-to-b from-bg-surface to-bg-muted">
            <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-20">
                <div className="flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-16">
                    {/* Left Side - Images */}
                    <div className="flex-1 relative">
                        <div className="relative z-10 rounded-xl overflow-hidden shadow-2xl transform transition duration-500 hover:-translate-y-2">
                            <OptimizedImage
                                src={featureData.images[0]}
                                alt="Luxury accommodation"
                                className="w-full h-full object-cover"
                                wrapperClassName="w-full h-80 lg:h-96"
                                sizes="(max-width: 1024px) 100vw, 45vw"
                            />
                            <div className="absolute inset-0 bg-accent-primary/10 mix-blend-multiply"></div>
                        </div>
                        <OptimizedImage
                            src={featureData.images[1]}
                            alt="Garden swing area"
                            className="w-full h-full object-cover"
                            wrapperClassName="w-56 sm:w-64 absolute -bottom-8 -right-6 sm:right-0 lg:-right-8 rounded-xl shadow-2xl border-4 border-[color:var(--bg-surface)] z-20 transition duration-500 hover:scale-105"
                            sizes="(max-width: 1024px) 50vw, 28vw"
                        />
                    </div>

                    {/* Right Side - Content */}
                    <div className="flex-1">
                        <h2 className="text-3xl lg:text-4xl font-bold text-text-primary relative mb-4">
                            {featureData.title}
                       
                        </h2>
                        <p className="text-text-muted leading-relaxed mb-6">{featureData.description}</p>

                        {/* Features List */}
                        <div className="space-y-2">
                            {featureData.features.map((feature, index) => (
                                <div
                                    key={index}
                                    onClick={() => setActiveFeature(index)}
                                    className={`p-4 rounded-lg transition-all duration-300 cursor-pointer flex items-start gap-4 border-l-4 ${activeFeature === index
                                        ? 'bg-bg-surface shadow-level1 border-accent-primary'
                                        : 'border-transparent hover:bg-bg-surface'
                                        }`}
                                >
                                    <div
                                        className={`p-2 rounded-full ${activeFeature === index ? 'bg-accent-primary text-[var(--text-contrast)]' : 'bg-accent-primary/10 text-accent-primary'
                                            }`}
                                    >
                                        <MdOutlineDone className="text-xl" />
                                    </div>
                                    <div>
                                        <h3 className="text-text-primary font-semibold text-lg">{feature.title}</h3>
                                        <p className="text-text-muted text-xs">{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Homepage_WhyChoose;
