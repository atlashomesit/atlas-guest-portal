import React, { useState, useEffect } from "react";
import Calender from "../Calendar/Calender";
import Button from "../Button/Button";
import AutoSearch from "../AutoSearch/AutoSearch";
import "./patch.css";
import RoomsCountInput from "../RoomsCountInput/RoomsCountInput";
import {
  updateRooms,
  updateAdults,
  updateChildren,
  updateInfants,
  updatePets,
} from "../../Redux/UserData/action";
import { useDispatch } from "../../Redux/simpleStore";
import AdultCount from "../AdultCountInput/AdultCount";
import ChildrenCount from "../ChildrenCountInput/ChildrenCount";
import InfantCount from "../InfantCountInput/InfantCount";
import PetsCount from "../PetsCountInput/PetsCount";

const Patch = ({ colorCode, btnColor, brandId }) => {
  const [roomsCount, setRoomsCount] = useState(1);
  const [adultsCount, setAdultsCount] = useState(1);
  const [selectedChildValue, setSelectedChildValue] = useState(0);
  const [infantsCount, setInfantsCount] = useState(0);
  const [petsCount, setPetsCount] = useState(0);
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [isPatchVisible, setIsPatchVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const dispatch = useDispatch();

  const handleAdultChange = (e) => {
    const value = +e.target.value;
    setAdultsCount(value);
    dispatch(updateAdults(value));
  };

  const handleRoomCountChange = (e) => {
    const value = +e.target.value;
    setRoomsCount(value);
    dispatch(updateRooms(value));
  };

  const handleChildrenChange = (value) => {
    setSelectedChildValue(value);
    dispatch(updateChildren(value));
  };

  const handleInfantChange = (value) => {
    setInfantsCount(value);
    dispatch(updateInfants(value));
  };

  const handlePetsChange = (value) => {
    setPetsCount(value);
    dispatch(updatePets(value));
  };

  const toggleInputVisibility = () => {
    setIsInputVisible((prev) => !prev);
  };

  const togglePatchVisibility = () => {
    setIsPatchVisible((prev) => !prev);
  };

  useEffect(() => {
    const handleResize = () => {
      const isNowMobile = window.innerWidth <= 768;
      setIsMobile(isNowMobile);
      if (isNowMobile) {
        setIsPatchVisible(false);
      } else {
        setIsPatchVisible(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const totalGuests =
    adultsCount + selectedChildValue + infantsCount + petsCount;

  return (
    <>
      {isPatchVisible && (
        <div
          className={`container-patch animated-slide-up ${
            isMobile ? "slide-up" : ""
          }`}
          style={{ backgroundColor: colorCode }}
        >
          <div className="wrapper">
            <div className="auto-search-name">
              <div className="hotel-icon" aria-hidden>
                🏨
              </div>
              <AutoSearch brandId={brandId} />
            </div>
            <div className="calendr-room-book-div">
              <div className="calendar-icon-div" aria-hidden>
                📅
              </div>
              <Calender />
            </div>
            <div className="input-count-all">
              <p
                className="input-p-all-content"
                onClick={toggleInputVisibility}
                style={{ cursor: "pointer" }}
              >
                <div className="person-icon-toggle-div" aria-hidden>
                  👤
                </div>
                <div>
                  {roomsCount} Room{roomsCount > 1 ? "s" : ""}, {adultsCount}{" "}
                  Adult{adultsCount > 1 ? "s" : ""}, {selectedChildValue}{" "}
                  Children, {infantsCount} Infant{infantsCount === 1 ? "" : "s"},
                  {" "}
                  {petsCount} Pet{petsCount === 1 ? "" : "s"}
                </div>
                <div className="expand-icon-toggle-div" aria-hidden>
                  ⌄
                </div>
              </p>

              {isInputVisible && (
                <div className="input-count-second-div">
                  <RoomsCountInput
                    handleRoomCountChange={handleRoomCountChange}
                  />
                  <AdultCount
                    roomsCount={roomsCount}
                    handleInputChange={handleAdultChange}
                    selectedValue={adultsCount}
                  />
                  <ChildrenCount
                    roomsCount={roomsCount}
                    selectedValue={adultsCount}
                    handleChildrenChange={handleChildrenChange}
                  />
                  <InfantCount
                    roomsCount={roomsCount}
                    onChange={handleInfantChange}
                  />
                  <PetsCount
                    roomsCount={roomsCount}
                    onChange={handlePetsChange}
                  />
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>
                    Total guests selected: {totalGuests}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      marginTop: "2px",
                      color: "#444",
                    }}
                  >
                    Pets may incur an additional fee and require approval.
                  </div>
                  <button
                    className="toggle-input-button"
                    onClick={toggleInputVisibility}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
            <div className="button-div-search">
              <Button btnColor={btnColor} />
            </div>
          </div>
        </div>
      )}

      {!isPatchVisible && isMobile && (
        <div className="book-now-button-mobile" onClick={togglePatchVisibility}>
          Book Now
        </div>
      )}
    </>
  );
};

export default Patch;
