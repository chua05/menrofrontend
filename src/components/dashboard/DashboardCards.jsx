import {
    FiUsers,
    FiClipboard,
    FiMapPin,
    FiCheckCircle
} from "react-icons/fi";

export default function DashboardCards({ role }) {

    const cards = {

        admin: [

            {
                title: "Registered Users",
                value: "248",
                icon: <FiUsers />,
                color: "green"
            },

            {
                title: "Pending Requests",
                value: "31",
                icon: <FiClipboard />,
                color: "yellow"
            },

            {
                title: "Planting Sites",
                value: "18",
                icon: <FiMapPin />,
                color: "blue"
            },

            {
                title: "Verified Reports",
                value: "152",
                icon: <FiCheckCircle />,
                color: "emerald"
            }

        ],

        staff: [

            {
                title: "Seedling Requests",
                value: "31",
                icon: <FiClipboard />,
                color: "yellow"
            },

            {
                title: "Tree Reports",
                value: "76",
                icon: <FiCheckCircle />,
                color: "green"
            },

            {
                title: "Planting Sites",
                value: "18",
                icon: <FiMapPin />,
                color: "blue"
            },

            {
                title: "Available Seedlings",
                value: "2,420",
                icon: <FiUsers />,
                color: "emerald"
            }

        ],

        volunteer: [

            {
                title: "My Requests",
                value: "4",
                icon: <FiClipboard />,
                color: "yellow"
            },

            {
                title: "Joined Events",
                value: "7",
                icon: <FiUsers />,
                color: "green"
            },

            {
                title: "Submitted Reports",
                value: "5",
                icon: <FiCheckCircle />,
                color: "blue"
            },

            {
                title: "Planting Sites",
                value: "18",
                icon: <FiMapPin />,
                color: "emerald"
            }

        ]

    };

    return (

    <div className="dashboard-cards">

        {cards[role]?.map((card) => (

            <div
                key={card.title}
                className="dashboard-card"
            >

                <div className="card-icon">

                    {card.icon}

                </div>

                <div className="card-title">

                    {card.title}

                </div>

                <div className="card-value">

                    {card.value}

                </div>

            </div>

        ))}

    </div>

);

}