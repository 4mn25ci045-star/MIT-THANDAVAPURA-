# MIT Transit Tracker

Agent















"Develope a college bus tracking application. The app opens with an animated logo of 'MIT Thandavapura' in orange against a black background, with 'Thandavapura' displayed in white underneath.















Access is for authorized college personnel only. Standard users login using their unique USN, starting specifically with '4MN', and must enter a matching 4-digit OTP via the linked phone number for secure access. Initial login can be done via Google.







The 'Travel' tab features a search bar for bus or route number. After searching, it displays real-time tracking on a map, distance left, ETA compared to the user's current location, voice messaging and direct driver call to the driver.







Add real-time bus position updates on the map (polling or WebSocket) so bus markers move smoothly and ETA recalculates automatically.















Add a stop-near notification that alerts me when the tracked bus is within a configurable distance of my stop.















Security tab will open with pin .. if pin is current then open inside gps id and route number then under this save button if save this route number to gps id and it will show in travel tab if search in travel tab route number it will show mentioned about the details



Replace gps id to imei number and replace 4 pin  and convert into password



Implement admin password hashing with secure comparison and add rate limiting for repeated login attempts to the Security tab.



Remove usn login only phone number and Gmail 



Add an Admin password change flow so I can update the hashed password after logging into the Security tab. Don't show any demo password... Password should MITT2026











- When a user selects or searches for a bus number or route number, highlight ONLY that specific bus's complete route in MIT Orange (#FF7900) on the map.



- The selected bus route must be displayed with a bold, clearly visible orange line.



- All other bus routes must remain in their default colours with reduced visual emphasis.



- Show the selected bus's live location using an orange bus marker with a smooth real-time movement animation.



- Display the route's starting point, stops, destination, and direction clearly.



- If the bus moves, update its live marker along the selected route without changing the route's orange colour.



- When the user selects a different bus, remove the previous route's orange highlight and highlight only the newly selected bus route.



- If no bus is selected, display all routes in their normal default style.



- Ensure overlapping routes do not cause every route to turn orange. Only the selected route geometry should be highlighted.



- Preserve existing map functionality, live tracking, search, ETA, distance remaining, and mobile responsiveness.



- Use the existing map provider and project architecture. Do not rebuild the application or change unrelated UI components.



- Connect the highlight to the actual selected bus and route data. Do not use hardcoded sample routes or fake live locations.



- If route data or live GPS coordinates are unavailable, show an appropriate loading or unavailable state instead of displaying a fake route.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ba0f0878-d7e2-488c-a481-d34a684987f0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
