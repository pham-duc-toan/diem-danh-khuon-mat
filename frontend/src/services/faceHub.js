import * as signalR from "@microsoft/signalr";

/**
 * Creates a SignalR connection to the FaceHub.
 * Automatically attaches the JWT token for authentication.
 */
export function createFaceHubConnection() {
  const token = localStorage.getItem("token");

  const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/face", {
      accessTokenFactory: () => token || "",
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  return connection;
}
