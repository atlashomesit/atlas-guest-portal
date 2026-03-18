
interface CommonBannerProps {
    image: string;
    PageName: string
}

const CommonBanner: React.FC<CommonBannerProps> = ({ image, PageName }) => {

    return (
        <section className=''>
<<<<<<< HEAD
            <div className='relative h-[70vh] w-full'>
=======
            <div className='relative h-[40vh] md:h-[70vh] w-full bg-bg-muted'>
>>>>>>> d89c465d64614c4151932dfc055e773e7b689f0c
                <img className='h-full w-full object-cover' src={image} alt="Banner" />
            </div>
            <div className='px-4 lg:px-20 py-8'>
                <span className='text-3xl text-text-primary font-semibold tracking-wide'>{PageName}</span>
            </div>
        </section>
    )
}

export default CommonBanner
