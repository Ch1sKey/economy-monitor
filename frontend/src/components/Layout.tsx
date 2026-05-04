import { NavLink, Outlet } from "react-router-dom";
import { TimeframePicker } from "./TimeframePicker";

const linkCls = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");

export function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>EconomyManager</h1>
        <nav className="nav">
          <NavLink to="/" className={linkCls} end>
            Dashboard
          </NavLink>
          <NavLink to="/players" className={linkCls}>
            Players
          </NavLink>
          <NavLink to="/sankey" className={linkCls}>
            Overall Sankey
          </NavLink>
          <NavLink to="/events" className={linkCls}>
            Raw Events
          </NavLink>
          <NavLink to="/diagnostics" className={linkCls}>
            Diagnostics
          </NavLink>
        </nav>
      </aside>
      <main className="main">
        <TimeframePicker />
        <Outlet />
      </main>
    </div>
  );
}
