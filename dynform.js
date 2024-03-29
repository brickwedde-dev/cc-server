const crypto = require('crypto');
const fs = require('fs').promises;

let isObject = function(a) {
    return (!!a) && (a.constructor === Object);
};

function recurseNames(names, obj) {
  if (obj) {
    if (obj.name) {
      names[obj.name] = obj;
    }
    if (Array.isArray(obj)) {
      for(var i = 0; i < obj.length; i++) {
        recurseNames(names, obj[i]);
      }
    } else if (isObject(obj)) {
      for(var i in obj) {
        recurseNames(names, obj[i]);
      }
    }
  }
}

class DynamicFormPlugin {
  constructor() {
    this.api = new DynamicFormApi(this);
  }

  checksession (oInfo, req, res, user, method) {
    return Promise.resolve();
  }
}

class DynamicFormApi {
  getDefinition(oInfo, formtype) {
    formtype = ("" + formtype).replace(/\.\./g, "_") + ".json";

    return new Promise(async (resolve, reject) => {
      try {
        var formdef = await fs.readFile("../dynform/definition/" + formtype);
        if (formdef) {
          formdef = JSON.parse(formdef);
          resolve(formdef);
        }
      } catch (e) {
      }
      reject("Parameter error");
    });
  }

  load(oInfo, type, formtype, objectid) {
    type = type.replace(/[/\\?%*:|"<>\\.]/g, '-');
    formtype = ("" + formtype).replace(/\.\./g, "_") + ".json";

    return new Promise(async (resolve, reject) => {
      var anonymous = true;
      var formdef = await fs.readFile("../dynform/definition/" + formtype);
      try {
        if (formdef) {
          formdef = JSON.parse(formdef);
        }
      } catch (e) {
      }
      var checksession = true;
      if (formdef) {
        if (formdef.localhost && oInfo.req.socket.remoteAddress == "127.0.0.1") {
          checksession = false;
          anonymous = false;
        } else if (formdef.anonymousload) {
          checksession = false;
        }
      }

      if (checksession) {
        if (!oInfo.session) {
          reject("Cannot load unauthorized");
          return;
        }
        anonymous = false;
      }
      if (objectid) {
        try {
          await fs.mkdir("../dynform/storage/" + type);
        } catch (e) {
        }
  
        try {
          var s = await fs.readFile("../dynform/storage/" + type + "/" + objectid);

          var o1 = JSON.parse(s);

          if (anonymous) {
            var names = {};
            recurseNames(names, formdef);

            for(var i in o1) {
              if (i != "objectid" && !names[i]) {
                delete o1[i];
              }
            }
          }
          resolve(o1);
        } catch (e) {
          reject("Exception " + e);
        }
      }
      reject("Parameter error");
    });
  }

  save(oInfo, type, formtype, obj) {
    type = type.replace(/[/\\?%*:|"<>\\.]/g, '-');
    formtype = ("" + formtype).replace(/\.\./g, "_") + ".json";

    return new Promise(async (resolve, reject) => {
      var anonymous = true;
      var formdef = await fs.readFile("../dynform/definition/" + formtype);
      try {
        if (formdef) {
          formdef = JSON.parse(formdef);
        }
      } catch (e) {
        reject("Form definition error " + e);
        return;
      }
      var checksession = true;
      if (formdef) {
        if (formdef.localhost && oInfo.req.socket.remoteAddress == "127.0.0.1") {
          checksession = false;
          anonymous = false;
        } else {
          if (formdef.anonymoussave) {
            checksession = false;
          } else if (formdef.anonymousnew && !obj.objectid) {
            checksession = false;
          }
        }
      }

      if (checksession) {
        if (!oInfo.session) {
          reject("Cannot save unauthorized");
          return;
        }
        anonymous = false;
      }
      try {
        await fs.mkdir("../dynform/storage/" + type);
      } catch (e) {}

      var saveobj = {};
      if (obj.objectid) {
        try {
          var temp = await fs.readFile("../dynform/storage/" + type + "/" + obj.objectid);
          if (temp) {
            saveobj = JSON.parse(temp);
          }
        } catch (e) {
          console.log ("Exception in save:" + e);
        }
        saveobj.objectid = "" + obj.objectid;
      }
      if (!saveobj.objectid) {
        const hash = crypto.createHash('sha256');
        hash.update("" + new Date().getTime());
        saveobj.objectid = hash.digest('hex');
      }

      var names = {};
      recurseNames(names, formdef);

      for(var i in names) {
        if (i != "objectid")
        saveobj[i] = obj[i];
      }

      if (!saveobj.erfasst) {
        saveobj.erfasst = new Date().getTime();
      }
      if (!saveobj.ablaufdatum) {
        saveobj.ablaufdatum = new Date().getTime() + 3 * 30 * 24 * 60 * 60 * 1000;
      }
      saveobj.bearbeitet = new Date().getTime();

      await fs.writeFile("../dynform/storage/" + type + "/" + saveobj.objectid, JSON.stringify(saveobj));
      
      for(var i in saveobj) {
        if (i != "objectid" && !names[i]) {
          delete saveobj[i];
        }
      }
      resolve(saveobj);
    });
  }

  list(oInfo, type) {
    if (!oInfo.user.features.admin) {
        return Promise.reject("Not Admin!");
    }
    return new Promise(async (resolve, reject) => {

      type = type.replace(/[/\\?%*:|"<>\\.]/g, '-');

      try {
        await fs.mkdir("../dynform/storage/" + type);
      } catch (e) {
      }

      var aFiles = [];
      var dir = await fs.opendir("../dynform/storage/" + type);
      for await (const dirent of dir) {
        try {
          if(dirent.isFile()) {
            aFiles.push(JSON.parse(await fs.readFile("../dynform/storage/" + type + "/" + dirent.name)));
          }
        } catch (e) {
        }
      }
      resolve(aFiles);
    });
  }

  delete(oInfo, type) {
    if (!oInfo.user.features.admin) {
        return Promise.reject("Not Admin!");
    }

    return new Promise(async (resolve, reject, objectid) => {
      type = type.replace(/[/\\?%*:|"<>\\.]/g, '-');
      objectid = objectid.replace(/[/\\?%*:|"<>\\.]/g, '-');
      try {
        await fs.unlink("../dynform/storage/" + type + "/" + objectid);
        resolve(true);
      } catch (e) {
      }
      reject();
    });
  }

  clean (oInfo) {
    if (!oInfo.user.features.admin) {
        return Promise.reject("Not Admin!");
    }
    return new Promise(async (resolve, reject) => {
      type = type.replace(/[/\\?%*:|"<>\\.]/g, '-');
      var aFiles = [];
      var dir = await fs.opendir("../dynform/storage/" + type);
      for await (const dirent of dir) {
        if (!dirent.isFile()) {
          continue;
        }
        var s = await fs.readFile("../dynform/storage/" + type + "/" + dirent.name)
        var o = JSON.parse(s)
        if ((o.ablaufdatum || 0) < now) {
          aFiles.push(o.objectid);
        }
      }
      resolve(aFiles);
    });
  }
}

module.exports = { DynamicFormPlugin };
