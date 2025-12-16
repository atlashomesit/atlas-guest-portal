import { Link } from "react-router-dom";
import { LOGO_URL } from "../../../config/branding";

const Subheading = () => {
    return (
        <section>
            <div className="w-full h-fit flex justify-start mt-12 px-4 bg-transparent">
                <Link to={'/'}>
                    <img className="w-40 h-20 object-contain bg-transparent" src={LOGO_URL} alt="LOGO" />
                </Link>
            </div>
        </section>
    );
};

export default Subheading;
