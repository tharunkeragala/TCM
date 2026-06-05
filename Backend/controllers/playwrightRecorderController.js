const recorder = require("../services/playwrightRecorder");

exports.startRecording = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !String(url).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "URL is required" });
    }

    const sessionId = await recorder.startRecording(String(url).trim());

    res.status(200).json({ success: true, sessionId });
  } catch (err) {
    console.error("START Recorder Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to start recorder",
        error: err.message,
      });
  }
};

exports.stopRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await recorder.stopRecording(id);

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("STOP Recorder Error:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to stop recorder",
        error: err.message,
      });
  }
};
