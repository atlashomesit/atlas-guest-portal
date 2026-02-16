import axios from "axios";
import {
  GET_HOTEL_FAILURE,
  GET_HOTEL_REQUEST,
  GET_HOTEL_SUCCESS,
} from "./actionTypes";

const BASE_URL = "https://api.ratebotai.com:8443";

// Main Url for Production
const API_GET_HOTEL_SNIPIT_DATA = BASE_URL + "/get_hotel_snipit_data"
// ---------------------------------------

// URL for testing
// const API_GET_HOTEL_SNIPIT_DATA = "http://127.0.0.1:5000/get_hotel_snipit_data";

// the below function purpose is to remove duplicate hotel which are fetched from the data base

function uniqByKeepLast(data, key) {
  return [...new Map(data.map((x) => [key(x), x])).values()];
}
// -----------end of the above function ------------------
export const getHotel =
  (params = { brand_id: 42 }) =>
  async (dispatch) => {
    try {
      dispatch({ type: GET_HOTEL_REQUEST });
      const res = await axios.post(API_GET_HOTEL_SNIPIT_DATA, {
        ...params,
      });
      if (res?.data?.data?.hotel_info?.length > 0) {
        const filteredHotels = uniqByKeepLast(
          res?.data?.data?.hotel_info,
          (it) => it?.combain_name
        );
        dispatch({
          type: GET_HOTEL_SUCCESS,
          payload: {
            data: filteredHotels,
            message: {
              message: res?.data?.message,
              status: res?.data?.status,
              status_message: res?.data?.status_message,
            },
          },
        });
        
      } else {
        dispatch({
          type: GET_HOTEL_SUCCESS,
          payload: {
            data: [],
            message: {
              message: res.data.message,
              status: res.data.status,
              status_message: res.data.status_message,
            },
          },
        });
      }
      
    } catch (err) {
      dispatch({ type: GET_HOTEL_FAILURE });
    }
  };

