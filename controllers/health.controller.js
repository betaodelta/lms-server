import { getDBStatus } from "../database/db.js";

export const checkHealth = async (req, res) => {
  try {
    const dbState = getDBStatus();
    const stateText = getReadyStateText(dbState);
    if (dbState === 1) {
      res.status(200).json({
        status: "OK",
        dbState: stateText,
      });
    } else {
      res.status(503).json({
        status: "Unavailable",
        dbState: stateText,
      });
    }
  } catch (error) {
    console.error("Health check failed", error);
    res.status(500).json({ status: "Error", message: error.message });
  }
};

// This is just one kind of Utility method
function getReadyStateText(state) {
  const states = {
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
  };
  return states[state] || "Unknown";
}
