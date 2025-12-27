import React, { useEffect, useState } from "react";
import { useDispatch } from "../../Redux/simpleStore";
import { updatePets } from "../../Redux/UserData/action";

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

const PetsCount = ({ roomsCount, onChange }) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [petsCount, setPetsCount] = useState(0);
  const dispatch = useDispatch();
  const maxPets = roomsCount;

  useEffect(() => {
    setPetsCount(0);
    dispatch(updatePets(0));
    onChange(0);
  }, [roomsCount, dispatch]);

  const incrementPets = () => {
    if (petsCount < maxPets) {
      const next = petsCount + 1;
      setPetsCount(next);
      dispatch(updatePets(next));
      onChange(next);
    }
  };

  const decrementPets = () => {
    if (petsCount > 0) {
      const next = petsCount - 1;
      setPetsCount(next);
      dispatch(updatePets(next));
      onChange(next);
    }
  };

  const handleSelectChange = (e) => {
    const value = Number(e.target.value);
    setPetsCount(value);
    dispatch(updatePets(value));
    onChange(value);
  };

  return (
    <div className="count-main-cont">
      <p className="select-p-mobile-view">Pets</p>
      {isMobile ? (
        <select
          className="mobile-select-mob-view"
          value={petsCount}
          onChange={handleSelectChange}
          style={{ border: "1px solid transparent", borderRadius: "4px" }}
        >
          {[...Array(maxPets + 1)].map((_, i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      ) : (
        <div className="desktop-room-counter">
          <button onClick={decrementPets} disabled={petsCount <= 0}>
            ➖
          </button>
          <span className="span-count-all">{petsCount}</span>
          <button onClick={incrementPets} disabled={petsCount >= maxPets}>
            ➕
          </button>
        </div>
      )}
      <p className="span-count-all" style={{ fontSize: "12px", marginTop: "4px" }}>
        Pets allowed (fees may apply).
      </p>
    </div>
  );
};

export default PetsCount;
