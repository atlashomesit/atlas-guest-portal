import { useEffect } from "react";

interface BookingEngineProps {
    containerId: string;
    dataTypeId: string;
    dataBrandId: string;
    dataBtnColor: string;
}

const BookingEngine: React.FC<BookingEngineProps> = ({
    containerId,
    dataTypeId,
    dataBrandId,
    dataBtnColor,
}) => {
    useEffect(() => {
        // Dynamically load the CSS for the booking engine
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/be/static/css/main.5a8b9a96.css"; // Path to the CSS file (adjust as needed)
        document.head.appendChild(link);

        // Load the generated styles from the new bundle
        const bundleStyles = document.createElement("link");
        bundleStyles.rel = "stylesheet";
        bundleStyles.href = "/be/static/js/main.caa69fb1.css";
        document.head.appendChild(bundleStyles);

        // Dynamically load the JS for the booking engine
        const script = document.createElement("script");
        script.src = "/be/static/js/main.caa69fb1.js"; // Path to the JS file (adjust as needed)
        script.async = true;

        // Append the script to the body
        document.body.appendChild(script);

        // Cleanup: remove the dynamically added script and CSS when the component unmounts
        return () => {
            document.head.removeChild(link);
            document.head.removeChild(bundleStyles);
            document.body.removeChild(script);
        };
    }, []);

    return (
        <div className="booking-patch-harsha" id={containerId}>
            <div
                className="harsha-inside-patch"
                id="booking-engine-root"
                data-typeid={dataTypeId}
                data-brandid={dataBrandId}
                data-btncolor={dataBtnColor}
            >
                {/* The script and CSS will dynamically load here */}
            </div>
        </div>
    );
};

export default BookingEngine;
