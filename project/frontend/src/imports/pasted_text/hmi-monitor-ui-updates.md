HMI Monitor Web UI – Refine Existing Design

Use the three existing reference screens as the base design. Do not redesign the whole interface. Keep the current visual style, layout, sidebar, colors, typography, cards, spacing, and overall industrial HMI monitoring aesthetic.

Make only the following changes.

==================================================
1. DASHBOARD IO – BASED ON IMAGE 1
==================================================

Keep the current Dashboard IO layout.

TOP HEADER
- Keep the machine search box.
- Keep the user/admin information.
- Remove the date and time displayed next to the search box.
- Do not replace it with another date/time element.

OFFLINE MACHINE PANEL
- Keep the Offline machine list on the right side.
- Do not use separate "Offline Since" and "Offline Until" columns.
- Instead, show one column called "Offline".
- Display the offline period directly as a time range.

Example:
M-005 | 08:00 - 10:00

For a machine that is currently offline:
M-005 | 08:00 - Now

If a machine has already reconnected:
M-005 | 08:00 - 10:00

The purpose is to immediately show how long the machine was offline using a simple time range.

MAIN HEATMAP
- Keep the heatmap as the largest and most important element of the Dashboard.
- Support approximately 200 machine tiles.
- Each tile represents one machine.

Status colors:
- Green = Run
- Yellow/Orange = Stop
- Red = Error
- Gray = Offline

Important:
- Run, Stop, and Error are normal machine operating states.
- Offline means the HMI/device is no longer communicating with the server or is turned off.

Keep the four small summary cards:
- Run
- Stop
- Error
- Offline

The summary cards should remain small and should not compete visually with the heatmap.

Clicking a machine tile should open that machine's Machine Detail page.

==================================================
2. MACHINE DETAIL – BASED ON IMAGE 2
==================================================

Keep the existing Machine Detail page style and layout, but redesign the status timeline.

REMOVE THE CURRENT TITLE
- Remove the text "24-Hour Timeline".
- Do not display that phrase anywhere.

DATE SELECTION
- Add a compact date picker/calendar near the timeline.
- The user must be able to select the date to view.
- Do not hard-code the date.

TIMELINE
Create a proper horizontal time chart for the selected date.

The timeline represents 01:00 to 24:00.

Important:
- Time must progress continuously from left to right.
- Do NOT create exactly one equal-sized block for every hour.
- Each colored segment must represent the actual duration of the machine's state.
- The chart should look like a simple horizontal Gantt-style status timeline.

Status colors:
- Green = Run
- Yellow/Orange = Stop
- Red = Error
- Gray = Offline

Show clear hour markers from 1 to 24 along the horizontal axis.

Example concept:
01 ─── Run ───────── Stop ── Error ───────── Run ───
02 ───────── Run ───────────── Error ─────────────
03 ── Offline ─────── Run ────────────────────────
...
24 ───────── Run ───── Stop ──────────────────────

HOVER TOOLTIP
When the user moves the mouse over a colored timeline segment, show a small tooltip containing:
- Status
- Start time
- End time
- Duration

Example:
Status: Error
Start: 08:15:20
End: 08:17:40
Duration: 2m 20s

The user should not need to click to see this information.

LEGEND
Keep a simple legend below the timeline:
- Green – Run
- Yellow/Orange – Stop
- Red – Error
- Gray – Offline

Keep the Machine Detail page simple.

Do NOT add:
- MAC address
- IP address
- Code Version
- HMI Version
- RSSI
- Daily statistics

Those details already belong to the Setup page.

==================================================
3. DEVICE SETUP – BASED ON IMAGE 3
==================================================

Keep the current Setup page layout.

Keep the three statistic cards:
- Connected
- Login
- Total

Keep the existing device management table.

DEVICE SEARCH
The search field must search across all relevant device information.

Searchable fields:
- Machine name
- IP address
- MAC address
- Code Version
- HMI Version
- HMI Login/Logout status

The search should filter the table dynamically.

Examples:
- Searching "M-005" finds the machine.
- Searching "192.168.1.14" finds the corresponding machine.
- Searching a MAC address finds the corresponding machine.
- Searching "v2.5.7" finds machines with that Code Version.
- Searching "HMI-2.0" finds machines with that HMI Version.
- Searching "Login" or "Logout" filters by HMI login state.

STATUS COLUMN
Do NOT display text such as:
- RUN
- STOP
- ERROR
- OFFLINE

Instead, show only a small colored status indicator.

Use:
- Green dot = Run
- Yellow/Orange dot = Stop
- Red dot = Error
- Gray dot = Offline

The Status column should contain only the color indicator.

LOGIN COLUMN
Keep the Login column because it represents the HMI user's login/logout state.

Keep a simple visual representation for:
- Login
- Logout

Do not confuse HMI Login/Logout with the Web administrator login.

KEEP THESE TABLE COLUMNS
- No.
- Machine
- MAC Address
- IP Address
- Code Ver.
- HMI Ver.
- Status
- Login

==================================================
GLOBAL UI REQUIREMENTS
==================================================

Keep the existing visual identity:
- Dark navy left sidebar
- Blue active navigation
- Light gray page background
- White cards
- Clean industrial dashboard appearance
- Green, yellow/orange, red, and gray status colors
- Modern sans-serif typography
- Rounded cards
- Minimal visual decoration

Do not introduce unnecessary pages or features.

The system should remain focused on:
1. Monitoring machine IO status.
2. Identifying offline machines.
3. Viewing the status history of one machine.
4. Managing and searching HMI devices.
5. Viewing HMI Login/Logout status.

Do not add OEE, production management, MES functions, Playback, or unrelated features.