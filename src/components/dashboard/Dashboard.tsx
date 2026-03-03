import { useState, useCallback, useEffect } from "react";
import Sidebar from "./Sidebar";
import TableViewer from "./TableViewer";
import SQLEditor from "./SQLEditor";
import DataIngestModal from "./DataIngestModal";
import api from "../../utils/api";

interface DashboardProps {
  projectName: string;
  tables: string[];
  onTablesChange: (tables: string[]) => void;
  onBackToProjects: () => void;
}

export default function Dashboard({
  projectName,
  tables,
  onTablesChange,
  onBackToProjects,
}: DashboardProps) {
  const [selectedTable, setSelectedTable] = useState<string | null>(
    tables.length > 0 ? tables[0] : null
  );
  const [activeTab, setActiveTab] = useState<"data" | "sql">("data");
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (tables.length === 0) {
      setSelectedTable(null);
      return;
    }

    if (!selectedTable || !tables.includes(selectedTable)) {
      setSelectedTable(tables[0]);
    }
  }, [tables, selectedTable]);

  const refreshTables = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await api.get("/project/sql/dashboard");
      const rawTables = response.data?.tables ?? [];
      const normalized = rawTables.map((t: unknown) =>
        Array.isArray(t) && t.length > 0 ? String(t[0]) : String(t)
      );
      onTablesChange(normalized);
    } catch (err) {
      console.error("Failed to refresh tables:", err);
    } finally {
      setRefreshing(false);
    }
  }, [onTablesChange]);

  const handleIngestSuccess = () => { refreshTables(); };
  const handleSelectTable = (table: string) => { setSelectedTable(table); setActiveTab("data"); };

  return (
    <div className="h-screen flex overflow-hidden bg-bg-secondary">
      <Sidebar
        projectName={projectName}
        tables={tables}
        selectedTable={selectedTable}
        activeTab={activeTab}
        onSelectTable={handleSelectTable}
        onTabChange={setActiveTab}
        onRefresh={refreshTables}
        onIngestData={() => setShowIngestModal(true)}
        onBackToProjects={onBackToProjects}
        loading={refreshing}
      />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === "data" ? (
          <TableViewer tableName={selectedTable} />
        ) : (
          <SQLEditor />
        )}
      </main>
      {showIngestModal && (
        <DataIngestModal
          onClose={() => setShowIngestModal(false)}
          onSuccess={handleIngestSuccess}
        />
      )}
    </div>
  );
}
