const { getBearerFromReq } = require("./authsimple.js");

class SsePlugin {
  constructor(api) {
    this.api = api;
    this.api.plugin = this;
  }

  checksession (oInfo, req, res, user, method) {
    return new Promise((resolve, reject) => {
      resolve();
    });
  }
}

module.exports = { SsePlugin };