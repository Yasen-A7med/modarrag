import { getSuperAdminConsoleData } from "@/application/schools/actions";
import { CreateSchoolWizardClient } from "@/components/super-admin/CreateSchoolWizardClient";
import { SuperAdminAccessNotice } from "@/components/super-admin/SuperAdminDashboardClient";

export default async function SuperAdminSchoolsPage() {
  const result = await getSuperAdminConsoleData();

  if (!result.ok) {
    return (
      <SuperAdminAccessNotice
        errorCode={result.error.code}
        errorMessage={result.error.message}
      />
    );
  }

  return <CreateSchoolWizardClient existingSchools={result.data.schools} />;
}
