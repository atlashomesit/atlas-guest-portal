import React from "react";

export interface DormMaxStayNoticeProps {
  maxNights: number;
  rollingWindowDays: number;
  requestedNights?: number;
}

export default function DormMaxStayNotice({
  maxNights,
  rollingWindowDays,
  requestedNights,
}: DormMaxStayNoticeProps) {
  if (maxNights <= 0 || rollingWindowDays <= 0) return null;
  const exceeds = typeof requestedNights === "number" && requestedNights > maxNights;

  return (
    <div
      data-testid="hsl036-max-stay-notice"
      role={exceeds ? "alert" : "note"}
      style={{
        background: exceeds ? "#fef2f2" : "#fffbeb",
        border: exceeds ? "1px solid #fecaca" : "1px solid #fde68a",
        color: exceeds ? "#991b1b" : "#92400e",
        borderRadius: 10,
        padding: "12px 14px",
        fontSize: 13,
        margin: "10px 0",
      }}
    >
      <strong>Dorm stay limit:</strong> Guests can stay up to <strong>{maxNights} nights</strong> in any rolling{" "}
      <strong>{rollingWindowDays}-day</strong> period in our dorms.
      {exceeds && ` Your current selection (${requestedNights} nights) exceeds this limit.`}
    </div>
  );
}
