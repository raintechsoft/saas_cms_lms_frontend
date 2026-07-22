import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export { toast, ToastContainer };

export function notifySuccess(message: string) {
  toast.success(message, { position: "top-right", autoClose: 2800 });
}

export function notifyError(message: string) {
  toast.error(message, { position: "top-right", autoClose: 4000 });
}

export function notifyInfo(message: string) {
  toast.info(message, { position: "top-right", autoClose: 2800 });
}
