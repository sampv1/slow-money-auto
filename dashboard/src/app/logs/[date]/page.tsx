import { redirect } from "next/navigation";

// Daily Logs is on hold — the per-day detail is inaccessible for everyone
// (including admin). Original detail view preserved in git history.
export default function LogDetailPage() {
  redirect("/macro");
}
