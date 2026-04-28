export default function DashboardLayout({
  userName,
  role,
  menuItems,
  activeMenu,
  onMenuClick,
  children,
}) {
  return (
    <section className="dashboardShell">
      {/* Shared sidebar for all roles; items are injected from DashboardPage. */}
      <aside className="dashboardSidebar">
        <h3 className="dashboardSidebarTitle">Dashboard Menu</h3>
        <nav className="dashboardSidebarNav">
          {menuItems.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onMenuClick(item.id)}
              className={`dashboardMenuButton ${activeMenu === item.id ? 'dashboardMenuButtonActive' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="dashboardMain">
        {/* Shared top area keeps role + welcome consistent across dashboards. */}
        <header className="dashboardHeader">
          <div>
            <p className="dashboardWelcome">Welcome, {userName}</p>
            <h2>Learnify Dashboard</h2>
          </div>
          <span className="dashboardRoleBadge">{role}</span>
        </header>

        <main className="dashboardContent">{children}</main>
      </div>
    </section>
  );
}
