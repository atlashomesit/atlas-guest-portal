import React, { useEffect, useState } from "react";
import { useDispatch } from "../../Redux/simpleStore";
import { updateAdults } from "../../Redux/UserData/action";

// Custom hook for detecting screen size
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
};

const AdultCount = ({ roomsCount, handleInputChange, selectedValue }) => {
  const isMobile = useMediaQuery("(max-width: 768px)"); // Adjust the breakpoint as needed
  const [adultCount, setAdultCount] = useState(1);
  const maxAdults = roomsCount * 3;

  const dispatch = useDispatch();

  useEffect(() => {
    setAdultCount(1);
    dispatch(updateAdults(1));
  }, [roomsCount, dispatch]);

  const incrementAdultCount = () => {
    if (adultCount < maxAdults) {
      const newCount = adultCount + 1;
      setAdultCount(newCount);
      dispatch(updateAdults(newCount));
      handleInputChange({ target: { value: newCount } });
    }
  };

  const decrementAdultCount = () => {
    if (adultCount > 1) {
      const newCount = adultCount - 1;
      setAdultCount(newCount);
      dispatch(updateAdults(newCount));
      handleInputChange({ target: { value: newCount } });
    }
  };

  return (
    <div className="count-main-cont">
      <p className="select-p-mobile-view">Adults</p>
      {isMobile ? (
        <select
          className="mobile-select-mob-view"
          value={adultCount}
          onChange={(e) => {
            const value = Number(e.target.value);
            setAdultCount(value);
            dispatch(updateAdults(value));
            handleInputChange(e);
          }}
          style={{
            border: "1px solid transparent",
            borderRadius: "4px",
          }}
        >
          {[...Array(maxAdults)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      ) : (
        <div className="desktop-room-counter">
          <button
            onClick={decrementAdultCount}
            disabled={adultCount <= 1}
            // style={{
            //   padding: "10px",
            //   borderRadius: "4px",
            //   marginRight: "5px",
            // }}
          >
            ➖
          </button>
          <span className="span-count-all">{adultCount}</span>
          <button
            onClick={incrementAdultCount}
            disabled={adultCount >= maxAdults}
            // style={{
            //   padding: "10px",
            //   borderRadius: "4px",
            //   marginLeft: "5px",
            // }}
          >
            ➕
          </button>
        </div>
      )}
    </div>
  );
};

export default AdultCount;

