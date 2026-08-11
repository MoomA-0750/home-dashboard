import type { DashboardLayout } from "@home-dashboard/widget-sdk";

export async function fetchLayout(apiBaseUrl: string): Promise<DashboardLayout> {
  const res = await fetch(`${apiBaseUrl}/api/layout`);
  if (!res.ok) throw new Error(`layout API error: ${res.status}`);
  return res.json();
}

export async function saveLayout(apiBaseUrl: string, layout: DashboardLayout): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/api/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
  if (!res.ok) throw new Error(`layout save error: ${res.status}`);
}
