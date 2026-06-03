import { Link } from "react-router-dom";
import { LOGO_URL } from "../../../config/branding";
import { getTenantContext } from "../../../tenant/tenantContext";
import { getTenantBrandName } from "../../../tenant/displayBrand";
import { getTenantOverrides } from "../../../tenant/tenantOverrides";

const Subheading = () => {
    const overrides = getTenantOverrides(getTenantContext()?.slug);
    const brandName = getTenantBrandName();
    const showLogo = !overrides.hideLogo;

    return (
        <section>
            <div className="w-full h-fit flex justify-start mt-12 px-4 bg-transparent">
                {showLogo && (
                    <Link to={'/'}>
                        <img className="w-40 h-20 object-contain bg-transparent" src={LOGO_URL} alt={brandName} />
                    </Link>
                )}
            </div>
        </section>
    );
};

export default Subheading;
