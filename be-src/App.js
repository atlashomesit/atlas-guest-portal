import "./App.css";
import "./custom.css";
import Patch from "./Componenets/Patch/Patch";
import { useEffect, useRef, useState } from "react";

function App() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isPatchVisible, setIsPatchVisible] = useState(false);
  const [colorCode, setColorCode] = useState("");
  const [btnColor, setBtnColor] = useState("");
  const [brandId, setBrandId] = useState("");
  const spanRef = useRef(null);

  useEffect(() => {
    const spanElement = document.getElementById("booking-engine-root");
    if (spanElement) {
      const typeId = spanElement.dataset.typeid;
      const brand_id = spanElement.dataset.brandid;
      const colorcode = spanElement.dataset.colorcode;
      const btncolor = spanElement.dataset.btncolor;

      setColorCode(colorcode);
      setBtnColor(btncolor);
      setBrandId(+brand_id);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const togglePatchVisibility = () => {
    setIsPatchVisible((prev) => !prev);
  };

  return (
    <div className="App-demo">
      {windowWidth <= 650 ? (
        <>
          {!isPatchVisible && (
            <div
              className="book-now-button-mobile"
              onClick={togglePatchVisibility}
            >
              Book Now
            </div>
          )}

          {isPatchVisible && (
            <div className="mobile-patch ">
              <Patch
                colorCode={colorCode}
                btnColor={btnColor}
                brandId={brandId}
              />
              <div className="close-icon" onClick={togglePatchVisibility}>
                ×
              </div>
            </div>
          )}
        </>
      ) : (
        <Patch colorCode={colorCode} btnColor={btnColor} brandId={brandId} />
      )}
    </div>
  );
}

export default App;
