import {
  DATA_FOR_GET_HOTEL_BY_ID,
  SET_ADULTS,
  SET_CALENDER_RANGE,
  SET_CHILDREN,
  SET_GUEST_DETAILS,
  SET_INFANTS,
  SET_PETS,
  SET_ROOMS,
  SET_SELECTED_HOTEL_DATA,
} from "./actionTypes";

export const updateCalender = (payload) => (dispatch) => {
  dispatch({ type: SET_CALENDER_RANGE, payload });
};

export const updateAdults = (payload) => (dispatch) => {
  dispatch({ type: SET_ADULTS, payload });
};

export const updateRooms = (payload) => (dispatch) => {
  dispatch({ type: SET_ROOMS, payload });
};

export const updateChildren = (payload) => (dispatch) => {
  dispatch({ type: SET_CHILDREN, payload });
};

export const updateInfants = (payload) => (dispatch) => {
  dispatch({ type: SET_INFANTS, payload });
};

export const updatePets = (payload) => (dispatch) => {
  dispatch({ type: SET_PETS, payload });
};

export const updateGuestDetails = (payload) => (dispatch) => {
  dispatch({ type: SET_GUEST_DETAILS, payload });
};

export const updateHotelSelected = (payload) => (dispatch) => {
  dispatch({ type: SET_SELECTED_HOTEL_DATA, payload });
};

export const constructObjForGetHotelById = (payload) => (dispatch) => {
  const {
    from_date,
    to_date,
    no_of_adults,
    room_count,
    no_of_children,
    no_of_infants,
    no_of_pets,
    id,
  } = payload;

  const guest_details = {
    counts: {
      adults: no_of_adults,
      children: no_of_children,
      infants: no_of_infants,
      pets: no_of_pets,
    },
    rooms: room_count,
    totalGuests: no_of_adults + no_of_children + no_of_infants,
    petFeeNote: no_of_pets > 0 ? "Pets may incur an additional fee" : "",
  };

  const obj = {
    from_date,
    to_date,
    room_count,
    no_of_adults,
    no_of_children,
    no_of_infants,
    no_of_pets,
    id,
    guest_details,
    room_info: [
      {
        no_of_adults,
        child_0_to_6: 0,
        child_7_to_12: no_of_children,
        no_of_child: no_of_children,
        no_of_infants,
      },
    ],
  };

  if (room_count > 1) {
    let room_info = [];
    for (let i = 0; i < room_count; i++) {
      let cal = Math.floor(no_of_adults / room_count);
      let num = Math.floor(no_of_children / room_count);
      let infants = Math.floor(no_of_infants / room_count);
      if (i === 0) {
        cal += no_of_adults % room_count;
        num += no_of_children % room_count;
        infants += no_of_infants % room_count;
      }
      room_info.push({
        no_of_adults: cal,
        child_0_to_6: 0,
        child_7_to_12: num,
        no_of_child: num,
        no_of_infants: infants,
      });
    }
    obj.room_info = room_info;
  }

  dispatch({ type: SET_GUEST_DETAILS, payload: guest_details });
  dispatch({ type: DATA_FOR_GET_HOTEL_BY_ID, payload: obj });
};
