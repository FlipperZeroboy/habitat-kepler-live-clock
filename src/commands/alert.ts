import { Command } from "commander";
import { createApiClient, type AlertResponse, type AlertsResponse } from "../api-client";
import { printError } from "../cli-utils";

export function createAlertCommand() {
  const apiClient = createApiClient();
  const command = new Command("alert").description("Inspect and acknowledge local operational alerts.");

  command.command("list").description("List persisted alerts and their statuses.").option("--json", "Print alerts as JSON").action(async (options: { json?: boolean }) => {
    try {
      const response = await apiClient.get<AlertsResponse>("/alerts");
      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }
      if (response.alerts.length === 0) {
        console.log("No alerts.");
        return;
      }
      for (const alert of response.alerts) {
        console.log(`${alert.id} | ${alert.status} | ${alert.severity} | ${alert.code} | ${alert.title} | occurrences: ${alert.occurrenceCount}`);
      }
    } catch (error) {
      printError(error);
    }
  });

  command.command("acknowledge").description("Acknowledge one persisted alert.").argument("<alert-id>", "Alert id").action(async (id: string) => {
    try {
      const alert = (await apiClient.post<AlertResponse>(`/alerts/${encodeURIComponent(id)}/acknowledge`, {})).alert;
      console.log(`Acknowledged alert ${alert.id}.`);
    } catch (error) {
      printError(error);
    }
  });

  return command;
}
