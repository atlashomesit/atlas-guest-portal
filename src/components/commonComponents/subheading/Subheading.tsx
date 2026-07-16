import { Link } from "react-router-dom";
import { LOGO_URL } from "../../../config/branding";
import { getTenantContext } from "../../../tenant/tenantContext";
import { getTenantBrandName } from "../../../tenant/displayBrand";
import { getTenantOverrides } from "../../../tenant/tenantOverrides";

const Subheading = () => {
    const tenant = getTenantContext();
    const overrides = getTenantOverrides(tenant?.slug);
    const brandName = getTenantBrandName();
    const showLogo = !overrides.hideLogo;
    const logoSrc = overrides.logoUrl ?? tenant?.logoUrl ?? LOGO_URL;

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
