import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "../../Redux/simpleStore";
import { getHotel } from "../../Redux/Hotel/action";
import { updateHotelSelected } from "../../Redux/UserData/action";
import "./auto.css";

const AutoSearch = ({ brandId }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const { hotels } = useSelector((store) => store?.reducerHotel || {});
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getHotel({ brand_id: brandId }));
  }, [brandId, dispatch]);

  useEffect(() => {
    setSelectedOption(hotels[0]);
    dispatch(updateHotelSelected(hotels[0]));
  }, [hotels, dispatch]);

  return (
    <div style={{ margin: "auto 0" }}>
      <h2 className="auto-search-hotel-name">
        {selectedOption?.hotel_name &&
          selectedOption.hotel_name.split(" ").slice(1).join(" ")}
      </h2>
    </div>
  );
};

export default AutoSearch;
