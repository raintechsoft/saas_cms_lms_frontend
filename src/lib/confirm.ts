import Swal from "sweetalert2";

export async function confirmDelete(input: {
  title?: string;
  text: string;
  confirmText?: string;
}): Promise<boolean> {
  const result = await Swal.fire({
    title: input.title ?? "Are you sure?",
    text: input.text,
    icon: "warning",
    showCancelButton: true,
    focusCancel: true,
    confirmButtonText: input.confirmText ?? "Yes, delete",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    buttonsStyling: false,
    customClass: {
      popup: "swal-popup",
      title: "swal-title",
      htmlContainer: "swal-text",
      actions: "swal-actions",
      confirmButton: "swal-confirm",
      cancelButton: "swal-cancel",
    },
  });
  return result.isConfirmed;
}
