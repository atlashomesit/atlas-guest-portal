
interface CommonBannerProps {
    image: string;
    PageName: string
}

const CommonBanner: React.FC<CommonBannerProps> = ({ image, PageName }) => {

    return (
        <section className=''>
            <div className='relative h-[70vh] w-full'>
                {image
                    ? <img className='h-full w-full object-cover' src={image} alt="Banner" />
                    : <div className='h-full w-full bg-gradient-to-br from-slate-100 to-slate-200' />
                }
            </div>
            <div className='px-4 lg:px-20 py-8'>
                <span className='text-3xl text-text-primary font-semibold tracking-wide'>{PageName}</span>
            </div>
        </section>
    )
}

export default CommonBanner
