import { redirect } from "next/navigation";
import { areCustomEndpointsAllowed } from "open-sse/providers/policy.js";
import ProviderConnectionsPage from "./ProviderConnectionsPage";

// The Models screen replaces the provider list. The connection list stays reachable only
// when custom OpenAI/Anthropic-compatible endpoints are enabled in brand.json.
export default function ProvidersPage() {
  if (!areCustomEndpointsAllowed()) redirect("/dashboard/models");
  return <ProviderConnectionsPage />;
}
