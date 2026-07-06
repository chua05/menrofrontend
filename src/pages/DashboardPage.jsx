export default function DashboardPage() {
  const user = JSON.parse(localStorage.getItem("user"));
    return (
    <div>
    <h1>Dashboard</h1>
    <p>{user?.fullName}</p>
    <p>{user?.email}</p>
    <p>{user?.role}</p>
    </div>
    );
    }