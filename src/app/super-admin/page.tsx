import { getSuperAdminConsoleData } from "@/application/schools/actions";
import {
  SuperAdminAccessNotice,
  SuperAdminDashboardClient,
} from "@/components/super-admin/SuperAdminDashboardClient";

export default async function SuperAdminPage() {
  const result = await getSuperAdminConsoleData();

  if (!result.ok) {
    return (
      <SuperAdminAccessNotice
        errorCode={result.error.code}
        errorMessage={result.error.message}
      />
    );
  }

  return <SuperAdminDashboardClient data={result.data} />;
}
