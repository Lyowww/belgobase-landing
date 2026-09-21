export type ContactDeliveryState = {
  success: boolean;
  message: "successMessage" | "errorMessage";
};

export function contactDeliveryState(delivered: boolean): ContactDeliveryState {
  return delivered
    ? { success: true, message: "successMessage" }
    : { success: false, message: "errorMessage" };
}
