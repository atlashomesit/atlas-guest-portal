import { Link } from "react-router-dom";
import { LOGO_URL } from "../../../config/branding";
import { getTenantContext } from "../../../tenant/tenantContext";
import { getTenantOverrides } from "../../../tenant/tenantOverrides";

const Subheading = () => {
    const tenant = getTenantContext();
    const overrides = getTenantOverrides(tenant?.slug);
    const showLogo = !overrides.hideLogo;

    return (
        <section>
            <div className="w-full h-fit flex justify-start mt-12 px-4 bg-transparent">
                {showLogo && (
                    <Link to={'/'}>
                        <img className="w-40 h-20 object-contain bg-transparent" src={LOGO_URL} alt={tenant?.name ?? 'Home'} />
                    </Link>
                )}
            </div>
        </section>
    );
};

export default Subheading;
