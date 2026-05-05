
interface CommonBannerProps {
    image: string;
    PageName: string
}

const CommonBanner: React.FC<CommonBannerProps> = ({ image, PageName }) => {

    return (
        <section className=''>
            <div className='relative w-full h-auto'>
                {image
                    ? <img className='w-full h-auto object-cover' src={image} alt="Banner" loading="eager" decoding="async" fetchPriority="high" />
                    : <div className='w-full bg-gradient-to-br from-slate-100 to-slate-200 py-6' />
                }
            </div>
            <div className='px-4 lg:px-20 py-12 text-center'>
                <h1 className='text-4xl lg:text-5xl text-text-primary font-bold tracking-tight'>{PageName}</h1>
            </div>
        </section>
    )
}

export default CommonBanner
