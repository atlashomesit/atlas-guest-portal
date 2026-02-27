
interface CommonBannerProps {
    image: string;
    PageName: string
}

const CommonBanner: React.FC<CommonBannerProps> = ({ image, PageName }) => {

    return (
        <section className=''>
            <div className='relative h-[70vh] w-full'>
                <img className='h-full w-full object-cover' src={image} alt="Banner" />
            </div>
            <div className='px-4 lg:px-20 py-8'>
                <span className='text-3xl text-text-primary font-semibold tracking-wide'>{PageName}</span>
            </div>
        </section>
    )
}

export default CommonBanner
