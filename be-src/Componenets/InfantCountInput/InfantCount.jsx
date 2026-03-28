import React, { useEffect, useState } from "react";
import { useDispatch } from "../../Redux/simpleStore";
import { updateInfants } from "../../Redux/UserData/action";

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

const InfantCount = ({ roomsCount, onChange }) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [infantCount, setInfantCount] = useState(0);
  const dispatch = useDispatch();
  const maxInfants = roomsCount * 2;

  useEffect(() => {
    setInfantCount(0);
    dispatch(updateInfants(0));
    onChange(0);
  }, [roomsCount, dispatch]);

  const incrementInfantCount = () => {
    if (infantCount < maxInfants) {
      const next = infantCount + 1;
      setInfantCount(next);
      dispatch(updateInfants(next));
      onChange(next);
    }
  };

  const decrementInfantCount = () => {
    if (infantCount > 0) {
      const next = infantCount - 1;
      setInfantCount(next);
      dispatch(updateInfants(next));
      onChange(next);
    }
  };

  const handleSelectChange = (e) => {
    const value = Number(e.target.value);
    setInfantCount(value);
    dispatch(updateInfants(value));
    onChange(value);
  };

  return (
    <div className="count-main-cont">
      <p className="select-p-mobile-view">Infants</p>
      {isMobile ? (
        <select
          className="mobile-select-mob-view"
          value={infantCount}
          onChange={handleSelectChange}
          style={{ border: "1px solid transparent", borderRadius: "4px" }}
        >
          {[...Array(maxInfants + 1)].map((_, i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      ) : (
        <div className="desktop-room-counter">
          <button onClick={decrementInfantCount} disabled={infantCount <= 0}>
            ➖
          </button>
          <span className="span-count-all">{infantCount}</span>
          <button
            onClick={incrementInfantCount}
            disabled={infantCount >= maxInfants}
          >
            ➕
          </button>
        </div>
      )}
      <p className="span-count-all" style={{ fontSize: "12px", marginTop: "4px" }}>
        Up to 2 infants per room.
      </p>
    </div>
  );
};

export default InfantCount;
