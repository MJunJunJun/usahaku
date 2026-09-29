import { Navigate } from "react-router-dom";

// Old tier checkout links now enter the per-website billing flow.
export function PaymentFlow() {
  return <Navigate replace to="/dashboard/subscription" />;
}

export { PaymentDetail } from "./BillingPayment";
