import { resolveOptimizedAsset } from '../../../utils/resolveOptimizedAsset';

interface Place {
    title: string;
    thumbnail: string;
    description: string;
}

const NearByPlaces = () => {
    const data: Place[] = [
        {
            title: "Alibaug Beach",
            thumbnail: resolveOptimizedAsset('destination_images/mussorie.webp'),
            description: "A serene beach perfect for relaxing and enjoying the sunset.",
        },
        {
            title: "Kolaba Fort",
            thumbnail: resolveOptimizedAsset('NearByplaces/kolaba.webp'),
            description: "A historic sea fort accessible during low tide, offering a glimpse into the region's rich history.",
        },
        {
            title: "Nagaon Beach",
            thumbnail: resolveOptimizedAsset('NearByplaces/Nagaon_Beach.jpg'),
            description: "Known for its water sports activities like banana boat rides and parasailing.",
        },
        {
            title: "Kashid Beach",
            thumbnail: resolveOptimizedAsset('NearByplaces/Kashid-Beach.jpg'),
            description: "A pristine beach with white sand, ideal for a peaceful getaway.",
        },
        {
            title: "Murud-Janjira Fort",
            thumbnail: resolveOptimizedAsset('NearByplaces/murund_janjira.jpg'),
            description: "A majestic fort located on an island, famous for its architecture and history.",
        },
        {
            title: "Kihim Beach",
            thumbnail: resolveOptimizedAsset('NearByplaces/kihim.jpg'),
            description: "A tranquil spot surrounded by lush greenery, perfect for nature lovers.",
        },
    ];

    return (
        <section className='py-10 md:py-20'>
            <div className='h-full w-full py-10'>
                <div className='capitalize flex justify-center pb-16 px-4 sm:px-6 lg:px-10'>
                    <p className='slide-title border-b-2 border-primary text-center w-max py-2 text-2xl sm:text-3xl md:text-4xl text-primary'>
                        Nearby Places
                    </p>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 px-6 lg:px-9'>
                    {data?.map((item) => (
                        <div key={item.title} className='relative h-[50vh] md:h-[70vh] w-full mb-3 border border-border-subtle rounded-lg overflow-hidden'>
                            {/* Image with Overlay */}
                            <div className="relative h-5/6 w-full">
                                <img className='object-cover h-full w-full' src={item.thumbnail} alt={item.title} />
                                <div className="absolute inset-0 bg-[color:color-mix(in_srgb,var(--text-primary)_10%,transparent)]"></div> {/* Dark overlay */}
                            </div>

                            {/* Text Content */}
                            <div className='absolute h-1/6 bottom-0 left-0 w-full  px-6 bg-gradient-to-t from-[color:color-mix(in_srgb,var(--text-primary)_90%,transparent)] via-[color:color-mix(in_srgb,var(--text-primary)_80%,transparent)] to-transparent text-[var(--text-contrast)]'>
                                <p className='text-lg md:text-xl font-semibold'>{item.title}</p>
                                <p className='text-xs md:text-sm mt-1'>{item.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default NearByPlaces;
