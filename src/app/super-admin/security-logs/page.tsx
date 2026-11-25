import {
  getAuditLogs,
  getSuperAdminConsoleData,
} from "@/application/schools/actions";
import { AuditLogsClient } from "@/components/super-admin/AuditLogsClient";
import { SuperAdminAccessNotice } from "@/components/super-admin/SuperAdminDashboardClient";

export default async function SuperAdminSecurityLogsPage() {
  const [consoleResult, logsResult] = await Promise.all([
    getSuperAdminConsoleData(),
    getAuditLogs({ limit: 50, offset: 0 }),
  ]);

  if (!consoleResult.ok) {
    return (
      <SuperAdminAccessNotice
        errorCode={consoleResult.error.code}
        errorMessage={consoleResult.error.message}
      />
    );
  }

  const initialLogs = logsResult.ok ? logsResult.data : [];

  return (
    <AuditLogsClient
      schools={consoleResult.data.schools}
      initialLogs={initialLogs}
    />
  );
}
