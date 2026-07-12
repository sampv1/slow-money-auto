import { redirect } from "next/navigation";

// Daily Logs is on hold — hidden and inaccessible for everyone (including
// admin). The full logs list (daily_logs table + summary) is preserved in git
// history for when the feature returns.
export default function LogsPage() {
  redirect("/macro");
}
