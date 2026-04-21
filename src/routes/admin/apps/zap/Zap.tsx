import { Routes, Route, Navigate } from "react-router-dom";
import { TripList } from "./TripList";
import { TripDetail } from "./TripDetail";
import { NewReceipt } from "./NewReceipt";
import { EditReceipt } from "./EditReceipt";

export function Zap() {
  return (
    <Routes>
      <Route index element={<TripList />} />
      <Route path=":tripId" element={<TripDetail />} />
      <Route path=":tripId/receipt/new" element={<NewReceipt />} />
      <Route path=":tripId/receipt/:receiptId" element={<EditReceipt />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
