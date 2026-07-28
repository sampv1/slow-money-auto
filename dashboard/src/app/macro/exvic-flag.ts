// Kill switch for the provisional "VN-Index ex-VIC" panel.
//
// Lives in its OWN module, deliberately WITHOUT "use client": a server
// component importing a plain value from a "use client" file gets a client
// reference proxy, not the value — the boolean would read as truthy no matter
// what the env said, and the switch would silently do nothing (verified).
//
// Set NEXT_PUBLIC_EXVIC=0 to hide the panel; pair with MACRO_EXVIC=0 on the
// pipeline side (scripts/macro/vnindex_ex.py) to stop writing its metrics.
export const EXVIC_ENABLED = process.env.NEXT_PUBLIC_EXVIC !== "0";
