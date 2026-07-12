import { redirect } from "next/navigation";

// The Market analysis page is on hold (hidden for everyone, including admin).
// The homepage now serves the Macro dashboard. The previous market page
// (daily_logs + ResponseViewer) is preserved in git history for when it returns.
export default function HomePage() {
  redirect("/macro");
}
