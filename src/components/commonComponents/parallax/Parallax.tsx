

interface ParallaxProps {
    image: string;
    title: string;
    description: string;
    overlayOpacity?: number;
}

const clampOpacity = (value: number) => Math.min(Math.max(value, 0), 1);

const Parallax: React.FC<ParallaxProps> = ({ image, title, description, overlayOpacity = 0.18 }) => {
    const safeOverlay = clampOpacity(overlayOpacity);
    const overlayTint = `color-mix(in srgb, var(--text-primary) ${Math.round(safeOverlay * 100)}%, transparent)`;
    const overlayDeep = `color-mix(in srgb, var(--text-primary) ${Math.min(Math.round((safeOverlay + 0.08) * 100), 80)}%, transparent)`;
    const overlayCanvas = `color-mix(in srgb, var(--bg-primary) 18%, transparent)`;
    const bgUrl = image.trim();

    return (
        <div
            className="relative h-[70vh] bg-fixed bg-cover bg-center rounded-2xl overflow-hidden bg-bg-muted"
            style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}
        >
            <div
                className="absolute inset-0 flex items-center justify-center text-center px-6"
                style={{
                    background: `linear-gradient(180deg, ${overlayDeep} 0%, ${overlayTint} 48%, ${overlayCanvas} 100%)`,
                }}
            >
                <div className="flex flex-col gap-4 md:gap-10 text-[color:var(--text-contrast)] w-[95%] md:w-[70%] drop-shadow-[0_10px_24px_color-mix(in_srgb,var(--text-primary)_30%,transparent)]">
                    <h1 className="text-2xl lg:text-5xl font-bold mb-4 leading-tight text-balance">
                        {title}
                    </h1>
                    <p className="text-base lg:text-xl leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Parallax;
