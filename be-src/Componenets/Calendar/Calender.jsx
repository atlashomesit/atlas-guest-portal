import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { DateRangePicker as DateRange } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import "./Calender.css";
import { updateCalender } from "../../Redux/UserData/action";
import { useDispatch, useSelector } from "../../Redux/simpleStore";

const Calendar = () => {
  // date state
  const [range, setRange] = useState({
    startDate: new Date(),
    endDate: new Date(new Date().valueOf() + 1000 * 3600 * 24),
    key: "selection",
  });

  // open close
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const store = useSelector((store) => store.reducerUserData);

  // get the target element to toggle
  const refOne = useRef(null);

  useEffect(() => {
    const formattedStartDate = format(range.startDate, "yyyy-MM-dd");
    const formattedEndDate = format(range.endDate, "yyyy-MM-dd");
    console.log(formattedStartDate, formattedEndDate);
    console.log(range, "from effect");
    dispatch(updateCalender([formattedStartDate, formattedEndDate]));
    console.log(store);
  }, [range]);

  useEffect(() => {
    // event listeners
    document.addEventListener("keydown", hideOnEscape, true);
    document.addEventListener("click", hideOnClickOutside, true);

    return () => {
      document.removeEventListener("keydown", hideOnEscape, true);
      document.removeEventListener("click", hideOnClickOutside, true);
    };
  }, []);

  // hide dropdown on ESC press
  const hideOnEscape = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Hide on outside click
  const hideOnClickOutside = (e) => {
    if (refOne.current && !refOne.current.contains(e.target)) {
      setOpen(false);
    }
  };

  const handleChange = (date) => {
    setRange({
      startDate: date.selection.startDate,
      endDate: date.selection.endDate,
      key: "selection",
    });
  };

  return (
    <div className="calendarWrap">
      {/* <div>
        <p style={{ fontWeight: "600", marginBottom: "0px" }}>
          From Date - To Date
        </p>
      </div> */}
      <div
        className="inputBox calendar-popup"
        onClick={() => setOpen((open) => !open)}
      >
        {`${format(range.startDate, "EEE d MMM")} - ${format(
          range.endDate,
          "EEE d MMM"
        )}`}
      </div>

      <div ref={refOne}>
        {open && (
          <DateRange
            ranges={[range]}
            onChange={handleChange}
            minDate={new Date()}
            months={1}
            direction="horizontal"
            className="calendarElement"
          />
        )}
      </div>
    </div>
  );
};

export default Calendar;

