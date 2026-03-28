import React, { useState } from "react";

// Custom hook for detecting screen size
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(window.matchMedia(query).matches);

  React.useEffect(() => {
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

const RoomsCountInput = ({ handleRoomCountChange }) => {
  const isMobile = useMediaQuery("(max-width: 768px)"); // Adjust breakpoint as needed
  const [roomCount, setRoomCount] = useState(1);

  const incrementRoomCount = () => {
    if (roomCount < 5) {
      const newCount = roomCount + 1;
      setRoomCount(newCount);
      handleRoomCountChange({ target: { value: newCount } });
    }
  };

  const decrementRoomCount = () => {
    if (roomCount > 1) {
      const newCount = roomCount - 1;
      setRoomCount(newCount);
      handleRoomCountChange({ target: { value: newCount } });
    }
  };

  return (
    <div className="count-main-cont">
      <p className="select-p-mobile-view">Rooms</p>
      {isMobile ? (
        <select
          className="mobile-select-mob-view"
          onChange={(e) => {
            setRoomCount(Number(e.target.value));
            handleRoomCountChange(e);
          }}
          value={roomCount}
          style={{
            border: "1px solid transparent",
            borderRadius: "4px",
          }}
        >
          {[...Array(5)].map((_, index) => (
            <option key={index + 1} value={index + 1}>
              {index + 1}
            </option>
          ))}
        </select>
      ) : (
        <div className="desktop-room-counter">
          <button
            onClick={decrementRoomCount}
            disabled={roomCount <= 1}
            // style={{
            //   padding: "10px",
            //   borderRadius: "4px",
            //   marginRight: "5px",
            // }}
          >
            ➖
          </button>
          <span className="span-count-all">{roomCount}</span>
          <button
            onClick={incrementRoomCount}
            disabled={roomCount >= 9}
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

export default RoomsCountInput;

