import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { DiagnosticsPage } from "@/pages/DiagnosticsPage";
import { OverallSankeyPage } from "@/pages/OverallSankeyPage";
import { PlayerDetailPage } from "@/pages/PlayerDetailPage";
import { PlayersPage } from "@/pages/PlayersPage";
import { RawEventsPage } from "@/pages/RawEventsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="players/:uuid" element={<PlayerDetailPage />} />
        <Route path="sankey" element={<OverallSankeyPage />} />
        <Route path="events" element={<RawEventsPage />} />
        <Route path="diagnostics" element={<DiagnosticsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
