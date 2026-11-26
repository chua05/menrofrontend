// Step-by-step dashboard tutorials, one per role. Each user only ever sees the guide for their own role.
// Screenshots live in public/tutorial/<role>/ and are regenerated with scripts/capture-tutorial-screenshots.mjs.

const shot = (role, page) => `${import.meta.env.BASE_URL}tutorial/${role}/${page}.jpg`;

const participant = [
  {
    title: "Welcome to your Dashboard",
    image: shot("participant", "dashboard"),
    body: "This is your home page. The cards at the top count your seedling requests, approved requests, planting reports and the trees you have reported planted.",
    tips: [
      "Click any card to open the page behind it.",
      "Use the menu button (☰) at the top left to move between pages.",
      "The bell shows new notifications about your requests and reports.",
    ],
  },
  {
    title: "Request seedlings",
    image: shot("participant", "request-seedlings"),
    body: "Open Request Seedlings to ask MENRO for seedlings. The form has four short steps.",
    tips: [
      "1 Requester & Address, 2 Request Details, 3 Planting Information, 4 Identification & Review.",
      "Fields marked * are required. Press Next to continue to the following step.",
      "Check everything on the review step before you submit.",
    ],
  },
  {
    title: "Track your requests",
    image: shot("participant", "my-requests"),
    body: "My Requests lists every request you have sent and where it is in the process.",
    tips: [
      "Statuses go from Pending Review to Approved, Seedlings Released and Completed.",
      "A Rejected request shows the reason when you open it.",
      "Press the eye icon to see the full details of a request.",
    ],
  },
  {
    title: "Join planting events",
    image: shot("participant", "event-calendar"),
    body: "The Event Calendar shows the tree planting activities MENRO has scheduled.",
    tips: [
      "Click a date to see the events on that day.",
      "The Upcoming Events list on the right shows what is coming next.",
    ],
  },
  {
    title: "Explore planting sites",
    image: shot("participant", "planting-sites"),
    body: "Planting Sites shows the reforestation sites on a map of Bulan's barangays.",
    tips: [
      "Search for a site or barangay, or filter by site status and tree condition.",
      "Click a site on the map to see its details.",
    ],
  },
  {
    title: "Submit planting reports",
    image: shot("participant", "my-planting-reports"),
    body: "After planting, press Submit Planting Report to send photos and details of what you planted.",
    tips: [
      "Reporting Progress shows whether MENRO has received and verified your report.",
      "Reports returned for correction need your changes before they can be verified.",
    ],
  },
  {
    title: "Keep your profile up to date",
    image: shot("participant", "profile"),
    body: "Open your profile from your name at the top right. Your details are used to fill in your requests.",
    tips: [
      "Press Edit Profile to change your contact number, sector or address.",
      "You can reopen this guide any time from the How to use button on your dashboard.",
    ],
  },
];

// Staff and Admin share most pages; the Admin guide adds the pages and decisions only Admins have.
function managementSteps(role) {
  const admin = role === "admin";
  return [
    {
      title: `Welcome to the ${admin ? "Admin" : "Staff"} Dashboard`,
      image: shot(role, "dashboard"),
      body: "The dashboard sums up the whole program: seedlings distributed, participants, trees planted, survival rate and upcoming events.",
      tips: [
        "Use the barangay filter at the top left to focus on one barangay.",
        "Click a summary card to open its page. The map shows every planting site.",
        "Use the menu button (☰) at the top left to move between pages.",
      ],
    },
    {
      title: "Review seedling requests",
      image: shot(role, "requests"),
      body: "Seedling Requests lists every request from participants. The tabs and cards count requests by status.",
      tips: [
        "Press the eye icon to open a request and review it.",
        admin
          ? "Requests reviewed by Staff wait in Awaiting Approval for your final decision."
          : "After your review, the request goes to the Admin for final approval.",
        admin
          ? "Search or filter by barangay, request type and date to find a request quickly."
          : "Press Submit Seedling Request to record a walk-in request for someone at the office.",
      ],
    },
    {
      title: "Manage the seedling inventory",
      image: shot(role, "seedlings"),
      body: "Seedling Inventory keeps the stock of each tree species and the seedlings released to requesters.",
      tips: [
        admin ? "Staff record new stock here; you can review every species and batch." : "Press Add Seedling to record new stock.",
        "Open Distribution Records to see every release.",
        "Current Quantity and Stock Status show what is available for new requests.",
      ],
    },
    {
      title: "Plan planting events",
      image: shot(role, "event-calendar"),
      body: "The Event Calendar holds all scheduled tree planting activities.",
      tips: [
        admin
          ? "Press Add Event to schedule a new activity."
          : "Events are created from approved requests. Click a date to see the events on that day.",
        "The cards at the top count upcoming, ongoing and completed events.",
      ],
    },
    {
      title: "Maintain planting sites",
      image: shot(role, "planting-sites"),
      body: "Planting Sites maps every reforestation site with its capacity and tree condition.",
      tips: [
        "Press Add Planting Site to register a new site.",
        "Filter the map by site status or tree condition.",
      ],
    },
    {
      title: "Check planting reports",
      image: shot(role, "planting-reports"),
      body: "Planting Reports collects the reports participants and staff submit after planting.",
      tips: admin
        ? [
          "Reports reviewed by Staff wait in Pending Verification for you to verify.",
          "Return a report for correction when something needs to be fixed.",
        ]
        : [
          "Open reports in Pending Review to check their photos and details.",
          "Press Submit Planting Report to file a report for MENRO's own planting.",
        ],
    },
    {
      title: "Monitor tree survival",
      image: shot(role, "survival-monitoring"),
      body: "Survival Monitoring tracks how the planted trees are doing over time.",
      tips: [
        admin
          ? "Monitoring results submitted by Staff count in the official survival rate once you approve them."
          : "Press Monitor Planted Trees to record a monitoring visit for a planted site.",
        "The Survival Trend and Monitoring Summary show healthy, damaged and dead trees.",
      ],
    },
    {
      title: "Read the analytics",
      image: shot(role, "reforestation-analytics"),
      body: "Analytics and Visualization turns the records into charts: seedlings distributed, trees planted and survival rate per month.",
      tips: ["Filter by date range, barangay, seedling tree or planting site."],
    },
    {
      title: "See everything on the map",
      image: shot(role, "map-visualization"),
      body: "Map Visualization places every planting site on the map of Bulan with its utilization and tree condition.",
      tips: ["Filter by barangay, site, species or monitoring condition. The legend explains the colors."],
    },
    {
      title: "Generate reports",
      image: shot(role, "reports"),
      body: "Reports creates printable summaries of the program.",
      tips: [
        "Choose a report type, set the date range and press Generate Report.",
        "Earlier reports are listed under Generated Reports for download.",
      ],
    },
    ...(admin
      ? [
        {
          title: "Manage registered users",
          image: shot(role, "registered-users"),
          body: "Registered Users lists every account in the system.",
          tips: [
            "Filter by role, barangay or status, or search by name and email.",
            "Use the actions on each row to view, edit or deactivate an account.",
          ],
        },
        {
          title: "Configure the system",
          image: shot(role, "settings"),
          body: "Settings controls system-wide options such as monitoring thresholds, verification rules and notifications.",
          tips: [
            "Press Save Settings after making changes.",
            "You can reopen this guide any time from the How to use button on your dashboard.",
          ],
        },
      ]
      : []),
  ];
}

export const DASHBOARD_TUTORIALS = {
  participant,
  staff: managementSteps("staff"),
  admin: managementSteps("admin"),
};

export function tutorialStepsForRole(role) {
  return DASHBOARD_TUTORIALS[role] || DASHBOARD_TUTORIALS.participant;
}
