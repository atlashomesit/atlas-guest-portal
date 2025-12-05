import { Link } from "react-router-dom";

const logo = 'https://atlashomestorage.blob.core.windows.net/listing-images/logo-removebg-preview%20(3).be48d403.webp';

const Subheading = () => {
    return (
        <section>
            <div className="w-full h-fit flex justify-start mt-12 px-4 bg-transparent">
                <Link to={'/'}>
                    <img className="w-40 h-20 object-contain bg-transparent" src={logo} alt="LOGO" />
                </Link>
            </div>
        </section>
    );
};

export default Subheading;
