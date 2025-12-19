// import { Link } from "react-router-dom";

const Homepage_LetUsGuide = () => {
    return (
        <section className="bg-bg-primary py-8 md:py-20 px-4 lg:px-60">
            <div className="">
                <div
                    className="flex flex-col md:flex-row justify-between gap-10 h-fit py-20 px-4 md:px-10 rounded-2xl text-[color:var(--text-contrast)] tracking-wider"
                    style={{
                        background:
                            "linear-gradient(135deg, color-mix(in srgb, var(--text-primary) 28%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 35%, transparent) 100%)",
                        boxShadow:
                            "0 16px 46px color-mix(in srgb, var(--text-primary) 14%, transparent)",
                    }}
                >
                    {/* left section  */}
                    <div className="flex-1 flex flex-col gap-4 md:gap-10">
                        <span className="text-xl font-semibold text-center md:text-left drop-shadow-sm">
                            Explore Your Dream Escape
                        </span>
                        <span className="text-2xl md:text-4xl font-semibold text-center md:text-left leading-tight drop-shadow-sm">
                            Let us design a vacation you’ll cherish.
                        </span>
                    </div>
                    {/* right section  */}
                    <div className="flex-1 flex flex-col gap-6 md:gap-14 text-bg-surface">
                        <span className="text-base md:text-xl font-light text-center md:text-left">
                            Only Stay is a serene retreat where luxury meets tranquility. Experience exceptional hospitality, elegant spaces, and a seamless blend of comfort and nature for a truly memorable stay.
                        </span>
                        {/* <span className="text-center md:text-left">
                            <Link to={'/contact'} className="px-6 py-3 bg-primary text-lg md:text-xl rounded-2xl inline-block">
                                Contact Us
                            </Link>
                        </span> */}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Homepage_LetUsGuide;
