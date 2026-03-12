# **App Name**: DecentraVote

## Core Features:

- Voter Registration & Login: Secure user registration and authentication for eligible voters, ensuring unique identities and access control using MongoDB for user data.
- Election Creation & Management: Admin interface for creating new elections, defining election titles, candidate lists, and setting active voting periods, stored in MongoDB.
- Cast Vote: Authenticated users can securely cast their vote for a chosen candidate in an active election. The vote submission interacts with the backend's blockchain simulation.
- Secure Vote Ledger: Backend implementation leveraging cryptographic hashing to link and immutably store individual votes, simulating blockchain principles within MongoDB for verifiable integrity.
- Real-time Vote Tally & Results: Display aggregated vote counts for active elections and final, immutable results once an election concludes, ensuring transparency and tamper-detection via the vote ledger.

## Style Guidelines:

- Light color scheme with a primary deep blue (#2673DE) evoking trust and security for key actions and branding. A soft, desaturated off-white background (#EDF1F6) maintains a clean, open feel. An accent purple-blue (#391F7A) is used for secondary interactive elements, providing depth and contrast.
- Headline and body font: 'Inter' (sans-serif), chosen for its modern, neutral, and highly readable design, ensuring clarity for important election information.
- Use clear, concise outline icons for navigation and functional elements (e.g., checkmarks for voting, lock for security, ballot box for elections) to maintain a professional and trustworthy aesthetic.
- A clean, card-based layout for displaying elections and candidates, with clear call-to-action buttons for voting. Responsive design is prioritized to ensure usability across various devices, leveraging Tailwind CSS utilities for consistency and rapid development.
- Subtle, fast animations on vote submission and navigation transitions provide immediate feedback and enhance the user experience without causing delay or distraction.