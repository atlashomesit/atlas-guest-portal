import { FaBed, FaShower, FaSwimmingPool, FaCar } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { Button } from "../../ui/Button";
// Define the types for the property amenities
interface Amenity {
    amenities_type: string;
    amenities_count: number;
}
// Define the type for the property object
interface Property {
    id: number;
    property_name: string;
    property_description: string;
    property_location: string;
    property_img: string[];
    property_amenities: Amenity[];
}
// Define the props for the PropertyModal component
interface PropertyModalProps {
    property: Property | null; // Property can be null if not selected
    onClose: () => void; // onClose is a function that closes the modal
    handleNavigate: (property: any) => void; // handleNavigate is a function that navigates to the property detail page
}

const PropertyModal: React.FC<PropertyModalProps> = ({ property, onClose, handleNavigate }) => {

    if (!property) return null;

    // Function to render the correct icon based on the string identifier
    const renderIcon = (iconName: string) => {
        switch (iconName) {
            case 'bed':
                return <FaBed />;
            case 'shower':
                return <FaShower />;
            case 'pool':
                return <FaSwimmingPool />;
            case 'car':
                return <FaCar />;
            default:
                return null;
        }
    };

    console.log(property.id);

    return (
        <section className="fixed inset-0 flex items-center justify-center w-full bg-[color:color-mix(in_srgb,var(--text-primary)_70%,transparent)] z-50">
            <div className="relative bg-bg-surface flex flex-col md:flex-row gap-5 rounded-lg shadow-level2 p-6 h-[70vh] md:h-[70vh] w-[80%] overflow-y-auto overflow-x-hidden text-text-primary">
                {/* property image  */}
                <div className="flex-1 h-full">
                    <img src={property.property_img[0]} alt={property.property_name} className="w-full  md:h-full object-cover rounded-lg" />
                </div>
                {/* property details  */}
                <div className="flex-1 flex flex-col gap-4">
                    {/* modal close button  */}
                    <span onClick={onClose} className=" fixed right-2 top-2 cursor-pointer z-10 text-2xl text-[var(--text-contrast)] h-8 w-8 bg-[color:color-mix(in_srgb,var(--text-primary)_40%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--text-primary)_60%,transparent)] flex justify-center items-center"><IoMdClose /></span>
                    {/* title  */}
                    <div className="flex justify-between items-start">
                        <h2 className="text-xl font-bold ">{property.property_name}</h2>
                    </div>
                    <hr />
                    {/* description  */}
                    <div className="flex flex-col gap-4">
                        <p className="text-text-muted mb-4 text-justify text-sm md:text-base tracking-wide">{property.property_description} </p>
                        <hr />
                        <div className="flex flex-row gap-1 md:gap-3">
                            <h3 className="font-semibold">Location </h3>
                            <p className="text-text-muted">: {property.property_location}</p>
                        </div>
                        <hr />
                        {/* amenities  */}
                        <div className="flex flex-col  md:flex-row gap-3 items-start">
                            <h3 className="font-semibold ">Amenities:</h3>
                            <ul className="list-disc list-inside grid grid-cols-12 gap-4">
                                {property.property_amenities.map((amenity: any, index: any) => (
                                    <div className="flex items-center gap-3" key={index}>
                                        <span className="text-sm md:text-base" key={index}>{renderIcon(amenity.amenities_icon   )}</span>
                                        <span className="text-sm md:text-base">{amenity.amenities_type}</span>
                                    </div>
                                ))}
                            </ul>
                        </div>
                        {/* redirecting button (redirecting to the property  detail page ) */}
                        <Button onClick={() => handleNavigate(property)} className="mt-4">
                            View Details
                        </Button>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default PropertyModal;
