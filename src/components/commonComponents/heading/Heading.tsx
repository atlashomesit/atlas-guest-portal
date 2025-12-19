interface HeadingProps {
    title: string;
}

const Heading = ({ title }: HeadingProps) => {
    return (
        <section>
            <div className="py-16 text-[color:var(--brand-ink)] md:pb-6 md:pt-8 tracking-wide flex justify-center items-center text-xl md:text-2xl lg:text-5xl font-semibold relative text-center">
                <p className="relative after:content-[''] bg-[color:var(--brand-contrast)] text-[color:var(--brand-ink)] px-6 py-2 font-semibold rounded-xl shadow-[var(--shadow-soft)] border border-[color:var(--border-subtle)] after:absolute after:left-0 after:-bottom-2 after:w-full after:h-[3px] after:bg-[color:var(--brand)] after:rounded-full after:transition-all after:duration-500 after:ease-in-out hover:after:w-0 cursor-pointer">
                    {title}
                </p>
            </div>
        </section>
    );
};

export default Heading;
