import { redirect } from "next/navigation";

/**
 * /fa-scanner has no content of its own — it lands on the manufacturing rubric,
 * which is what the page showed before the split and covers most of the
 * universe. Existing links and bookmarks keep working.
 */
export default function FaScannerIndex() {
  redirect("/fa-scanner/manufacturing");
}
