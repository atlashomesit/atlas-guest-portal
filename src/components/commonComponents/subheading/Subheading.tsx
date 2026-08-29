import { Link } from "react-router-dom";
import { resolveGuestLogoUrl } from "../../../config/branding";
import { getTenantContext } from "../../../tenant/tenantContext";
import { getTenantBrandName } from "../../../tenant/displayBrand";
import { getTenantOverrides } from "../../../tenant/tenantOverrides";
import { getTenantSlug } from "../../../tenant/tenantResolver";
import { hasRuntimeConfig, getRuntimeConfig } from "../../../runtime-config";

const Subheading = () => {
    const tenant = getTenantContext();
    const slug =
        tenant?.slug ||
        getTenantSlug({
            fallbackSlug: hasRuntimeConfig() ? getRuntimeConfig().tenantKey : undefined,
        });
    const overrides = getTenantOverrides(slug);
    const brandName = getTenantBrandName();
    const showLogo = !overrides.hideLogo;
    const logoSrc = resolveGuestLogoUrl({
        overrideLogoUrl: overrides.logoUrl,
        tenantLogoUrl: tenant?.logoUrl,
        slug,
    });

    return (
        <section>
            <div className="w-full h-fit flex justify-start mt-12 px-4 bg-transparent">
                {showLogo && (
                    <Link to={'/'}>
                        <img className="w-40 h-20 object-contain bg-transparent" src={logoSrc} alt={brandName} loading="eager" decoding="async" width={160} height={80} />
                    </Link>
                )}
            </div>
        </section>
    );
};

export default Subheading;
