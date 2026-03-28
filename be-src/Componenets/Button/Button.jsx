import React, { useEffect } from "react";
import "./Button.css";
import { useDispatch, useSelector } from "../../Redux/simpleStore";
import { constructObjForGetHotelById } from "../../Redux/UserData/action";

const Button = ({ btnColor }) => {
  const store = useSelector((store) => store?.reducerUserData || {});
  const dispatch = useDispatch();
  const {
    from_date,
    to_date,
    no_of_adults,
    room_count,
    no_of_children,
    no_of_infants,
    no_of_pets,
    selected_hotel,
    guest_details,
  } = store;

  useEffect(() => {
    dispatch(
      constructObjForGetHotelById({
        from_date,
        to_date,
        no_of_adults,
        room_count,
        no_of_children,
        no_of_infants,
        no_of_pets,
        id: selected_hotel?.hotel_id,
      })
    );
  }, [
    selected_hotel,
    no_of_adults,
    room_count,
    no_of_children,
    no_of_infants,
    no_of_pets,
    from_date,
    to_date,
    dispatch,
  ]);

  const handleButtonClick = () => {
    dispatch(
      constructObjForGetHotelById({
        from_date,
        to_date,
        no_of_adults,
        room_count,
        no_of_children,
        no_of_infants,
        no_of_pets,
        id: selected_hotel.hotel_id,
      })
    );

    const payload = {
      ...store,
      guest_details,
    };

    const url = `https://be.ratebotai.com/?data=${encodeURIComponent(
      JSON.stringify(payload)
    )}`;

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <button
        className="hero-btn"
        style={{ backgroundColor: btnColor }}
        onClick={handleButtonClick}
      >
        BOOK NOW
      </button>
    </div>
  );
};

export default Button;
