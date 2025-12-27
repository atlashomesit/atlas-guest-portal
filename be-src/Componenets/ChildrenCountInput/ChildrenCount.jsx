import React, { useEffect, useState } from "react";
import { useDispatch } from "../../Redux/simpleStore";
import { updateChildren } from "../../Redux/UserData/action";

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

const ChildrenCount = ({ roomsCount, selectedValue, handleChildrenChange }) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const maxChildren = Math.max(roomsCount * 3 - selectedValue, 0);
  const [selectedChildValue, setSelectedChildValue] = useState(0);

  const dispatch = useDispatch();

  const handleInputChange = (e) => {
    const value = +e.target.value;
    setSelectedChildValue(value);
    dispatch(updateChildren(value));
    handleChildrenChange(value);
  };

  const incrementChildCount = () => {
    if (selectedChildValue < maxChildren) {
      const newCount = selectedChildValue + 1;
      setSelectedChildValue(newCount);
      dispatch(updateChildren(newCount));
      handleChildrenChange(newCount);
    } else {
      showAlert();
    }
  };

  const decrementChildCount = () => {
    if (selectedChildValue > 0) {
      const newCount = selectedChildValue - 1;
      setSelectedChildValue(newCount);
      dispatch(updateChildren(newCount));
      handleChildrenChange(newCount);
    }
  };

  const showAlert = () => {
    alert(
      `Number of guests exceeds the maximum allowed. \nMaximum guests allowed: ${
        roomsCount * 3
      }\nPlease update your selection.`
    );
  };

  useEffect(() => {
    setSelectedChildValue(0);
    dispatch(updateChildren(0));
    handleChildrenChange(0);
  }, [selectedValue, roomsCount, dispatch]);

  return (
    <div className="count-main-cont">
      <p className="select-p-mobile-view">Children</p>
      {isMobile ? (
        <select
          className="mobile-select-mob-view"
          value={selectedChildValue}
          onChange={handleInputChange}
          style={{
            border: "1px solid transparent",
            borderRadius: "4px",
          }}
        >
          {[...Array(maxChildren + 1)].map((_, i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      ) : (
        <div className="desktop-room-counter">
          <button
            onClick={decrementChildCount}
            disabled={selectedChildValue <= 0}
          >
            ➖
          </button>
          <span className="span-count-all">{selectedChildValue}</span>
          <button
            onClick={incrementChildCount}
            disabled={selectedChildValue >= maxChildren}
          >
            ➕
          </button>
        </div>
      )}
      <p className="span-count-all" style={{ fontSize: "12px", marginTop: "4px" }}>
        Combined adults and children cannot exceed {roomsCount * 3} guests.
      </p>
    </div>
  );
};

export default ChildrenCount;
