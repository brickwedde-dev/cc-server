const fs = require('fs').promises;
const fssync = require('fs');
const crypto = require('crypto');

class StorageFilePlugin {
  constructor(types, options) {
    this.api = new StorageFileApi(this, types, options);
  }

  checksession (oInfo, req, res, user, method) {
    return new Promise((resolve, reject) => {
        resolve(true);
    });
  }
}

class StorageFileApi {
    constructor (plugin, types, options) {
        this.options = options || {};
        this.types = types;
    }

    getDbPath(oInfo, type) {
        if (this.types.indexOf(type) < 0) {
            return undefined;
        }
        var folder = type.replace(/[/\\?%*:|"<>\\.]/g, '-');
        var pathprefix = this.options.pathprefix;
        if(typeof(pathprefix) === "function") {
            pathprefix = pathprefix(oInfo);
        }
        var path = `${pathprefix}/${folder}/`;
        try {
            if (!fssync.existsSync(pathprefix)) {
                fssync.mkdirSync(pathprefix);
            }
            if (!fssync.existsSync(path)) {
                fssync.mkdirSync(path);
            }
        } catch (e) {
        }
        return path;
    }

    listObjects(oInfo, type) {
        var path = this.getDbPath(oInfo, type);
        if (!isDefined(path)) {
            return Promise.reject();
        }
        return new Promise(async (resolve, reject) => {
            try {
                if (oInfo && this.options.checkListPermission) {
                    await this.options.checkListPermission(oInfo, type);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            var aFiles = [];
            var dir = await fs.opendir(path);
            for await (const dirent of dir) {
                try {
                    if(dirent.isFile()) {
                        aFiles.push(JSON.parse(await fs.readFile(path + "/" + dirent.name)));
                    }
                } catch (e) {
                }
            }
            resolve(aFiles);
        });
    }

    getObjectByField(oInfo, type, field, content) {
        var path = this.getDbPath(oInfo, type);
        if (!isDefined(path)) {
            return Promise.reject();
        }
        return new Promise(async (resolve, reject) => {
            try {
                if (oInfo && this.options.checkListPermission) {
                    await this.options.checkListPermission(oInfo, type);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            var aFiles = [];
            var dir = await fs.opendir(path);
            for await (const dirent of dir) {
                try {
                    if(dirent.isFile()) {
                        var obj = JSON.parse(await fs.readFile(path + "/" + dirent.name));
                        if (bj && obj[field] === content) {
                           aFiles.push(obj);
                        }
                    }
                } catch (e) {
                }
            }
            resolve(aFiles);
        });
    }

    addOrUpdateObject(oInfo, type, obj) {
        if (!obj.objectid) {
            return this.addObject(oInfo, type, obj);
        } else {
            return this.updateObject(oInfo, type, obj);
        }
    }

    addObject(oInfo, type, obj) {
        const hash = crypto.createHash('sha256');
        hash.update("" + new Date().getTime());
        obj.objectid = hash.digest('hex');
        return this.updateObject(oInfo, type, obj);
    }

    updateObject(oInfo, type, obj) {
        var path = this.getDbPath(oInfo, type);
        if (!isDefined(path)) {
            return Promise.reject();
        }
        return new Promise(async (resolve, reject) => {
            try {
                if (this.options.checkUpdatePermission) {
                    await this.options.checkUpdatePermission(oInfo, type, obj);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }

            var objectid = obj.objectid.replace(/[/\\?%*:|"<>\\.]/g, '-');
            fs.writeFile(path + "/" + objectid, JSON.stringify(obj))
            .then(() => {
                resolve(obj);
            })
            .catch((e) => {
                reject(e);
            });
        });
    }

    deleteObject(oInfo, type, objId) {
        var path = this.getDbPath(oInfo, type);
        if (!isDefined(path)) {
            return Promise.reject();
        }
        return new Promise(async (resolve, reject, objectid) => {
            try {
                if (this.options.checkDeletePermission) {
                    await this.options.checkDeletePermission(oInfo, type);
                }
            } catch (e) {
                reject("Permission denied")
                return;
            }
            objectid = objectid.replace(/[/\\?%*:|"<>\\.]/g, '-');
            try {
                await fs.unlink(path + "/" + objectid);
                resolve(true);
            } catch (e) {
            }
            reject();
        });
    }
}

module.exports = { StorageFilePlugin };